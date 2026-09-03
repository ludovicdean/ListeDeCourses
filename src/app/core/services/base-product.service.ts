import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { mapBaseProduct } from '@core/database/sqlite-mappers';
import { SqliteRepository } from '@core/database/sqlite.repository';
import type { BaseProduct, BaseProductInput } from '@core/models/base-product.model';
import { LiveQueryService } from './live-query.service';

@Injectable({ providedIn: 'root' })
export class BaseProductService {
  private readonly liveQuery = inject(LiveQueryService);
  private readonly repo = inject(SqliteRepository);

  getByCategory(categoryId: number): Observable<BaseProduct[]> {
    return this.liveQuery.observe(async () => {
      const rows = await this.repo.query<Record<string, unknown>>(
        'SELECT id, categoryId, name, quantity, orderIndex FROM baseProducts WHERE categoryId = ? ORDER BY orderIndex;',
        [categoryId],
      );
      return rows.map(mapBaseProduct);
    });
  }

  async create(input: BaseProductInput): Promise<number> {
    return this.repo.insert('baseProducts', {
      categoryId: input.categoryId,
      name: input.name,
      quantity: input.quantity,
      orderIndex: input.order,
    });
  }

  async update(id: number, changes: Partial<BaseProductInput>): Promise<void> {
    await this.repo.update('baseProducts', id, {
      categoryId: changes.categoryId,
      name: changes.name,
      quantity: changes.quantity,
      orderIndex: changes.order,
    });
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete('baseProducts', id);
  }

  async getNextOrder(categoryId: number): Promise<number> {
    const rows = await this.repo.query<Record<string, unknown>>(
      'SELECT orderIndex FROM baseProducts WHERE categoryId = ? ORDER BY orderIndex DESC LIMIT 1;',
      [categoryId],
    );
    const last = rows[0];
    return (last ? Number(last['orderIndex']) : -1) + 1;
  }

  async count(): Promise<number> {
    const rows = await this.repo.query<Record<string, unknown>>('SELECT COUNT(*) as count FROM baseProducts;');
    return Number(rows[0]?.['count'] ?? 0);
  }
}
