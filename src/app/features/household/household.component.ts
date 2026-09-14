import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { PageHeaderComponent } from '@app/shared/page-header/page-header.component';

import type { HouseholdInvite, HouseholdMember } from '@core/models/household.model';
import { ConfirmService } from '@core/services/confirm.service';
import { HouseholdService } from '@core/services/household.service';
import { SupabaseService } from '@core/services/supabase.service';
import { getErrorMessage } from '@core/utils/error-message.utils';

@Component({
  selector: 'app-household',
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
  ],
  templateUrl: './household.component.html',
  styleUrl: './household.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HouseholdComponent implements OnInit {
  private readonly householdService = inject(HouseholdService);
  private readonly supabase = inject(SupabaseService);
  private readonly confirm = inject(ConfirmService);

  protected readonly householdName = signal('Mon foyer');
  protected readonly members = signal<HouseholdMember[]>([]);
  protected readonly invites = signal<HouseholdInvite[]>([]);
  protected readonly isOwner = signal(false);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly renaming = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly renameForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
  });

  protected readonly inviteForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected memberLabel(member: HouseholdMember): string {
    if (member.userId === this.supabase.userId) {
      return member.email ? `${member.email} (vous)` : 'Vous';
    }

    return member.email ?? 'Membre';
  }

  protected roleLabel(role: HouseholdMember['role']): string {
    return role === 'owner' ? 'Propriétaire' : 'Membre';
  }

  protected canRemoveMember(member: HouseholdMember): boolean {
    if (!this.isOwner()) {
      return false;
    }

    return member.userId.toLowerCase() !== this.currentUserId.toLowerCase();
  }

  protected get currentUserId(): string {
    return this.supabase.userId;
  }

  protected async saveHouseholdName(): Promise<void> {
    if (this.renameForm.invalid || this.renaming()) {
      return;
    }

    this.renaming.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const name = this.renameForm.controls.name.value;
      await this.householdService.updateHouseholdName(name);
      this.householdName.set(name);
      this.successMessage.set('Nom du foyer mis à jour.');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.renaming.set(false);
    }
  }

  protected async sendInvite(): Promise<void> {
    if (this.inviteForm.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await this.householdService.inviteByEmail(this.inviteForm.controls.email.value);
      this.inviteForm.reset();
      this.successMessage.set('Invitation envoyée.');
      await this.loadInvites();
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  protected async cancelInvite(inviteId: number): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await this.householdService.cancelInvite(inviteId);
      await this.loadInvites();
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }

  protected async removeMember(member: HouseholdMember): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Retirer du foyer',
      message: `Retirer ${this.memberLabel(member)} du foyer ? Cette personne n'aura plus accès aux listes partagées.`,
      confirmLabel: 'Retirer',
    });

    if (!confirmed) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await this.householdService.removeMember(member.userId);
      this.members.set(await this.householdService.getMembers());
      this.successMessage.set('Membre retiré du foyer.');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const info = await this.householdService.getHouseholdInfo();
      this.householdName.set(info.name);
      this.renameForm.controls.name.setValue(info.name);
      this.members.set(await this.householdService.getMembers());
      this.isOwner.set((await this.householdService.getCurrentUserRole()) === 'owner');
      await this.loadInvites();
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadInvites(): Promise<void> {
    if (!this.isOwner()) {
      this.invites.set([]);
      return;
    }

    this.invites.set(await this.householdService.getPendingInvites());
  }
}
