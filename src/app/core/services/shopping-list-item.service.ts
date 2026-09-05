import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import {
  INGREDIENTS_CATEGORY_NAME,
  INGREDIENTS_CATEGORY_ORDER,
  MEALS_CATEGORY_NAME,
  MEALS_CATEGORY_ORDER,
} from '@core/constants/special-categories';
import { mapShoppingListItem } from '@core/database/sqlite-mappers';
import { SqliteRepository } from '@core/database/sqlite.repository';
import type {
  ShoppingListCategoryGroup,
  ShoppingListItem,
  ShoppingListStatus,
} from '@core/models/shopping-list.model';
import { LiveQueryService } from './live-query.service';

@Injectable({ providedIn: 'root' })
export class ShoppingListItemService {
  private readonly liveQuery = inject(LiveQueryService);
  private readonly repo = inject(SqliteRepository);

  getGroupedItems(listId: number): Observable<ShoppingListCategoryGroup[]> {
    return this.liveQuery.observe(async () => {
      const listRow = await this.repo.get<Record<string, unknown>>(
        'SELECT listTypeId, status FROM shoppingLists WHERE id = ?;',
        [listId],
      );
      const listTypeRow = listRow
        ? await this.repo.get<Record<string, unknown>>(
            'SELECT hasMealCategories FROM baseListTypes WHERE id = ?;',
            [listRow['listTypeId']],
          )
        : undefined;

      const status = listRow ? String(listRow['status']) : undefined;
      const hasMealCategories = listTypeRow ? Boolean(listTypeRow['hasMealCategories']) : false;

      let sql =
        'SELECT id, shoppingListId, categoryName, categoryOrder, productName, productOrder, quantity, checked, pickedUp, itemType, recipeUrl FROM shoppingListItems WHERE shoppingListId = ?';
      if (status === 'shopping' || status === 'completed') {
        sql += " AND (checked = 1 OR itemType IN ('ingredient', 'meal'))";
      }
      sql += ' ORDER BY categoryOrder, productOrder;';

      const itemRows = await this.repo.query<Record<string, unknown>>(sql, [listId]);
      const items = itemRows.map(mapShoppingListItem);

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

      return this.mergeSpecialCategoryGroups(groups, status as ShoppingListStatus, hasMealCategories);
    });
  }

  async addIngredient(listId: number, name: string, quantity: number): Promise<number> {
    const productOrder = await this.getNextOrderInCategory(listId, INGREDIENTS_CATEGORY_NAME);

    return this.repo.insert('shoppingListItems', {
      shoppingListId: listId,
      categoryName: INGREDIENTS_CATEGORY_NAME,
      categoryOrder: INGREDIENTS_CATEGORY_ORDER,
      productName: name,
      productOrder,
      quantity,
      checked: 0,
      pickedUp: 0,
      itemType: 'ingredient',
    });
  }

  async addMeal(listId: number, name: string, recipeUrl?: string): Promise<number> {
    const productOrder = await this.getNextOrderInCategory(listId, MEALS_CATEGORY_NAME);

    return this.repo.insert('shoppingListItems', {
      shoppingListId: listId,
      categoryName: MEALS_CATEGORY_NAME,
      categoryOrder: MEALS_CATEGORY_ORDER,
      productName: name,
      productOrder,
      quantity: 1,
      checked: 0,
      pickedUp: 0,
      itemType: 'meal',
      recipeUrl,
    });
  }

  async updateIngredientItem(id: number, name: string, quantity: number): Promise<void> {
    await this.repo.update('shoppingListItems', id, { productName: name, quantity });
  }

  async updateMealItem(id: number, name: string, recipeUrl?: string): Promise<void> {
    await this.repo.update('shoppingListItems', id, { productName: name, recipeUrl });
  }

  async deleteItem(id: number): Promise<void> {
    await this.repo.delete('shoppingListItems', id);
  }

  async updateItem(
    id: number,
    changes: Partial<Pick<ShoppingListItem, 'quantity' | 'checked' | 'pickedUp'>>,
  ): Promise<void> {
    await this.repo.update('shoppingListItems', id, {
      quantity: changes.quantity,
      checked: changes.checked === undefined ? undefined : changes.checked ? 1 : 0,
      pickedUp: changes.pickedUp === undefined ? undefined : changes.pickedUp ? 1 : 0,
    });
  }

  private mergeSpecialCategoryGroups(
    groups: Map<string, ShoppingListCategoryGroup>,
    _status: ShoppingListStatus | undefined,
    hasMealCategories: boolean,
  ): ShoppingListCategoryGroup[] {
    const standard: ShoppingListCategoryGroup[] = [];
    let ingredients: ShoppingListCategoryGroup | undefined;
    let meals: ShoppingListCategoryGroup | undefined;

    for (const group of groups.values()) {
      if (group.categoryName === INGREDIENTS_CATEGORY_NAME) {
        ingredients = group;
      } else if (group.categoryName === MEALS_CATEGORY_NAME) {
        meals = group;
      } else {
        standard.push(group);
      }
    }

    standard.sort((a, b) => a.categoryOrder - b.categoryOrder);

    const result = [...standard];

    if (hasMealCategories) {
      result.push(
        ingredients ?? {
          categoryName: INGREDIENTS_CATEGORY_NAME,
          categoryOrder: INGREDIENTS_CATEGORY_ORDER,
          items: [],
        },
      );
      result.push(
        meals ?? {
          categoryName: MEALS_CATEGORY_NAME,
          categoryOrder: MEALS_CATEGORY_ORDER,
          items: [],
        },
      );
    }

    return result;
  }

  private async getNextOrderInCategory(listId: number, categoryName: string): Promise<number> {
    const rows = await this.repo.query<Record<string, unknown>>(
      'SELECT MAX(productOrder) as maxOrder FROM shoppingListItems WHERE shoppingListId = ? AND categoryName = ?;',
      [listId, categoryName],
    );
    const maxOrder = rows[0]?.['maxOrder'] === null ? -1 : Number(rows[0]?.['maxOrder'] ?? -1);
    return maxOrder + 1;
  }
}
