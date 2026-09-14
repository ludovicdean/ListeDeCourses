-- Phase 1 : tables foyer (à exécuter dans le SQL Editor Supabase)

CREATE TABLE households (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL DEFAULT 'Mon foyer',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at bigint NOT NULL
);

CREATE TABLE household_members (
  household_id bigint REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  created_at bigint NOT NULL,
  PRIMARY KEY (household_id, user_id)
);

CREATE INDEX idx_household_members_user ON household_members(user_id);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- SELECT : membre du foyer OU créateur (nécessaire pour INSERT ... RETURNING avant l'ajout du membre)
CREATE POLICY "households_select_owner_or_member" ON households
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "households_insert_authenticated" ON households
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "household_members_select_own" ON household_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "household_members_insert_own" ON household_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
