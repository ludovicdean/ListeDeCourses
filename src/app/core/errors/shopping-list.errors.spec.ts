import { BaseEmptyError, isShoppingListError, NoSelectionError } from './shopping-list.errors';

describe('shopping-list.errors', () => {
  it('identifies shopping list errors', () => {
    expect(isShoppingListError(new BaseEmptyError())).toBe(true);
    expect(isShoppingListError(new NoSelectionError())).toBe(true);
    expect(isShoppingListError(new Error('other'))).toBe(false);
  });

  it('exposes stable error codes', () => {
    expect(new BaseEmptyError().code).toBe('BASE_EMPTY');
    expect(new NoSelectionError().code).toBe('NO_SELECTION');
  });
});
