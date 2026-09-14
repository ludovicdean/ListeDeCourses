import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthSetupService } from '@core/services/auth-setup.service';
import { SupabaseService } from '@core/services/supabase.service';
import { getErrorMessage } from '@core/utils/error-message.utils';

type AuthMode = 'login' | 'signup';

@Component({
  selector: 'app-login',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly authSetup = inject(AuthSetupService);
  private readonly router = inject(Router);

  protected readonly mode = signal<AuthMode>('login');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);
  protected readonly loading = signal(false);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  protected switchMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    const email = this.form.controls.email.value;
    const password = this.form.controls.password.value;

    try {
      if (this.mode() === 'login') {
        await this.supabase.signIn(email, password);
        await this.authSetup.completeSetupForAuthenticatedUser();
        await this.router.navigateByUrl('/');
        return;
      }

      const { sessionCreated } = await this.supabase.signUp(email, password);

      if (!sessionCreated) {
        this.infoMessage.set(
          'Compte créé. Vérifiez votre boîte mail pour confirmer votre inscription, puis connectez-vous.',
        );
        this.switchMode('login');
        return;
      }

      await this.authSetup.completeSetupForAuthenticatedUser();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
