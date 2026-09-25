-- Changelog backfill, 22 to 25 September 2026 (no commits on the 21st or 26th in range).
-- Idempotent: an entry is only inserted when no row with the same shipped_on and title exists.
insert into changelog_entries (shipped_on, title, body, audience)
select v.shipped_on::date, v.title, v.body, v.audience
from (values
  ('2026-09-22', 'hoshigo opens its first pages', 'The first real version: your own page for the handful of things you''d give five stars, sorted by category. Paste a link and hoshigo tries to fill in the title, maker and cover.', 'public'),
  ('2026-09-22', 'Films, books and albums, properly recognised', 'Links from IMDb, Spotify, Goodreads, Discogs, Bandcamp, Tidal and more are matched to the real film, book or album. TV, songs, podcasts, places and videos joined the categories.', 'public'),
  ('2026-09-22', 'Edit what you''ve kept', 'Change a title, a photo or a note after adding it. For essays and things, you can choose from the photos found on the page.', 'public'),
  ('2026-09-22', 'Private pages, social links and a new homepage', 'Keep your page for friends only, add links to your other accounts, and meet the new homepage with its field of red stamps.', 'public'),
  ('2026-09-22', 'Signing in, made dependable', 'Forgotten passwords can be reset, and magic links now open the door on every browser.', 'public'),
  ('2026-09-22', 'Security fixes in links and password reset', 'Blocked javascript: URLs in item links and stopped password reset revealing whether an address is registered.', 'internal'),
  ('2026-09-22', 'Canonical works backbone', 'Items resolve against TMDB, MusicBrainz and Open Library into a shared works table with match confidence; reference queries added.', 'internal'),
  ('2026-09-23', 'Friends', 'Ask someone to be your friend, or send an invite link. Friends see everything on each other''s page, and the friends page shows what they added lately.', 'public'),
  ('2026-09-23', 'Share a single hoshigo', 'Every hoshigo has its own page now, with a link preview and a card sized for Instagram stories and posts.', 'public'),
  ('2026-09-23', 'Adding, from anywhere', 'Paste a link or search for it yourself, from any page. Seen something on a friend''s page? Add it to your own in one press.', 'public'),
  ('2026-09-23', 'Richer places and games', 'Places come with their kind, city, website and a photo; games are found through Wikidata; translated film titles are recognised.', 'public'),
  ('2026-09-23', 'Covers in colour', 'Covers now show in calm, slightly muted colour, and categories are ordered by kind: reading, watching, listening, then the rest.', 'public'),
  ('2026-09-23', 'A feedback tab', 'Something unclear or broken? The feedback tab sends a line straight to the people who make hoshigo.', 'public'),
  ('2026-09-23', 'Friend aware row level security', 'Mutual friendships, requests and private profiles enforced in RLS; caller only friend checks and keyset pagination.', 'internal'),
  ('2026-09-23', 'Safer link reading', 'SSRF safe fetching, spacer image rejection, and the language model kept off by default as a last resort classifier.', 'internal'),
  ('2026-09-23', 'Signup and friend request emails', 'The owner is emailed on each signup; friend request emails for users; email environment variables trimmed; test endpoint added and removed.', 'internal'),
  ('2026-09-24', 'A human check at the door', 'Before signing up, you drag five red hoshigos into place. It keeps bots out, never leaves you stuck, and waits for you to continue.', 'public'),
  ('2026-09-24', 'Words, rewritten by hand', 'Every email and most of the site now speak in hoshigo''s own voice, with emails in the same paper and ink design as the site.', 'public'),
  ('2026-09-24', 'A painted homepage', 'The homepage has a new painted hero, with the red hoshigos gently breathing so you know where to press.', 'public'),
  ('2026-09-24', 'Better at finding the right link', 'Each category suggests where to find a link, classical albums match properly, and anything found in a catalogue can be kept without a link.', 'public'),
  ('2026-09-24', 'Works written by the server only', 'The works catalogue is written with the service role, catalogue picks are re-verified, and missing fields are filled.', 'internal'),
  ('2026-09-24', 'Owner tools: backfill and stats', 'An owner only backfill review for missing work links, an owner only stats page, and Vercel Web Analytics.', 'internal'),
  ('2026-09-24', 'Rate limits and preview hardening', 'Feedback is rate limited, invite previews only match real crawlers, and API keys are stripped of stray whitespace.', 'internal'),
  ('2026-09-24', 'Stylesheet brace fix', 'A missing brace in globals.css silently dropped every rule after the homepage width block; restored.', 'internal'),
  ('2026-09-25', 'Someday: a list for your future self', 'Save something from someone else''s hoshigo to watch, read, hear or visit later. When you get to it, mark it Loved it to add it to your page, or Not a hoshigo.', 'public'),
  ('2026-09-25', 'Follow public pages', 'Follow a public page without becoming friends. Profiles show a friends line, with friends you share first.', 'public'),
  ('2026-09-25', 'A new about page', 'The about page is now in our own words, with the same painting as the homepage.', 'public'),
  ('2026-09-25', 'Small things, smoother', 'Logging in takes you straight to your own page, people search ignores accents, friends load ten at a time, and every IMDb link shape is understood.', 'public'),
  ('2026-09-25', 'Owner feedback page', 'Feedback gets a status and notes on an owner page, with JSON export and a status migration.', 'internal'),
  ('2026-09-25', 'Friends are not followers', 'A trigger removes follows when a friendship is accepted; someday keeps its history instead of deleting rows.', 'internal')
) as v(shipped_on, title, body, audience)
where not exists (
  select 1 from changelog_entries c where c.shipped_on = v.shipped_on::date and c.title = v.title
);
