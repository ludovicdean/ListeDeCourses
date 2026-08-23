import { inject, Injectable } from '@angular/core';

import { BASE_LIST_SEED } from '../data/base-list.seed';
import { shoppingDb } from '../database/shopping-db';
import { BaseCategoryService } from './base-category.service';
import { BaseListTypeService } from './base-list-type.service';
import { ShoppingListService } from './shopping-list.service';

@Injectable({ providedIn: 'root' })
export class BaseListSeedService {
  private readonly baseCategoryService = inject(BaseCategoryService);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly shoppingListService = inject(ShoppingListService);

  async seedIfEmpty(): Promise<void> {
    await this.baseListTypeService.ensureDefaultTypes();

    const listTypes = await shoppingDb.baseListTypes.orderBy('order').toArray();
    const weeklyType = listTypes.find((type) => type.hasMealCategories);
    if (!weeklyType?.id) {
      return;
    }

    const weeklyCategoryCount = await shoppingDb.baseCategories
      .where('listTypeId')
      .equals(weeklyType.id)
      .filter((category) => category.type === 'standard')
      .count();

    if (weeklyCategoryCount === 0) {
      await shoppingDb.transaction('rw', shoppingDb.baseCategories, shoppingDb.baseProducts, async () => {
        for (const [categoryOrder, categorySeed] of BASE_LIST_SEED.entries()) {
          const categoryId = await shoppingDb.baseCategories.add({
            listTypeId: weeklyType.id!,
            name: categorySeed.name,
            order: categoryOrder,
            type: 'standard',
          });

          for (const [productOrder, productName] of categorySeed.products.entries()) {
            await shoppingDb.baseProducts.add({
              categoryId,
              name: productName,
              order: productOrder,
            });
          }
        }
      });
    }

    for (const listType of listTypes) {
      if (listType.id !== undefined && listType.hasMealCategories) {
        await this.baseCategoryService.ensureSpecialCategories(listType.id);
      }
    }

    if (weeklyType?.id) {
      await this.shoppingListService.fixLegacyListTypes(weeklyType.id);
    }
  }

  async reseed(): Promise<void> {
    const weeklyTypeId = await this.baseListTypeService.getWeeklyListTypeId();

    await shoppingDb.transaction(
      'rw',
      shoppingDb.baseCategories,
      shoppingDb.baseProducts,
      shoppingDb.baseMeals,
      async () => {
        const weeklyCategories = await shoppingDb.baseCategories
          .where('listTypeId')
          .equals(weeklyTypeId)
          .toArray();

        for (const category of weeklyCategories) {
          if (category.id !== undefined) {
            await shoppingDb.baseProducts.where('categoryId').equals(category.id).delete();
          }
        }

        await shoppingDb.baseCategories.where('listTypeId').equals(weeklyTypeId).delete();
        await shoppingDb.baseMeals.where('listTypeId').equals(weeklyTypeId).delete();

        for (const [categoryOrder, categorySeed] of BASE_LIST_SEED.entries()) {
          const categoryId = await shoppingDb.baseCategories.add({
            listTypeId: weeklyTypeId,
            name: categorySeed.name,
            order: categoryOrder,
            type: 'standard',
          });

          for (const [productOrder, productName] of categorySeed.products.entries()) {
            await shoppingDb.baseProducts.add({
              categoryId,
              name: productName,
              order: productOrder,
            });
          }
        }
      },
    );

    await this.baseCategoryService.ensureSpecialCategories(weeklyTypeId);
  }
}
