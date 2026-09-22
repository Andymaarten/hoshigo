# hoshigo email templates

Where to paste these: Supabase Dashboard → your project → Authentication →
Email Templates. Each `.html` file below maps to one template in that list.
Paste the whole file into the template's HTML body field, keep the Supabase
variables (`{{ .ConfirmationURL }}` etc.) exactly as they appear — don't
translate or rename them, Supabase substitutes them at send time.

- `confirm-signup.html` → "Confirm signup"
- `magic-link.html` → "Magic Link"
- `reset-password.html` → "Reset Password"

Suggested subject lines (set in the same dashboard screen, separate field
from the HTML body):
- Confirm signup: `Confirm your hoshigo account`
- Magic Link: `Your hoshigo login link`
- Reset Password: `Reset your hoshigo password`

Design: plain cream background, black text, one red bordered button — same
palette as the site (`#efe7d8` / `#1d1c1a` / `#d8321f`). Built with inline
styles and a table layout on purpose, since email clients (Outlook/Gmail)
don't reliably support external stylesheets or modern CSS.
