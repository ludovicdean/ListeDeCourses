import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AccountMenuComponent } from '@app/shared/account-menu/account-menu.component';

@Component({
  selector: 'app-page-header',
  imports: [RouterLink, MatToolbarModule, MatIconModule, MatButtonModule, AccountMenuComponent],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
  readonly backLink = input<string | readonly unknown[] | null>(null);
  readonly backAriaLabel = input('Retour');
  readonly showAccountMenu = input(false);
  readonly statusBadge = input<string | undefined>(undefined);
  readonly statusClass = input<string | undefined>(undefined);
}
