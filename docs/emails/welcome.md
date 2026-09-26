# Welcome emails

Three short notes for new people, sent by behaviour. Each is a message from
Hoshi: a small signed note, not a newsletter. Written 2026-09-26 by Yuki.

Hoshi in these notes: the only place Hoshi writes in the first person, as a
signed note (see "Hoshi" in `docs/voice.md`). Short, dry, fond. No
exclamation marks, and Hoshi never asks for anything more than one small
thing.

Every email opens with the same motif, set above the heading:

> hoshigo · 星五 · five stars

And ends with the signature, then the community block, then the footer.

> Hoshi

---

## Day 4 — your first five

**Send when:** day 4 after signup, only if they have fewer than 3 hoshigos.

- **Subject:** Your first five
- **Preheader:** A page takes only a handful. Here is the quickest way to add one.
- **Heading:** Room for a few more.

**Body:**

> Your page has a few empty shelves. That's how every notebook starts.
>
> The quickest way to add a hoshigo: copy a link from Spotify, IMDb or anywhere at all, and paste it into hoshigo. I'll try to fill in the rest. On your phone, the "Add to hoshigo" shortcut in the share sheet does the same from any app.
>
> No hurry. Only the ones you'd give five stars.
>
> Hoshi

- **Button:** Add a hoshigo → `/{handle}?add=1` (opens the add dialog on their page)

---

## Day 10 — hoshigo, one tap away

**Send when:** day 10, only if they have never opened hoshigo as an installed app.

- **Subject:** hoshigo, one tap away
- **Preheader:** Put hoshigo on your home screen, and add from any app.
- **Heading:** A place on your home screen.

**Body:**

> The best things turn up when you're not looking: a song in a café, a book on a friend's shelf.
>
> Put hoshigo on your home screen and it's one tap away when they do. Then you can add from any app, straight from the share sheet. It takes a minute to set up; I timed it.
>
> Hoshi

- **Button:** Put hoshigo on my phone → `https://hoshigo.cc/app`

---

## Day 21 — from the community

**Send when:** day 21, always.

- **Subject:** From the community
- **Preheader:** A few things other people would give five stars, and a link for a friend.
- **Heading:** What others are keeping.

**Body:**

> Three weeks in. By now you know the feeling: a page that says something true about you, readable in thirty seconds.
>
> The best part of hoshigo is other people's pages. Below are a few things kept this week, by hand, by real people.
>
> And if someone comes to mind whose five stars you'd like to see, here is your invite link. Whoever opens it becomes your friend straight away.
>
> Hoshi

- **Button:** Invite a friend → their personal invite link (`/invite/{token}`)
- Below the button, the link printed in full, small, for copying into a message.

---

## The community block (all three emails)

Filled automatically by Hana with 2 or 3 picks.

- **Heading:** from the community
- **Intro:** A few things other people would give five stars this week.

Each pick, in this order and format:

> **{title}**, {by}
> kept by {name}
> "{note}" (only when the note is short, roughly under 120 characters; otherwise leave it out)

The title links to the listing on the person's page. No stars, no counts.

---

## Shared footer

> You get these notes because you started a hoshigo page. [Stop these emails](/settings#updates) or [unsubscribe in one tap]({oneTapUnsubscribeUrl}).

Plain text version:

> You get these notes because you started a hoshigo page.
> Stop these emails: https://hoshigo.cc/settings#updates
> Unsubscribe in one tap: {oneTapUnsubscribeUrl}

The one tap link should also go in the `List-Unsubscribe` and
`List-Unsubscribe-Post` headers, so mail apps can show their own button.
