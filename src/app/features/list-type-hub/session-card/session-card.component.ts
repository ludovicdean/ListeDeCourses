import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import type { SessionCardData } from '@core/models/shopping-list-hub.model';

@Component({
  selector: 'app-session-card',
  imports: [DatePipe, MatIconModule, MatButtonModule, MatMenuModule],
  templateUrl: './session-card.component.html',
  styleUrl: './session-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionCardComponent {
  readonly data = input.required<SessionCardData>();

  readonly open = output<void>();
  readonly edit = output<void>();
  readonly validate = output<void>();
  readonly complete = output<void>();
  readonly remove = output<void>();
}
