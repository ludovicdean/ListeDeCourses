import { Injectable, inject } from '@angular/core';
import { type Observable, shareReplay } from 'rxjs';

import {
  BaseEmptyError,
  ListTypeNotFoundError,
  NoSelectionError,
} from '@core/errors/shopping-list.errors';
import { shoppingDb } from '@core/database/shopping-db';
import type { BaseListType } from '@core/models/base-list-type.model';
import type { ListTypeHubData, SessionCardData } from '@core/models/shopping-list-hub.model';
import {
  MEALS_CATEGORY_NAME,
  MEALS_CATEGORY_ORDER,
} from '@core/constants/special-categories';
import type { ShoppingList, ShoppingListStatus } from '@core/models/shopping-list.model';
import { LiveQueryService } from './live-query.service';
import { extractSessionName, formatSessionDate, formatSessionName } from '@core/utils/session-name.utils';

@Injectable({ providedIn: 'root' })
export class ShoppingListSessionService {
  private readonly liveQuery = inject(LiveQueryService);
  private readonly sessionByIdStreams = new Map<number, Observable<ShoppingList | undefined>>();

  getById(id: number): Observable<ShoppingList | undefined> {
    const existing = this.sessionByIdStreams.get(id);
    if (existing) {
      return existing;
    }

    const stream = this.liveQuery
      .observe(() => this.loadSessionById(id))
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));

    this.sessionByIdStreams.set(id, stream);
    return stream;
  }

  async getSessionById(id: number): Promise<ShoppingList | undefined> {
    return this.loadSessionById(id);
  }

  watchListTypeHub(listTypeId: number): Observable<ListTypeHubData> {
    return this.liveQuery.observe(() => this.loadListTypeHubData(listTypeId));
  }

  countActiveByType(listTypeId: number): Observable<number> {
    return this.liveQuery.observe(async () => {
      if (!Number.isFinite(listTypeId) || listTypeId <= 0) {
        return 0;
      }

      const lists = await shoppingDb.shoppingLists.where('listTypeId').equals(listTypeId).toArray();
      return lists.filter((list) => list.status !== 'completed').length;
    });
  }

  async normalizeShoppingLists(fallbackWeeklyListTypeId: number): Promise<void> {
    const validTypeIds = new Set(
      (await shoppingDb.baseListTypes.toArray())
        .map((type) => type.id)
        .filter((id): id is number => id !== undefined),
    );

    await shoppingDb.shoppingLists.toCollection().modify((list) => {
      const parsedTypeId = Number(list.listTypeId);

      if (!Number.isFinite(parsedTypeId) || !validTypeIds.has(parsedTypeId)) {
        list.listTypeId = fallbackWeeklyListTypeId;
        return;
      }

      list.listTypeId = parsedTypeId;
    });
  }

  async ensureSessionNames(): Promise<void> {
    const listTypes = await shoppingDb.baseListTypes.toArray();
    const typeById = new Map<number, BaseListType>(
      listTypes
        .filter((type): type is BaseListType & { id: number } => type.id !== undefined)
        .map((type) => [type.id, type]),
    );

    const ids = await shoppingDb.shoppingLists.toCollection().primaryKeys();

    for (const rawId of ids) {
      const id = Number(rawId);
      const list = await shoppingDb.shoppingLists.get(id);
      if (!list) {
        continue;
      }

      const normalized = this.normalizeSession(list);
      const listTypeId = Number(normalized.listTypeId);
      if (!Number.isFinite(listTypeId)) {
        continue;
      }

      const listType = typeById.get(listTypeId);
      const typeName = listType?.name?.trim() || 'Liste';

      const needsName = !extractSessionName(normalized);
      const needsTypeId = listType !== undefined && normalized.listTypeId !== listTypeId;

      if (needsName || needsTypeId) {
        const dateStr = formatSessionDate(normalized.createdAt);
        const baseName = `${typeName} du ${dateStr}`;
        const uniqueName = await this.buildUniqueListName(listTypeId, typeName, baseName, id);

        await shoppingDb.shoppingLists.update(id, {
          name: uniqueName,
          ...(needsTypeId ? { listTypeId } : {}),
        });
      }
    }
  }

  async createFromBase(listTypeId: number, name?: string): Promise<number> {
    const listType = await shoppingDb.baseListTypes.get(listTypeId);
    if (!listType) {
      throw new ListTypeNotFoundError();
    }

    if (await this.isBaseEmpty(listTypeId)) {
      throw new BaseEmptyError();
    }

    const listName = await this.buildUniqueListName(listTypeId, listType.name, name);

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

  async validateList(id: number): Promise<void> {
    const selectedCount = await shoppingDb.shoppingListItems
      .where('shoppingListId')
      .equals(id)
      .filter((item) => item.checked)
      .count();

    if (selectedCount === 0) {
      throw new NoSelectionError();
    }

    await shoppingDb.shoppingLists.update(id, { status: 'shopping' });
    this.invalidateSessionCache(id);
  }

  async reopenForEditing(id: number): Promise<void> {
    await shoppingDb.transaction('rw', shoppingDb.shoppingLists, shoppingDb.shoppingListItems, async () => {
      await shoppingDb.shoppingLists.update(id, { status: 'preparing' });
      await shoppingDb.shoppingListItems
        .where('shoppingListId')
        .equals(id)
        .modify({ pickedUp: false });
    });
    this.invalidateSessionCache(id);
  }

  async updateStatus(id: number, status: ShoppingListStatus): Promise<void> {
    await shoppingDb.shoppingLists.update(id, { status });
    this.invalidateSessionCache(id);
  }

  async delete(id: number): Promise<void> {
    await shoppingDb.transaction('rw', shoppingDb.shoppingLists, shoppingDb.shoppingListItems, async () => {
      await shoppingDb.shoppingListItems.where('shoppingListId').equals(id).delete();
      await shoppingDb.shoppingLists.delete(id);
    });
    this.invalidateSessionCache(id);
  }

  private async loadListTypeHubData(listTypeId: number): Promise<ListTypeHubData> {
    const listType = await shoppingDb.baseListTypes.get(listTypeId);
    const sessions = await this.fetchSessionCardsByType(listTypeId);

    return {
      listType: listType ? { ...listType } : undefined,
      sessions,
    };
  }

  private async fetchSessionCardsByType(listTypeId: number): Promise<SessionCardData[]> {
    const listType = await shoppingDb.baseListTypes.get(listTypeId);
    const typeName = listType?.name?.trim() || 'Liste';
    const lists = await this.fetchListsByType(listTypeId);

    return lists
      .filter((list): list is ShoppingList & { id: number } => list.id !== undefined)
      .map((list) => ({
        id: list.id,
        name: formatSessionName(list, typeName),
        createdAt: list.createdAt,
        status: list.status,
      }));
  }

  private async fetchListsByType(listTypeId: number): Promise<ShoppingList[]> {
    if (!Number.isFinite(listTypeId) || listTypeId <= 0) {
      return [];
    }

    const records = await shoppingDb.shoppingLists
      .where('listTypeId')
      .equals(listTypeId)
      .toArray();

    return records
      .map((record) => this.normalizeSession(record))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  private async loadSessionById(id: number): Promise<ShoppingList | undefined> {
    const record = await shoppingDb.shoppingLists.get(id);
    if (!record) {
      return undefined;
    }

    return this.normalizeSession(record);
  }

  private normalizeSession(record: ShoppingList): ShoppingList {
    return {
      id: record.id !== undefined ? Number(record.id) : undefined,
      listTypeId: Number(record.listTypeId),
      name: extractSessionName(record),
      createdAt: Number(record.createdAt) || Date.now(),
      status: this.normalizeStatus(record.status),
    };
  }

  private normalizeStatus(status: ShoppingListStatus | undefined): ShoppingListStatus {
    if (status === 'shopping' || status === 'completed' || status === 'preparing') {
      return status;
    }

    return 'preparing';
  }

  private async buildUniqueListName(
    listTypeId: number,
    listTypeName: string,
    customName?: string,
    excludeId?: number,
  ): Promise<string> {
    const baseName =
      customName?.trim() ||
      `${listTypeName} du ${new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`;

    const existingNames = new Set(
      (
        await Promise.all(
          (
            await shoppingDb.shoppingLists.where('listTypeId').equals(listTypeId).primaryKeys()
          ).map((id) => shoppingDb.shoppingLists.get(Number(id))),
        )
      )
        .filter((record): record is ShoppingList => record !== undefined && record.id !== excludeId)
        .map((record) => extractSessionName(this.normalizeSession(record)))
        .filter((name) => name.length > 0),
    );

    if (!existingNames.has(baseName)) {
      return baseName;
    }

    let index = 2;
    while (existingNames.has(`${baseName} (${index})`)) {
      index++;
    }

    return `${baseName} (${index})`;
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

  private invalidateSessionCache(id: number): void {
    this.sessionByIdStreams.delete(id);
  }
}
