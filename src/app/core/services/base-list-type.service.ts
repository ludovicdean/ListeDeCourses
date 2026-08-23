import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { from, type Observable } from 'rxjs';

import { DEFAULT_LIST_TYPES } from '../constants/list-types';
import { shoppingDb } from '../database/shopping-db';
import type { BaseListType } from '../models/base-list-type.model';

@Injectable({ providedIn: 'root' })
export class BaseListTypeService {
  readonly listTypes$: Observable<BaseListType[]> = from(
    liveQuery(() => shoppingDb.baseListTypes.orderBy('order').toArray()),
  );

  getById(id: number): Observable<BaseListType | undefined> {
    return from(liveQuery(() => shoppingDb.baseListTypes.get(id)));
  }

  async ensureDefaultTypes(): Promise<void> {
    const count = await shoppingDb.baseListTypes.count();
    if (count > 0) {
      return;
    }

    for (const listType of DEFAULT_LIST_TYPES) {
      await shoppingDb.baseListTypes.add({ ...listType });
    }
  }

  async getWeeklyListTypeId(): Promise<number> {
    const weekly = await shoppingDb.baseListTypes.filter((type) => type.hasMealCategories).first();
    if (!weekly?.id) {
      throw new Error('WEEKLY_LIST_TYPE_MISSING');
    }

    return weekly.id;
  }
}
