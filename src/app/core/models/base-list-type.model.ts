export interface BaseListType {
  id?: number;
  name: string;
  order: number;
  /** Affiche les catégories spéciales Ingrédients Repas et Repas. */
  hasMealCategories: boolean;
}

export type BaseListTypeInput = Omit<BaseListType, 'id'>;
