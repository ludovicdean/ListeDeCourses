import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, type Observable, switchMap } from 'rxjs';

import {
  BaseEmptyError,
  ListTypeNotFoundError,
  NoSelectionError,
} from '@core/errors/shopping-list.errors';
import {
  MEALS_CATEGORY_NAME,
  MEALS_CATEGORY_ORDER,
} from '@core/constants/special-categories';
import {
  mapSupabaseBaseCategory,
  mapSupabaseBaseListType,
  mapSupabaseBaseMeal,
  mapSupabaseBaseProduct,
  mapSupabaseShoppingList,
  mapSupabaseShoppingListItem,
} from '@core/database/supabase-mapper';
import type { BaseListType } from '@core/models/base-list-type.model';
import type { ListTypeHubData, SessionCardData } from '@core/models/shopping-list-hub.model';
import type { ShoppingList, ShoppingListItem, ShoppingListStatus } from '@core/models/shopping-list.model';
import {
  LIDL_SESSION_PREFIX,
  SUPER_U_SESSION_PREFIX,
  extractSessionName,
  formatSessionName,
  formatStoreSessionName,
  resolveUniqueStoreSessionIndex,
} from '@core/utils/session-name.utils';
import { HouseholdService } from './household.service';
import { ShoppingListItemService } from './shopping-list-item.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ShoppingListSessionService {
  private readonly supabase = inject(SupabaseService);
  private readonly householdService = inject(HouseholdService);
  private readonly items = inject(ShoppingListItemService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  getById(id: number): Observable<ShoppingList | undefined> {
    return this.refresh$.pipe(switchMap(() => this.loadSessionById(id)));
  }

  async getSessionById(id: number): Promise<ShoppingList | undefined> {
    return this.loadSessionById(id);
  }

  watchListTypeHub(listTypeId: number): Observable<ListTypeHubData> {
    return this.refresh$.pipe(switchMap(() => this.loadListTypeHubData(listTypeId)));
  }

  countActiveByType(listTypeId: number): Observable<number> {
    return this.refresh$.pipe(
      switchMap(async () => {
        if (!Number.isFinite(listTypeId) || listTypeId <= 0) {
          return 0;
        }

        const { count, error } = await this.supabase.supabase
          .from('shopping_lists')
          .select('id', { count: 'exact', head: true })
          .eq('household_id', this.householdService.householdId)
          .eq('list_type_id', listTypeId)
          .neq('status', 'completed');

        if (error) {
          throw error;
        }

        return count ?? 0;
      }),
    );
  }

  async normalizeShoppingLists(_fallbackWeeklyListTypeId: number): Promise<void> {
    // No-op with Supabase: list_type_id integrity is enforced by the database.
  }

  async ensureSessionNames(): Promise<void> {
    const userId = this.supabase.userId;
    const householdId = this.householdService.householdId;

    const { data: typeRows, error: typesError } = await this.supabase.supabase
      .from('base_list_types')
      .select('id, name, order_index, has_meal_categories')
      .eq('household_id', householdId);

    if (typesError) {
      throw typesError;
    }

    const typeById = new Map<number, BaseListType>(
      (typeRows ?? []).map((row) => [Number(row['id']), mapSupabaseBaseListType(row)]),
    );

    const { data: listRows, error: listsError } = await this.supabase.supabase
      .from('shopping_lists')
      .select('id, list_type_id, name, created_at, status')
      .eq('household_id', householdId);

    if (listsError) {
      throw listsError;
    }

    for (const row of listRows ?? []) {
      const normalized = this.normalizeSession(row);
      const listTypeId = Number(normalized.listTypeId);
      if (!Number.isFinite(listTypeId)) {
        continue;
      }

      const listType = typeById.get(listTypeId);
      const needsName = !extractSessionName(normalized);
      const needsTypeId = listType !== undefined && normalized.listTypeId !== listTypeId;

      if (!needsName && !needsTypeId) {
        continue;
      }

      const createdAt = normalized.createdAt;
      const existingNames = await this.fetchExistingSessionNames(listTypeId, normalized.id);
      const index = resolveUniqueStoreSessionIndex(existingNames, LIDL_SESSION_PREFIX, createdAt);
      const uniqueName = formatStoreSessionName(LIDL_SESSION_PREFIX, createdAt, index);

      const payload: Record<string, unknown> = { name: uniqueName };
      if (needsTypeId) {
        payload['list_type_id'] = listTypeId;
      }

      const { error } = await this.supabase.supabase
        .from('shopping_lists')
        .update(payload)
        .eq('household_id', householdId)
        .eq('id', normalized.id);

      if (error) {
        throw error;
      }
    }

    this.refresh();
  }

  async createFromBase(listTypeId: number): Promise<number> {
    const userId = this.supabase.userId;
    const householdId = this.householdService.householdId;

    const { data: listTypeRow, error: listTypeError } = await this.supabase.supabase
      .from('base_list_types')
      .select('id, name, order_index, has_meal_categories')
      .eq('household_id', householdId)
      .eq('id', listTypeId)
      .maybeSingle();

    if (listTypeError) {
      throw listTypeError;
    }

    if (!listTypeRow) {
      throw new ListTypeNotFoundError();
    }

    if (await this.isBaseEmpty(listTypeId)) {
      throw new BaseEmptyError();
    }

    const createdAt = Date.now();
    const listName = await this.buildUniqueStoreSessionName(
      listTypeId,
      LIDL_SESSION_PREFIX,
      createdAt,
    );

    const { data: categoryRows, error: categoriesError } = await this.supabase.supabase
      .from('base_categories')
      .select('id, list_type_id, name, order_index, type')
      .eq('household_id', householdId)
      .eq('list_type_id', listTypeId)
      .order('order_index');

    if (categoriesError) {
      throw categoriesError;
    }

    const listType = mapSupabaseBaseListType(listTypeRow);
    const categories = (categoryRows ?? []).map(mapSupabaseBaseCategory);
    const mealsCategory = categories.find((category) => category.type === 'meals');
    const itemPayloads: Record<string, unknown>[] = [];

    for (const category of categories) {
      if (category.id === undefined || category.type === 'meals') {
        continue;
      }

      const { data: productRows, error: productsError } = await this.supabase.supabase
        .from('base_products')
        .select('id, category_id, name, quantity, order_index')
        .eq('household_id', householdId)
        .eq('category_id', category.id)
        .order('order_index');

      if (productsError) {
        throw productsError;
      }

      for (const product of (productRows ?? []).map(mapSupabaseBaseProduct)) {
        const isIngredient = category.type === 'ingredients';
        const quantity = product.quantity ?? 1;

        itemPayloads.push({
          user_id: userId,
          household_id: householdId,
          category_name: category.name,
          category_order: category.order,
          product_name: product.name,
          product_order: product.order,
          quantity: isIngredient ? quantity : 1,
          checked: false,
          picked_up: false,
          item_type: isIngredient ? 'ingredient' : 'product',
        });
      }
    }

    if (listType.hasMealCategories) {
      const { data: mealRows, error: mealsError } = await this.supabase.supabase
        .from('base_meals')
        .select('id, list_type_id, name, recipe_url, order_index')
        .eq('household_id', householdId)
        .eq('list_type_id', listTypeId)
        .order('order_index');

      if (mealsError) {
        throw mealsError;
      }

      for (const meal of (mealRows ?? []).map(mapSupabaseBaseMeal)) {
        itemPayloads.push({
          user_id: userId,
          household_id: householdId,
          category_name: MEALS_CATEGORY_NAME,
          category_order: mealsCategory?.order ?? MEALS_CATEGORY_ORDER,
          product_name: meal.name,
          product_order: meal.order,
          quantity: 1,
          checked: false,
          picked_up: false,
          item_type: 'meal',
          recipe_url: meal.recipeUrl ?? null,
        });
      }
    }

    const { data: listRow, error: listError } = await this.supabase.supabase
      .from('shopping_lists')
      .insert({
        user_id: userId,
        household_id: householdId,
        list_type_id: listTypeId,
        name: listName,
        created_at: createdAt,
        status: 'preparing',
      })
      .select('id')
      .single();

    if (listError || !listRow) {
      throw listError ?? new Error('Impossible de créer la liste');
    }

    const listId = Number(listRow['id']);

    if (itemPayloads.length > 0) {
      const { error: itemsError } = await this.supabase.supabase.from('shopping_list_items').insert(
        itemPayloads.map((item) => ({
          ...item,
          shopping_list_id: listId,
        })),
      );

      if (itemsError) {
        throw itemsError;
      }
    }

    this.refresh();
    this.items.invalidate();
    return listId;
  }

  async validateList(id: number): Promise<void> {
    const { count, error: countError } = await this.supabase.supabase
      .from('shopping_list_items')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', this.householdService.householdId)
      .eq('shopping_list_id', id)
      .eq('checked', true);

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) === 0) {
      throw new NoSelectionError();
    }

    const { error } = await this.supabase.supabase
      .from('shopping_lists')
      .update({ status: 'shopping' })
      .eq('household_id', this.householdService.householdId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    this.refresh();
    this.items.invalidate();
  }

  async reopenForEditing(id: number): Promise<void> {
    const { error: listError } = await this.supabase.supabase
      .from('shopping_lists')
      .update({ status: 'preparing' })
      .eq('household_id', this.householdService.householdId)
      .eq('id', id);

    if (listError) {
      throw listError;
    }

    const { error: itemsError } = await this.supabase.supabase
      .from('shopping_list_items')
      .update({ picked_up: false })
      .eq('household_id', this.householdService.householdId)
      .eq('shopping_list_id', id);

    if (itemsError) {
      throw itemsError;
    }

    this.refresh();
    this.items.invalidate();
  }

  async updateStatus(id: number, status: ShoppingListStatus): Promise<void> {
    if (status === 'completed') {
      await this.completeSession(id);
      return;
    }

    const { error } = await this.supabase.supabase
      .from('shopping_lists')
      .update({ status })
      .eq('household_id', this.householdService.householdId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    this.refresh();
    this.items.invalidate();
  }

  async delete(id: number): Promise<void> {
    const householdId = this.householdService.householdId;

    const { error: itemsError } = await this.supabase.supabase
      .from('shopping_list_items')
      .delete()
      .eq('household_id', householdId)
      .eq('shopping_list_id', id);

    if (itemsError) {
      throw itemsError;
    }

    const { error: listError } = await this.supabase.supabase
      .from('shopping_lists')
      .delete()
      .eq('household_id', householdId)
      .eq('id', id);

    if (listError) {
      throw listError;
    }

    this.refresh();
    this.items.invalidate();
  }

  private async loadListTypeHubData(listTypeId: number): Promise<ListTypeHubData> {
    const householdId = this.householdService.householdId;

    const { data: listTypeRow, error: listTypeError } = await this.supabase.supabase
      .from('base_list_types')
      .select('id, name, order_index, has_meal_categories')
      .eq('household_id', householdId)
      .eq('id', listTypeId)
      .maybeSingle();

    if (listTypeError) {
      throw listTypeError;
    }

    const sessions = await this.fetchSessionCardsByType(listTypeId);

    return {
      listType: listTypeRow ? mapSupabaseBaseListType(listTypeRow) : undefined,
      sessions,
    };
  }

  private async fetchSessionCardsByType(listTypeId: number): Promise<SessionCardData[]> {
    const householdId = this.householdService.householdId;

    const { data: listTypeRow } = await this.supabase.supabase
      .from('base_list_types')
      .select('name')
      .eq('household_id', householdId)
      .eq('id', listTypeId)
      .maybeSingle();

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

    const { data, error } = await this.supabase.supabase
      .from('shopping_list_items')
      .select('shopping_list_id')
      .eq('household_id', this.householdService.householdId)
      .eq('checked', true)
      .in('shopping_list_id', listIds);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      const listId = Number(row['shopping_list_id']);
      counts.set(listId, (counts.get(listId) ?? 0) + 1);
    }

    return counts;
  }

  private async fetchListsByType(listTypeId: number): Promise<ShoppingList[]> {
    if (!Number.isFinite(listTypeId) || listTypeId <= 0) {
      return [];
    }

    const { data, error } = await this.supabase.supabase
      .from('shopping_lists')
      .select('id, list_type_id, name, created_at, status')
      .eq('household_id', this.householdService.householdId)
      .eq('list_type_id', listTypeId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((record) => this.normalizeSession(record));
  }

  private async loadSessionById(id: number): Promise<ShoppingList | undefined> {
    const { data, error } = await this.supabase.supabase
      .from('shopping_lists')
      .select('id, list_type_id, name, created_at, status')
      .eq('household_id', this.householdService.householdId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? this.normalizeSession(data) : undefined;
  }

  private normalizeSession(record: Record<string, unknown>): ShoppingList {
    const mapped = mapSupabaseShoppingList(record);
    return {
      ...mapped,
      name: extractSessionName(mapped),
      status: this.normalizeStatus(mapped.status),
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
    const followUpItems =
      session.status === 'shopping' ? await this.buildFollowUpItems(sessionId) : [];

    const { error: completeError } = await this.supabase.supabase
      .from('shopping_lists')
      .update({ status: 'completed' })
      .eq('household_id', this.householdService.householdId)
      .eq('id', sessionId);

    if (completeError) {
      throw completeError;
    }

    if (followUpItems.length > 0) {
      await this.createFollowUpSession({ ...session, id: sessionId }, followUpItems);
    }

    this.refresh();
    this.items.invalidate();
  }

  private async createFollowUpSession(
    sourceSession: ShoppingList & { id: number },
    items: ShoppingListItem[],
  ): Promise<void> {
    const userId = this.supabase.userId;
    const householdId = this.householdService.householdId;
    const createdAt = Date.now();
    const listName = await this.buildUniqueStoreSessionName(
      sourceSession.listTypeId,
      SUPER_U_SESSION_PREFIX,
      createdAt,
    );

    const { data: listRow, error: listError } = await this.supabase.supabase
      .from('shopping_lists')
      .insert({
        user_id: userId,
        household_id: householdId,
        list_type_id: sourceSession.listTypeId,
        name: listName,
        created_at: createdAt,
        status: 'preparing',
      })
      .select('id')
      .single();

    if (listError || !listRow) {
      throw listError ?? new Error('Impossible de créer la liste de suivi');
    }

    const listId = Number(listRow['id']);

    if (items.length > 0) {
      const { error: itemsError } = await this.supabase.supabase.from('shopping_list_items').insert(
        items.map((item) => ({
          user_id: userId,
          household_id: householdId,
          shopping_list_id: listId,
          category_name: item.categoryName,
          category_order: item.categoryOrder,
          product_name: item.productName,
          product_order: item.productOrder,
          quantity: item.quantity,
          checked: true,
          picked_up: false,
          item_type: item.itemType,
          recipe_url: item.recipeUrl ?? null,
        })),
      );

      if (itemsError) {
        throw itemsError;
      }
    }
  }

  private async buildFollowUpItems(listId: number): Promise<ShoppingListItem[]> {
    const unpickedItems = await this.fetchUnpickedShoppingItems(listId);
    const meals = await this.fetchMealsFromSession(listId);
    const unpickedNonMeals = unpickedItems.filter((item) => item.itemType !== 'meal');

    return [...unpickedNonMeals, ...meals].sort(
      (a, b) => a.categoryOrder - b.categoryOrder || a.productOrder - b.productOrder,
    );
  }

  private async fetchUnpickedShoppingItems(listId: number): Promise<ShoppingListItem[]> {
    const { data, error } = await this.supabase.supabase
      .from('shopping_list_items')
      .select(
        'id, shopping_list_id, category_name, category_order, product_name, product_order, quantity, checked, picked_up, item_type, recipe_url',
      )
      .eq('household_id', this.householdService.householdId)
      .eq('shopping_list_id', listId)
      .eq('checked', true)
      .eq('picked_up', false)
      .order('category_order')
      .order('product_order');

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapSupabaseShoppingListItem);
  }

  private async fetchMealsFromSession(listId: number): Promise<ShoppingListItem[]> {
    const { data, error } = await this.supabase.supabase
      .from('shopping_list_items')
      .select(
        'id, shopping_list_id, category_name, category_order, product_name, product_order, quantity, checked, picked_up, item_type, recipe_url',
      )
      .eq('household_id', this.householdService.householdId)
      .eq('shopping_list_id', listId)
      .eq('item_type', 'meal')
      .order('category_order')
      .order('product_order');

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapSupabaseShoppingListItem);
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
    const { data, error } = await this.supabase.supabase
      .from('shopping_lists')
      .select('id, list_type_id, name, created_at, status')
      .eq('household_id', this.householdService.householdId)
      .eq('list_type_id', listTypeId);

    if (error) {
      throw error;
    }

    return (data ?? [])
      .filter((record) => Number(record['id']) !== excludeId)
      .map((record) => extractSessionName(this.normalizeSession(record)))
      .filter((name) => name.length > 0);
  }

  private async isBaseEmpty(listTypeId: number): Promise<boolean> {
    const householdId = this.householdService.householdId;

    const { data: categoryRows, error: categoriesError } = await this.supabase.supabase
      .from('base_categories')
      .select('id, type')
      .eq('household_id', householdId)
      .eq('list_type_id', listTypeId);

    if (categoriesError) {
      throw categoriesError;
    }

    let itemCount = 0;

    for (const category of categoryRows ?? []) {
      if (category['id'] === undefined || category['type'] === 'meals') {
        continue;
      }

      const { count, error: productsError } = await this.supabase.supabase
        .from('base_products')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .eq('category_id', category['id']);

      if (productsError) {
        throw productsError;
      }

      itemCount += count ?? 0;
    }

    const { data: listTypeRow, error: listTypeError } = await this.supabase.supabase
      .from('base_list_types')
      .select('has_meal_categories')
      .eq('household_id', householdId)
      .eq('id', listTypeId)
      .maybeSingle();

    if (listTypeError) {
      throw listTypeError;
    }

    if (listTypeRow && Boolean(listTypeRow['has_meal_categories'])) {
      const { count, error: mealsError } = await this.supabase.supabase
        .from('base_meals')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .eq('list_type_id', listTypeId);

      if (mealsError) {
        throw mealsError;
      }

      itemCount += count ?? 0;
    }

    return itemCount === 0;
  }

  private refresh(): void {
    this.refresh$.next();
  }
}
