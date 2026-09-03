import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { mapBaseMeal } from '@core/database/sqlite-mappers';
import { SqliteRepository } from '@core/database/sqlite.repository';
import type { BaseMeal, BaseMealInput } from '@core/models/base-meal.model';
import { LiveQueryService } from './live-query.service';

@Injectable({ providedIn: 'root' })
export class BaseMealService {
  private readonly liveQuery = inject(LiveQueryService);
  private readonly repo = inject(SqliteRepository);

  getMeals(listTypeId: number): Observable<BaseMeal[]> {
    return this.liveQuery.observe(async () => {
      const rows = await this.repo.query<Record<string, unknown>>(
        'SELECT id, listTypeId, name, recipeUrl, orderIndex FROM baseMeals WHERE listTypeId = ? ORDER BY orderIndex;',
        [listTypeId],
      );
      return rows.map(mapBaseMeal);
    });
  }

  async create(input: BaseMealInput): Promise<number> {
    return this.repo.insert('baseMeals', {
      listTypeId: input.listTypeId,
      name: input.name,
      recipeUrl: input.recipeUrl,
      orderIndex: input.order,
    });
  }

  async update(id: number, changes: Partial<BaseMealInput>): Promise<void> {
    await this.repo.update('baseMeals', id, {
      listTypeId: changes.listTypeId,
      name: changes.name,
      recipeUrl: changes.recipeUrl,
      orderIndex: changes.order,
    });
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete('baseMeals', id);
  }

  async getNextOrder(listTypeId: number): Promise<number> {
    const rows = await this.repo.query<Record<string, unknown>>(
      'SELECT orderIndex FROM baseMeals WHERE listTypeId = ? ORDER BY orderIndex DESC LIMIT 1;',
      [listTypeId],
    );
    const last = rows[0];
    return (last ? Number(last['orderIndex']) : -1) + 1;
  }

  async count(listTypeId: number): Promise<number> {
    const rows = await this.repo.query<Record<string, unknown>>(
      'SELECT COUNT(*) as count FROM baseMeals WHERE listTypeId = ?;',
      [listTypeId],
    );
    return Number(rows[0]?.['count'] ?? 0);
  }
}
