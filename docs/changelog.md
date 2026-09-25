# Changelog

What changed on hoshigo, newest first. Public entries appear on the site and in
"new on hoshigo" emails; internal ones are for us. Source of truth: the
`changelog_entries` table (backfill in `docs/migrations/2026-09-26-changelog-backfill.sql`).

## 2026-09-25

- **Someday: a list for your future self** (public). Save something from someone else's hoshigo to watch, read, hear or visit later. When you get to it, mark it Loved it to add it to your page, or Not a hoshigo.
- **Follow public pages** (public). Follow a public page without becoming friends. Profiles show a friends line, with friends you share first.
- **A new about page** (public). The about page is now in our own words, with the same painting as the homepage.
- **Small things, smoother** (public). Logging in takes you straight to your own page, people search ignores accents, friends load ten at a time, and every IMDb link shape is understood.
- **Owner feedback page** (internal). Feedback gets a status and notes on an owner page, with JSON export and a status migration.
- **Friends are not followers** (internal). A trigger removes follows when a friendship is accepted; someday keeps its history instead of deleting rows.

## 2026-09-24

- **A human check at the door** (public). Before signing up, you drag five red hoshigos into place. It keeps bots out, never leaves you stuck, and waits for you to continue.
- **Words, rewritten by hand** (public). Every email and most of the site now speak in hoshigo's own voice, with emails in the same paper and ink design as the site.
- **A painted homepage** (public). The homepage has a new painted hero, with the red hoshigos gently breathing so you know where to press.
- **Better at finding the right link** (public). Each category suggests where to find a link, classical albums match properly, and anything found in a catalogue can be kept without a link.
- **Works written by the server only** (internal). The works catalogue is written with the service role, catalogue picks are re-verified, and missing fields are filled.
- **Owner tools: backfill and stats** (internal). An owner only backfill review for missing work links, an owner only stats page, and Vercel Web Analytics.
- **Rate limits and preview hardening** (internal). Feedback is rate limited, invite previews only match real crawlers, and API keys are stripped of stray whitespace.
- **Stylesheet brace fix** (internal). A missing brace in globals.css silently dropped every rule after the homepage width block; restored.

## 2026-09-23

- **Friends** (public). Ask someone to be your friend, or send an invite link. Friends see everything on each other's page, and the friends page shows what they added lately.
- **Share a single hoshigo** (public). Every hoshigo has its own page now, with a link preview and a card sized for Instagram stories and posts.
- **Adding, from anywhere** (public). Paste a link or search for it yourself, from any page. Seen something on a friend's page? Add it to your own in one press.
- **Richer places and games** (public). Places come with their kind, city, website and a photo; games are found through Wikidata; translated film titles are recognised.
- **Covers in colour** (public). Covers now show in calm, slightly muted colour, and categories are ordered by kind: reading, watching, listening, then the rest.
- **A feedback tab** (public). Something unclear or broken? The feedback tab sends a line straight to the people who make hoshigo.
- **Friend aware row level security** (internal). Mutual friendships, requests and private profiles enforced in RLS; caller only friend checks and keyset pagination.
- **Safer link reading** (internal). SSRF safe fetching, spacer image rejection, and the language model kept off by default as a last resort classifier.
- **Signup and friend request emails** (internal). The owner is emailed on each signup; friend request emails for users; email environment variables trimmed; test endpoint added and removed.

## 2026-09-22

- **hoshigo opens its first pages** (public). The first real version: your own page for the handful of things you'd give five stars, sorted by category. Paste a link and hoshigo tries to fill in the title, maker and cover.
- **Films, books and albums, properly recognised** (public). Links from IMDb, Spotify, Goodreads, Discogs, Bandcamp, Tidal and more are matched to the real film, book or album. TV, songs, podcasts, places and videos joined the categories.
- **Edit what you've kept** (public). Change a title, a photo or a note after adding it. For essays and things, you can choose from the photos found on the page.
- **Private pages, social links and a new homepage** (public). Keep your page for friends only, add links to your other accounts, and meet the new homepage with its field of red stamps.
- **Signing in, made dependable** (public). Forgotten passwords can be reset, and magic links now open the door on every browser.
- **Security fixes in links and password reset** (internal). Blocked javascript: URLs in item links and stopped password reset revealing whether an address is registered.
- **Canonical works backbone** (internal). Items resolve against TMDB, MusicBrainz and Open Library into a shared works table with match confidence; reference queries added.
