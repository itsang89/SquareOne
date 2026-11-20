-- The app subscribes to friends changes; hosted prod never had friends in the publication.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friends') then
    alter publication supabase_realtime add table public.friends;
  end if;
end $$;
