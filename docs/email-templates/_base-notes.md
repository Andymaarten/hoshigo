# hoshigo email templates

Where to paste these: Supabase Dashboard → your project → Authentication →
Email Templates. Each `.html` file below maps to one template in that list.
Paste the whole file into the template's HTML body field, keep the Supabase
variables (`{{ .ConfirmationURL }}` etc.) exactly as they appear — don't
translate or rename them, Supabase substitutes them at send time.

- `confirm-signup.html` → "Confirm signup"
- `magic-link.html` → "Magic Link"
- `reset-password.html` → "Reset Password"
- `invite-user.html` → "Invite user" (not used yet)
- `change-email.html` → "Change Email Address" (not used yet; uses `{{ .Email }}` and `{{ .NewEmail }}`)
- `reauthentication.html` → "Reauthentication" (not used yet; shows `{{ .Token }}`, a code, no link)

Subject lines: each file starts with an HTML comment `<!-- Subject: ... -->`.
Copy that text into the dashboard's separate Subject field. The comment itself
is harmless if pasted along with the body.

- Confirm signup: `Is it really you?`
- Magic Link: `Your magic link to enter the world of hoshigo.`
- Reset Password: `A new password for hoshigo`
- Invite user: `Someone saved you a place on hoshigo.`
- Change Email Address: `Hello? Confirming your new address`
- Reauthentication: `Your hoshigo code`

Expiry wording: the emails say links expire "after an hour" (invites: "after
a day"), matching Supabase's defaults. If the OTP/link expiry is changed under
Authentication → Providers → Email, update those lines too.

Words: see `docs/voice.md`. Each email has one light touch at most; the
button, the expiry line and the "not you?" footer are always plain.

Design: plain cream background, black text, one red button — same palette as
the site (`#efe7d8` / `#1d1c1a` / `#d8321f`). Built with inline styles and a
table layout on purpose, since email clients (Outlook/Gmail) don't reliably
support external stylesheets or modern CSS. Every link email also prints the
raw link under the button for clients that block buttons.
