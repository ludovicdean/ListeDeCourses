-- Gestion du foyer : renommage et retrait de membres
-- À exécuter dans le SQL Editor Supabase si 004 a déjà été appliqué.

DROP POLICY IF EXISTS "households_update_owner" ON households;
DROP POLICY IF EXISTS "household_members_delete_by_owner" ON household_members;

CREATE POLICY "households_update_owner" ON households
  FOR UPDATE TO authenticated
  USING (is_household_owner(id))
  WITH CHECK (is_household_owner(id));

CREATE POLICY "household_members_delete_by_owner" ON household_members
  FOR DELETE TO authenticated
  USING (
    is_household_owner(household_id)
    AND user_id <> auth.uid()
  );
