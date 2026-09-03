import type { BaseCategory } from '@core/models/base-category.model';
import type { BaseListType } from '@core/models/base-list-type.model';
import type { BaseMeal } from '@core/models/base-meal.model';
import type { BaseProduct } from '@core/models/base-product.model';
import type { ShoppingList, ShoppingListItem } from '@core/models/shopping-list.model';

export function mapBaseListType(row: Record<string, unknown>): BaseListType {
  return {
    id: Number(row['id']),
    name: String(row['name']),
    order: Number(row['orderIndex']),
    hasMealCategories: Boolean(row['hasMealCategories']),
  };
}

export function mapBaseCategory(row: Record<string, unknown>): BaseCategory {
  return {
    id: Number(row['id']),
    listTypeId: Number(row['listTypeId']),
    name: String(row['name']),
    order: Number(row['orderIndex']),
    type: row['type'] as BaseCategory['type'],
  };
}

export function mapBaseProduct(row: Record<string, unknown>): BaseProduct {
  return {
    id: Number(row['id']),
    categoryId: Number(row['categoryId']),
    name: String(row['name']),
    quantity: row['quantity'] === null ? undefined : Number(row['quantity']),
    order: Number(row['orderIndex']),
  };
}

export function mapBaseMeal(row: Record<string, unknown>): BaseMeal {
  return {
    id: Number(row['id']),
    listTypeId: Number(row['listTypeId']),
    name: String(row['name']),
    recipeUrl: row['recipeUrl'] === null ? undefined : String(row['recipeUrl']),
    order: Number(row['orderIndex']),
  };
}

export function mapShoppingList(row: Record<string, unknown>): ShoppingList {
  return {
    id: Number(row['id']),
    listTypeId: Number(row['listTypeId']),
    name: String(row['name']),
    createdAt: Number(row['createdAt']),
    status: String(row['status']) as ShoppingList['status'],
  };
}

export function mapShoppingListItem(row: Record<string, unknown>): ShoppingListItem {
  return {
    id: Number(row['id']),
    shoppingListId: Number(row['shoppingListId']),
    categoryName: String(row['categoryName']),
    categoryOrder: Number(row['categoryOrder']),
    productName: String(row['productName']),
    productOrder: Number(row['productOrder']),
    quantity: Number(row['quantity']),
    checked: Boolean(row['checked']),
    pickedUp: Boolean(row['pickedUp']),
    itemType: String(row['itemType']) as ShoppingListItem['itemType'],
    recipeUrl: row['recipeUrl'] === null ? undefined : String(row['recipeUrl']),
  };
}

export function toSqliteBoolean(value: boolean): number {
  return value ? 1 : 0;
}
