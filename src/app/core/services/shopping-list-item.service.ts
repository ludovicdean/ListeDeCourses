import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, type Observable, switchMap } from 'rxjs';

import {
  INGREDIENTS_CATEGORY_NAME,
  INGREDIENTS_CATEGORY_ORDER,
  MEALS_CATEGORY_NAME,
  MEALS_CATEGORY_ORDER,
} from '@core/constants/special-categories';
import {
  mapSupabaseBaseMeal,
  mapSupabaseShoppingListItem,
} from '@core/database/supabase-mapper';
import type {
  ShoppingListCategoryGroup,
  ShoppingListItem,
  ShoppingListStatus,
} from '@core/models/shopping-list.model';
import { HouseholdService } from './household.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ShoppingListItemService {
  private readonly supabase = inject(SupabaseService);
  private readonly householdService = inject(HouseholdService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  getGroupedItems(
    listId: number,
    statusOverride?: ShoppingListStatus,
  ): Observable<ShoppingListCategoryGroup[]> {
    return this.refresh$.pipe(
      switchMap(async () => {
        const householdId = this.householdService.householdId;

        const { data: listRow, error: listError } = await this.supabase.supabase
          .from('shopping_lists')
          .select('list_type_id, status')
          .eq('household_id', householdId)
          .eq('id', listId)
          .maybeSingle();

        if (listError) {
          throw listError;
        }

        let hasMealCategories = false;
        if (listRow) {
          const { data: listTypeRow, error: listTypeError } = await this.supabase.supabase
            .from('base_list_types')
            .select('has_meal_categories')
            .eq('household_id', householdId)
            .eq('id', listRow['list_type_id'])
            .maybeSingle();

          if (listTypeError) {
            throw listTypeError;
          }

          hasMealCategories = Boolean(listTypeRow?.['has_meal_categories']);
        }

        const status = statusOverride ?? (listRow ? (String(listRow['status']) as ShoppingListStatus) : undefined);

        let query = this.supabase.supabase
          .from('shopping_list_items')
          .select(
            'id, shopping_list_id, category_name, category_order, product_name, product_order, quantity, checked, picked_up, item_type, recipe_url',
          )
          .eq('household_id', householdId)
          .eq('shopping_list_id', listId);

        if (status === 'shopping' || status === 'completed') {
          query = query.or('checked.eq.true,item_type.eq.ingredient,item_type.eq.meal');
        }

        const { data: itemRows, error: itemsError } = await query
          .order('category_order')
          .order('product_order');

        if (itemsError) {
          throw itemsError;
        }

        const items = (itemRows ?? []).map(mapSupabaseShoppingListItem);
        const groups = new Map<string, ShoppingListCategoryGroup>();

        for (const item of items) {
          if (item.itemType === 'meal' || item.categoryName === MEALS_CATEGORY_NAME) {
            continue;
          }

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

        return this.mergeSpecialCategoryGroups(
          groups,
          status as ShoppingListStatus,
          hasMealCategories,
        );
      }),
    );
  }

  getMealsForList(listId: number): Observable<ShoppingListItem[]> {
    return this.refresh$.pipe(
      switchMap(async () => {
        const householdId = this.householdService.householdId;

        const { data: listRow, error: listError } = await this.supabase.supabase
          .from('shopping_lists')
          .select('list_type_id')
          .eq('household_id', householdId)
          .eq('id', listId)
          .maybeSingle();

        if (listError) {
          throw listError;
        }

        if (!listRow) {
          return [];
        }

        const listTypeId = Number(listRow['list_type_id']);

        const { data: mealRows, error: mealsError } = await this.supabase.supabase
          .from('shopping_list_items')
          .select(
            'id, shopping_list_id, category_name, category_order, product_name, product_order, quantity, checked, picked_up, item_type, recipe_url',
          )
          .eq('household_id', householdId)
          .eq('shopping_list_id', listId)
          .eq('item_type', 'meal')
          .order('product_order');

        if (mealsError) {
          throw mealsError;
        }

        const sessionMeals = (mealRows ?? []).map(mapSupabaseShoppingListItem);
        if (sessionMeals.length > 0) {
          return sessionMeals;
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

        if (!listTypeRow || !Boolean(listTypeRow['has_meal_categories'])) {
          return [];
        }

        const { data: baseMealRows, error: baseMealsError } = await this.supabase.supabase
          .from('base_meals')
          .select('id, list_type_id, name, recipe_url, order_index')
          .eq('household_id', householdId)
          .eq('list_type_id', listTypeId)
          .order('order_index');

        if (baseMealsError) {
          throw baseMealsError;
        }

        const { data: mealsCategoryRow, error: mealsCategoryError } = await this.supabase.supabase
          .from('base_categories')
          .select('order_index')
          .eq('household_id', householdId)
          .eq('list_type_id', listTypeId)
          .eq('type', 'meals')
          .maybeSingle();

        if (mealsCategoryError) {
          throw mealsCategoryError;
        }

        const categoryOrder = mealsCategoryRow
          ? Number(mealsCategoryRow['order_index'])
          : MEALS_CATEGORY_ORDER;

        return (baseMealRows ?? []).map(mapSupabaseBaseMeal).map((meal) => ({
          shoppingListId: listId,
          categoryName: MEALS_CATEGORY_NAME,
          categoryOrder,
          productName: meal.name,
          productOrder: meal.order,
          quantity: 1,
          checked: false,
          pickedUp: false,
          itemType: 'meal' as const,
          recipeUrl: meal.recipeUrl,
        }));
      }),
    );
  }

  async addIngredient(listId: number, name: string, quantity: number): Promise<number> {
    const productOrder = await this.getNextOrderInCategory(listId, INGREDIENTS_CATEGORY_NAME);

    const { data, error } = await this.supabase.supabase
      .from('shopping_list_items')
      .insert({
        user_id: this.supabase.userId,
        household_id: this.householdService.householdId,
        shopping_list_id: listId,
        category_name: INGREDIENTS_CATEGORY_NAME,
        category_order: INGREDIENTS_CATEGORY_ORDER,
        product_name: name,
        product_order: productOrder,
        quantity,
        checked: false,
        picked_up: false,
        item_type: 'ingredient',
      })
      .select('id')
      .single();

    if (error || !data) {
      throw error ?? new Error("Impossible d'ajouter l'ingrédient");
    }

    this.refresh();
    return Number(data['id']);
  }

  async addMeal(listId: number, name: string, recipeUrl?: string): Promise<number> {
    const productOrder = await this.getNextOrderInCategory(listId, MEALS_CATEGORY_NAME);

    const { data, error } = await this.supabase.supabase
      .from('shopping_list_items')
      .insert({
        user_id: this.supabase.userId,
        household_id: this.householdService.householdId,
        shopping_list_id: listId,
        category_name: MEALS_CATEGORY_NAME,
        category_order: MEALS_CATEGORY_ORDER,
        product_name: name,
        product_order: productOrder,
        quantity: 1,
        checked: false,
        picked_up: false,
        item_type: 'meal',
        recipe_url: recipeUrl ?? null,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw error ?? new Error("Impossible d'ajouter le repas");
    }

    this.refresh();
    return Number(data['id']);
  }

  async updateIngredientItem(id: number, name: string, quantity: number): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('shopping_list_items')
      .update({ product_name: name, quantity })
      .eq('household_id', this.householdService.householdId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    this.refresh();
  }

  async updateMealItem(id: number, name: string, recipeUrl?: string): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('shopping_list_items')
      .update({ product_name: name, recipe_url: recipeUrl ?? null })
      .eq('household_id', this.householdService.householdId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    this.refresh();
  }

  async deleteItem(id: number): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('shopping_list_items')
      .delete()
      .eq('household_id', this.householdService.householdId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    this.refresh();
  }

  async updateItem(
    id: number,
    changes: Partial<Pick<ShoppingListItem, 'quantity' | 'checked' | 'pickedUp'>>,
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (changes.quantity !== undefined) {
      payload['quantity'] = changes.quantity;
    }
    if (changes.checked !== undefined) {
      payload['checked'] = changes.checked;
    }
    if (changes.pickedUp !== undefined) {
      payload['picked_up'] = changes.pickedUp;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    const { error } = await this.supabase.supabase
      .from('shopping_list_items')
      .update(payload)
      .eq('household_id', this.householdService.householdId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    this.refresh();
  }

  private mergeSpecialCategoryGroups(
    groups: Map<string, ShoppingListCategoryGroup>,
    status: ShoppingListStatus | undefined,
    hasMealCategories: boolean,
  ): ShoppingListCategoryGroup[] {
    const standard: ShoppingListCategoryGroup[] = [];
    let ingredients: ShoppingListCategoryGroup | undefined;

    for (const group of groups.values()) {
      if (group.categoryName === INGREDIENTS_CATEGORY_NAME) {
        ingredients = group;
      } else if (group.categoryName !== MEALS_CATEGORY_NAME) {
        standard.push(group);
      }
    }

    standard.sort((a, b) => a.categoryOrder - b.categoryOrder);

    const result = [...standard];

    if (ingredients?.items.length) {
      result.push(ingredients);
    } else if (status === 'preparing' && hasMealCategories) {
      result.push({
        categoryName: INGREDIENTS_CATEGORY_NAME,
        categoryOrder: INGREDIENTS_CATEGORY_ORDER,
        items: [],
      });
    }

    return result;
  }

  private async getNextOrderInCategory(listId: number, categoryName: string): Promise<number> {
    const { data, error } = await this.supabase.supabase
      .from('shopping_list_items')
      .select('product_order')
      .eq('household_id', this.householdService.householdId)
      .eq('shopping_list_id', listId)
      .eq('category_name', categoryName)
      .order('product_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ? Number(data['product_order']) : -1) + 1;
  }

  invalidate(): void {
    this.refresh$.next();
  }

  private refresh(): void {
    this.refresh$.next();
  }
}
