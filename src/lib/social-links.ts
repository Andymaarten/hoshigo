import type { SocialLink } from "@/lib/supabase/types";

export const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram", prefix: "https://instagram.com/" },
  { id: "x", label: "X / Twitter", prefix: "https://x.com/" },
  { id: "substack", label: "Substack", prefix: "" },
  { id: "letterboxd", label: "Letterboxd", prefix: "https://letterboxd.com/" },
  { id: "linkedin", label: "LinkedIn", prefix: "https://linkedin.com/in/" },
  { id: "website", label: "Website", prefix: "" },
] as const;

export type SocialPlatformId = (typeof SOCIAL_PLATFORMS)[number]["id"];

export function platformLabel(id: string): string {
  return SOCIAL_PLATFORMS.find((p) => p.id === id)?.label ?? id;
}

/** Derives a canonical URL for a given platform + raw handle string. */
export function deriveSocialUrl(platform: string, rawHandle: string): string {
  const handle = rawHandle.trim().replace(/^@/, "");
  if (platform === "website") {
    return /^https?:\/\//i.test(handle) ? handle : `https://${handle}`;
  }
  if (platform === "substack") {
    if (/^https?:\/\//i.test(handle)) return handle;
    return `https://${handle}.substack.com`;
  }
  const meta = SOCIAL_PLATFORMS.find((p) => p.id === platform);
  return `${meta?.prefix ?? ""}${handle}`;
}

/** Parses and sanitizes the JSON payload sent from SocialLinksEditor's hidden input. */
export function parseSocialLinksPayload(raw: string | null | undefined): SocialLink[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: SocialLink[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const platform = String((entry as Record<string, unknown>).platform ?? "").trim();
    const handle = String((entry as Record<string, unknown>).handle ?? "").trim();
    if (!platform || !handle) continue;
    out.push({ platform, handle: handle.replace(/^@/, ""), url: deriveSocialUrl(platform, handle) });
    if (out.length >= 6) break;
  }
  return out;
}
