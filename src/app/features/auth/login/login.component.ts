import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';

import { SupabaseService } from '@core/services/supabase.service';
import { BaseListTypeService } from '@app/core/services/base-list-type.service';
import { BaseListCatalogSeedService } from '@app/core/services/base-list-catalog-seed.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatToolbarModule,
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
  private readonly router = inject(Router);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly catalogSeed = inject(BaseListCatalogSeedService);
  
  protected readonly errorMessage = signal<string | null>(null);
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

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.supabase.signIn(
        this.form.controls.email.value,
        this.form.controls.password.value,
      );
      await this.baseListTypeService.ensureDefaultTypes();
      await this.catalogSeed.ensureWeeklyCatalogIfEmpty();
      await this.router.navigateByUrl('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connexion impossible';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}