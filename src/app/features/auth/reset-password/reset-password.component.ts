import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthSetupService } from '@core/services/auth-setup.service';
import { SupabaseService } from '@core/services/supabase.service';
import { getErrorMessage } from '@core/utils/error-message.utils';

@Component({
  selector: 'app-reset-password',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly authSetup = inject(AuthSetupService);
  private readonly router = inject(Router);

  protected readonly ready = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)],
      }),
    },
    {
      validators: (group) => {
        const password = group.get('password')?.value;
        const confirmPassword = group.get('confirmPassword')?.value;
        return password === confirmPassword ? null : { passwordMismatch: true };
      },
    },
  );

  async ngOnInit(): Promise<void> {
    if (!this.supabase.session) {
      this.errorMessage.set('Lien invalide ou expiré. Demandez un nouveau lien de réinitialisation.');
      return;
    }

    this.ready.set(true);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.loading() || !this.ready()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.supabase.updatePassword(this.form.controls.password.value);
      await this.authSetup.completeSetupForAuthenticatedUser();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
