import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import { SupabaseService } from '@core/services/supabase.service';

@Component({
  selector: 'app-account-menu',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './account-menu.component.html',
  styleUrl: './account-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountMenuComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.supabase.signOut();
    await this.router.navigateByUrl('/login');
  }
}
