import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { combineLatest, map } from 'rxjs';

import { getListTypeMeta } from '../../core/constants/list-type-meta';
import { BaseListTypeService } from '../../core/services/base-list-type.service';
import { ShoppingListService } from '../../core/services/shopping-list.service';

@Component({
  selector: 'app-home',
  imports: [AsyncPipe, RouterLink, MatToolbarModule, MatIconModule, MatCardModule],
  template: `
    <mat-toolbar color="primary">
      <span>Listes de courses</span>
    </mat-toolbar>

    <div class="page">
      <p class="intro">Choisissez le type de liste à utiliser.</p>

      @if (cards$ | async; as cards) {
        <div class="cards">
          @for (card of cards; track card.id) {
            <a class="card-link" [routerLink]="['/type', card.id]">
              <mat-card class="type-card">
                <mat-card-content>
                  <mat-icon class="type-icon" aria-hidden="true">{{ card.meta.icon }}</mat-icon>
                  <div class="type-text">
                    <h2>{{ card.name }}</h2>
                    <p>{{ card.meta.description }}</p>
                    @if (card.activeCount > 0) {
                      <span class="badge">{{ card.activeCount }} en cours</span>
                    }
                  </div>
                  <mat-icon class="chevron" aria-hidden="true">chevron_right</mat-icon>
                </mat-card-content>
              </mat-card>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .page {
      padding: 16px;
    }

    .intro {
      margin: 0 0 16px;
      opacity: 0.75;
    }

    .cards {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .card-link {
      text-decoration: none;
      color: inherit;
    }

    .type-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px !important;
    }

    .type-icon {
      font-size: 2rem;
      width: 2rem;
      height: 2rem;
      color: var(--mat-sys-primary);
      flex-shrink: 0;
    }

    .type-text {
      flex: 1;
      min-width: 0;
    }

    .type-text h2 {
      margin: 0 0 4px;
      font-size: 1.05rem;
      font-weight: 600;
    }

    .type-text p {
      margin: 0;
      font-size: 0.875rem;
      opacity: 0.7;
    }

    .badge {
      display: inline-block;
      margin-top: 8px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      background: #e3f2fd;
      color: #1565c0;
    }

    .chevron {
      opacity: 0.4;
      flex-shrink: 0;
    }
  `,
})
export class HomeComponent {
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly shoppingListService = inject(ShoppingListService);

  protected readonly cards$ = combineLatest([
    this.baseListTypeService.listTypes$,
    this.shoppingListService.lists$,
  ]).pipe(
    map(([listTypes, lists]) =>
      listTypes
        .filter((type) => type.id !== undefined)
        .map((type) => ({
          id: type.id!,
          name: type.name,
          meta: getListTypeMeta(type.name),
          activeCount: lists.filter(
            (list) => list.listTypeId === type.id && list.status !== 'completed',
          ).length,
        })),
    ),
  );
}
