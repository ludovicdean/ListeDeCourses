-- Phase 2 : partage des données par foyer
-- À exécuter dans le SQL Editor Supabase après 001 et 002.

-- ---------------------------------------------------------------------------
-- Helpers RLS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_household_member(hid bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hid AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_household_owner(hid bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hid AND user_id = auth.uid() AND role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- household_members : email + un foyer par utilisateur
-- ---------------------------------------------------------------------------

ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS email text;

UPDATE household_members hm
SET email = au.email
FROM auth.users au
WHERE hm.user_id = au.id AND hm.email IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_household_members_user_unique ON household_members(user_id);

DROP POLICY IF EXISTS "household_members_select_own" ON household_members;

CREATE POLICY "household_members_select_household" ON household_members
  FOR SELECT TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "household_members_delete_own" ON household_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "household_members_update_own" ON household_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- household_id sur les 6 tables de données
-- ---------------------------------------------------------------------------

ALTER TABLE base_list_types ADD COLUMN IF NOT EXISTS household_id bigint REFERENCES households(id);
ALTER TABLE base_categories ADD COLUMN IF NOT EXISTS household_id bigint REFERENCES households(id);
ALTER TABLE base_products ADD COLUMN IF NOT EXISTS household_id bigint REFERENCES households(id);
ALTER TABLE base_meals ADD COLUMN IF NOT EXISTS household_id bigint REFERENCES households(id);
ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS household_id bigint REFERENCES households(id);
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS household_id bigint REFERENCES households(id);

UPDATE base_list_types t
SET household_id = hm.household_id
FROM household_members hm
WHERE t.user_id = hm.user_id AND t.household_id IS NULL;

UPDATE base_categories t
SET household_id = hm.household_id
FROM household_members hm
WHERE t.user_id = hm.user_id AND t.household_id IS NULL;

UPDATE base_products t
SET household_id = hm.household_id
FROM household_members hm
WHERE t.user_id = hm.user_id AND t.household_id IS NULL;

UPDATE base_meals t
SET household_id = hm.household_id
FROM household_members hm
WHERE t.user_id = hm.user_id AND t.household_id IS NULL;

UPDATE shopping_lists t
SET household_id = hm.household_id
FROM household_members hm
WHERE t.user_id = hm.user_id AND t.household_id IS NULL;

UPDATE shopping_list_items t
SET household_id = hm.household_id
FROM household_members hm
WHERE t.user_id = hm.user_id AND t.household_id IS NULL;

ALTER TABLE base_list_types ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE base_categories ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE base_products ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE base_meals ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE shopping_lists ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE shopping_list_items ALTER COLUMN household_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_base_list_types_household ON base_list_types(household_id);
CREATE INDEX IF NOT EXISTS idx_base_categories_household ON base_categories(household_id);
CREATE INDEX IF NOT EXISTS idx_base_products_household ON base_products(household_id);
CREATE INDEX IF NOT EXISTS idx_base_meals_household ON base_meals(household_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_household ON shopping_lists(household_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_household ON shopping_list_items(household_id);

-- ---------------------------------------------------------------------------
-- RLS sur les 6 tables (remplace les anciennes politiques user_id)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  pol record;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'base_list_types',
    'base_categories',
    'base_products',
    'base_meals',
    'shopping_lists',
    'shopping_list_items'
  ]
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
    END LOOP;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format(
      'CREATE POLICY "household_select" ON %I FOR SELECT TO authenticated USING (is_household_member(household_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "household_insert" ON %I FOR INSERT TO authenticated WITH CHECK (is_household_member(household_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "household_update" ON %I FOR UPDATE TO authenticated USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "household_delete" ON %I FOR DELETE TO authenticated USING (is_household_member(household_id))',
      tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Invitations par email
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS household_invites (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  household_id bigint REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at bigint NOT NULL,
  UNIQUE (household_id, email)
);

CREATE INDEX IF NOT EXISTS idx_household_invites_email ON household_invites(lower(email));

ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_invites_select" ON household_invites;
DROP POLICY IF EXISTS "household_invites_insert" ON household_invites;
DROP POLICY IF EXISTS "household_invites_update" ON household_invites;
DROP POLICY IF EXISTS "household_invites_delete" ON household_invites;

CREATE POLICY "household_invites_select" ON household_invites
  FOR SELECT TO authenticated
  USING (
    is_household_owner(household_id)
    OR lower(email) = lower((auth.jwt() ->> 'email'))
  );

CREATE POLICY "household_invites_insert" ON household_invites
  FOR INSERT TO authenticated
  WITH CHECK (is_household_owner(household_id));

CREATE POLICY "household_invites_update" ON household_invites
  FOR UPDATE TO authenticated
  USING (
    is_household_owner(household_id)
    OR lower(email) = lower((auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    is_household_owner(household_id)
    OR lower(email) = lower((auth.jwt() ->> 'email'))
  );

CREATE POLICY "household_invites_delete" ON household_invites
  FOR DELETE TO authenticated
  USING (is_household_owner(household_id));
