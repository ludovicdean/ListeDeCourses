import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import type { ListTypeHubData } from '@core/models/shopping-list-hub.model';
import type {
  ShoppingList,
  ShoppingListCategoryGroup,
  ShoppingListItem,
  ShoppingListStatus,
} from '@core/models/shopping-list.model';
import { ShoppingListItemService } from './shopping-list-item.service';
import { ShoppingListSessionService } from './shopping-list-session.service';

export type { ListTypeHubData, SessionCardData } from '@core/models/shopping-list-hub.model';

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly sessions = inject(ShoppingListSessionService);
  private readonly items = inject(ShoppingListItemService);

  getById(id: number): Observable<ShoppingList | undefined> {
    return this.sessions.getById(id);
  }

  getSessionById(id: number): Promise<ShoppingList | undefined> {
    return this.sessions.getSessionById(id);
  }

  watchListTypeHub(listTypeId: number): Observable<ListTypeHubData> {
    return this.sessions.watchListTypeHub(listTypeId);
  }

  normalizeShoppingLists(fallbackWeeklyListTypeId: number): Promise<void> {
    return this.sessions.normalizeShoppingLists(fallbackWeeklyListTypeId);
  }

  countActiveByType(listTypeId: number): Observable<number> {
    return this.sessions.countActiveByType(listTypeId);
  }

  getGroupedItems(listId: number): Observable<ShoppingListCategoryGroup[]> {
    return this.items.getGroupedItems(listId);
  }

  ensureSessionNames(): Promise<void> {
    return this.sessions.ensureSessionNames();
  }

  addIngredient(listId: number, name: string, quantity: number): Promise<number> {
    return this.items.addIngredient(listId, name, quantity);
  }

  addMeal(listId: number, name: string, recipeUrl?: string): Promise<number> {
    return this.items.addMeal(listId, name, recipeUrl);
  }

  updateIngredientItem(id: number, name: string, quantity: number): Promise<void> {
    return this.items.updateIngredientItem(id, name, quantity);
  }

  updateMealItem(id: number, name: string, recipeUrl?: string): Promise<void> {
    return this.items.updateMealItem(id, name, recipeUrl);
  }

  deleteItem(id: number): Promise<void> {
    return this.items.deleteItem(id);
  }

  createFromBase(listTypeId: number): Promise<number> {
    return this.sessions.createFromBase(listTypeId);
  }

  updateItem(
    id: number,
    changes: Partial<Pick<ShoppingListItem, 'quantity' | 'checked' | 'pickedUp'>>,
  ): Promise<void> {
    return this.items.updateItem(id, changes);
  }

  validateList(id: number): Promise<void> {
    return this.sessions.validateList(id);
  }

  reopenForEditing(id: number): Promise<void> {
    return this.sessions.reopenForEditing(id);
  }

  updateStatus(id: number, status: ShoppingListStatus): Promise<void> {
    return this.sessions.updateStatus(id, status);
  }

  delete(id: number): Promise<void> {
    return this.sessions.delete(id);
  }
}
