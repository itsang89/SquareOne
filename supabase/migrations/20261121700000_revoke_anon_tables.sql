-- Hosted Supabase default privileges grant anon full rights (incl. TRUNCATE) on every new public table.
-- There is no guest mode: anon needs nothing in public. RLS already hid the rows; this removes the grants.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
