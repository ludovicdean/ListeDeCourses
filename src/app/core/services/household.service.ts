import { Injectable, inject } from '@angular/core';
import { filter } from 'rxjs';

import type {
  HouseholdInfo,
  HouseholdInvite,
  HouseholdMember,
  HouseholdRole,
} from '@core/models/household.model';
import { SupabaseService } from './supabase.service';

const HOUSEHOLD_DATA_TABLES = [
  'base_list_types',
  'base_categories',
  'base_products',
  'base_meals',
  'shopping_lists',
  'shopping_list_items',
] as const;

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly supabase = inject(SupabaseService);
  private cachedHouseholdId: number | null = null;

  constructor() {
    this.supabase.session$.pipe(filter((session) => session === null)).subscribe(() => {
      this.clearCache();
    });
  }

  get householdId(): number {
    return this.requireHouseholdId();
  }

  requireHouseholdId(): number {
    if (this.cachedHouseholdId === null) {
      throw new Error('Foyer non initialisé');
    }
    return this.cachedHouseholdId;
  }

  clearCache(): void {
    this.cachedHouseholdId = null;
  }

  async ensureHouseholdForCurrentUser(): Promise<number> {
    if (this.cachedHouseholdId !== null) {
      return this.cachedHouseholdId;
    }

    const userId = this.supabase.userId;
    const userEmail = this.supabase.session?.user?.email ?? null;

    const { data: existing, error: fetchError } = await this.supabase.supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(
        fetchError.message ??
          'Impossible de lire le foyer. Vérifiez que le script SQL households a été exécuté dans Supabase.',
      );
    }

    if (existing?.['household_id'] !== undefined) {
      this.cachedHouseholdId = Number(existing['household_id']);
      await this.syncMemberEmail(userId, userEmail);
      await this.processPendingInvites();
      return this.cachedHouseholdId;
    }

    const joinedViaInvite = await this.tryJoinFromPendingInvites();
    if (joinedViaInvite !== null) {
      this.cachedHouseholdId = joinedViaInvite;
      return joinedViaInvite;
    }

    return await this.createSoloHousehold(userId, userEmail);
  }

  async getHouseholdInfo(): Promise<HouseholdInfo> {
    const householdId = this.requireHouseholdId();

    const { data, error } = await this.supabase.supabase
      .from('households')
      .select('id, name')
      .eq('id', householdId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message ?? 'Impossible de charger le foyer.');
    }

    return {
      id: Number(data['id']),
      name: String(data['name']),
    };
  }

  async getMembers(): Promise<HouseholdMember[]> {
    const householdId = this.requireHouseholdId();

    const { data, error } = await this.supabase.supabase
      .from('household_members')
      .select('user_id, email, role')
      .eq('household_id', householdId)
      .order('created_at');

    if (error) {
      throw new Error(error.message ?? 'Impossible de charger les membres.');
    }

    return (data ?? []).map((row) => ({
      userId: String(row['user_id']),
      email: row['email'] ? String(row['email']) : null,
      role: row['role'] as HouseholdRole,
    }));
  }

  async getPendingInvites(): Promise<HouseholdInvite[]> {
    const householdId = this.requireHouseholdId();
    await this.assertOwner();

    const { data, error } = await this.supabase.supabase
      .from('household_invites')
      .select('id, email, status, created_at')
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message ?? 'Impossible de charger les invitations.');
    }

    return (data ?? []).map((row) => ({
      id: Number(row['id']),
      email: String(row['email']),
      status: row['status'] as HouseholdInvite['status'],
      createdAt: Number(row['created_at']),
    }));
  }

  async inviteByEmail(email: string): Promise<void> {
    const householdId = this.requireHouseholdId();
    await this.assertOwner();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email invalide.');
    }

    const currentEmail = this.supabase.session?.user?.email?.trim().toLowerCase();
    if (currentEmail === normalizedEmail) {
      throw new Error('Vous ne pouvez pas vous inviter vous-même.');
    }

    const members = await this.getMembers();
    if (members.some((member) => member.email?.toLowerCase() === normalizedEmail)) {
      throw new Error('Cette personne est déjà membre du foyer.');
    }

    const { error } = await this.supabase.supabase.from('household_invites').insert({
      household_id: householdId,
      email: normalizedEmail,
      invited_by: this.supabase.userId,
      status: 'pending',
      created_at: Date.now(),
    });

    if (error) {
      throw new Error(error.message ?? "Impossible d'envoyer l'invitation.");
    }
  }

  async cancelInvite(inviteId: number): Promise<void> {
    await this.assertOwner();

    const { error } = await this.supabase.supabase
      .from('household_invites')
      .delete()
      .eq('id', inviteId)
      .eq('household_id', this.requireHouseholdId());

    if (error) {
      throw new Error(error.message ?? "Impossible d'annuler l'invitation.");
    }
  }

  async updateHouseholdName(name: string): Promise<void> {
    await this.assertOwner();

    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Le nom du foyer ne peut pas être vide.');
    }

    const { error } = await this.supabase.supabase
      .from('households')
      .update({ name: trimmed })
      .eq('id', this.requireHouseholdId());

    if (error) {
      throw new Error(error.message ?? 'Impossible de renommer le foyer.');
    }
  }

  async removeMember(memberUserId: string): Promise<void> {
    await this.assertOwner();

    if (memberUserId === this.supabase.userId) {
      throw new Error('Vous ne pouvez pas vous retirer vous-même du foyer.');
    }

    const member = (await this.getMembers()).find((entry) => entry.userId === memberUserId);
    if (!member) {
      throw new Error('Membre introuvable.');
    }

    const { data: removed, error } = await this.supabase.supabase
      .from('household_members')
      .delete()
      .eq('household_id', this.requireHouseholdId())
      .eq('user_id', memberUserId)
      .select('user_id');

    if (error) {
      throw new Error(error.message ?? 'Impossible de retirer ce membre.');
    }

    if (!removed?.length) {
      throw new Error(
        'Impossible de retirer ce membre. Exécutez le script SQL 005-household-management.sql dans Supabase.',
      );
    }
  }

  async getCurrentUserRole(): Promise<HouseholdRole> {
    const userId = this.supabase.userId;
    const householdId = this.requireHouseholdId();

    const { data, error } = await this.supabase.supabase
      .from('household_members')
      .select('role')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message ?? 'Impossible de déterminer votre rôle.');
    }

    return data['role'] as HouseholdRole;
  }

  private async processPendingInvites(): Promise<void> {
    const invites = await this.fetchPendingInvitesForCurrentUser();
    if (invites.length === 0) {
      return;
    }

    for (const invite of invites) {
      const targetHouseholdId = Number(invite['household_id']);
      const inviteId = Number(invite['id']);

      if (targetHouseholdId !== this.cachedHouseholdId) {
        await this.joinHousehold(targetHouseholdId);
      }

      await this.updateInviteStatus(inviteId, 'accepted');
    }
  }

  private async tryJoinFromPendingInvites(): Promise<number | null> {
    const invites = await this.fetchPendingInvitesForCurrentUser();
    if (invites.length === 0) {
      return null;
    }

    const targetHouseholdId = Number(invites[0]['household_id']);
    const userEmail = this.supabase.session?.user?.email ?? null;

    await this.addMemberToHousehold(targetHouseholdId, 'member', userEmail);

    for (const invite of invites) {
      await this.updateInviteStatus(Number(invite['id']), 'accepted');
    }

    return targetHouseholdId;
  }

  private async fetchPendingInvitesForCurrentUser(): Promise<Record<string, unknown>[]> {
    const email = this.supabase.session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return [];
    }

    const { data, error } = await this.supabase.supabase
      .from('household_invites')
      .select('id, household_id')
      .eq('status', 'pending')
      .ilike('email', email);

    if (error) {
      throw new Error(error.message ?? 'Impossible de lire les invitations.');
    }

    return data ?? [];
  }

  private async createSoloHousehold(userId: string, userEmail: string | null): Promise<number> {
    const { data: household, error: householdError } = await this.supabase.supabase
      .from('households')
      .insert({
        name: 'Mon foyer',
        created_by: userId,
        created_at: Date.now(),
      })
      .select('id')
      .single();

    if (householdError || !household) {
      throw new Error(
        householdError?.message ??
          'Impossible de créer le foyer. Vérifiez que le script SQL households a été exécuté dans Supabase.',
      );
    }

    const householdId = Number(household['id']);
    await this.addMemberToHousehold(householdId, 'owner', userEmail);
    this.cachedHouseholdId = householdId;
    return householdId;
  }

  private async addMemberToHousehold(
    householdId: number,
    role: HouseholdRole,
    email: string | null,
  ): Promise<void> {
    const { error } = await this.supabase.supabase.from('household_members').insert({
      household_id: householdId,
      user_id: this.supabase.userId,
      email,
      role,
      created_at: Date.now(),
    });

    if (error) {
      throw new Error(error.message ?? 'Impossible de rejoindre le foyer.');
    }
  }

  private async joinHousehold(targetHouseholdId: number): Promise<void> {
    const userId = this.supabase.userId;
    const userEmail = this.supabase.session?.user?.email ?? null;
    const currentHouseholdId = this.cachedHouseholdId;

    if (currentHouseholdId === null) {
      await this.addMemberToHousehold(targetHouseholdId, 'member', userEmail);
      this.cachedHouseholdId = targetHouseholdId;
      return;
    }

    if (currentHouseholdId === targetHouseholdId) {
      return;
    }

    for (const table of HOUSEHOLD_DATA_TABLES) {
      const { error } = await this.supabase.supabase
        .from(table)
        .update({ household_id: targetHouseholdId })
        .eq('household_id', currentHouseholdId);

      if (error) {
        throw new Error(error.message ?? 'Impossible de migrer les données vers le foyer.');
      }
    }

    const { data: removed, error: leaveError } = await this.supabase.supabase
      .from('household_members')
      .delete()
      .eq('household_id', currentHouseholdId)
      .eq('user_id', userId)
      .select('user_id');

    if (leaveError) {
      throw new Error(leaveError.message ?? "Impossible de quitter l'ancien foyer.");
    }

    if (!removed?.length) {
      throw new Error(
        "Impossible de quitter l'ancien foyer. Exécutez le script SQL 004-household-members-delete.sql dans Supabase.",
      );
    }

    await this.addMemberToHousehold(targetHouseholdId, 'member', userEmail);
    await this.deleteHouseholdIfEmpty(currentHouseholdId);
    this.cachedHouseholdId = targetHouseholdId;
  }

  private async deleteHouseholdIfEmpty(householdId: number): Promise<void> {
    const { count, error } = await this.supabase.supabase
      .from('household_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('household_id', householdId);

    if (error || (count ?? 0) > 0) {
      return;
    }

    await this.supabase.supabase.from('households').delete().eq('id', householdId);
  }

  private async updateInviteStatus(
    inviteId: number,
    status: HouseholdInvite['status'],
  ): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('household_invites')
      .update({ status })
      .eq('id', inviteId);

    if (error) {
      throw new Error(error.message ?? "Impossible de mettre à jour l'invitation.");
    }
  }

  private async syncMemberEmail(userId: string, email: string | null): Promise<void> {
    if (!email) {
      return;
    }

    await this.supabase.supabase
      .from('household_members')
      .update({ email })
      .eq('user_id', userId)
      .is('email', null);
  }

  private async assertOwner(): Promise<void> {
    const role = await this.getCurrentUserRole();
    if (role !== 'owner') {
      throw new Error('Seul le propriétaire du foyer peut effectuer cette action.');
    }
  }
}
