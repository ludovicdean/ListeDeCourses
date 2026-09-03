import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { shoppingDb } from '@core/database/shopping-db';
import type { BaseMeal, BaseMealInput } from '@core/models/base-meal.model';
import { LiveQueryService } from './live-query.service';

@Injectable({ providedIn: 'root' })
export class BaseMealService {
  private readonly liveQuery = inject(LiveQueryService);

  getMeals(listTypeId: number): Observable<BaseMeal[]> {
    return this.liveQuery.observe(() =>
      shoppingDb.baseMeals.where('listTypeId').equals(listTypeId).sortBy('order'),
    );
  }

  async create(input: BaseMealInput): Promise<number> {
    return shoppingDb.baseMeals.add(input);
  }

  async update(id: number, changes: Partial<BaseMealInput>): Promise<void> {
    await shoppingDb.baseMeals.update(id, changes);
  }

  async delete(id: number): Promise<void> {
    await shoppingDb.baseMeals.delete(id);
  }

  async getNextOrder(listTypeId: number): Promise<number> {
    const last = await shoppingDb.baseMeals.where('listTypeId').equals(listTypeId).sortBy('order');
    return (last.at(-1)?.order ?? -1) + 1;
  }

  async count(listTypeId: number): Promise<number> {
    return shoppingDb.baseMeals.where('listTypeId').equals(listTypeId).count();
  }
}
