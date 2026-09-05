import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { DEFAULT_LIST_TYPES } from '@core/constants/list-type.config';
import { mapBaseListType, toSqliteBoolean } from '@core/database/sqlite-mappers';
import { SqliteRepository } from '@core/database/sqlite.repository';
import type { BaseListType } from '@core/models/base-list-type.model';
import { LiveQueryService } from './live-query.service';

@Injectable({ providedIn: 'root' })
export class BaseListTypeService {
  private readonly liveQuery = inject(LiveQueryService);
  private readonly repo = inject(SqliteRepository);

  readonly listTypes$: Observable<BaseListType[]> = this.liveQuery.observe(async () => {
    const rows = await this.repo.query<Record<string, unknown>>(
      'SELECT id, name, orderIndex, hasMealCategories FROM baseListTypes ORDER BY orderIndex;',
    );
    return rows.map(mapBaseListType);
  });

  getById(id: number): Observable<BaseListType | undefined> {
    return this.liveQuery.observe(async () => {
      const row = await this.repo.get<Record<string, unknown>>(
        'SELECT id, name, orderIndex, hasMealCategories FROM baseListTypes WHERE id = ?;',
        [id],
      );
      return row ? mapBaseListType(row) : undefined;
    });
  }

  async ensureDefaultTypes(): Promise<void> {
    await this.deduplicateByName();

    for (const listType of DEFAULT_LIST_TYPES) {
      const existing = await this.repo.get<Record<string, unknown>>(
        'SELECT id FROM baseListTypes WHERE name = ? LIMIT 1;',
        [listType.name],
      );
      if (existing) {
        continue;
      }

      await this.repo.insert('baseListTypes', {
        name: listType.name,
        orderIndex: listType.order,
        hasMealCategories: toSqliteBoolean(listType.hasMealCategories),
      });
    }
  }

  private async deduplicateByName(): Promise<void> {
    const rows = await this.repo.query<Record<string, unknown>>(
      'SELECT id, name FROM baseListTypes ORDER BY id;',
    );

    const idsByName = new Map<string, number[]>();
    for (const row of rows) {
      const name = String(row['name']);
      const id = Number(row['id']);
      const ids = idsByName.get(name) ?? [];
      ids.push(id);
      idsByName.set(name, ids);
    }

    for (const ids of idsByName.values()) {
      if (ids.length <= 1) {
        continue;
      }

      const keepId = ids[0];
      const duplicateIds = ids.slice(1);

      for (const duplicateId of duplicateIds) {
        await this.repo.transaction(async () => {
          await this.repo.exec({
            sql: 'UPDATE baseCategories SET listTypeId = ? WHERE listTypeId = ?;',
            bind: [keepId, duplicateId],
          });
          await this.repo.exec({
            sql: 'UPDATE baseMeals SET listTypeId = ? WHERE listTypeId = ?;',
            bind: [keepId, duplicateId],
          });
          await this.repo.exec({
            sql: 'UPDATE shoppingLists SET listTypeId = ? WHERE listTypeId = ?;',
            bind: [keepId, duplicateId],
          });
          await this.repo.delete('baseListTypes', duplicateId);
        });
      }
    }

    await this.repo.exec({
      sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_list_types_name ON baseListTypes(name);',
    });
  }

  async getWeeklyListTypeId(): Promise<number> {
    const row = await this.repo.get<Record<string, unknown>>(
      'SELECT id FROM baseListTypes WHERE hasMealCategories = 1 ORDER BY orderIndex LIMIT 1;',
    );
    if (!row?.['id']) {
      throw new Error('WEEKLY_LIST_TYPE_MISSING');
    }

    return Number(row['id']);
  }
}
