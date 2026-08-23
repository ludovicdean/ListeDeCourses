import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { from, type Observable } from 'rxjs';

import { shoppingDb } from '../database/shopping-db';
import type { BaseProduct, BaseProductInput } from '../models/base-product.model';

@Injectable({ providedIn: 'root' })
export class BaseProductService {
  getByCategory(categoryId: number): Observable<BaseProduct[]> {
    return from(
      liveQuery(() =>
        shoppingDb.baseProducts.where('categoryId').equals(categoryId).sortBy('order'),
      ),
    );
  }

  async create(input: BaseProductInput): Promise<number> {
    return shoppingDb.baseProducts.add(input);
  }

  async update(id: number, changes: Partial<BaseProductInput>): Promise<void> {
    await shoppingDb.baseProducts.update(id, changes);
  }

  async delete(id: number): Promise<void> {
    await shoppingDb.baseProducts.delete(id);
  }

  async getNextOrder(categoryId: number): Promise<number> {
    const last = await shoppingDb.baseProducts
      .where('categoryId')
      .equals(categoryId)
      .sortBy('order')
      .then((products) => products.at(-1));

    return (last?.order ?? -1) + 1;
  }

  async count(): Promise<number> {
    return shoppingDb.baseProducts.count();
  }
}
