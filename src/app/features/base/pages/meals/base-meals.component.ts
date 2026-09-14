import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { switchMap } from 'rxjs';

import { PageHeaderComponent } from '@app/shared/page-header/page-header.component';
import { BaseListTypeService } from '@core/services/base-list-type.service';

import { MealDialogComponent, type MealDialogResult } from '@features/base/dialogs/meal-dialog/meal-dialog.component';
import type { BaseMeal } from '@core/models/base-meal.model';
import { BaseMealService } from '@core/services/base-meal.service';
import { ConfirmService } from '@core/services/confirm.service';
import { routeParamNumber$, routeParamNumberSignal } from '@core/utils/route-param.utils';

@Component({
  selector: 'app-base-meals',
  imports: [
    AsyncPipe,
    PageHeaderComponent,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDialogModule,
  ],
  templateUrl: './base-meals.component.html',
  styleUrl: './base-meals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseMealsComponent {
  private readonly baseMealService = inject(BaseMealService);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmService = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly listTypeId$ = routeParamNumber$('listTypeId');

  protected readonly listTypeId = routeParamNumberSignal('listTypeId');

  protected readonly listType = toSignal(
    this.listTypeId$.pipe(switchMap((id) => this.baseListTypeService.getById(id))),
  );

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

    const confirmed = await this.confirmService.confirm({
      title: 'Supprimer le repas',
      message: `Supprimer le repas « ${meal.name} » ?`,
      confirmLabel: 'Supprimer',
    });
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

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (result) => {
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
