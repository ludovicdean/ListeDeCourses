import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { combineLatest, map, of, switchMap } from 'rxjs';

import { getListTypeMeta } from '@core/constants/list-type.config';
import { BaseListTypeService } from '@core/services/base-list-type.service';
import { ShoppingListService } from '@core/services/shopping-list.service';
import { BaseListCatalogSeedService } from '@app/core/services/base-list-catalog-seed.service';
import { SupabaseService } from '@app/core/services/supabase.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, MatToolbarModule, MatIconModule, MatCardModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly catalogSeed = inject(BaseListCatalogSeedService);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  
  async ngOnInit(): Promise<void> {
    if (!this.supabase.isAuthenticated) {
      return;
    }
    await this.baseListTypeService.ensureDefaultTypes();
    await this.catalogSeed.ensureWeeklyCatalogIfEmpty();
  }
  protected async signOut(): Promise<void> {
    await this.supabase.signOut();
    await this.router.navigateByUrl('/login');
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
