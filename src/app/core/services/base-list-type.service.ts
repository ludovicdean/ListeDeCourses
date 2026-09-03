import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { DEFAULT_LIST_TYPES } from '@core/constants/list-type.config';
import { shoppingDb } from '@core/database/shopping-db';
import type { BaseListType } from '@core/models/base-list-type.model';
import { LiveQueryService } from './live-query.service';

@Injectable({ providedIn: 'root' })
export class BaseListTypeService {
  private readonly liveQuery = inject(LiveQueryService);

  readonly listTypes$: Observable<BaseListType[]> = this.liveQuery.observe(() =>
    shoppingDb.baseListTypes.orderBy('order').toArray(),
  );

  getById(id: number): Observable<BaseListType | undefined> {
    return this.liveQuery.observe(() => shoppingDb.baseListTypes.get(id));
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
