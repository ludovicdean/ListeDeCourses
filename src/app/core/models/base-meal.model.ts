export interface BaseMeal {
  id?: number;
  listTypeId: number;
  name: string;
  recipeUrl?: string;
  order: number;
}

export type BaseMealInput = Omit<BaseMeal, 'id'>;
