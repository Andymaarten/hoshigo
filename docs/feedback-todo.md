# Feedback to do

Source: the `feedback` table (20 messages, 24 to 25 September 2026). Each item lists the feedback ids it came from (first 8 characters) so we can mark them `done`, `planned` or `wontfix` on /admin/feedback when handled.

## 1. Bugs (real users hit these)

| # | Item | From | Status |
|---|---|---|---|
| B1 | Pasting an IMDb link doesn't work for a user (gon1999, /gon1999) | 25 Sep 09:41 | open |
| B2 | Find people is not accent insensitive: "Romee" doesn't find "Romée" | 25 Sep 10:06 | open |
| B3 | "The red button does not work" (owner, 24 Sep 08:27, probably before the add flow rework; verify) | 24 Sep 08:27 | verify |
| B4 | Sharing a listing from a private profile via WhatsApp shows no photo (Freaks and Geeks, markdekwaasteniet). Currently by design: private profiles give no public preview. Decide: allow a preview image for friends only is impossible (WhatsApp fetches anonymously), so either keep as is or allow cover only | 24 Sep 15:25 | decide |

## 2. Quick wins (small, clear)

| # | Item | From |
|---|---|---|
| Q1 | Red stamp: back to "press here to **add** a hoshigo" (owner: "keep" feels odd when you're adding), text 5 to 10% larger | 25 Sep 08:48 |
| Q2 | New people with nothing yet: clearer hint on their own page how to add. Empty state copy: "You haven't added any hoshigos yet. Press the red button to add your first!" | 25 Sep 08:48, 11:14 |
| Q3 | Nav order: Log out last (rightmost): My hoshigo, Friends, Explore, Log out | 25 Sep 11:10 |
| Q4 | Footer isn't recognised as a footer. Repeat the navigation there: About hoshigo, My hoshigo, Edit profile, Inspiration, Friends, Explore, Log out | 24 Sep 19:57, 25 Sep 08:50 |
| Q5 | The homepage / manifesto must be reachable when logged in (today logged in users are redirected from / to their own page) | 24 Sep 16:29 |
| Q6 | Places: when a place is found, put its website link straight into the link field (visible, editable) | 24 Sep 16:12 |
| Q7 | Gentle nudge when saving without a note: "Are you sure you want to keep this without a note? Notes make them more personal." | 24 Sep 17:29 |

## 3. Features (bigger, worth a design pass first)

| # | Item | From |
|---|---|---|
| F1 | **Wishlist / save for later**: on someone else's listing, "Save for later" (instead of or next to "Add to my hoshigo"). A list of everything you want to watch, read, do, with filters, showing who it came from (link to their listing) and which other friends have it as a hoshigo | 25 Sep 08:40 |
| F2 | **Inspiration**: curated public profiles people can stumble upon (an owner set "featured" flag), a page in the nav | 24 Sep 16:32, 25 Sep 08:50 |
| F3 | **Enrichment**: add platform links in the background when people give none (books to Goodreads, films to Letterboxd, music to Spotify); a preference per person for their platforms (Apple Music vs Spotify, IMDb vs Letterboxd) so links open where they live | 25 Sep 08:37 |
| F4 | **Weekly email**: your friends' newest hoshigos, first few shown, "log in for more", plus a nudge to add your own | 24 Sep 18:00 |
| F5 | **Changelog**: keep a dated record of what changes on the site, to send "new on hoshigo" emails to the community | 25 Sep 08:44 |
| F6 | Better Qobuz support | 24 Sep 16:07 |
| F7 | Gamify adding? (open question; conflicts with the anti engagement stance, discuss first) | 24 Sep 18:00 |

## 4. Answered or done

| Item | Status |
|---|---|
| See someone's friends on their profile (25 Sep 10:01) | done: friends line on profiles, live 25 Sep |
| "Can you see who sends this? Is it tied to the account?" (a user, 24 Sep 17:19) | answer: yes, feedback is stored with the sender's account (handle), visible only to the owner |
