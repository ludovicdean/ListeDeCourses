import type { ShoppingList } from '@core/models/shopping-list.model';

import {
  LIDL_SESSION_PREFIX,
  SUPER_U_SESSION_PREFIX,
  formatSessionDate,
  formatSessionName,
  formatSessionShortDate,
  formatStoreSessionName,
  resolveUniqueStoreSessionIndex,
} from './session-name.utils';

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

  it('formats short dates as dd/mm/yy', () => {
    expect(formatSessionShortDate(date)).toBe('28/08/26');
  });

  it('formats store session names with increment', () => {
    expect(formatStoreSessionName(LIDL_SESSION_PREFIX, date)).toBe('courses lidl 28/08/26');
    expect(formatStoreSessionName(LIDL_SESSION_PREFIX, date, 2)).toBe('courses lidl 28/08/26 2');
    expect(formatStoreSessionName(SUPER_U_SESSION_PREFIX, date, 3)).toBe('courses super u 28/08/26 3');
  });

  it('resolves the first free store session index', () => {
    const index = resolveUniqueStoreSessionIndex(
      ['courses lidl 28/08/26', 'courses lidl 28/08/26 2'],
      LIDL_SESSION_PREFIX,
      date,
    );

    expect(index).toBe(3);
  });
});
