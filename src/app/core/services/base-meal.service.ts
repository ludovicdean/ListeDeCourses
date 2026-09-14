import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, type Observable, switchMap } from 'rxjs';

import { mapSupabaseBaseMeal } from '@core/database/supabase-mapper';
import type { BaseMeal, BaseMealInput } from '@core/models/base-meal.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class BaseMealService {
  private readonly supabase = inject(SupabaseService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  getMeals(listTypeId: number): Observable<BaseMeal[]> {
    return this.refresh$.pipe(
      switchMap(async () => {
        const { data, error } = await this.supabase.supabase
          .from('base_meals')
          .select('id, list_type_id, name, recipe_url, order_index')
          .eq('user_id', this.supabase.userId)
          .eq('list_type_id', listTypeId)
          .order('order_index');

        if (error) {
          throw error;
        }

        return (data ?? []).map(mapSupabaseBaseMeal);
      }),
    );
  }

  async create(input: BaseMealInput): Promise<number> {
    const { data, error } = await this.supabase.supabase
      .from('base_meals')
      .insert({
        user_id: this.supabase.userId,
        list_type_id: input.listTypeId,
        name: input.name,
        recipe_url: input.recipeUrl ?? null,
        order_index: input.order,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw error ?? new Error('Impossible de créer le repas');
    }

    this.refresh();
    return Number(data['id']);
  }

  async update(id: number, changes: Partial<BaseMealInput>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (changes.listTypeId !== undefined) {
      payload['list_type_id'] = changes.listTypeId;
    }
    if (changes.name !== undefined) {
      payload['name'] = changes.name;
    }
    if (changes.recipeUrl !== undefined) {
      payload['recipe_url'] = changes.recipeUrl ?? null;
    }
    if (changes.order !== undefined) {
      payload['order_index'] = changes.order;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    const { error } = await this.supabase.supabase
      .from('base_meals')
      .update(payload)
      .eq('user_id', this.supabase.userId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    this.refresh();
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('base_meals')
      .delete()
      .eq('user_id', this.supabase.userId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    this.refresh();
  }

  async getNextOrder(listTypeId: number): Promise<number> {
    const { data, error } = await this.supabase.supabase
      .from('base_meals')
      .select('order_index')
      .eq('user_id', this.supabase.userId)
      .eq('list_type_id', listTypeId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ? Number(data['order_index']) : -1) + 1;
  }

  async count(listTypeId: number): Promise<number> {
    const { count, error } = await this.supabase.supabase
      .from('base_meals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', this.supabase.userId)
      .eq('list_type_id', listTypeId);

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  private refresh(): void {
    this.refresh$.next();
  }
}
