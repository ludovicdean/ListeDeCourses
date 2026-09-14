-- Correctif RLS : INSERT ... RETURNING échouait car SELECT exigeait déjà d'être membre.
-- À exécuter dans le SQL Editor Supabase si 001-households.sql a déjà été appliqué.

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "households_select_member" ON households;

CREATE POLICY "households_select_owner_or_member" ON households
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "households_insert_authenticated" ON households;

CREATE POLICY "households_insert_authenticated" ON households
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
