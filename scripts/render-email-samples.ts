// Renders sample emails to docs/design/email-*.html for design review.
// Run: NEXT_PUBLIC_SITE_URL=../../public UNSUBSCRIBE_SECRET=x npx tsx scripts/render-email-samples.ts
// (the site URL points the images at the local public folder so the samples open offline)
import { writeFileSync } from "node:fs";
import { renderEmail } from "../src/lib/email-layout";
import { renderWelcome } from "../src/lib/welcome";
import type { Pick } from "../src/lib/community-picks";

const out = (name: string, r: { html: string; text: string }) => {
  writeFileSync(`docs/design/email-${name}.html`, r.html);
  writeFileSync(`docs/design/email-${name}.txt`, r.text);
};

const pick = (handle: string, name: string, title: string, by: string, image: string): Pick => ({
  itemId: handle,
  workId: null,
  handle,
  name,
  title,
  by,
  category: null,
  imageUrl: `../design/email-covers/${image}`,
  note: null,
  path: `/${handle}`,
});
const picks = [
  pick("sara", "Sara", "Perfect Days", "Wim Wenders", "cover-1.png"),
  pick("andymaarten", "Andy", "The Remains of the Day", "Kazuo Ishiguro", "cover-2.png"),
  pick("mark", "Mark", "In a Landscape", "John Cage", "cover-3.png"),
];
const links = { oneClickUrl: "https://hoshigo.cc/api/unsubscribe?t=sample" };

out("welcome", renderWelcome(1, picks, links, null, "remote"));
out("day-10", renderWelcome(2, [], links, null));
out("day-21", renderWelcome(3, picks, links, "https://hoshigo.cc/invite/sample"));

out(
  "friend-request",
  renderEmail({
    preheader: "Sara would like to be friends on hoshigo.",
    heading: "Sara would like to be friends.",
    paragraphs: [[{ strong: "Sara" }, " asked to be friends on hoshigo. Friends see each other's full page, even when it's private."]],
    button: { label: "See the request", href: "https://hoshigo.cc/friends" },
    footer: "You get an email for each friend request.",
    footerLink: { label: "Turn these off", href: "https://hoshigo.cc/settings" },
  })
);

out(
  "update",
  renderEmail({
    preheader: "hoshigo on your home screen, and adding from any app.",
    heading: "A few new things.",
    paragraphs: [
      [{ strong: "hoshigo as an app." }, " Add it to your home screen and it opens like any other app."],
      [{ strong: "Add from anywhere." }, " Share a link from Spotify or YouTube straight to your page."],
    ],
    button: { label: "Open hoshigo", href: "https://hoshigo.cc/" },
    signature: "Andy",
    footer: "You get a short note when something new arrives, a few times a year.",
    footerLink: { label: "Unsubscribe", href: "https://hoshigo.cc/unsubscribe" },
  })
);
console.log("ok");
