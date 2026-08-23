import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { map, switchMap } from 'rxjs';

import { getListTypeMeta } from '../../core/constants/list-type-meta';
import { BaseListTypeService } from '../../core/services/base-list-type.service';
import { ShoppingListService } from '../../core/services/shopping-list.service';
import type { ShoppingList } from '../../core/models/shopping-list.model';

@Component({
  selector: 'app-list-type-hub',
  imports: [
    AsyncPipe,
    DatePipe,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatCardModule,
  ],
  template: `
    @if (listType(); as type) {
      <mat-toolbar color="primary">
        <a mat-icon-button routerLink="/" aria-label="Accueil">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <span>{{ type.name }}</span>
      </mat-toolbar>

      <div class="page">
        <mat-card class="actions-card">
          <mat-card-content>
            <button mat-flat-button color="primary" class="main-action" (click)="createNewList()">
              <mat-icon>{{ meta().icon }}</mat-icon>
              Préparer une liste
            </button>
            <a mat-stroked-button class="secondary-action" [routerLink]="['/base', type.id]">
              <mat-icon>tune</mat-icon>
              Modifier la liste de base
            </a>
          </mat-card-content>
        </mat-card>

        <section class="sessions">
          <h2>Mes sessions ({{ (lists$ | async)?.length ?? 0 }})</h2>

          @if (lists$ | async; as lists) {
            @if (lists.length === 0) {
              <p class="empty-state">
                Aucune liste pour l'instant. Commencez par « Préparer une liste ».
              </p>
            } @else {
              <mat-list>
                @for (list of lists; track list.id) {
                  <mat-list-item class="session-item">
                    <a class="session-link" [routerLink]="['/list', list.id]">
                      <span class="session-name">{{ list.name }}</span>
                      <span class="session-date">
                        {{ list.createdAt | date: 'd MMM y, HH:mm' : '' : 'fr' }}
                      </span>
                    </a>
                    <span matListItemMeta class="session-meta">
                      @switch (list.status) {
                        @case ('preparing') {
                          <span class="status preparing">Préparation</span>
                        }
                        @case ('shopping') {
                          <span class="status shopping">En magasin</span>
                        }
                        @case ('completed') {
                          <span class="status completed">Terminée</span>
                        }
                      }
                      <button
                        mat-icon-button
                        aria-label="Supprimer la session"
                        (click)="deleteList(list)"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    </span>
                  </mat-list-item>
                }
              </mat-list>
            }
          }
        </section>
      </div>
    }
  `,
  styles: `
    .page {
      padding: 16px;
    }

    .actions-card mat-card-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px !important;
    }

    .main-action,
    .secondary-action {
      width: 100%;
      justify-content: center;
    }

    .sessions h2 {
      margin: 24px 0 8px;
      font-size: 0.95rem;
      font-weight: 600;
      opacity: 0.8;
    }

    .empty-state {
      margin: 0;
      padding: 8px 0;
      opacity: 0.65;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .session-item {
      height: auto !important;
      min-height: 72px;
      padding-top: 8px;
      padding-bottom: 8px;
    }

    .session-link {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
      text-decoration: none;
      color: inherit;
      padding: 4px 0;
    }

    .session-name {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .session-date {
      font-size: 0.8rem;
      opacity: 0.65;
    }

    .session-meta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .status {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 12px;
      white-space: nowrap;
    }

    .status.preparing {
      background: #fff3e0;
      color: #e65100;
    }

    .status.shopping {
      background: #e3f2fd;
      color: #1565c0;
    }

    .status.completed {
      background: #e8f5e9;
      color: #2e7d32;
    }
  `,
})
export class ListTypeHubComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly shoppingListService = inject(ShoppingListService);

  private readonly listTypeId$ = this.route.paramMap.pipe(
    map((params) => Number(params.get('listTypeId'))),
  );

  protected readonly listType = toSignal(
    this.listTypeId$.pipe(switchMap((id) => this.baseListTypeService.getById(id))),
  );

  protected readonly meta = toSignal(
    this.listTypeId$.pipe(
      switchMap((id) => this.baseListTypeService.getById(id)),
      map((type) => getListTypeMeta(type?.name ?? '')),
    ),
    { initialValue: getListTypeMeta('') },
  );

  protected readonly lists$ = this.listTypeId$.pipe(
    switchMap((listTypeId) => this.shoppingListService.getListsByType(listTypeId)),
  );

  protected async createNewList(): Promise<void> {
    const type = this.listType();
    if (!type?.id) {
      return;
    }

    try {
      const listId = await this.shoppingListService.createFromBase(type.id);
      await this.router.navigate(['/list', listId]);
    } catch (error) {
      if (error instanceof Error && error.message === 'BASE_EMPTY') {
        alert(
          'La liste de base est vide. Configurez-la d\'abord via « Modifier la liste de base ».',
        );
        return;
      }

      throw error;
    }
  }

  protected async deleteList(list: ShoppingList): Promise<void> {
    if (list.id === undefined) {
      return;
    }

    const confirmed = confirm(`Supprimer la session « ${list.name} » ?`);
    if (confirmed) {
      await this.shoppingListService.delete(list.id);
    }
  }
}
