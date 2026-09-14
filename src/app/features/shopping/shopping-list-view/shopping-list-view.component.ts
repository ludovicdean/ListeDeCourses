import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { filter, of, switchMap } from 'rxjs';

import { PageHeaderComponent } from '@app/shared/page-header/page-header.component';
import type { ShoppingListStatus } from '@core/models/shopping-list.model';

import {
  IngredientDialogComponent,
  type IngredientDialogResult,
} from '@features/base/dialogs/ingredient-dialog/ingredient-dialog.component';
import { MealDialogComponent, type MealDialogResult } from '@features/base/dialogs/meal-dialog/meal-dialog.component';
import {
  INGREDIENTS_CATEGORY_NAME,
  MEALS_CATEGORY_NAME,
} from '@core/constants/special-categories';
import { isShoppingListError } from '@core/errors/shopping-list.errors';
import type { ShoppingListItem } from '@core/models/shopping-list.model';
import { BaseListTypeService } from '@core/services/base-list-type.service';
import { ConfirmService } from '@core/services/confirm.service';
import { NotificationService } from '@core/services/notification.service';
import { ShoppingListService } from '@core/services/shopping-list.service';
import { routeParamNumber$ } from '@core/utils/route-param.utils';

@Component({
  selector: 'app-shopping-list-view',
  imports: [
    PageHeaderComponent,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatCheckboxModule,
    MatDividerModule,
    MatDialogModule,
  ],
  templateUrl: './shopping-list-view.component.html',
  styleUrl: './shopping-list-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingListViewComponent {
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmService = inject(ConfirmService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly listId$ = routeParamNumber$('id').pipe(filter((id) => id > 0));

  protected readonly listId = toSignal(this.listId$, { initialValue: 0 });

  protected readonly list = toSignal(
    this.listId$.pipe(switchMap((id) => this.shoppingListService.getById(id))),
  );

  protected readonly listType = toSignal(
    this.listId$.pipe(
      switchMap((id) => this.shoppingListService.getById(id)),
      switchMap((list) =>
        list ? this.baseListTypeService.getById(list.listTypeId) : of(undefined),
      ),
    ),
  );

  protected readonly groups = toSignal(
    this.listId$.pipe(
      switchMap((id) =>
        this.shoppingListService.getById(id).pipe(
          switchMap((list) => this.shoppingListService.getGroupedItems(id, list?.status)),
        ),
      ),
    ),
    { initialValue: [] },
  );

  protected readonly meals = toSignal(
    this.listId$.pipe(switchMap((id) => this.shoppingListService.getMealsForList(id))),
    { initialValue: [] },
  );

  protected readonly MEALS_CATEGORY_NAME = MEALS_CATEGORY_NAME;

  protected isSpecialCategory(categoryName: string): boolean {
    return this.isIngredientsCategory(categoryName) || this.isMealsCategory(categoryName);
  }

  protected isIngredientsCategory(categoryName: string): boolean {
    return categoryName === INGREDIENTS_CATEGORY_NAME;
  }

  protected isMealsCategory(categoryName: string): boolean {
    return categoryName === MEALS_CATEGORY_NAME;
  }

  protected showMealsSection(): boolean {
    if (this.meals().length > 0) {
      return true;
    }

    return this.list()?.status === 'preparing' && Boolean(this.listType()?.hasMealCategories);
  }

  protected isSessionMeal(item: ShoppingListItem): boolean {
    return item.id !== undefined;
  }

  protected hubBackLabel(): string {
    const typeName = this.listType()?.name;
    return typeName ? `Retour au hub ${typeName}` : 'Retour au hub';
  }

  protected statusLabel(status: ShoppingListStatus): string {
    switch (status) {
      case 'preparing':
        return 'Préparation';
      case 'shopping':
        return 'En magasin';
      case 'completed':
        return 'Terminée';
    }
  }

  protected openAddDialog(categoryName: string): void {
    const list = this.list();
    if (list?.id === undefined || list.status !== 'preparing') {
      return;
    }

    if (categoryName === INGREDIENTS_CATEGORY_NAME) {
      this.openIngredientDialog(list.id);
      return;
    }

    if (categoryName === MEALS_CATEGORY_NAME) {
      this.openMealDialog(list.id);
    }
  }

  protected openEditDialog(item: ShoppingListItem): void {
    const list = this.list();
    if (list?.id === undefined || item.id === undefined || list.status !== 'preparing') {
      return;
    }

    if (item.itemType === 'ingredient') {
      this.openIngredientDialog(list.id, item);
      return;
    }

    if (item.itemType === 'meal') {
      this.openMealDialog(list.id, item);
    }
  }

  protected async toggleSelected(item: ShoppingListItem, checked: boolean): Promise<void> {
    if (item.id === undefined) {
      return;
    }

    await this.shoppingListService.updateItem(item.id, { checked });
  }

  protected async togglePickedUp(item: ShoppingListItem, pickedUp: boolean): Promise<void> {
    if (item.id === undefined) {
      return;
    }

    await this.shoppingListService.updateItem(item.id, { pickedUp });
  }

  protected async changeQuantity(item: ShoppingListItem, delta: number): Promise<void> {
    if (item.id === undefined) {
      return;
    }

    const minQuantity = item.itemType === 'ingredient' ? 0.01 : 1;
    const quantity = Math.max(minQuantity, item.quantity + delta);
    await this.shoppingListService.updateItem(item.id, { quantity });
  }

  protected async deleteItem(item: ShoppingListItem): Promise<void> {
    if (item.id === undefined) {
      return;
    }

    const confirmed = await this.confirmService.confirm({
      title: 'Supprimer l\'élément',
      message: `Supprimer « ${item.productName} » de cette liste ?`,
      confirmLabel: 'Supprimer',
    });

    if (confirmed) {
      await this.shoppingListService.deleteItem(item.id);
    }
  }

  protected async validateList(): Promise<void> {
    const listValue = this.list();
    if (listValue?.id === undefined) {
      return;
    }

    try {
      await this.shoppingListService.validateList(listValue.id);
      this.notificationService.info('Liste prête pour le magasin.');
    } catch (error) {
      if (isShoppingListError(error)) {
        this.notificationService.error(error.message);
        return;
      }

      throw error;
    }
  }

  protected async completeList(): Promise<void> {
    const listValue = this.list();
    if (listValue?.id === undefined) {
      return;
    }

    const confirmed = await this.confirmService.confirm({
      title: 'Terminer les courses',
      message: `Terminer la session « ${listValue.name} » ?`,
      confirmLabel: 'Terminer',
    });

    if (confirmed) {
      await this.shoppingListService.updateStatus(listValue.id, 'completed');
    }
  }

  protected async reopenForEditing(): Promise<void> {
    const listValue = this.list();
    if (listValue?.id === undefined || listValue.status === 'preparing') {
      return;
    }

    await this.shoppingListService.reopenForEditing(listValue.id);
  }

  private openIngredientDialog(listId: number, item?: ShoppingListItem): void {
    const dialogRef = this.dialog.open<
      IngredientDialogComponent,
      { ingredient?: { name: string; quantity?: number } },
      IngredientDialogResult
    >(IngredientDialogComponent, {
      data: {
        ingredient: item
          ? { name: item.productName, quantity: item.quantity }
          : undefined,
      },
      width: '360px',
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (result) => {
      if (!result) {
        return;
      }

      if (item?.id !== undefined) {
        await this.shoppingListService.updateIngredientItem(item.id, result.name, result.quantity);
        return;
      }

      await this.shoppingListService.addIngredient(listId, result.name, result.quantity);
    });
  }

  private openMealDialog(listId: number, item?: ShoppingListItem): void {
    const dialogRef = this.dialog.open<
      MealDialogComponent,
      { meal?: { name: string; recipeUrl?: string } },
      MealDialogResult
    >(MealDialogComponent, {
      data: {
        meal: item ? { name: item.productName, recipeUrl: item.recipeUrl } : undefined,
      },
      width: '360px',
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (result) => {
      if (!result) {
        return;
      }

      if (item?.id !== undefined) {
        await this.shoppingListService.updateMealItem(item.id, result.name, result.recipeUrl);
        return;
      }

      await this.shoppingListService.addMeal(listId, result.name, result.recipeUrl);
    });
  }
}
