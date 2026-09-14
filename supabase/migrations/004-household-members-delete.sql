-- Correctif : quitter un foyer (nécessaire pour accepter une invitation)
-- À exécuter dans le SQL Editor Supabase si 003 a déjà été appliqué.

DROP POLICY IF EXISTS "household_members_delete_own" ON household_members;
DROP POLICY IF EXISTS "household_members_update_own" ON household_members;

CREATE POLICY "household_members_delete_own" ON household_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "household_members_update_own" ON household_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
