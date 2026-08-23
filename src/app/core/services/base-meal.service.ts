import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { from, type Observable } from 'rxjs';

import { shoppingDb } from '../database/shopping-db';
import type { BaseMeal, BaseMealInput } from '../models/base-meal.model';

@Injectable({ providedIn: 'root' })
export class BaseMealService {
  getMeals(listTypeId: number): Observable<BaseMeal[]> {
    return from(
      liveQuery(() =>
        shoppingDb.baseMeals.where('listTypeId').equals(listTypeId).sortBy('order'),
      ),
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
