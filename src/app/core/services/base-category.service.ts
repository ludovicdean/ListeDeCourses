import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { from, type Observable } from 'rxjs';

import {
  INGREDIENTS_CATEGORY_NAME,
  INGREDIENTS_CATEGORY_ORDER,
  MEALS_CATEGORY_NAME,
  MEALS_CATEGORY_ORDER,
} from '../constants/special-categories';
import { shoppingDb } from '../database/shopping-db';
import type { BaseCategory, BaseCategoryInput } from '../models/base-category.model';
import { isSpecialCategory } from '../models/base-category.model';

@Injectable({ providedIn: 'root' })
export class BaseCategoryService {
  getStandardCategories(listTypeId: number): Observable<BaseCategory[]> {
    return from(
      liveQuery(() =>
        shoppingDb.baseCategories
          .where('[listTypeId+type]')
          .equals([listTypeId, 'standard'])
          .sortBy('order'),
      ),
    );
  }

  getById(id: number): Observable<BaseCategory | undefined> {
    return from(liveQuery(() => shoppingDb.baseCategories.get(id)));
  }

  getIngredientsCategory(listTypeId: number): Observable<BaseCategory | undefined> {
    return from(
      liveQuery(() =>
        shoppingDb.baseCategories.where('[listTypeId+type]').equals([listTypeId, 'ingredients']).first(),
      ),
    );
  }

  getMealsCategory(listTypeId: number): Observable<BaseCategory | undefined> {
    return from(
      liveQuery(() =>
        shoppingDb.baseCategories.where('[listTypeId+type]').equals([listTypeId, 'meals']).first(),
      ),
    );
  }

  async create(input: BaseCategoryInput): Promise<number> {
    return shoppingDb.baseCategories.add(input);
  }

  async update(id: number, changes: Partial<BaseCategoryInput>): Promise<void> {
    const category = await shoppingDb.baseCategories.get(id);
    if (category && isSpecialCategory(category)) {
      return;
    }

    await shoppingDb.baseCategories.update(id, changes);
  }

  async delete(id: number): Promise<void> {
    const category = await shoppingDb.baseCategories.get(id);
    if (!category || isSpecialCategory(category)) {
      return;
    }

    await shoppingDb.transaction('rw', shoppingDb.baseCategories, shoppingDb.baseProducts, async () => {
      await shoppingDb.baseProducts.where('categoryId').equals(id).delete();
      await shoppingDb.baseCategories.delete(id);
    });
  }

  async getNextOrder(listTypeId: number): Promise<number> {
    const categories = await shoppingDb.baseCategories
      .where('[listTypeId+type]')
      .equals([listTypeId, 'standard'])
      .sortBy('order');
    const last = categories.at(-1);
    return (last?.order ?? -1) + 1;
  }

  async ensureSpecialCategories(listTypeId: number): Promise<void> {
    const listType = await shoppingDb.baseListTypes.get(listTypeId);
    if (!listType?.hasMealCategories) {
      return;
    }

    const ingredients = await shoppingDb.baseCategories
      .where('[listTypeId+type]')
      .equals([listTypeId, 'ingredients'])
      .first();
    if (!ingredients) {
      await shoppingDb.baseCategories.add({
        listTypeId,
        name: INGREDIENTS_CATEGORY_NAME,
        order: INGREDIENTS_CATEGORY_ORDER,
        type: 'ingredients',
      });
    }

    const meals = await shoppingDb.baseCategories
      .where('[listTypeId+type]')
      .equals([listTypeId, 'meals'])
      .first();
    if (!meals) {
      await shoppingDb.baseCategories.add({
        listTypeId,
        name: MEALS_CATEGORY_NAME,
        order: MEALS_CATEGORY_ORDER,
        type: 'meals',
      });
    }
  }
}
