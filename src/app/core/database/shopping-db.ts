import Dexie, { type Table } from 'dexie';

import type { BaseCategory } from '../models/base-category.model';
import type { BaseListType } from '../models/base-list-type.model';
import type { BaseMeal } from '../models/base-meal.model';
import type { BaseProduct } from '../models/base-product.model';
import type { ShoppingList, ShoppingListItem } from '../models/shopping-list.model';

export class ShoppingDatabase extends Dexie {
  baseListTypes!: Table<BaseListType, number>;
  baseCategories!: Table<BaseCategory, number>;
  baseProducts!: Table<BaseProduct, number>;
  baseMeals!: Table<BaseMeal, number>;
  shoppingLists!: Table<ShoppingList, number>;
  shoppingListItems!: Table<ShoppingListItem, number>;

  constructor() {
    super('ListeDeCoursesDB');

    this.version(1).stores({
      categories: '++id, name, order',
      products: '++id, categoryId, name, checked, order',
    });

    this.version(2).stores({
      baseCategories: '++id, name, order',
      baseProducts: '++id, categoryId, name, order',
      shoppingLists: '++id, createdAt, status',
      shoppingListItems: '++id, shoppingListId, checked, categoryOrder, productOrder',
    });

    this.version(3)
      .stores({
        baseCategories: '++id, name, order',
        baseProducts: '++id, categoryId, name, order',
        shoppingLists: '++id, createdAt, status',
        shoppingListItems: '++id, shoppingListId, checked, pickedUp, categoryOrder, productOrder',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table('shoppingListItems')
          .toCollection()
          .modify((item: ShoppingListItem & { pickedUp?: boolean }) => {
            item.pickedUp = item.pickedUp ?? false;
          });

        await transaction
          .table('shoppingLists')
          .toCollection()
          .modify((list: { status: string }) => {
            if (list.status === 'active') {
              list.status = 'preparing';
            }
          });
      });

    this.version(4)
      .stores({
        baseCategories: '++id, name, order, type',
        baseProducts: '++id, categoryId, name, order',
        baseMeals: '++id, name, order',
        shoppingLists: '++id, createdAt, status',
        shoppingListItems: '++id, shoppingListId, checked, pickedUp, itemType, categoryOrder, productOrder',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table('baseCategories')
          .toCollection()
          .modify((category: BaseCategory & { type?: BaseCategory['type'] }) => {
            category.type = category.type ?? 'standard';
          });

        await transaction
          .table('shoppingListItems')
          .toCollection()
          .modify((item: ShoppingListItem & { itemType?: ShoppingListItem['itemType'] }) => {
            item.itemType = item.itemType ?? 'product';
          });
      });

    this.version(5)
      .stores({
        baseListTypes: '++id, name, order',
        baseCategories: '++id, listTypeId, [listTypeId+type], name, order, type',
        baseProducts: '++id, categoryId, name, order',
        baseMeals: '++id, listTypeId, name, order',
        shoppingLists: '++id, listTypeId, createdAt, status',
        shoppingListItems: '++id, shoppingListId, checked, pickedUp, itemType, categoryOrder, productOrder',
      })
      .upgrade(async (transaction) => {
        const weeklyTypeId = await transaction.table('baseListTypes').add({
          name: 'Courses hebdomadaire',
          order: 0,
          hasMealCategories: true,
        });

        await transaction.table('baseListTypes').add({
          name: 'Courses mensuelle',
          order: 1,
          hasMealCategories: false,
        });

        await transaction.table('baseListTypes').add({
          name: 'Pharmacie',
          order: 2,
          hasMealCategories: false,
        });

        await transaction
          .table('baseCategories')
          .toCollection()
          .modify((category: BaseCategory & { listTypeId?: number }) => {
            category.listTypeId = weeklyTypeId;
          });

        await transaction
          .table('baseMeals')
          .toCollection()
          .modify((meal: BaseMeal & { listTypeId?: number }) => {
            meal.listTypeId = weeklyTypeId;
          });

        await transaction
          .table('shoppingLists')
          .toCollection()
          .modify((list: ShoppingList & { listTypeId?: number }) => {
            list.listTypeId = weeklyTypeId;
          });
      });
  }
}

export const shoppingDb = new ShoppingDatabase();
