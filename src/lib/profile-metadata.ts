import type { Metadata } from "next";
import { excerpt, type ProfileCard } from "@/lib/share";
import { SHARE_FORMATS } from "@/lib/share";

export function profileMetadata(card: ProfileCard, variant: "profile" | "invite"): Metadata {
  const { profile } = card;
  const name = profile.display_name || profile.handle;
  const title = variant === "invite" ? `${name} invites you to be friends on hoshigo` : `${name} · hoshigo`;
  const bio = excerpt(profile.bio, 160);
  const description =
    variant === "invite"
      ? `${bio ? `${bio} ` : ""}Open the link to keep your own five stars and see each other's.`
      : bio || `The handful of things ${name} would give five stars.`;
  const image = { url: `/${profile.handle}/card/${variant}`, ...SHARE_FORMATS.og, alt: name };
  return {
    title,
    description,
    openGraph: { type: "profile", siteName: "hoshigo", title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
