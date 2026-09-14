import type { ShoppingList } from '@core/models/shopping-list.model';

export const LIDL_SESSION_PREFIX = 'courses lidl';
export const SUPER_U_SESSION_PREFIX = 'courses super u';

export function formatSessionDate(createdAt: number): string {
  const timestamp = Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now();
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatSessionShortDate(timestamp: number = Date.now()): string {
  const date = new Date(Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now());
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function formatStoreSessionName(prefix: string, timestamp: number, index = 1): string {
  const baseName = `${prefix} ${formatSessionShortDate(timestamp)}`;
  return index <= 1 ? baseName : `${baseName} ${index}`;
}

export function resolveUniqueStoreSessionIndex(
  existingNames: Iterable<string>,
  prefix: string,
  timestamp: number,
): number {
  const candidates = new Set(existingNames);
  let index = 1;
  while (candidates.has(formatStoreSessionName(prefix, timestamp, index))) {
    index++;
  }
  return index;
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
