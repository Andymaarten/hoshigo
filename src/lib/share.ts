import { createClient } from "@/lib/supabase/server";
import type { Category, Item, Profile } from "@/lib/supabase/types";
import { canViewItem, canViewProfileItems, type Viewer } from "@/lib/share-rules";
import { friendStateWith } from "@/lib/friends";

export const SHARE_FORMATS = {
  og: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
  portrait: { width: 1080, height: 1350 },
} as const;
export type ShareFormat = keyof typeof SHARE_FORMATS;

export type SharedListing = { kind: "listing"; profile: Profile; item: Item; category: Category | null };
export type PrivateProfile = { kind: "private"; profile: Profile };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `asViewer: "public"` is for share images and metadata: crawlers and chat apps fetch them
// without cookies, so they must never show more than an anonymous visitor could see.
// The database policies enforce the same rules; this check keeps us correct regardless.
export async function getSharedListing(
  handle: string,
  itemId: string,
  asViewer: "request" | "public" = "request"
): Promise<SharedListing | PrivateProfile | null> {
  if (!UUID.test(itemId)) return null;
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("*").eq("handle", handle).returns<Profile[]>().maybeSingle();
  if (!profile) return null;

  let viewer: Viewer = { userId: null, isOwner: false, isFriend: false };
  if (asViewer === "request") {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? null;
    const isFriend = !!userId && userId !== profile.id && (await friendStateWith(supabase, userId, profile.id)) === "friends";
    viewer = { userId, isOwner: userId === profile.id, isFriend };
  }

  // Decided before looking the item up, so a private profile doesn't reveal which ids exist.
  if (!canViewProfileItems(viewer, profile.is_private)) return { kind: "private", profile };

  const { data: item } = await supabase
    .from("items")
    .select("*")
    .eq("id", itemId)
    .eq("profile_id", profile.id)
    .returns<Item[]>()
    .maybeSingle();
  if (!item) return null;

  // The public window is "the pinned listing first, then the newest". `pinned` may not exist
  // yet (before that migration), so it is read defensively and the pin query may just fail.
  const isPinned = (item as Item & { pinned?: boolean }).pinned === true;
  const [{ count: newer }, { data: category }, pinnedOther] = await Promise.all([
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .eq("category_id", item.category_id)
      .gt("created_at", item.created_at),
    supabase.from("categories").select("*").eq("id", item.category_id).returns<Category[]>().maybeSingle(),
    isPinned
      ? Promise.resolve({ data: null })
      : supabase
          .from("items")
          .select("created_at")
          .eq("profile_id", profile.id)
          .eq("category_id", item.category_id)
          .eq("pinned", true)
          .neq("id", item.id)
          .limit(1)
          .returns<{ created_at: string }[]>(),
  ]);

  // A newer pinned listing is already counted in `newer`; only an older one pushes this one down.
  const pin = pinnedOther.data?.[0];
  let rank = isPinned ? 0 : (newer ?? Infinity);
  if (pin && pin.created_at <= item.created_at) rank += 1;

  if (!canViewItem(viewer, rank)) return null;
  return { kind: "listing", profile, item, category: category ?? null };
}

export type ProfileCard = { profile: Profile; coverUrls: string[] };

// What a link preview of someone's page may show: always what an anonymous visitor sees,
// so a private page gives name and bio only, and a public one only covers inside the
// public window of each category.
export async function getProfileCard(handle: string): Promise<ProfileCard | null> {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("handle", handle).returns<Profile[]>().maybeSingle();
  if (!profile) return null;
  const anonymous: Viewer = { userId: null, isOwner: false, isFriend: false };
  if (!canViewProfileItems(anonymous, profile.is_private)) return { profile, coverUrls: [] };

  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(60)
    .returns<(Item & { pinned?: boolean })[]>();

  // Pinned listings lead their category's public window, so they are ranked first.
  const ordered = [...(items ?? [])].sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true));
  const rank = new Map<number, number>();
  const coverUrls: string[] = [];
  for (const it of ordered) {
    const r = rank.get(it.category_id) ?? 0;
    rank.set(it.category_id, r + 1);
    if (it.image_url && canViewItem(anonymous, r) && coverUrls.length < 5) coverUrls.push(it.image_url);
  }
  return { profile, coverUrls };
}

// Invite tokens are secrets that let someone befriend the inviter, so the preview only
// resolves them to a handle (via a narrow database function) and shows that person's
// public card. Returns null before the migration has run.
export async function inviteHandle(token: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_preview_handle", { invite_token: token });
  if (error || typeof data !== "string") return null;
  return data;
}

export function sharePath(handle: string, itemId: string) {
  return `/${handle}/${itemId}`;
}

export function shareImagePath(handle: string, itemId: string, format: ShareFormat) {
  return `/${handle}/${itemId}/card/${format}`;
}

export function excerpt(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "")}…`;
}
