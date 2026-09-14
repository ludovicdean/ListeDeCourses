import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, type Observable, switchMap } from 'rxjs';

import { mapSupabaseBaseCategory } from '@core/database/supabase-mapper';
import type { BaseCategory, BaseCategoryInput } from '@core/models/base-category.model';
import { isSpecialCategory } from '@core/models/base-category.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class BaseCategoryService {
  private readonly supabase = inject(SupabaseService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  getStandardCategories(listTypeId: number): Observable<BaseCategory[]> {
    return this.refresh$.pipe(
      switchMap(async () => {
        const { data, error } = await this.supabase.supabase
          .from('base_categories')
          .select('id, list_type_id, name, order_index, type')
          .eq('user_id', this.supabase.userId)
          .eq('list_type_id', listTypeId)
          .eq('type', 'standard')
          .order('order_index');

        if (error) {
          throw error;
        }

        return (data ?? []).map(mapSupabaseBaseCategory);
      }),
    );
  }

  getById(id: number): Observable<BaseCategory | undefined> {
    return this.refresh$.pipe(
      switchMap(async () => {
        const { data, error } = await this.supabase.supabase
          .from('base_categories')
          .select('id, list_type_id, name, order_index, type')
          .eq('user_id', this.supabase.userId)
          .eq('id', id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data ? mapSupabaseBaseCategory(data) : undefined;
      }),
    );
  }

  getIngredientsCategory(listTypeId: number): Observable<BaseCategory | undefined> {
    return this.refresh$.pipe(
      switchMap(async () => {
        const { data, error } = await this.supabase.supabase
          .from('base_categories')
          .select('id, list_type_id, name, order_index, type')
          .eq('user_id', this.supabase.userId)
          .eq('list_type_id', listTypeId)
          .eq('type', 'ingredients')
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data ? mapSupabaseBaseCategory(data) : undefined;
      }),
    );
  }

  getMealsCategory(listTypeId: number): Observable<BaseCategory | undefined> {
    return this.refresh$.pipe(
      switchMap(async () => {
        const { data, error } = await this.supabase.supabase
          .from('base_categories')
          .select('id, list_type_id, name, order_index, type')
          .eq('user_id', this.supabase.userId)
          .eq('list_type_id', listTypeId)
          .eq('type', 'meals')
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data ? mapSupabaseBaseCategory(data) : undefined;
      }),
    );
  }

  async create(input: BaseCategoryInput): Promise<number> {
    const { data, error } = await this.supabase.supabase
      .from('base_categories')
      .insert({
        user_id: this.supabase.userId,
        list_type_id: input.listTypeId,
        name: input.name,
        order_index: input.order,
        type: input.type,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw error ?? new Error('Impossible de créer la catégorie');
    }

    this.refresh();
    return Number(data['id']);
  }

  async update(id: number, changes: Partial<BaseCategoryInput>): Promise<void> {
    const { data: existing, error: fetchError } = await this.supabase.supabase
      .from('base_categories')
      .select('type')
      .eq('user_id', this.supabase.userId)
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existing && isSpecialCategory({ type: existing['type'] } as BaseCategory)) {
      return;
    }

    const payload: Record<string, unknown> = {};
    if (changes.listTypeId !== undefined) {
      payload['list_type_id'] = changes.listTypeId;
    }
    if (changes.name !== undefined) {
      payload['name'] = changes.name;
    }
    if (changes.order !== undefined) {
      payload['order_index'] = changes.order;
    }
    if (changes.type !== undefined) {
      payload['type'] = changes.type;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    const { error } = await this.supabase.supabase
      .from('base_categories')
      .update(payload)
      .eq('user_id', this.supabase.userId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    this.refresh();
  }

  async delete(id: number): Promise<void> {
    const { data: existing, error: fetchError } = await this.supabase.supabase
      .from('base_categories')
      .select('type')
      .eq('user_id', this.supabase.userId)
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!existing || isSpecialCategory({ type: existing['type'] } as BaseCategory)) {
      return;
    }

    const { error: productsError } = await this.supabase.supabase
      .from('base_products')
      .delete()
      .eq('user_id', this.supabase.userId)
      .eq('category_id', id);

    if (productsError) {
      throw productsError;
    }

    const { error: categoryError } = await this.supabase.supabase
      .from('base_categories')
      .delete()
      .eq('user_id', this.supabase.userId)
      .eq('id', id);

    if (categoryError) {
      throw categoryError;
    }

    this.refresh();
  }

  async getNextOrder(listTypeId: number): Promise<number> {
    const { data, error } = await this.supabase.supabase
      .from('base_categories')
      .select('order_index')
      .eq('user_id', this.supabase.userId)
      .eq('list_type_id', listTypeId)
      .eq('type', 'standard')
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ? Number(data['order_index']) : -1) + 1;
  }

  private refresh(): void {
    this.refresh$.next();
  }
}
