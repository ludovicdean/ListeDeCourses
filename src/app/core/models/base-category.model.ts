export type BaseCategoryType = 'standard' | 'ingredients' | 'meals';

export interface BaseCategory {
  id?: number;
  listTypeId: number;
  name: string;
  order: number;
  type: BaseCategoryType;
}

export type BaseCategoryInput = Omit<BaseCategory, 'id'>;

export function isSpecialCategory(category: BaseCategory): boolean {
  return category.type === 'ingredients' || category.type === 'meals';
}
