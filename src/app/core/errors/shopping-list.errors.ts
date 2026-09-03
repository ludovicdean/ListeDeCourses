export class ShoppingListError extends Error {
  constructor(
    message: string,
    readonly code: 'BASE_EMPTY' | 'NO_SELECTION' | 'LIST_TYPE_NOT_FOUND',
  ) {
    super(message);
    this.name = 'ShoppingListError';
  }
}

export class BaseEmptyError extends ShoppingListError {
  constructor() {
    super(
      'La liste de base est vide. Configurez-la d\'abord via « Modifier la liste de base ».',
      'BASE_EMPTY',
    );
  }
}

export class NoSelectionError extends ShoppingListError {
  constructor() {
    super('Cochez au moins un produit avant de passer en magasin.', 'NO_SELECTION');
  }
}

export class ListTypeNotFoundError extends ShoppingListError {
  constructor() {
    super('Type de liste introuvable.', 'LIST_TYPE_NOT_FOUND');
  }
}

export function isShoppingListError(error: unknown): error is ShoppingListError {
  return error instanceof ShoppingListError;
}
