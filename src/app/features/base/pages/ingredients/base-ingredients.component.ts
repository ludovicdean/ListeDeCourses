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

import {
  IngredientDialogComponent,
  type IngredientDialogResult,
} from '@features/base/dialogs/ingredient-dialog/ingredient-dialog.component';
import type { BaseProduct } from '@core/models/base-product.model';
import { BaseCategoryService } from '@core/services/base-category.service';
import { BaseProductService } from '@core/services/base-product.service';
import { ConfirmService } from '@core/services/confirm.service';
import { routeParamNumber$, routeParamNumberSignal } from '@core/utils/route-param.utils';

@Component({
  selector: 'app-base-ingredients',
  imports: [
    AsyncPipe,
    PageHeaderComponent,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDialogModule,
  ],
  templateUrl: './base-ingredients.component.html',
  styleUrl: './base-ingredients.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseIngredientsComponent {
  private readonly baseCategoryService = inject(BaseCategoryService);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly baseProductService = inject(BaseProductService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmService = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly listTypeId$ = routeParamNumber$('listTypeId');

  protected readonly listTypeId = routeParamNumberSignal('listTypeId');

  protected readonly listType = toSignal(
    this.listTypeId$.pipe(switchMap((id) => this.baseListTypeService.getById(id))),
  );

  private readonly ingredientsCategory = toSignal(
    this.listTypeId$.pipe(switchMap((id) => this.baseCategoryService.getIngredientsCategory(id))),
  );

  protected readonly products$ = this.listTypeId$.pipe(
    switchMap((listTypeId) =>
      this.baseCategoryService.getIngredientsCategory(listTypeId).pipe(
        switchMap((category) => this.baseProductService.getByCategory(category?.id ?? -1)),
      ),
    ),
  );

  protected openCreateDialog(): void {
    const category = this.ingredientsCategory();
    if (!category?.id) {
      return;
    }

    this.openDialog(category.id);
  }

  protected openEditDialog(product: BaseProduct): void {
    const category = this.ingredientsCategory();
    if (!category?.id) {
      return;
    }

    this.openDialog(category.id, product);
  }

  protected async deleteIngredient(product: BaseProduct): Promise<void> {
    if (product.id === undefined) {
      return;
    }

    const confirmed = await this.confirmService.confirm({
      title: 'Supprimer l\'ingrédient',
      message: `Supprimer l'ingrédient « ${product.name} » ?`,
      confirmLabel: 'Supprimer',
    });
    if (confirmed) {
      await this.baseProductService.delete(product.id);
    }
  }

  private openDialog(categoryId: number, product?: BaseProduct): void {
    const dialogRef = this.dialog.open<
      IngredientDialogComponent,
      { ingredient?: BaseProduct },
      IngredientDialogResult
    >(IngredientDialogComponent, {
      data: { ingredient: product },
      width: '360px',
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (result) => {
      if (!result) {
        return;
      }

      if (product?.id !== undefined) {
        await this.baseProductService.update(product.id, {
          name: result.name,
          quantity: result.quantity,
        });
        return;
      }

      const order = await this.baseProductService.getNextOrder(categoryId);
      await this.baseProductService.create({
        categoryId,
        name: result.name,
        quantity: result.quantity,
        order,
      });
    });
  }
}
