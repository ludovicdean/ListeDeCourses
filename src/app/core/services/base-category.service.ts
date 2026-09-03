import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import {
  INGREDIENTS_CATEGORY_NAME,
  INGREDIENTS_CATEGORY_ORDER,
  MEALS_CATEGORY_NAME,
  MEALS_CATEGORY_ORDER,
} from '@core/constants/special-categories';
import { mapBaseCategory, toSqliteBoolean } from '@core/database/sqlite-mappers';
import { SqliteRepository } from '@core/database/sqlite.repository';
import type { BaseCategory, BaseCategoryInput } from '@core/models/base-category.model';
import { isSpecialCategory } from '@core/models/base-category.model';
import { BaseListTypeService } from './base-list-type.service';
import { LiveQueryService } from './live-query.service';

@Injectable({ providedIn: 'root' })
export class BaseCategoryService {
  private readonly liveQuery = inject(LiveQueryService);
  private readonly repo = inject(SqliteRepository);
  private readonly listTypeService = inject(BaseListTypeService);

  getStandardCategories(listTypeId: number): Observable<BaseCategory[]> {
    return this.liveQuery.observe(async () => {
      const rows = await this.repo.query<Record<string, unknown>>(
        'SELECT id, listTypeId, name, orderIndex, type FROM baseCategories WHERE listTypeId = ? AND type = ? ORDER BY orderIndex;',
        [listTypeId, 'standard'],
      );
      return rows.map(mapBaseCategory);
    });
  }

  getById(id: number): Observable<BaseCategory | undefined> {
    return this.liveQuery.observe(async () => {
      const row = await this.repo.get<Record<string, unknown>>(
        'SELECT id, listTypeId, name, orderIndex, type FROM baseCategories WHERE id = ?;',
        [id],
      );
      return row ? mapBaseCategory(row) : undefined;
    });
  }

  getIngredientsCategory(listTypeId: number): Observable<BaseCategory | undefined> {
    return this.liveQuery.observe(async () => {
      const row = await this.repo.get<Record<string, unknown>>(
        'SELECT id, listTypeId, name, orderIndex, type FROM baseCategories WHERE listTypeId = ? AND type = ?;',
        [listTypeId, 'ingredients'],
      );
      return row ? mapBaseCategory(row) : undefined;
    });
  }

  getMealsCategory(listTypeId: number): Observable<BaseCategory | undefined> {
    return this.liveQuery.observe(async () => {
      const row = await this.repo.get<Record<string, unknown>>(
        'SELECT id, listTypeId, name, orderIndex, type FROM baseCategories WHERE listTypeId = ? AND type = ?;',
        [listTypeId, 'meals'],
      );
      return row ? mapBaseCategory(row) : undefined;
    });
  }

  async create(input: BaseCategoryInput): Promise<number> {
    return this.repo.insert('baseCategories', {
      listTypeId: input.listTypeId,
      name: input.name,
      orderIndex: input.order,
      type: input.type,
    });
  }

  async update(id: number, changes: Partial<BaseCategoryInput>): Promise<void> {
    const row = await this.repo.get<Record<string, unknown>>(
      'SELECT type FROM baseCategories WHERE id = ?;',
      [id],
    );
    if (row && isSpecialCategory({ type: row['type'] } as BaseCategory)) {
      return;
    }

    await this.repo.update('baseCategories', id, {
      listTypeId: changes.listTypeId,
      name: changes.name,
      orderIndex: changes.order,
      type: changes.type,
    });
  }

  async delete(id: number): Promise<void> {
    const row = await this.repo.get<Record<string, unknown>>(
      'SELECT type FROM baseCategories WHERE id = ?;',
      [id],
    );
    if (!row || isSpecialCategory({ type: row['type'] } as BaseCategory)) {
      return;
    }

    await this.repo.transaction(async () => {
      await this.repo.exec({
        sql: 'DELETE FROM baseProducts WHERE categoryId = ?;',
        bind: [id],
      });
      await this.repo.exec({
        sql: 'DELETE FROM baseCategories WHERE id = ?;',
        bind: [id],
      });
    });
  }

  async getNextOrder(listTypeId: number): Promise<number> {
    const rows = await this.repo.query<Record<string, unknown>>(
      'SELECT orderIndex FROM baseCategories WHERE listTypeId = ? AND type = ? ORDER BY orderIndex DESC LIMIT 1;',
      [listTypeId, 'standard'],
    );
    const last = rows[0];
    return (last ? Number(last['orderIndex']) : -1) + 1;
  }

  async ensureSpecialCategories(listTypeId: number): Promise<void> {
    const listTypeRow = await this.repo.get<Record<string, unknown>>(
      'SELECT hasMealCategories FROM baseListTypes WHERE id = ?;',
      [listTypeId],
    );
    if (!listTypeRow || !toSqliteBoolean(Boolean(listTypeRow['hasMealCategories']))) {
      return;
    }

    const ingredients = await this.repo.get<Record<string, unknown>>(
      'SELECT id FROM baseCategories WHERE listTypeId = ? AND type = ?;',
      [listTypeId, 'ingredients'],
    );
    if (!ingredients) {
      await this.repo.insert('baseCategories', {
        listTypeId,
        name: INGREDIENTS_CATEGORY_NAME,
        orderIndex: INGREDIENTS_CATEGORY_ORDER,
        type: 'ingredients',
      });
    }

    const meals = await this.repo.get<Record<string, unknown>>(
      'SELECT id FROM baseCategories WHERE listTypeId = ? AND type = ?;',
      [listTypeId, 'meals'],
    );
    if (!meals) {
      await this.repo.insert('baseCategories', {
        listTypeId,
        name: MEALS_CATEGORY_NAME,
        orderIndex: MEALS_CATEGORY_ORDER,
        type: 'meals',
      });
    }
  }
}
