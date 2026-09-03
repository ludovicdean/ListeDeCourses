import type { ShoppingList } from '@core/models/shopping-list.model';

import { formatSessionDate, formatSessionName } from './session-name.utils';

describe('session-name.utils', () => {
  const typeName = 'Courses hebdomadaire';
  const date = new Date('2026-08-28T10:00:00').getTime();

  it('returns the stored name when present', () => {
    const session: ShoppingList = {
      id: 1,
      listTypeId: 1,
      name: 'Ma liste perso',
      createdAt: date,
      status: 'preparing',
    };

    expect(formatSessionName(session, typeName)).toBe('Ma liste perso');
  });

  it('builds a fallback name for unnamed sessions', () => {
    const session: ShoppingList = {
      id: 1,
      listTypeId: 1,
      name: '',
      createdAt: date,
      status: 'preparing',
    };

    expect(formatSessionName(session, typeName)).toBe(
      `${typeName} du ${formatSessionDate(date)}`,
    );
  });

  it('builds a fallback name when name is missing', () => {
    const session: ShoppingList = {
      id: 1,
      listTypeId: 1,
      name: '',
      createdAt: 0,
      status: 'preparing',
    };

    expect(formatSessionName(session, typeName)).toContain(typeName);
  });
});
