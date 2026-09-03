import type { ShoppingList } from '@core/models/shopping-list.model';

export function formatSessionDate(createdAt: number): string {
  const timestamp = Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now();
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatSessionName(session: ShoppingList, listTypeName: string): string {
  const storedName = extractSessionName(session);
  if (storedName) {
    return storedName;
  }

  const dateLabel = formatSessionDate(session.createdAt);
  return `${listTypeName} du ${dateLabel}`;
}

export function extractSessionName(record: ShoppingList): string {
  if (typeof record.name === 'string') {
    return record.name.trim();
  }

  return '';
}
