# Copy review, 2026-09-24

Proposals only. Nothing here is applied yet except the one outright error
noted at the end. Grouped by page, most impactful first. Mark each row
yes / no / rewrite, and the answers go into the feedback log in
`docs/voice.md`.

## 1. Login and signup (`src/app/login/`)

First words most people read after the homepage.

| Current | Proposed | Why |
| --- | --- | --- |
| Check your email for the link. (magic link sent) | Check your inbox. The magic link is on its way. | Echoes the email subject; tells them what to look for. |
| Check your email for a reset link. | Check your inbox for a link to choose a new password. | Names what the link does. |
| Fill in both fields. | Both boxes need something in them. | Softer, still plain. Optional. |
| Enter your email. | Which email should we send it to? | A question, like the owner's examples. |
| Password needs at least 8 characters. | Your password needs at least 8 characters. | Addresses the person. |
| `…` (pending label on Log in / Create account) | Opening the door… / Making your page… | The one place a tiny image fits during a wait. |
| Forgot password? | Forgot your password? | Small, warmer. |
| Back to login | Back to log in | "login" is a noun; the action is "log in". |
| Tab: Magic link | Tab: Magic link (keep) | Already good. |

## 2. Empty states

| Where | Current | Proposed | Why |
| --- | --- | --- | --- |
| Own page, no items (`[handle]/page.tsx`) | Nothing yet — press the red stamp above to add your first hoshigo. | Nothing here yet. Press the red stamp to keep your first five star thing. | "keep" is our word; "above" is not always true on mobile. |
| Friends, none yet | No friends yet. Find people below, or send them your invite link. | No friends here yet. Search below, or send your invite link to someone you'd trust with your taste. | One light touch, same instruction. |
| Friends feed, none yet | Once you have friends, what they add shows up here, newest first. | When your friends add something, it appears here, newest first. That's all. No algorithm. | Reinforces the manifesto at the moment it matters. |
| Friends, not enabled | Friends are almost here. Check back soon. | Friends are almost here. | "Check back soon" is a nudge to return; we don't do those. |
| Friend search, no results | Nobody found for "q". | Nobody called "q" here yet. | Warmer; "yet" hints they could invite them. |
| Loading feed | Loading what your friends added… | Gathering what your friends added… | Optional; small warmth during a wait. |

## 3. 404 (`not-found.tsx`)

| Current | Proposed | Why |
| --- | --- | --- |
| nothing here. | nothing here. (keep) | Already perfect. |
| This page doesn't exist, or the link has changed. | This page doesn't exist, or it has moved. Hoshi looked everywhere. | One quiet Hoshi moment in a place with no stakes. |
| Go to hoshigo | Back to hoshigo | "Back" feels like returning home. |

## 4. Add dialog (`[handle]/AddStamp.tsx`)

| Current | Proposed | Why |
| --- | --- | --- |
| Add a hoshigo | Add a hoshigo (keep) | Good. |
| From Spotify, IMDb, Goodreads, a shop, anywhere. We fill in the rest. | From Spotify, IMDb, a shop, anywhere. We fill in the rest. | Four examples read as a list; three plus "anywhere" is enough. |
| Pick a category and search for the film, album, book or place. | Pick a category and search for it. | Shorter; the categories are on the next screen. |
| That site doesn't let us read its pages, so fill in the title yourself. | That site keeps its pages to itself. Fill in the title below. | Small touch, same instruction. |
| We couldn't read that page, so we guessed the title from the link. Check it below. | We couldn't read that page, so we guessed the title from the link. Check it below. (keep) | Clear and honest. |
| That link doesn't look right. Fix it or leave it empty. | That link doesn't look quite right. Fix it, or leave it empty. | Softer. |
| Save without link | Save without a link | Grammar. |
| See it on your page | See it on your page (keep) | Good. |
| Adding… | Keeping… | Optional; "keep" is our verb. Ask the owner. |

## 5. Share panel (`SharePanel.tsx`, `InviteLink.tsx`)

| Current | Proposed | Why |
| --- | --- | --- |
| Share message: "One of my five stars: Title, By url" | (keep) | Already the voice. |
| Invite message: "Be my friend on hoshigo: url" | "I keep my five star things on hoshigo. Come and be my friend: url" | Tells the recipient what hoshigo is. |
| Whoever opens it becomes your friend right away, so share it only with people you know. | Whoever opens this becomes your friend right away, so give it only to people you know. | "give" sounds like handing a key. |
| More | More ways to share | Clearer next to WhatsApp. |

## 6. Feedback tab (`FeedbackTab.tsx`, `feedback-action.ts`)

| Current | Proposed | Why |
| --- | --- | --- |
| feedback? | feedback? (keep) | Lovely as is. |
| Something unclear, broken, or missing? A line is plenty. | Something unclear, broken or missing? A line is plenty. | Drop the serial comma; also a borderline rule of three, but earned here. |
| Thank you. It went straight to the person who makes hoshigo. | Thank you. It went straight to the person who makes hoshigo, who reads every one. | Only if true. |
| Thank you, we have your notes. Give it a little while before sending more. | Thank you, we have your notes. Give it an hour before sending more. | Concrete beats vague. |
| Write a few words first. | (keep) | Good. |
| That didn't go through. Please try again in a moment. | (keep) | The model error message. |

## 7. Onboarding (`onboarding/`)

| Current | Proposed | Why |
| --- | --- | --- |
| One last thing — pick your page address. | One last thing: where should your page live? | A question, and a place. |
| Lowercase letters, numbers, _ and the minus sign. You can share this address with anyone. | Lowercase letters, numbers, _ and the minus sign. | Second sentence is implied. |
| That page address is already taken. Try another one. | Someone already lives at that address. Try another. | One light touch in an error, still says what to do. |
| Start your hoshigo | Start your hoshigo (keep) | Good. |
| Placeholder: A line about you | (keep) | Good. |

## 8. Profile and friends (`[handle]/`, `FriendButton.tsx`, `VisibilityChoice.tsx`)

| Current | Proposed | Why |
| --- | --- | --- |
| Log in to add friend | Log in to add as a friend | Grammar. |
| Tile: log in to add as friend | log in to add as a friend | Grammar. |
| Remove friend → Keep | Remove friend → Keep them | Clearer what "Keep" keeps. |
| Everyone sees your latest five per category. Friends see everything. | (keep) | Clear. |
| Others see only your name and bio, and can ask to be your friend. Friends see everything. | (keep) | Clear. |

## 9. Settings, nav, footer

| Current | Proposed | Why |
| --- | --- | --- |
| Nav: Login | Log in | "Log in" is the action; matches the login page. |
| Footer: Sign up / Login | Sign up or log in | No slash, matches above. |
| Footer: Keep your own five star page. | (keep) | The best line on the site. |
| edit profile (h1) | your page. | Matches "your friends."; we say "page". Optional. |
| You need to be logged in. | Log in first, then try again. | Says what to do. |

## 10. About and homepage

| Current | Proposed | Why |
| --- | --- | --- |
| About: We like you to be gone within a few minutes. | Actually, we would like you to be gone within minutes. | Match the homepage wording; the "Actually" is the joke. |
| Pricing: This page is a placeholder for what's coming. | Not here yet. Hoshi is still polishing it. | Optional; placeholder language is internal speak. |

## Fixed directly (outright errors)

- Homepage: "Press one of the hoshigo's below" → "hoshigos" (stray
  apostrophe in a plural).
- No literal hyphens were found in user visible UI copy.
