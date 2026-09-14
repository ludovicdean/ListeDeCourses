import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, type Observable, switchMap } from 'rxjs';

import { mapSupabaseBaseProduct } from '@core/database/supabase-mapper';
import type { BaseProduct, BaseProductInput } from '@core/models/base-product.model';
import { HouseholdService } from './household.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class BaseProductService {
  private readonly supabase = inject(SupabaseService);
  private readonly householdService = inject(HouseholdService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  getByCategory(categoryId: number): Observable<BaseProduct[]> {
    return this.refresh$.pipe(
      switchMap(async () => {
        const { data, error } = await this.supabase.supabase
          .from('base_products')
          .select('id, category_id, name, quantity, order_index')
          .eq('household_id', this.householdService.householdId)
          .eq('category_id', categoryId)
          .order('order_index');

        if (error) {
          throw error;
        }

        return (data ?? []).map(mapSupabaseBaseProduct);
      }),
    );
  }

  async create(input: BaseProductInput): Promise<number> {
    const { data, error } = await this.supabase.supabase
      .from('base_products')
      .insert({
        user_id: this.supabase.userId,
        household_id: this.householdService.householdId,
        category_id: input.categoryId,
        name: input.name,
        quantity: input.quantity ?? null,
        order_index: input.order,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw error ?? new Error('Impossible de créer le produit');
    }

    this.refresh();
    return Number(data['id']);
  }

  async update(id: number, changes: Partial<BaseProductInput>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (changes.categoryId !== undefined) {
      payload['category_id'] = changes.categoryId;
    }
    if (changes.name !== undefined) {
      payload['name'] = changes.name;
    }
    if (changes.quantity !== undefined) {
      payload['quantity'] = changes.quantity ?? null;
    }
    if (changes.order !== undefined) {
      payload['order_index'] = changes.order;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    const { error } = await this.supabase.supabase
      .from('base_products')
      .update(payload)
      .eq('household_id', this.householdService.householdId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    this.refresh();
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('base_products')
      .delete()
      .eq('household_id', this.householdService.householdId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    this.refresh();
  }

  async getNextOrder(categoryId: number): Promise<number> {
    const { data, error } = await this.supabase.supabase
      .from('base_products')
      .select('order_index')
      .eq('household_id', this.householdService.householdId)
      .eq('category_id', categoryId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ? Number(data['order_index']) : -1) + 1;
  }

  async count(): Promise<number> {
    const { count, error } = await this.supabase.supabase
      .from('base_products')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', this.householdService.householdId);

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  private refresh(): void {
    this.refresh$.next();
  }
}
