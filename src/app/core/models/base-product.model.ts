export interface BaseProduct {
  id?: number;
  categoryId: number;
  name: string;
  order: number;
  /** Quantité libre, utilisée pour la catégorie Ingrédients Repas. */
  quantity?: number;
}

export type BaseProductInput = Omit<BaseProduct, 'id'>;
