// Renders sample emails to docs/design/email-*.html for design review.
// Run: npx tsx scripts/render-email-samples.ts
import { writeFileSync } from "node:fs";
import { renderEmail } from "../src/lib/email-layout";

const out = (name: string, r: { html: string; text: string }) => {
  writeFileSync(`docs/design/email-${name}.html`, r.html);
  writeFileSync(`docs/design/email-${name}.txt`, r.text);
};

out(
  "welcome",
  renderEmail({
    preheader: "Your page is ready for the first few things you'd give five stars.",
    heading: "Welcome to hoshigo.",
    paragraphs: [
      "Your page is ready. It holds only what you'd give five stars, so there's no rush to fill it.",
      "Start with one: the film you still think about, or the book you keep lending out.",
    ],
    button: { label: "Add your first hoshigo", href: "https://hoshigo.cc/" },
    community: {
      heading: "Kept by others this week",
      picks: [
        { title: "Perfect Days", by: "Wim Wenders, 2023", owner: "Sara", note: "Watch it on a slow Sunday.", href: "https://hoshigo.cc/sara", image: "email-covers/cover-1.png" },
        { title: "The Remains of the Day", by: "Kazuo Ishiguro", owner: "Andy", href: "https://hoshigo.cc/andymaarten", image: "email-covers/cover-2.png" },
        { title: "In a Landscape", by: "John Cage, played by Stephen Drury", owner: "Mark", note: "For writing late at night.", href: "https://hoshigo.cc/mark", image: "email-covers/cover-3.png" },
      ],
    },
    signature: "Hoshi",
    footer: "You're getting this because you just made a hoshigo.",
  })
);

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
    preheader: "Three small things, and hoshigo on your home screen.",
    heading: "A few new things.",
    paragraphs: [
      [{ strong: "hoshigo as an app." }, " Add it to your home screen and it opens like any other app, without the browser around it."],
      [{ strong: "Add from anywhere." }, " Share a link from Spotify or YouTube straight to your page."],
      [{ strong: "Someday." }, " A quiet list for tips you haven't tried yet."],
    ],
    button: { label: "Open hoshigo", href: "https://hoshigo.cc/" },
    signature: "Andy",
    footer: "You get a short note when something new arrives, a few times a year.",
    footerLink: { label: "Unsubscribe", href: "https://hoshigo.cc/unsubscribe" },
  })
);
console.log("ok");
