import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { combineLatest, map, of, switchMap } from 'rxjs';

import { PageHeaderComponent } from '@app/shared/page-header/page-header.component';
import { getListTypeMeta } from '@core/constants/list-type.config';
import { BaseListTypeService } from '@core/services/base-list-type.service';
import { ShoppingListService } from '@core/services/shopping-list.service';
import { AuthSetupService } from '@core/services/auth-setup.service';
import { SupabaseService } from '@core/services/supabase.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, MatIconModule, MatCardModule, PageHeaderComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  private readonly authSetup = inject(AuthSetupService);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly supabase = inject(SupabaseService);

  async ngOnInit(): Promise<void> {
    if (!this.supabase.isAuthenticated) {
      return;
    }
    await this.authSetup.completeSetupForAuthenticatedUser();
  }

  protected readonly cards = toSignal(
    this.baseListTypeService.listTypes$.pipe(
      switchMap((listTypes) => {
        const types = listTypes.filter((type) => type.id !== undefined);

        if (types.length === 0) {
          return of([]);
        }

        return combineLatest(
          types.map((type) =>
            this.shoppingListService.countActiveByType(type.id!).pipe(
              map((activeCount) => ({
                id: type.id!,
                name: type.name,
                meta: getListTypeMeta(type.name),
                activeCount,
              })),
            ),
          ),
        );
      }),
    ),
    { initialValue: [] },
  );
}
