import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';

import { BaseMealService } from '../../../core/services/base-meal.service';
import type { BaseMeal } from '../../../core/models/base-meal.model';
import { MealDialogComponent, type MealDialogResult } from '../meal-dialog/meal-dialog.component';

@Component({
  selector: 'app-base-meals',
  imports: [
    AsyncPipe,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDialogModule,
  ],
  template: `
    <mat-toolbar color="primary">
      <a mat-icon-button [routerLink]="['/base', listTypeId()]" aria-label="Retour">
        <mat-icon>arrow_back</mat-icon>
      </a>
      <span>Repas</span>
      <span class="spacer"></span>
      <button mat-icon-button aria-label="Ajouter un repas" (click)="openCreateDialog()">
        <mat-icon>add</mat-icon>
      </button>
    </mat-toolbar>

    <p class="hint">
      Planifiez vos repas avec un nom et, si vous le souhaitez, un lien vers la recette.
    </p>

    @if (meals$ | async; as meals) {
      @if (meals.length === 0) {
        <p class="empty-state">Aucun repas pour l'instant.</p>
      } @else {
        <mat-list>
          @for (meal of meals; track meal.id) {
            <mat-list-item>
              <span matListItemTitle>{{ meal.name }}</span>
              @if (meal.recipeUrl) {
                <span matListItemLine>
                  <a [href]="meal.recipeUrl" target="_blank" rel="noopener noreferrer">Voir la recette</a>
                </span>
              }
              <span matListItemMeta class="actions">
                <button mat-icon-button aria-label="Modifier" (click)="openEditDialog(meal)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button aria-label="Supprimer" (click)="deleteMeal(meal)">
                  <mat-icon>delete</mat-icon>
                </button>
              </span>
            </mat-list-item>
          }
        </mat-list>
      }
    }
  `,
  styles: `
    .spacer {
      flex: 1;
    }

    .hint {
      margin: 0;
      padding: 12px 16px;
      font-size: 0.875rem;
      opacity: 0.75;
      line-height: 1.4;
    }

    .empty-state {
      padding: 24px 16px;
      text-align: center;
      opacity: 0.7;
    }

    .actions {
      display: inline-flex;
      align-items: center;
    }
  `,
})
export class BaseMealsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly baseMealService = inject(BaseMealService);
  private readonly dialog = inject(MatDialog);

  private readonly listTypeId$ = this.route.paramMap.pipe(
    map((params) => Number(params.get('listTypeId'))),
  );

  protected readonly listTypeId = toSignal(this.listTypeId$);

  protected readonly meals$ = this.listTypeId$.pipe(
    switchMap((listTypeId) => this.baseMealService.getMeals(listTypeId)),
  );

  protected openCreateDialog(): void {
    this.openDialog();
  }

  protected openEditDialog(meal: BaseMeal): void {
    this.openDialog(meal);
  }

  protected async deleteMeal(meal: BaseMeal): Promise<void> {
    if (meal.id === undefined) {
      return;
    }

    const confirmed = confirm(`Supprimer le repas « ${meal.name} » ?`);
    if (confirmed) {
      await this.baseMealService.delete(meal.id);
    }
  }

  private openDialog(meal?: BaseMeal): void {
    const listTypeId = this.listTypeId();
    if (!listTypeId) {
      return;
    }

    const dialogRef = this.dialog.open<MealDialogComponent, { meal?: BaseMeal }, MealDialogResult>(
      MealDialogComponent,
      {
        data: { meal },
        width: '360px',
      },
    );

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) {
        return;
      }

      if (meal?.id !== undefined) {
        await this.baseMealService.update(meal.id, {
          name: result.name,
          recipeUrl: result.recipeUrl,
        });
        return;
      }

      const order = await this.baseMealService.getNextOrder(listTypeId);
      await this.baseMealService.create({
        listTypeId,
        name: result.name,
        recipeUrl: result.recipeUrl,
        order,
      });
    });
  }
}
