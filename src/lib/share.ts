import { createClient } from "@/lib/supabase/server";
import type { Category, Item, Profile } from "@/lib/supabase/types";
import { canViewItem, canViewProfileItems, type Viewer } from "@/lib/share-rules";

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
    // Friendship hook: replace `false` with Hana's friendship check (userId, profile.id).
    viewer = { userId, isOwner: userId === profile.id, isFriend: false };
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

  const [{ count: newer }, { data: category }] = await Promise.all([
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .eq("category_id", item.category_id)
      .gt("created_at", item.created_at),
    supabase.from("categories").select("*").eq("id", item.category_id).returns<Category[]>().maybeSingle(),
  ]);

  if (!canViewItem(viewer, newer ?? Infinity)) return null;
  return { kind: "listing", profile, item, category: category ?? null };
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
