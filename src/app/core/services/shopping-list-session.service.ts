import { Injectable, inject } from '@angular/core';
import { type Observable, shareReplay } from 'rxjs';

import {
  BaseEmptyError,
  ListTypeNotFoundError,
  NoSelectionError,
} from '@core/errors/shopping-list.errors';
import {
  mapBaseCategory,
  mapBaseListType,
  mapBaseMeal,
  mapShoppingList,
  mapShoppingListItem,
  toSqliteBoolean,
} from '@core/database/sqlite-mappers';
import { SqliteRepository } from '@core/database/sqlite.repository';
import type { BaseListType } from '@core/models/base-list-type.model';
import type { ListTypeHubData, SessionCardData } from '@core/models/shopping-list-hub.model';
import {
  MEALS_CATEGORY_NAME,
  MEALS_CATEGORY_ORDER,
} from '@core/constants/special-categories';
import type { ShoppingList, ShoppingListItem, ShoppingListStatus } from '@core/models/shopping-list.model';
import {
  LIDL_SESSION_PREFIX,
  SUPER_U_SESSION_PREFIX,
  extractSessionName,
  formatSessionName,
  formatStoreSessionName,
  resolveUniqueStoreSessionIndex,
} from '@core/utils/session-name.utils';
import { LiveQueryService } from './live-query.service';

@Injectable({ providedIn: 'root' })
export class ShoppingListSessionService {
  private readonly liveQuery = inject(LiveQueryService);
  private readonly repo = inject(SqliteRepository);
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

      const rows = await this.repo.query<Record<string, unknown>>(
        'SELECT COUNT(*) as count FROM shoppingLists WHERE listTypeId = ? AND status != ?;',
        [listTypeId, 'completed'],
      );
      return Number(rows[0]?.['count'] ?? 0);
    });
  }

  async normalizeShoppingLists(fallbackWeeklyListTypeId: number): Promise<void> {
    await this.repo.exec({
      sql: 'UPDATE shoppingLists SET listTypeId = ? WHERE listTypeId NOT IN (SELECT id FROM baseListTypes);',
      bind: [fallbackWeeklyListTypeId],
    });
  }

  async ensureSessionNames(): Promise<void> {
    const typeRows = await this.repo.query<Record<string, unknown>>('SELECT id, name FROM baseListTypes;');
    const typeById = new Map<number, BaseListType>(
      typeRows.map((row) => [Number(row['id']), mapBaseListType(row)]),
    );

    const listRows = await this.repo.query<Record<string, unknown>>('SELECT id FROM shoppingLists;');

    for (const rawRow of listRows) {
      const id = Number(rawRow['id']);
      const row = await this.repo.get<Record<string, unknown>>(
        'SELECT id, listTypeId, name, createdAt, status FROM shoppingLists WHERE id = ?;',
        [id],
      );
      if (!row) {
        continue;
      }

      const normalized = this.normalizeSession(row);
      const listTypeId = Number(normalized.listTypeId);
      if (!Number.isFinite(listTypeId)) {
        continue;
      }

      const listType = typeById.get(listTypeId);

      const needsName = !extractSessionName(normalized);
      const needsTypeId = listType !== undefined && normalized.listTypeId !== listTypeId;

      if (needsName || needsTypeId) {
        const createdAt = normalized.createdAt;
        const existingNames = await this.fetchExistingSessionNames(listTypeId, id);
        const index = resolveUniqueStoreSessionIndex(existingNames, LIDL_SESSION_PREFIX, createdAt);
        const uniqueName = formatStoreSessionName(LIDL_SESSION_PREFIX, createdAt, index);

        await this.repo.update('shoppingLists', id, {
          name: uniqueName,
          ...(needsTypeId ? { listTypeId } : {}),
        });
      }
    }
  }

  async createFromBase(listTypeId: number): Promise<number> {
    const listTypeRow = await this.repo.get<Record<string, unknown>>(
      'SELECT id, name, orderIndex, hasMealCategories FROM baseListTypes WHERE id = ?;',
      [listTypeId],
    );
    if (!listTypeRow) {
      throw new ListTypeNotFoundError();
    }

    const listType = mapBaseListType(listTypeRow);

    if (await this.isBaseEmpty(listTypeId)) {
      throw new BaseEmptyError();
    }

    const listName = await this.buildUniqueStoreSessionName(
      listTypeId,
      LIDL_SESSION_PREFIX,
      Date.now(),
    );

    const categoryRows = await this.repo.query<Record<string, unknown>>(
      'SELECT id, listTypeId, name, orderIndex, type FROM baseCategories WHERE listTypeId = ? ORDER BY orderIndex;',
      [listTypeId],
    );
    const categories = categoryRows.map(mapBaseCategory);
    const mealsCategory = categories.find((category) => category.type === 'meals');

    let listId: number | undefined;

    await this.repo.transaction(async () => {
      listId = await this.repo.insert('shoppingLists', {
        listTypeId,
        name: listName,
        createdAt: Date.now(),
        status: 'preparing',
      });

      for (const category of categories) {
        if (category.id === undefined || category.type === 'meals') {
          continue;
        }

        const productRows = await this.repo.query<Record<string, unknown>>(
          'SELECT id, categoryId, name, quantity, orderIndex FROM baseProducts WHERE categoryId = ? ORDER BY orderIndex;',
          [category.id],
        );

        for (const productRow of productRows) {
          const isIngredient = category.type === 'ingredients';
          const quantity = productRow['quantity'] === null ? 1 : Number(productRow['quantity']);

          await this.repo.insert('shoppingListItems', {
            shoppingListId: listId,
            categoryName: category.name,
            categoryOrder: category.order,
            productName: String(productRow['name']),
            productOrder: Number(productRow['orderIndex']),
            quantity: isIngredient ? quantity : 1,
            checked: 0,
            pickedUp: 0,
            itemType: isIngredient ? 'ingredient' : 'product',
          });
        }
      }

      if (listType.hasMealCategories) {
        const mealRows = await this.repo.query<Record<string, unknown>>(
          'SELECT id, listTypeId, name, recipeUrl, orderIndex FROM baseMeals WHERE listTypeId = ? ORDER BY orderIndex;',
          [listTypeId],
        );
        const meals = mealRows.map(mapBaseMeal);

        for (const meal of meals) {
          await this.repo.insert('shoppingListItems', {
            shoppingListId: listId,
            categoryName: MEALS_CATEGORY_NAME,
            categoryOrder: mealsCategory?.order ?? MEALS_CATEGORY_ORDER,
            productName: meal.name,
            productOrder: meal.order,
            quantity: 1,
            checked: 0,
            pickedUp: 0,
            itemType: 'meal',
            recipeUrl: meal.recipeUrl,
          });
        }
      }
    });

    if (listId === undefined) {
      throw new Error('Failed to create shopping list');
    }

    return listId;
  }

  async validateList(id: number): Promise<void> {
    const rows = await this.repo.query<Record<string, unknown>>(
      'SELECT COUNT(*) as count FROM shoppingListItems WHERE shoppingListId = ? AND checked = 1;',
      [id],
    );
    const selectedCount = Number(rows[0]?.['count'] ?? 0);

    if (selectedCount === 0) {
      throw new NoSelectionError();
    }

    await this.repo.update('shoppingLists', id, { status: 'shopping' });
    this.invalidateSessionCache(id);
  }

  async reopenForEditing(id: number): Promise<void> {
    await this.repo.transaction(async () => {
      await this.repo.update('shoppingLists', id, { status: 'preparing' });
      await this.repo.exec({
        sql: 'UPDATE shoppingListItems SET pickedUp = 0 WHERE shoppingListId = ?;',
        bind: [id],
      });
    });
    this.invalidateSessionCache(id);
  }

  async updateStatus(id: number, status: ShoppingListStatus): Promise<void> {
    if (status === 'completed') {
      await this.completeSession(id);
      return;
    }

    await this.repo.update('shoppingLists', id, { status });
    this.invalidateSessionCache(id);
  }

  async delete(id: number): Promise<void> {
    await this.repo.transaction(async () => {
      await this.repo.exec({
        sql: 'DELETE FROM shoppingListItems WHERE shoppingListId = ?;',
        bind: [id],
      });
      await this.repo.exec({
        sql: 'DELETE FROM shoppingLists WHERE id = ?;',
        bind: [id],
      });
    });
    this.repo.notifyChange('shoppingLists');
    this.invalidateSessionCache(id);
  }

  private async loadListTypeHubData(listTypeId: number): Promise<ListTypeHubData> {
    const listTypeRow = await this.repo.get<Record<string, unknown>>(
      'SELECT id, name, orderIndex, hasMealCategories FROM baseListTypes WHERE id = ?;',
      [listTypeId],
    );
    const sessions = await this.fetchSessionCardsByType(listTypeId);

    return {
      listType: listTypeRow ? mapBaseListType(listTypeRow) : undefined,
      sessions,
    };
  }

  private async fetchSessionCardsByType(listTypeId: number): Promise<SessionCardData[]> {
    const listTypeRow = await this.repo.get<Record<string, unknown>>(
      'SELECT name FROM baseListTypes WHERE id = ?;',
      [listTypeId],
    );
    const typeName = listTypeRow?.['name'] ? String(listTypeRow['name']) : 'Liste';
    const lists = await this.fetchListsByType(listTypeId);
    const listIds = lists
      .filter((list): list is ShoppingList & { id: number } => list.id !== undefined)
      .map((list) => list.id);
    const selectedCounts = await this.fetchSelectedCountsByListIds(listIds);

    return lists
      .filter((list): list is ShoppingList & { id: number } => list.id !== undefined)
      .map((list) => ({
        id: list.id,
        name: formatSessionName(list, typeName),
        createdAt: list.createdAt,
        status: list.status,
        selectedCount: selectedCounts.get(list.id) ?? 0,
      }));
  }

  private async fetchSelectedCountsByListIds(listIds: number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    if (listIds.length === 0) {
      return counts;
    }

    const placeholders = listIds.map(() => '?').join(', ');
    const rows = await this.repo.query<Record<string, unknown>>(
      `SELECT shoppingListId, COUNT(*) as count FROM shoppingListItems WHERE checked = 1 AND shoppingListId IN (${placeholders}) GROUP BY shoppingListId;`,
      listIds,
    );

    for (const row of rows) {
      counts.set(Number(row['shoppingListId']), Number(row['count'] ?? 0));
    }

    return counts;
  }

  private async fetchListsByType(listTypeId: number): Promise<ShoppingList[]> {
    if (!Number.isFinite(listTypeId) || listTypeId <= 0) {
      return [];
    }

    const rows = await this.repo.query<Record<string, unknown>>(
      'SELECT id, listTypeId, name, createdAt, status FROM shoppingLists WHERE listTypeId = ? ORDER BY createdAt DESC;',
      [listTypeId],
    );

    return rows.map((record) => this.normalizeSession(record)).sort((a, b) => b.createdAt - a.createdAt);
  }

  private async loadSessionById(id: number): Promise<ShoppingList | undefined> {
    const record = await this.repo.get<Record<string, unknown>>(
      'SELECT id, listTypeId, name, createdAt, status FROM shoppingLists WHERE id = ?;',
      [id],
    );
    if (!record) {
      return undefined;
    }

    return this.normalizeSession(record);
  }

  private normalizeSession(record: Record<string, unknown>): ShoppingList {
    return {
      id: record['id'] !== undefined ? Number(record['id']) : undefined,
      listTypeId: Number(record['listTypeId']),
      name: extractSessionName(mapShoppingList(record)),
      createdAt: Number(record['createdAt']) || Date.now(),
      status: this.normalizeStatus(record['status'] as ShoppingListStatus),
    };
  }

  private normalizeStatus(status: ShoppingListStatus | undefined): ShoppingListStatus {
    if (status === 'shopping' || status === 'completed' || status === 'preparing') {
      return status;
    }

    return 'preparing';
  }

  private async completeSession(id: number): Promise<void> {
    const session = await this.loadSessionById(id);
    if (session?.id === undefined) {
      return;
    }

    const sessionId = session.id;
    const unpickedItems =
      session.status === 'shopping' ? await this.fetchUnpickedShoppingItems(sessionId) : [];

    await this.repo.transaction(async () => {
      await this.repo.exec({
        sql: 'UPDATE shoppingLists SET status = ? WHERE id = ?;',
        bind: ['completed', sessionId],
      });

      if (unpickedItems.length > 0) {
        await this.createFollowUpSession({ ...session, id: sessionId }, unpickedItems);
      }
    });

    this.repo.notifyChange('shoppingLists');
    this.invalidateSessionCache(sessionId);
  }

  private async createFollowUpSession(
    sourceSession: ShoppingList & { id: number },
    items: ShoppingListItem[],
  ): Promise<void> {
    const createdAt = Date.now();
    const listName = await this.buildUniqueStoreSessionName(
      sourceSession.listTypeId,
      SUPER_U_SESSION_PREFIX,
      createdAt,
    );

    const listId = await this.repo.insert('shoppingLists', {
      listTypeId: sourceSession.listTypeId,
      name: listName,
      createdAt,
      status: 'preparing',
    });

    for (const item of items) {
      await this.repo.insert('shoppingListItems', {
        shoppingListId: listId,
        categoryName: item.categoryName,
        categoryOrder: item.categoryOrder,
        productName: item.productName,
        productOrder: item.productOrder,
        quantity: item.quantity,
        checked: 1,
        pickedUp: 0,
        itemType: item.itemType,
        recipeUrl: item.recipeUrl,
      });
    }
  }

  private async fetchUnpickedShoppingItems(listId: number): Promise<ShoppingListItem[]> {
    const rows = await this.repo.query<Record<string, unknown>>(
      `SELECT id, shoppingListId, categoryName, categoryOrder, productName, productOrder, quantity, checked, pickedUp, itemType, recipeUrl
       FROM shoppingListItems
       WHERE shoppingListId = ? AND checked = 1 AND pickedUp = 0
       ORDER BY categoryOrder, productOrder;`,
      [listId],
    );

    return rows.map(mapShoppingListItem);
  }

  private async buildUniqueStoreSessionName(
    listTypeId: number,
    prefix: string,
    createdAt: number,
    excludeId?: number,
  ): Promise<string> {
    const existingNames = await this.fetchExistingSessionNames(listTypeId, excludeId);
    const index = resolveUniqueStoreSessionIndex(existingNames, prefix, createdAt);
    return formatStoreSessionName(prefix, createdAt, index);
  }

  private async fetchExistingSessionNames(
    listTypeId: number,
    excludeId?: number,
  ): Promise<string[]> {
    const rows = await this.repo.query<Record<string, unknown>>(
      'SELECT id, listTypeId, name, createdAt, status FROM shoppingLists WHERE listTypeId = ?;',
      [listTypeId],
    );

    return rows
      .filter((record) => Number(record['id']) !== excludeId)
      .map((record) => extractSessionName(this.normalizeSession(record)))
      .filter((name) => name.length > 0);
  }

  private async isBaseEmpty(listTypeId: number): Promise<boolean> {
    const categoryRows = await this.repo.query<Record<string, unknown>>(
      'SELECT id, type FROM baseCategories WHERE listTypeId = ?;',
      [listTypeId],
    );

    let itemCount = 0;

    for (const category of categoryRows) {
      if (category['id'] === undefined || category['type'] === 'meals') {
        continue;
      }

      const productRows = await this.repo.query<Record<string, unknown>>(
        'SELECT COUNT(*) as count FROM baseProducts WHERE categoryId = ?;',
        [category['id']],
      );
      itemCount += Number(productRows[0]?.['count'] ?? 0);
    }

    const listTypeRow = await this.repo.get<Record<string, unknown>>(
      'SELECT hasMealCategories FROM baseListTypes WHERE id = ?;',
      [listTypeId],
    );
    if (listTypeRow && toSqliteBoolean(Boolean(listTypeRow['hasMealCategories']))) {
      const mealRows = await this.repo.query<Record<string, unknown>>(
        'SELECT COUNT(*) as count FROM baseMeals WHERE listTypeId = ?;',
        [listTypeId],
      );
      itemCount += Number(mealRows[0]?.['count'] ?? 0);
    }

    return itemCount === 0;
  }

  private invalidateSessionCache(id: number): void {
    this.sessionByIdStreams.delete(id);
  }
}
