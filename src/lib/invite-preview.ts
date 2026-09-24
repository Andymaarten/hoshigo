import { getProfileCard, inviteHandle } from "@/lib/share";
import { profileMetadata } from "@/lib/profile-metadata";

// Chat apps and social sites fetch a link to draw its preview. They must get a page with
// Open Graph tags instead of the redirect to signup that people get. (iMessage identifies
// as facebookexternalhit/Twitterbot.) Only crawler names: in-app browsers of Snapchat, Viber,
// Facebook and others carry their app name too, and people there must reach signup.
const PREVIEW_BOT =
  /facebookexternalhit|Twitterbot|WhatsApp\/|Slackbot|TelegramBot|Discordbot|LinkedInBot|SkypeUriPreview|Pinterestbot|redditbot|Applebot|Googlebot|Cardyb|Mastodon\/|Iframely|Embedly/i;

export function isPreviewBot(userAgent: string | null): boolean {
  return !!userAgent && PREVIEW_BOT.test(userAgent);
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function invitePreviewResponse(token: string, requestUrl: string): Promise<Response> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(requestUrl).origin).replace(/\/$/, "");
  const handle = await inviteHandle(token);
  const card = handle ? await getProfileCard(handle) : null;

  let title = "You are invited to hoshigo";
  let description = "Keep the handful of things you would give five stars. No ads, no algorithm.";
  let image = `${site}/app-icon`;
  if (card) {
    const meta = profileMetadata(card, "invite");
    title = String(meta.title);
    description = String(meta.description);
    image = `${site}/${card.profile.handle}/card/invite`;
  }

  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="hoshigo">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(`${site}/invite/${token}`)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    ...(card ? [`<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`] : []),
    `<meta name="twitter:card" content="${card ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    `<meta name="robots" content="noindex">`,
  ];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>${tags.join("")}<meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:48px 20px;background:#efe7d8;color:#1d1c1a;font-family:Georgia,serif;text-align:center"><p style="font-size:22px">${esc(title)}</p><p><a href="${esc(`/invite/${token}?go=1`)}" style="display:inline-block;padding:14px 22px;border:2px solid #1d1c1a;color:#1d1c1a;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:700">Continue to hoshigo</a></p></body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
