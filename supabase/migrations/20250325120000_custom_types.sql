-- User-defined transaction type labels (synced across devices)
CREATE TABLE public.custom_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX custom_types_user_id_idx ON public.custom_types(user_id);

ALTER TABLE public.custom_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own custom types"
  ON public.custom_types
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Realtime: in Supabase Dashboard → Database → Publications, add `custom_types`
-- to the `supabase_realtime` publication (or run:
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_types;
-- once; it errors if the table is already published).
