# SEO audit of hoshigo.cc

Sora, 28 September 2026. Based on the code on `origin/staging` and the live site (curl, plus Lighthouse 12 run locally with mobile emulation). No code changed in this round; each fix below says where it would go.

## Summary

hoshigo is small, so search traffic matters less than friends sharing links. The basics still matter for two reasons: people will google "hoshigo" after hearing about it, and link previews (WhatsApp and others) read the same tags. Three problems are worth fixing now; the rest can wait.

| Priority | Issue | Effort |
|---|---|---|
| P1 | Canonical and OG URLs point to `hoshigo.cc`, which redirects to `www.hoshigo.cc` | Tiny (env var) |
| P1 | No `robots.txt` and no `sitemap.xml`; both requests fall into the `[handle]` route as a 404 page | Small |
| P1 | Private profiles expose name and bio to search engines, with no `noindex` | Small |
| P2 | Homepage has no `<h1>` and no canonical; /about and /pricing reuse the site wide title and description | Small |
| P2 | Mobile speed: LCP 5.3 s (home) and 5.8 s (profile); a profile page weighs 3.9 MB | Medium |
| P2 | No structured data | Small |
| P3 | /login is indexable; listing pages are thin as separate search results | Small |
| Decide | Should public pages be in search engines at all, and who decides? | Owner decision |

## Findings

### P1. Canonical host mismatch

- `https://hoshigo.cc/` answers 308 to `https://www.hoshigo.cc/`. Vercel has **www** as the primary domain.
- The pages say the opposite. On /andymaarten: `<link rel="canonical" href="https://hoshigo.cc/andymaarten">`. The og:image on every page is `https://hoshigo.cc/opengraph-image?...`. The homepage og:url is `https://www.hoshigo.cc` (set by hand in `src/app/page.tsx`).
- The cause: `metadataBase` in `src/app/layout.tsx` is `NEXT_PUBLIC_SITE_URL || "https://hoshigo.cc"`, and production evidently uses the apex.
- Why it matters: a canonical that redirects is a mixed signal to Google. Every preview image costs crawlers an extra redirect hop, which some previewers drop.
- **Fix:** set `NEXT_PUBLIC_SITE_URL=https://www.hoshigo.cc` in Vercel production and preview settings, and change the fallback in `layout.tsx` to the www URL. The alternative is making the apex primary in Vercel, but pick one and use it everywhere. The share cards, invite previews and emails use the same variable (`notify-signup.ts` already falls back to www), so this also makes them consistent.

### P1. robots.txt and sitemap.xml missing

- `/robots.txt` and `/sitemap.xml` return 404, rendered by `[handle]` as a profile called "robots.txt" (the 404 page carries `noindex`, so no harm, but crawlers get no guidance).
- **Fix:** add `src/app/robots.ts` (the Next metadata file convention). Allow `/`; disallow `/api/`, `/admin`, `/stats`, `/settings`, `/friends`, `/someday`, `/add`, `/invite/`, `/auth/`, `/onboarding`, `/reset-password`, `/unsubscribe`, `/login`, and `/*/card/` (the share images); point to the sitemap.
- Add `src/app/sitemap.ts` listing `/`, `/about` and `/app`, plus public profiles that allow indexing (see the decision below). Use `lastModified` from the newest visible item. Leave listing pages out for now.
- Check that `robots`, `sitemap` and other file names are on the reserved handle list in onboarding, so nobody can register them.

### P1. Private profiles are indexable

- `src/app/[handle]/layout.tsx` builds metadata from `getProfileCard`. For a private profile it returns name and bio, with no `robots` rule. The page itself shows name, bio and an Add friend button. So Google can index "Name · hoshigo" plus the bio of someone who chose to be private.
- **Fix:** in `generateMetadata`, return `robots: { index: false, follow: false }` when `profile.is_private`, and leave private profiles out of the sitemap. Keep the link preview; WhatsApp ignores `noindex`, and the preview only shows name and bio, which the owner already accepted for private pages.

### P2. Titles, headings and descriptions

| Page | Title | Description | H1 |
|---|---|---|---|
| / | hoshigo | own | **none** |
| /about | hoshigo (same as root) | root default | yes |
| /pricing | hoshigo (same as root) | root default | ? |
| /app | hoshigo as an app | own | yes |
| /andymaarten | Andreas · hoshigo | the bio | 1 |
| /login | Log in · hoshigo | root default | none |

- Homepage: give the big wordmark or the prompt a real `<h1>` (it can stay visually identical), and add `alternates.canonical: "/"`.
- Homepage title: search results would read better as "hoshigo · keep the handful of things you'd give five stars" (under 60 characters). The og:title can stay "hoshigo".
- /about: its own title ("what we're about · hoshigo") and a description taken from the about text.
- Profile description: when there's no bio, it falls back to "The handful of things Name would give five stars." That's good.
- Consider titles like "Andreas's five stars · hoshigo": it says what the page is to someone who has never heard of hoshigo.

### P2. Speed

Lighthouse mobile lab data, not field data (Vercel Speed Insights would give field data):

| Page | Performance | FCP | LCP | CLS | Weight |
|---|---|---|---|---|---|
| / | 71 | 3.7 s | 5.3 s | 0 | 1.05 MB |
| /andymaarten | 69 | 3.8 s | 5.8 s | 0 | 3.9 MB |

The server answers fast (70 ms), and layout doesn't shift. Two things account for most of the delay:

1. **Cover images at full size.** Profile covers load straight from Goodreads and Amazon, or through `/api/img` without resizing. Only TMDB gets a size parameter. Lighthouse estimates 3.2 MB of savings. The fix is to resize in `/api/img` (sharp is already available; see `share-card.tsx`) to 2× the thumb size, serve WebP, and route all external covers through it or through `next/image` with remote patterns.
2. **A render-blocking Google Fonts stylesheet** for Shippori Mincho, which is used only for the glyphs 星五. Self-host a subset (the share cards already ship `assets/fonts/ShipporiMincho-Bold-subset.ttf`, 2 KB) or add `&text=星五` to the CSS URL and `display=swap`.

Also: 84 KB of unused JavaScript and 59 KB of unused CSS. These are minor.

### P2. Structured data

Nothing today. Add JSON-LD:

- On `/`: `WebSite` with name "hoshigo" and url, plus `Organization` with logo (the icon).
- On public profiles: `ProfilePage` whose `mainEntity` is a `Person` with `name` and `url`, and optionally an `ItemList` of the visible hoshigos (name, and `url` pointing at the listing). No email, no location, nothing not already on the page.

This gives Google a correct name and site name, and the site name shows in results as "hoshigo" rather than the domain.

### P3. Smaller items

- `/login` should be `noindex` (thin page). `/explore` redirects to login when logged out, which is fine.
- Listing pages (`/handle/uuid`) have proper titles, descriptions and canonicals, and give 404 plus `noindex` when not public. Good. As search results they are thin (one cover, one note), so mark them `noindex, follow` for now. They remain perfect link previews; `noindex` doesn't affect sharing.
- `html lang="en"`: correct for UI copy. Dutch notes won't hurt.
- Register the site in Google Search Console and Bing Webmaster Tools (DNS verification on the domain), submit the sitemap, and watch "Pages" for errors. It's free and shows how people search for hoshigo.
- OG cards: fine on home, profiles, listings and invites (see `docs/share-previews/`). The only issue is the host (P1).

## The decision: should people's pages be in search engines?

**For indexing public pages by default**

- It is how "hoshigo" plus a name gets found: someone hears "look at my hoshigo" and googles it.
- Public means public; the owner already chose between public and private, and the latest five per list are visible to anyone with the link.
- Pages with notes are the best public face of hoshigo. They are real people's taste, not generated text.

**Against**

- People made a page expecting friends and people they send the link to, not strangers and employers searching their name. Most never think about search engines when choosing "public".
- A name plus a list of films, books and places is personal data. Taste can say things about religion, politics, health or sexuality. In the EU the careful default is "not unless you want it".
- Search traffic to individual pages will be small; the growth value is low. Being listed can't be quickly undone (removal from Google takes days to weeks).
- The manifesto ("no fake profiles, only real people") increases the privacy stakes: these are verified real names.

**Recommendation**

- Add a setting under Visibility in settings: **"Show my page in search engines"**, off or on. Explain it in one plain line: "Anyone with the link can already see your page. This decides whether Google and others may list it."
- Default **off for everyone who signed up before the setting exists**. They never agreed to it, so turning it on for them would be a surprise.
- **New people** choose during onboarding, next to public or private. Preselect **off**, with a short line saying what "on" does. That fits "only real people, by choice" better than an opt out, and the SEO loss is small.
- Private profiles are always `noindex`, whatever the setting.
- Implementation: a boolean column `profiles.search_visible default false`. The layout's `generateMetadata` returns `robots: { index: false }` unless the profile is public and `search_visible` is true. The sitemap includes only those pages. The homepage, /about and /app stay indexable, and they are what a search for "hoshigo" should find anyway.

If the owner prefers the opposite (on by default for public pages), the minimum is to say so clearly at the public or private choice in onboarding, and to keep the opt out one tap away.
