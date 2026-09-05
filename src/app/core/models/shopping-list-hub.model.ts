import type { BaseListType } from './base-list-type.model';
import type { ShoppingListStatus } from './shopping-list.model';

export interface SessionCardData {
  id: number;
  name: string;
  createdAt: number;
  status: ShoppingListStatus;
  selectedCount: number;
}

export interface ListTypeHubData {
  listType: BaseListType | undefined;
  sessions: SessionCardData[];
}
