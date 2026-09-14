import { Injectable, inject } from '@angular/core';

import { BASE_LIST_SEED } from '@core/data/base-list.seed';
import {
  INGREDIENTS_CATEGORY_NAME,
  INGREDIENTS_CATEGORY_ORDER,
  MEALS_CATEGORY_NAME,
  MEALS_CATEGORY_ORDER,
} from '@core/constants/special-categories';
import { BaseListTypeService } from './base-list-type.service';
import { HouseholdService } from './household.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class BaseListCatalogSeedService {
  private readonly supabase = inject(SupabaseService);
  private readonly householdService = inject(HouseholdService);
  private readonly listTypes = inject(BaseListTypeService);

  async ensureWeeklyCatalogIfEmpty(): Promise<void> {
    const userId = this.supabase.userId;
    const householdId = this.householdService.householdId;
    const weeklyListTypeId = await this.listTypes.getWeeklyListTypeId();

    const { count } = await this.supabase.supabase
      .from('base_categories')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('list_type_id', weeklyListTypeId)
      .eq('type', 'standard');

    if ((count ?? 0) > 0) {
      await this.ensureSpecialCategories(weeklyListTypeId);
      return;
    }

    for (const [categoryOrder, categorySeed] of BASE_LIST_SEED.entries()) {
      const { data: category, error: categoryError } = await this.supabase.supabase
        .from('base_categories')
        .insert({
          user_id: userId,
          household_id: householdId,
          list_type_id: weeklyListTypeId,
          name: categorySeed.name,
          order_index: categoryOrder,
          type: 'standard',
        })
        .select('id')
        .single();

      if (categoryError || !category) {
        throw categoryError ?? new Error('Impossible de créer la catégorie');
      }

      const products = categorySeed.products.map((name, productOrder) => ({
        user_id: userId,
        household_id: householdId,
        category_id: category.id,
        name,
        order_index: productOrder,
      }));

      const { error: productsError } = await this.supabase.supabase
        .from('base_products')
        .insert(products);

      if (productsError) {
        throw productsError;
      }
    }

    await this.ensureSpecialCategories(weeklyListTypeId);
  }

  private async ensureSpecialCategories(listTypeId: number): Promise<void> {
    const userId = this.supabase.userId;
    const householdId = this.householdService.householdId;

    for (const special of [
      { name: INGREDIENTS_CATEGORY_NAME, order: INGREDIENTS_CATEGORY_ORDER, type: 'ingredients' },
      { name: MEALS_CATEGORY_NAME, order: MEALS_CATEGORY_ORDER, type: 'meals' },
    ]) {
      const { data: existing } = await this.supabase.supabase
        .from('base_categories')
        .select('id')
        .eq('household_id', householdId)
        .eq('list_type_id', listTypeId)
        .eq('type', special.type)
        .maybeSingle();

      if (existing) {
        continue;
      }

      const { error } = await this.supabase.supabase.from('base_categories').insert({
        user_id: userId,
        household_id: householdId,
        list_type_id: listTypeId,
        name: special.name,
        order_index: special.order,
        type: special.type,
      });

      if (error) {
        throw error;
      }
    }
  }
}
