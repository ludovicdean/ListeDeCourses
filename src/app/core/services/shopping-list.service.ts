import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { from, type Observable } from 'rxjs';

import {
  INGREDIENTS_CATEGORY_NAME,
  INGREDIENTS_CATEGORY_ORDER,
  MEALS_CATEGORY_NAME,
  MEALS_CATEGORY_ORDER,
} from '../constants/special-categories';
import { shoppingDb } from '../database/shopping-db';
import type {
  ShoppingList,
  ShoppingListCategoryGroup,
  ShoppingListItem,
  ShoppingListStatus,
} from '../models/shopping-list.model';

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  readonly lists$: Observable<ShoppingList[]> = from(
    liveQuery(() =>
      shoppingDb.shoppingLists.orderBy('createdAt').reverse().toArray(),
    ),
  );

  getById(id: number): Observable<ShoppingList | undefined> {
    return from(liveQuery(() => shoppingDb.shoppingLists.get(id)));
  }

  getListsByType(listTypeId: number): Observable<ShoppingList[]> {
    return from(
      liveQuery(async () => {
        const lists = await shoppingDb.shoppingLists.orderBy('createdAt').reverse().toArray();
        return lists.filter((list) => list.listTypeId === listTypeId);
      }),
    );
  }

  async fixLegacyListTypes(weeklyListTypeId: number): Promise<void> {
    await shoppingDb.shoppingLists
      .filter((list) => list.listTypeId === undefined || Number.isNaN(list.listTypeId))
      .modify({ listTypeId: weeklyListTypeId });
  }

  getGroupedItems(listId: number): Observable<ShoppingListCategoryGroup[]> {
    return from(
      liveQuery(async () => {
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
      }),
    );
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

  private async getNextOrderInCategory(listId: number, categoryName: string): Promise<number> {
    const items = await shoppingDb.shoppingListItems
      .where('shoppingListId')
      .equals(listId)
      .filter((item) => item.categoryName === categoryName)
      .toArray();

    const lastOrder = items.reduce((max, item) => Math.max(max, item.productOrder), -1);
    return lastOrder + 1;
  }

  async createFromBase(listTypeId: number, name?: string): Promise<number> {
    const listType = await shoppingDb.baseListTypes.get(listTypeId);
    if (!listType) {
      throw new Error('LIST_TYPE_NOT_FOUND');
    }

    const isEmpty = await this.isBaseEmpty(listTypeId);
    if (isEmpty) {
      throw new Error('BASE_EMPTY');
    }

    const listName =
      name?.trim() ||
      `${listType.name} du ${new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`;

    const categories = await shoppingDb.baseCategories
      .where('listTypeId')
      .equals(listTypeId)
      .sortBy('order');
    const mealsCategory = categories.find((category) => category.type === 'meals');

    return shoppingDb.transaction(
      'rw',
      shoppingDb.shoppingLists,
      shoppingDb.shoppingListItems,
      shoppingDb.baseCategories,
      shoppingDb.baseProducts,
      shoppingDb.baseMeals,
      async () => {
        const listId = await shoppingDb.shoppingLists.add({
          listTypeId,
          name: listName,
          createdAt: Date.now(),
          status: 'preparing',
        });

        for (const category of categories) {
          if (category.id === undefined || category.type === 'meals') {
            continue;
          }

          const products = await shoppingDb.baseProducts
            .where('categoryId')
            .equals(category.id)
            .sortBy('order');

          for (const product of products) {
            const isIngredient = category.type === 'ingredients';

            await shoppingDb.shoppingListItems.add({
              shoppingListId: listId,
              categoryName: category.name,
              categoryOrder: category.order,
              productName: product.name,
              productOrder: product.order,
              quantity: isIngredient ? (product.quantity ?? 1) : 1,
              checked: false,
              pickedUp: false,
              itemType: isIngredient ? 'ingredient' : 'product',
            });
          }
        }

        if (listType.hasMealCategories) {
          const meals = await shoppingDb.baseMeals.where('listTypeId').equals(listTypeId).sortBy('order');
          for (const meal of meals) {
            await shoppingDb.shoppingListItems.add({
              shoppingListId: listId,
              categoryName: MEALS_CATEGORY_NAME,
              categoryOrder: mealsCategory?.order ?? MEALS_CATEGORY_ORDER,
              productName: meal.name,
              productOrder: meal.order,
              quantity: 1,
              checked: false,
              pickedUp: false,
              itemType: 'meal',
              recipeUrl: meal.recipeUrl,
            });
          }
        }

        return listId;
      },
    );
  }

  private async isBaseEmpty(listTypeId: number): Promise<boolean> {
    const categories = await shoppingDb.baseCategories.where('listTypeId').equals(listTypeId).toArray();
    let itemCount = 0;

    for (const category of categories) {
      if (category.id === undefined || category.type === 'meals') {
        continue;
      }

      itemCount += await shoppingDb.baseProducts.where('categoryId').equals(category.id).count();
    }

    const listType = await shoppingDb.baseListTypes.get(listTypeId);
    if (listType?.hasMealCategories) {
      itemCount += await shoppingDb.baseMeals.where('listTypeId').equals(listTypeId).count();
    }

    return itemCount === 0;
  }

  async updateItem(
    id: number,
    changes: Partial<Pick<ShoppingListItem, 'quantity' | 'checked' | 'pickedUp'>>,
  ): Promise<void> {
    await shoppingDb.shoppingListItems.update(id, changes);
  }

  async validateList(id: number): Promise<void> {
    const selectedCount = await shoppingDb.shoppingListItems
      .where('shoppingListId')
      .equals(id)
      .filter((item) => item.checked)
      .count();

    if (selectedCount === 0) {
      throw new Error('NO_SELECTION');
    }

    await shoppingDb.shoppingLists.update(id, { status: 'shopping' });
  }

  async updateStatus(id: number, status: ShoppingListStatus): Promise<void> {
    await shoppingDb.shoppingLists.update(id, { status });
  }

  async delete(id: number): Promise<void> {
    await shoppingDb.transaction('rw', shoppingDb.shoppingLists, shoppingDb.shoppingListItems, async () => {
      await shoppingDb.shoppingListItems.where('shoppingListId').equals(id).delete();
      await shoppingDb.shoppingLists.delete(id);
    });
  }
}
