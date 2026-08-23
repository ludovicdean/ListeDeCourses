export type ShoppingListStatus = 'preparing' | 'shopping' | 'completed';
export type ShoppingListItemType = 'product' | 'ingredient' | 'meal';

export interface ShoppingList {
  id?: number;
  listTypeId: number;
  name: string;
  createdAt: number;
  status: ShoppingListStatus;
}

export interface ShoppingListCategoryGroup {
  categoryName: string;
  categoryOrder: number;
  items: ShoppingListItem[];
}

export interface ShoppingListItem {
  id?: number;
  shoppingListId: number;
  categoryName: string;
  categoryOrder: number;
  productName: string;
  productOrder: number;
  quantity: number;
  checked: boolean;
  pickedUp: boolean;
  itemType: ShoppingListItemType;
  recipeUrl?: string;
}

export function isMealItem(item: ShoppingListItem): boolean {
  return item.itemType === 'meal';
}
