import { inject, Injectable } from '@angular/core';

import { BASE_LIST_SEED } from '@core/data/base-list.seed';
import { mapBaseListType } from '@core/database/sqlite-mappers';
import { SqliteRepository } from '@core/database/sqlite.repository';
import { BaseCategoryService } from './base-category.service';
import { BaseListTypeService } from './base-list-type.service';
import { ShoppingListService } from './shopping-list.service';

@Injectable({ providedIn: 'root' })
export class BaseListSeedService {
  private readonly baseCategoryService = inject(BaseCategoryService);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly repo = inject(SqliteRepository);

  private seeding: Promise<void> | null = null;

  async seedIfEmpty(): Promise<void> {
    if (this.seeding) {
      return this.seeding;
    }

    this.seeding = this.doSeedIfEmpty();
    return this.seeding;
  }

  private async doSeedIfEmpty(): Promise<void> {
    await this.baseListTypeService.ensureDefaultTypes();

    const listTypeRows = await this.repo.query<Record<string, unknown>>(
      'SELECT id, name, orderIndex, hasMealCategories FROM baseListTypes ORDER BY orderIndex;',
    );
    const listTypes = listTypeRows.map(mapBaseListType);
    const weeklyType = listTypes.find((type) => type.hasMealCategories);
    if (!weeklyType?.id) {
      return;
    }

    const standardCountRows = await this.repo.query<Record<string, unknown>>(
      'SELECT COUNT(*) as count FROM baseCategories WHERE listTypeId = ? AND type = ?;',
      [weeklyType.id, 'standard'],
    );
    const weeklyCategoryCount = Number(standardCountRows[0]?.['count'] ?? 0);

    if (weeklyCategoryCount === 0) {
      await this.repo.transaction(async () => {
        for (const [categoryOrder, categorySeed] of BASE_LIST_SEED.entries()) {
          const categoryId = await this.repo.insert('baseCategories', {
            listTypeId: weeklyType.id!,
            name: categorySeed.name,
            orderIndex: categoryOrder,
            type: 'standard',
          });

          for (const [productOrder, productName] of categorySeed.products.entries()) {
            await this.repo.insert('baseProducts', {
              categoryId,
              name: productName,
              orderIndex: productOrder,
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
      await this.shoppingListService.normalizeShoppingLists(weeklyType.id);
    }

    await this.shoppingListService.ensureSessionNames();
  }
}
