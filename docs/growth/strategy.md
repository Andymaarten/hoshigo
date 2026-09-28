# Growth strategy, first six weeks

Written by Sora (growth and community) on 28 September 2026. It follows `docs/voice.md`, the about page and `docs/sharing-strategy.md`. Everything that goes out is written and sent by Andreas himself. Sora researches and drafts, and never posts, sends or signs up anywhere.

## What we are growing

hoshigo is a page for the handful of things you'd give five stars, and a way to see your friends' pages. It gets better as your friends join, which makes it social, but it is not a feed. So the goal is not visitors. The goal is **people who make a real page and then bring a friend.**

One consequence shapes the whole plan. A stranger who signs up alone and never adds a friend has almost nothing to come back to. A page is only worth keeping if someone you know might look at it. So we aim for small clusters of people who already know each other, not a wide spray of individuals.

## Who it is for first

I compared six candidate groups on four questions. Do they already ask each other for tips? Do they distrust algorithmic recommendations? Is there a respectful, public way to reach them? Is there a writer they trust who might mention hoshigo in their own words?

| Group | Ask each other for tips | Tired of algorithms | Respectful way in | Trusted voice | Verdict |
|---|---|---|---|---|---|
| Dutch readers of personal culture newsletters (the VPRO Gids, 3voor12 and NRC crowd) | Constantly: "heb je nog een tip?" | Yes, openly | The writers themselves, by a personal reply | Yes | **First** |
| People on the slow or indie web (Dense Discovery, kottke.org and Hacker News readers) | Yes | Strongly | Editors who ask for projects; Show HN explicitly invites things you made | Yes | **First** |
| Existing users' own friends | Yes | Mixed | Sharing cards and invite links already built | The friend | **Always, the base** |
| Book clubs (Hebban, Silent Book Club) | Around one shared book | Some | Forums forbid advertising; clubs meet in person | Weak | Later, by taking part |
| Film clubs (Eye, filmhuizen) | Yes, after a screening | Yes | Institutions, membership administrators | Weak for this | Later, in person |
| Music nerds (Bandcamp, Discord communities) | Yes | Strongly | Many communities ban self-promotion | Some | One curator now, more later |

### Audience 1: Dutch culture tip readers

People who subscribe to a writer's monthly list of what to watch, read or listen to. For example Yuki Kho's *De Kho van Kunst* (she calls it algorithm-free), Anke Meijer's *I Like To Watch*, and Lieven Heeremans' *Heb je nog een podcasttip?*. They are the friend who always gets asked for a tip, and hoshigo's about page ends on exactly that moment.

- **Message:** "The next time someone asks you for a tip, send your page."
- **Why they'd care:** they already keep lists, in notes apps and WhatsApp threads. hoshigo turns that into one small page that stays readable and shows only the best.

### Audience 2: people who choose the slow web

Readers of Dense Discovery ("what the algorithms overlook"), kottke.org and Hacker News. They are international and English speaking, and allergic to ads, feeds and engagement tricks.

- **Message:** "A personal page for the handful of things you'd give five stars. No feed, no ads, no AI, and it would like you gone within minutes."
- **Why they'd care:** the manifesto is the product for them. They also build and host their own "favourites" pages, so hoshigo is a nicer, social version of something they already do.

### Audience 0: friends of people already here

The quiet base under everything. The listing and page cards, the invite link and the WhatsApp button are the channel. There is no outreach here; we make sharing feel natural and then watch the friendship numbers.

### Not first, and why

- **Book clubs:** Hebban's house rules say "Plaats je geen reclame" (no advertising). Silent Book Club chapters are gatherings, and their listings go stale fast. Andreas can take part as a reader and mention hoshigo only when someone asks where his list lives.
- **Reddit and similar forums:** most culture subreddits ban self-promotion, and we could not read their current rules reliably, so none are in the queue. `process.md` says how to check them properly before we ever consider one.
- **Recomendo's reader issue:** it says self-promotion is not permitted.

## What "working" means

Honest numbers we can read. Where /stats doesn't show one yet, I say so.

| Metric | Why | Where to read it today |
|---|---|---|
| **Activated signups**: new people who add at least 3 hoshigos within 7 days | A page with 3 things is a portrait; 1 is a test | Not on /stats yet. SQL below; a small /stats card later |
| **Friends made**: accepted friendships per week, and the share of new people with at least one friend after 14 days | The thing that makes hoshigo worth returning to | /stats "friendships made" (per day); the share needs the SQL below |
| **Returning weekly**: people who add or change something in two different weeks | Kept, not tried | Not tracked. We only know app opens (/stats "opened the app, last 7 days") and Vercel Analytics visitors. Proxy: people with items created in two different weeks |
| **Where people came from** | Which place is worth writing to again | Vercel Analytics referrers, per day. We don't add tracking parameters (see below), so we date each send and look at the following 72 hours |
| **Replies** | Early outreach is about relationships, not clicks | `docs/growth/log.md`, kept by Andreas |

Starting targets, deliberately modest for six weeks: 40 activated signups, a third of new people with a friend within 14 days, and 10 of the six week total returning in a later week. These are guesses to check against, not promises. Week 6 decides what to aim for next.

Activated signups and "has a friend", to run in the Supabase SQL editor until /stats shows them:

```sql
-- people who joined in the last 7 to 14 days (so they had a full week):
-- how many added 3 or more hoshigos in their first week, how many have a friend
with cohort as (
  select id, created_at from profiles
  where created_at between now() - interval '14 days' and now() - interval '7 days'
    and handle not like 'user-%'
)
select
  count(*) as joined,
  count(*) filter (where (select count(*) from items i where i.profile_id = c.id
                           and i.created_at < c.created_at + interval '7 days') >= 3) as activated,
  count(*) filter (where exists (select 1 from friendships f where f.status = 'accepted'
                           and c.id in (f.requester, f.addressee))) as with_a_friend
from cohort c;
```

## The six weeks

Each week at most three messages, all sent by Andreas, each on a different day, so we can see which one did what. Every Monday the scouting routine (`process.md`) refreshes the queue and reads last week's outcomes.

| Week | Do | Learn |
|---|---|---|
| 1 (from 28 Sep) | Fix the three SEO basics in `seo-audit.md` (canonical host, robots and sitemap, private pages noindex). Add the activation and "has a friend" numbers to /stats. Andreas asks 5 to 10 people he knows well to make a page **and add one friend each**. No outreach yet. | Baseline numbers. How long does a page take to make? Where do new people get stuck? (Read the feedback tab.) |
| 2 | First two Dutch letters: Lieven Heeremans and Yuki Kho. | Do writers reply? Does a mention bring activated signups, or only visitors? |
| 3 | Dense Discovery and kottke.org. | Same questions for an international, English speaking audience. Is the English page copy clear to a stranger? |
| 4 | Show HN, only if weeks 1 to 3 show strangers can make a page without help. Andreas posts it himself and stays for the day to answer. | Honest critique from builders. Expect a spike of visitors and few activations; that's fine. |
| 5 | Anke Meijer and Nena Veenstra, or whoever did best in week 2's pattern. | Does a series or music angle work better than general culture? |
| 6 | No outreach. Review everything with Andreas: numbers, replies, feedback. Write "what we learned" in `log.md` and choose one audience to go deeper with. | Which audience gets activated people *with friends*, not just signups. |

If something goes badly (for example a writer is annoyed to be contacted), we stop that line and note why. One mention is plenty; we never follow up more than once.

## What we will not do, and why

- **No mass messaging, no templates sent in bulk.** Every message is personal and names why this person. Anything else is spam, whatever we call it.
- **No accounts, bots or "seeding" by us.** The manifesto says real people only. Sora never posts, and nobody posts as someone else.
- **No tracking parameters or referral codes** in shared links. `sharing-strategy.md` rules them out; they also make links ugly and invite gaming.
- **No invite rewards, streaks, badges, leaderboards or "your friend just joined!" nudges.** They contradict "we would like you gone within minutes".
- **No fake urgency** ("founding spots running out"). The founding member plan is real: free for everyone until 1 January 2027, then a paywall for new members only. It can be said plainly, once, and never used as pressure.
- **No scraping of people's data, no buying lists, no cold DMs to strangers.** We only write to people whose public contact channel invites it (a newsletter reply, a published address, a "send me your project" line).
- **No posting where promotion is forbidden.** In those places Andreas may take part as himself, as a reader, and mention hoshigo only if someone asks.
- **No paid ads** in this phase. It would contradict "no ads" in spirit, and we can't yet say who we'd be paying to reach.
