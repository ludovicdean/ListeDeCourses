import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';

import {
  INGREDIENTS_CATEGORY_NAME,
  MEALS_CATEGORY_NAME,
} from '../../../core/constants/special-categories';
import { BaseListTypeService } from '../../../core/services/base-list-type.service';
import { ShoppingListService } from '../../../core/services/shopping-list.service';
import { isMealItem, type ShoppingListItem } from '../../../core/models/shopping-list.model';
import {
  IngredientDialogComponent,
  type IngredientDialogResult,
} from '../../base/ingredient-dialog/ingredient-dialog.component';
import { MealDialogComponent, type MealDialogResult } from '../../base/meal-dialog/meal-dialog.component';

@Component({
  selector: 'app-shopping-list-view',
  imports: [
    AsyncPipe,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatCheckboxModule,
    MatDividerModule,
    MatDialogModule,
  ],
  template: `
    @if (list(); as listValue) {
      <mat-toolbar color="primary">
        <a mat-icon-button [routerLink]="['/type', listValue.listTypeId]" aria-label="Retour">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div class="title-block">
          <span class="title">{{ listValue.name }}</span>
          @if (listType(); as type) {
            <span class="subtitle">{{ type.name }}</span>
          }
        </div>
        <span class="spacer"></span>
        @if (listValue.status === 'shopping') {
          <button mat-icon-button aria-label="Terminer les courses" (click)="completeList()">
            <mat-icon>done_all</mat-icon>
          </button>
        }
        <button mat-icon-button aria-label="Supprimer la liste" (click)="deleteList()">
          <mat-icon>delete</mat-icon>
        </button>
      </mat-toolbar>

      @if (listValue.status === 'preparing') {
        <p class="phase-hint">
          Cochez les produits à acheter, ajustez les quantités, et ajoutez vos ingrédients et repas
          dans les catégories spéciales.
        </p>
      } @else if (listValue.status === 'shopping') {
        <p class="phase-hint">Cochez les produits au fur et à mesure que vous les prenez en magasin.</p>
      }

      @if (groups$ | async; as groups) {
        @if (groups.length === 0) {
          @if (listValue.status === 'preparing') {
            <p class="empty-state">Cette liste ne contient aucun produit.</p>
          } @else {
            <p class="empty-state">Aucun produit sélectionné pour cette liste.</p>
          }
        } @else {
          @for (group of groups; track group.categoryName) {
            <div class="category-header">
              <h3 class="category-title">{{ group.categoryName }}</h3>
              @if (listValue.status === 'preparing' && isSpecialCategory(group.categoryName)) {
                <button
                  mat-icon-button
                  [attr.aria-label]="'Ajouter dans ' + group.categoryName"
                  (click)="openAddDialog(group.categoryName)"
                >
                  <mat-icon>add</mat-icon>
                </button>
              }
            </div>

            @if (group.items.length === 0 && listValue.status === 'preparing' && isSpecialCategory(group.categoryName)) {
              <p class="category-empty">Aucun élément. Appuyez sur + pour en ajouter.</p>
            } @else {
              <mat-list>
                @for (item of group.items; track item.id) {
                  @if (listValue.status === 'preparing') {
                    <mat-list-item>
                      <mat-checkbox
                        matListItemIcon
                        [checked]="item.checked"
                        (change)="toggleSelected(item, $event.checked)"
                      />
                      <span matListItemTitle>{{ item.productName }}</span>
                      @if (isMealItem(item) && item.recipeUrl) {
                        <span matListItemLine>
                          <a [href]="item.recipeUrl" target="_blank" rel="noopener noreferrer">Voir la recette</a>
                        </span>
                      } @else if (!isMealItem(item)) {
                        <span matListItemLine>Quantité : {{ item.quantity }}</span>
                      }
                      <span matListItemMeta class="actions">
                        @if (!isMealItem(item)) {
                          <button mat-icon-button aria-label="Diminuer" (click)="changeQuantity(item, -1)">
                            <mat-icon>remove</mat-icon>
                          </button>
                          <button mat-icon-button aria-label="Augmenter" (click)="changeQuantity(item, 1)">
                            <mat-icon>add</mat-icon>
                          </button>
                        }
                        @if (isSpecialCategory(group.categoryName)) {
                          <button mat-icon-button aria-label="Modifier" (click)="openEditDialog(item)">
                            <mat-icon>edit</mat-icon>
                          </button>
                          <button mat-icon-button aria-label="Supprimer" (click)="deleteItem(item)">
                            <mat-icon>delete</mat-icon>
                          </button>
                        }
                      </span>
                    </mat-list-item>
                  } @else {
                    <mat-list-item>
                      <mat-checkbox
                        matListItemIcon
                        [checked]="item.pickedUp"
                        [disabled]="listValue.status === 'completed'"
                        (change)="togglePickedUp(item, $event.checked)"
                      />
                      <span matListItemTitle [class.picked-up]="item.pickedUp">{{ item.productName }}</span>
                      @if (isMealItem(item) && item.recipeUrl) {
                        <span matListItemLine [class.picked-up]="item.pickedUp">
                          <a [href]="item.recipeUrl" target="_blank" rel="noopener noreferrer">Voir la recette</a>
                        </span>
                      } @else if (!isMealItem(item)) {
                        <span matListItemLine [class.picked-up]="item.pickedUp">
                          Quantité : {{ item.quantity }}
                        </span>
                      }
                    </mat-list-item>
                  }
                }
              </mat-list>
            }
            <mat-divider />
          }
        }
      }

      @if (listValue.status === 'preparing') {
        <div class="footer-actions">
          <button mat-flat-button color="primary" class="validate-button" (click)="validateList()">
            Valider ma liste
          </button>
        </div>
      }
    } @else {
      <mat-toolbar color="primary">
        <a mat-icon-button [routerLink]="['/type', list()?.listTypeId ?? 0]" aria-label="Retour">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <span>Liste introuvable</span>
      </mat-toolbar>
    }
  `,
  styles: `
    .spacer {
      flex: 1;
    }

    .title-block {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.2;
    }

    .subtitle {
      font-size: 0.75rem;
      opacity: 0.85;
      line-height: 1.2;
    }

    .phase-hint {
      margin: 0;
      padding: 12px 16px;
      font-size: 0.875rem;
      opacity: 0.75;
      line-height: 1.4;
    }

    .category-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-right: 8px;
    }

    .category-title {
      margin: 16px 16px 8px;
      font-size: 0.95rem;
      font-weight: 600;
      opacity: 0.85;
    }

    .category-empty {
      margin: 0 16px 12px;
      font-size: 0.875rem;
      opacity: 0.6;
    }

    .empty-state {
      padding: 24px 16px;
      text-align: center;
      opacity: 0.7;
    }

    .picked-up {
      text-decoration: line-through;
      opacity: 0.6;
    }

    .actions {
      display: inline-flex;
      align-items: center;
    }

    .footer-actions {
      padding: 16px;
      position: sticky;
      bottom: 0;
      background: var(--mat-sys-surface);
    }

    .validate-button {
      width: 100%;
    }
  `,
})
export class ShoppingListViewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly dialog = inject(MatDialog);

  private readonly listId$ = this.route.paramMap.pipe(
    map((params) => Number(params.get('id'))),
  );

  protected readonly list = toSignal(
    this.listId$.pipe(switchMap((id) => this.shoppingListService.getById(id))),
  );

  protected readonly listType = toSignal(
    this.listId$.pipe(
      switchMap((id) => this.shoppingListService.getById(id)),
      switchMap((list) =>
        list ? this.baseListTypeService.getById(list.listTypeId) : [undefined],
      ),
    ),
  );

  protected readonly groups$ = this.listId$.pipe(
    switchMap((id) => this.shoppingListService.getGroupedItems(id)),
  );

  protected readonly isMealItem = isMealItem;

  protected isSpecialCategory(categoryName: string): boolean {
    if (!this.listType()?.hasMealCategories) {
      return false;
    }

    return categoryName === INGREDIENTS_CATEGORY_NAME || categoryName === MEALS_CATEGORY_NAME;
  }

  protected openAddDialog(categoryName: string): void {
    const list = this.list();
    if (list?.id === undefined || list.status !== 'preparing') {
      return;
    }

    if (categoryName === INGREDIENTS_CATEGORY_NAME) {
      this.openIngredientDialog(list.id);
      return;
    }

    if (categoryName === MEALS_CATEGORY_NAME) {
      this.openMealDialog(list.id);
    }
  }

  protected openEditDialog(item: ShoppingListItem): void {
    const list = this.list();
    if (list?.id === undefined || item.id === undefined || list.status !== 'preparing') {
      return;
    }

    if (item.itemType === 'ingredient') {
      this.openIngredientDialog(list.id, item);
      return;
    }

    if (item.itemType === 'meal') {
      this.openMealDialog(list.id, item);
    }
  }

  protected async toggleSelected(item: ShoppingListItem, checked: boolean): Promise<void> {
    if (item.id === undefined) {
      return;
    }

    await this.shoppingListService.updateItem(item.id, { checked });
  }

  protected async togglePickedUp(item: ShoppingListItem, pickedUp: boolean): Promise<void> {
    if (item.id === undefined) {
      return;
    }

    await this.shoppingListService.updateItem(item.id, { pickedUp });
  }

  protected async changeQuantity(item: ShoppingListItem, delta: number): Promise<void> {
    if (item.id === undefined) {
      return;
    }

    const minQuantity = item.itemType === 'ingredient' ? 0.01 : 1;
    const quantity = Math.max(minQuantity, item.quantity + delta);
    await this.shoppingListService.updateItem(item.id, { quantity });
  }

  protected async deleteItem(item: ShoppingListItem): Promise<void> {
    if (item.id === undefined) {
      return;
    }

    const confirmed = confirm(`Supprimer « ${item.productName} » de cette liste ?`);
    if (confirmed) {
      await this.shoppingListService.deleteItem(item.id);
    }
  }

  protected async validateList(): Promise<void> {
    const list = this.list();
    if (list?.id === undefined) {
      return;
    }

    try {
      await this.shoppingListService.validateList(list.id);
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_SELECTION') {
        alert('Cochez au moins un produit avant de valider la liste.');
        return;
      }

      throw error;
    }
  }

  protected async completeList(): Promise<void> {
    const list = this.list();
    if (list?.id === undefined) {
      return;
    }

    await this.shoppingListService.updateStatus(list.id, 'completed');
    await this.router.navigate(['/type', list.listTypeId]);
  }

  protected async deleteList(): Promise<void> {
    const list = this.list();
    if (list?.id === undefined) {
      return;
    }

    const confirmed = confirm(`Supprimer la liste « ${list.name} » ?`);
    if (confirmed) {
      await this.shoppingListService.delete(list.id);
      await this.router.navigate(['/type', list.listTypeId]);
    }
  }

  private openIngredientDialog(listId: number, item?: ShoppingListItem): void {
    const dialogRef = this.dialog.open<
      IngredientDialogComponent,
      { ingredient?: { name: string; quantity?: number } },
      IngredientDialogResult
    >(IngredientDialogComponent, {
      data: {
        ingredient: item
          ? { name: item.productName, quantity: item.quantity }
          : undefined,
      },
      width: '360px',
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) {
        return;
      }

      if (item?.id !== undefined) {
        await this.shoppingListService.updateIngredientItem(item.id, result.name, result.quantity);
        return;
      }

      await this.shoppingListService.addIngredient(listId, result.name, result.quantity);
    });
  }

  private openMealDialog(listId: number, item?: ShoppingListItem): void {
    const dialogRef = this.dialog.open<
      MealDialogComponent,
      { meal?: { name: string; recipeUrl?: string } },
      MealDialogResult
    >(MealDialogComponent, {
      data: {
        meal: item ? { name: item.productName, recipeUrl: item.recipeUrl } : undefined,
      },
      width: '360px',
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) {
        return;
      }

      if (item?.id !== undefined) {
        await this.shoppingListService.updateMealItem(item.id, result.name, result.recipeUrl);
        return;
      }

      await this.shoppingListService.addMeal(listId, result.name, result.recipeUrl);
    });
  }
}
