import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import {
  INGREDIENTS_CATEGORY_NAME,
  INGREDIENTS_CATEGORY_ORDER,
  MEALS_CATEGORY_NAME,
  MEALS_CATEGORY_ORDER,
} from '@core/constants/special-categories';
import { shoppingDb } from '@core/database/shopping-db';
import type {
  ShoppingListCategoryGroup,
  ShoppingListItem,
  ShoppingListStatus,
} from '@core/models/shopping-list.model';
import { LiveQueryService } from './live-query.service';

@Injectable({ providedIn: 'root' })
export class ShoppingListItemService {
  private readonly liveQuery = inject(LiveQueryService);

  getGroupedItems(listId: number): Observable<ShoppingListCategoryGroup[]> {
    return this.liveQuery.observe(async () => {
      const list = await shoppingDb.shoppingLists.get(listId);
      const listType = list ? await shoppingDb.baseListTypes.get(list.listTypeId) : undefined;
      let items = await shoppingDb.shoppingListItems
        .where('shoppingListId')
        .equals(listId)
        .toArray();

      if (list?.status === 'shopping' || list?.status === 'completed') {
        items = items.filter((item) => item.checked);
      }

      items.sort(
        (a, b) =>
          a.categoryOrder - b.categoryOrder || a.productOrder - b.productOrder,
      );

      const groups = new Map<string, ShoppingListCategoryGroup>();

      for (const item of items) {
        let group = groups.get(item.categoryName);
        if (!group) {
          group = {
            categoryName: item.categoryName,
            categoryOrder: item.categoryOrder,
            items: [],
          };
          groups.set(item.categoryName, group);
        }
        group.items.push(item);
      }

      return this.mergeSpecialCategoryGroups(groups, list?.status, listType?.hasMealCategories ?? false);
    });
  }

  async addIngredient(listId: number, name: string, quantity: number): Promise<number> {
    const productOrder = await this.getNextOrderInCategory(listId, INGREDIENTS_CATEGORY_NAME);

    return shoppingDb.shoppingListItems.add({
      shoppingListId: listId,
      categoryName: INGREDIENTS_CATEGORY_NAME,
      categoryOrder: INGREDIENTS_CATEGORY_ORDER,
      productName: name,
      productOrder,
      quantity,
      checked: false,
      pickedUp: false,
      itemType: 'ingredient',
    });
  }

  async addMeal(listId: number, name: string, recipeUrl?: string): Promise<number> {
    const productOrder = await this.getNextOrderInCategory(listId, MEALS_CATEGORY_NAME);

    return shoppingDb.shoppingListItems.add({
      shoppingListId: listId,
      categoryName: MEALS_CATEGORY_NAME,
      categoryOrder: MEALS_CATEGORY_ORDER,
      productName: name,
      productOrder,
      quantity: 1,
      checked: false,
      pickedUp: false,
      itemType: 'meal',
      recipeUrl,
    });
  }

  async updateIngredientItem(id: number, name: string, quantity: number): Promise<void> {
    await shoppingDb.shoppingListItems.update(id, { productName: name, quantity });
  }

  async updateMealItem(id: number, name: string, recipeUrl?: string): Promise<void> {
    await shoppingDb.shoppingListItems.update(id, { productName: name, recipeUrl });
  }

  async deleteItem(id: number): Promise<void> {
    await shoppingDb.shoppingListItems.delete(id);
  }

  async updateItem(
    id: number,
    changes: Partial<Pick<ShoppingListItem, 'quantity' | 'checked' | 'pickedUp'>>,
  ): Promise<void> {
    await shoppingDb.shoppingListItems.update(id, changes);
  }

  private mergeSpecialCategoryGroups(
    groups: Map<string, ShoppingListCategoryGroup>,
    status: ShoppingListStatus | undefined,
    hasMealCategories: boolean,
  ): ShoppingListCategoryGroup[] {
    if (status === 'preparing' && hasMealCategories) {
      for (const special of [
        { categoryName: INGREDIENTS_CATEGORY_NAME, categoryOrder: INGREDIENTS_CATEGORY_ORDER },
        { categoryName: MEALS_CATEGORY_NAME, categoryOrder: MEALS_CATEGORY_ORDER },
      ]) {
        if (!groups.has(special.categoryName)) {
          groups.set(special.categoryName, { ...special, items: [] });
        }
      }
    }

    return [...groups.values()].sort((a, b) => a.categoryOrder - b.categoryOrder);
  }

  private async getNextOrderInCategory(listId: number, categoryName: string): Promise<number> {
    const items = await shoppingDb.shoppingListItems
      .where('shoppingListId')
      .equals(listId)
      .filter((item) => item.categoryName === categoryName)
      .toArray();

    const lastOrder = items.reduce((max, item) => Math.max(max, item.productOrder), -1);
    return lastOrder + 1;
  }
}
