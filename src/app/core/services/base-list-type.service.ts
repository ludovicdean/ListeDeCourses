import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, type Observable, switchMap } from 'rxjs';

import { DEFAULT_LIST_TYPES } from '@core/constants/list-type.config';
import { mapSupabaseBaseListType } from '@core/database/supabase-mapper';
import type { BaseListType } from '@core/models/base-list-type.model';
import { HouseholdService } from './household.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class BaseListTypeService {
  private readonly supabase = inject(SupabaseService);
  private readonly householdService = inject(HouseholdService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly listTypes$: Observable<BaseListType[]> = this.refresh$.pipe(
    switchMap(() => this.fetchListTypes()),
  );

  getById(id: number): Observable<BaseListType | undefined> {
    return this.refresh$.pipe(
      switchMap(async () => {
        const { data, error } = await this.supabase.supabase
          .from('base_list_types')
          .select('id, name, order_index, has_meal_categories')
          .eq('id', id)
          .eq('household_id', this.householdService.householdId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data ? mapSupabaseBaseListType(data) : undefined;
      }),
    );
  }

  async ensureDefaultTypes(): Promise<void> {
    const userId = this.supabase.userId;
    const householdId = this.householdService.householdId;

    for (const listType of DEFAULT_LIST_TYPES) {
      const { data: existing } = await this.supabase.supabase
        .from('base_list_types')
        .select('id')
        .eq('household_id', householdId)
        .eq('name', listType.name)
        .maybeSingle();

      if (existing) {
        continue;
      }

      const { error } = await this.supabase.supabase.from('base_list_types').insert({
        user_id: userId,
        household_id: householdId,
        name: listType.name,
        order_index: listType.order,
        has_meal_categories: listType.hasMealCategories,
      });

      if (error) {
        throw error;
      }
    }

    this.refresh();
  }

  async getWeeklyListTypeId(): Promise<number> {
    const { data, error } = await this.supabase.supabase
      .from('base_list_types')
      .select('id')
      .eq('household_id', this.householdService.householdId)
      .eq('has_meal_categories', true)
      .order('order_index')
      .limit(1)
      .maybeSingle();

    if (error || !data?.['id']) {
      throw new Error('WEEKLY_LIST_TYPE_MISSING');
    }

    return Number(data['id']);
  }

  private refresh(): void {
    this.refresh$.next();
  }

  private async fetchListTypes(): Promise<BaseListType[]> {
    const { data, error } = await this.supabase.supabase
      .from('base_list_types')
      .select('id, name, order_index, has_meal_categories')
      .eq('household_id', this.householdService.householdId)
      .order('order_index');

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapSupabaseBaseListType);
  }
}
