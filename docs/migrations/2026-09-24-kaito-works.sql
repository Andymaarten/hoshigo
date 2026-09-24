-- Only the server writes the shared `works` catalog (with the service role key, which
-- bypasses RLS). Logged in users could insert any works row through the REST API, and the
-- first row for a (source, source_id) is reused by everyone: a planted title, cover or place
-- website would show up on other people's listings. Reading stays public.
-- Safe to run more than once. Run it only once SUPABASE_SERVICE_ROLE_KEY is set in Vercel;
-- without that key the app writes works with the user's session and this policy is needed.

drop policy if exists "any logged-in user can register a work" on public.works;
