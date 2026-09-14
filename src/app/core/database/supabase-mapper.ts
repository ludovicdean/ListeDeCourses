import type { BaseCategory } from '@core/models/base-category.model';
import type { BaseListType } from '@core/models/base-list-type.model';
import type { BaseMeal } from '@core/models/base-meal.model';
import type { BaseProduct } from '@core/models/base-product.model';
import type { ShoppingList, ShoppingListItem } from '@core/models/shopping-list.model';

export function mapSupabaseBaseListType(row: Record<string, unknown>): BaseListType {
  return {
    id: Number(row['id']),
    name: String(row['name']),
    order: Number(row['order_index']),
    hasMealCategories: Boolean(row['has_meal_categories']),
  };
}

export function mapSupabaseBaseCategory(row: Record<string, unknown>): BaseCategory {
  return {
    id: Number(row['id']),
    listTypeId: Number(row['list_type_id']),
    name: String(row['name']),
    order: Number(row['order_index']),
    type: row['type'] as BaseCategory['type'],
  };
}

export function mapSupabaseBaseProduct(row: Record<string, unknown>): BaseProduct {
  return {
    id: Number(row['id']),
    categoryId: Number(row['category_id']),
    name: String(row['name']),
    order: Number(row['order_index']),
    quantity:
      row['quantity'] === null || row['quantity'] === undefined
        ? undefined
        : Number(row['quantity']),
  };
}

export function mapSupabaseBaseMeal(row: Record<string, unknown>): BaseMeal {
  return {
    id: Number(row['id']),
    listTypeId: Number(row['list_type_id']),
    name: String(row['name']),
    recipeUrl:
      row['recipe_url'] === null || row['recipe_url'] === undefined
        ? undefined
        : String(row['recipe_url']),
    order: Number(row['order_index']),
  };
}

function parseCreatedAt(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  return Date.now();
}

export function mapSupabaseShoppingList(row: Record<string, unknown>): ShoppingList {
  return {
    id: Number(row['id']),
    listTypeId: Number(row['list_type_id']),
    name: String(row['name']),
    createdAt: parseCreatedAt(row['created_at']),
    status: String(row['status']) as ShoppingList['status'],
  };
}

export function mapSupabaseShoppingListItem(row: Record<string, unknown>): ShoppingListItem {
  return {
    id: Number(row['id']),
    shoppingListId: Number(row['shopping_list_id']),
    categoryName: String(row['category_name']),
    categoryOrder: Number(row['category_order']),
    productName: String(row['product_name']),
    productOrder: Number(row['product_order']),
    quantity: Number(row['quantity']),
    checked: Boolean(row['checked']),
    pickedUp: Boolean(row['picked_up']),
    itemType: String(row['item_type']) as ShoppingListItem['itemType'],
    recipeUrl:
      row['recipe_url'] === null || row['recipe_url'] === undefined
        ? undefined
        : String(row['recipe_url']),
  };
}