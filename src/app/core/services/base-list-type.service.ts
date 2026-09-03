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
    const rows = await this.repo.query<Record<string, unknown>>('SELECT COUNT(*) as count FROM baseListTypes;');
    const count = Number(rows[0]?.['count'] ?? 0);
    if (count > 0) {
      return;
    }

    for (const listType of DEFAULT_LIST_TYPES) {
      await this.repo.insert('baseListTypes', {
        name: listType.name,
        orderIndex: listType.order,
        hasMealCategories: toSqliteBoolean(listType.hasMealCategories),
      });
    }
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
