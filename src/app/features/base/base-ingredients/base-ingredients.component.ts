import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';

import { BaseCategoryService } from '../../../core/services/base-category.service';
import { BaseProductService } from '../../../core/services/base-product.service';
import type { BaseProduct } from '../../../core/models/base-product.model';
import {
  IngredientDialogComponent,
  type IngredientDialogResult,
} from '../ingredient-dialog/ingredient-dialog.component';

@Component({
  selector: 'app-base-ingredients',
  imports: [
    AsyncPipe,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDialogModule,
  ],
  template: `
    <mat-toolbar color="primary">
      <a mat-icon-button [routerLink]="['/base', listTypeId()]" aria-label="Retour">
        <mat-icon>arrow_back</mat-icon>
      </a>
      <span>Ingrédients Repas</span>
      <span class="spacer"></span>
      <button mat-icon-button aria-label="Ajouter un ingrédient" (click)="openCreateDialog()">
        <mat-icon>add</mat-icon>
      </button>
    </mat-toolbar>

    <p class="hint">
      Ajoutez ici les ingrédients nécessaires à vos repas, avec une quantité libre (ex. 200, 1.5…).
    </p>

    @if (products$ | async; as products) {
      @if (products.length === 0) {
        <p class="empty-state">Aucun ingrédient pour l'instant.</p>
      } @else {
        <mat-list>
          @for (product of products; track product.id) {
            <mat-list-item>
              <span matListItemTitle>{{ product.name }}</span>
              <span matListItemLine>Quantité : {{ product.quantity }}</span>
              <span matListItemMeta class="actions">
                <button mat-icon-button aria-label="Modifier" (click)="openEditDialog(product)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button aria-label="Supprimer" (click)="deleteIngredient(product)">
                  <mat-icon>delete</mat-icon>
                </button>
              </span>
            </mat-list-item>
          }
        </mat-list>
      }
    }
  `,
  styles: `
    .spacer {
      flex: 1;
    }

    .hint {
      margin: 0;
      padding: 12px 16px;
      font-size: 0.875rem;
      opacity: 0.75;
      line-height: 1.4;
    }

    .empty-state {
      padding: 24px 16px;
      text-align: center;
      opacity: 0.7;
    }

    .actions {
      display: inline-flex;
      align-items: center;
    }
  `,
})
export class BaseIngredientsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly baseCategoryService = inject(BaseCategoryService);
  private readonly baseProductService = inject(BaseProductService);
  private readonly dialog = inject(MatDialog);

  private readonly listTypeId$ = this.route.paramMap.pipe(
    map((params) => Number(params.get('listTypeId'))),
  );

  protected readonly listTypeId = toSignal(this.listTypeId$);

  private readonly ingredientsCategory = toSignal(
    this.listTypeId$.pipe(switchMap((id) => this.baseCategoryService.getIngredientsCategory(id))),
  );

  protected readonly products$ = this.listTypeId$.pipe(
    switchMap((listTypeId) =>
      this.baseCategoryService.getIngredientsCategory(listTypeId).pipe(
        switchMap((category) => this.baseProductService.getByCategory(category?.id ?? -1)),
      ),
    ),
  );

  protected openCreateDialog(): void {
    const category = this.ingredientsCategory();
    if (!category?.id) {
      return;
    }

    this.openDialog(category.id);
  }

  protected openEditDialog(product: BaseProduct): void {
    const category = this.ingredientsCategory();
    if (!category?.id) {
      return;
    }

    this.openDialog(category.id, product);
  }

  protected async deleteIngredient(product: BaseProduct): Promise<void> {
    if (product.id === undefined) {
      return;
    }

    const confirmed = confirm(`Supprimer l'ingrédient « ${product.name} » ?`);
    if (confirmed) {
      await this.baseProductService.delete(product.id);
    }
  }

  private openDialog(categoryId: number, product?: BaseProduct): void {
    const dialogRef = this.dialog.open<
      IngredientDialogComponent,
      { ingredient?: BaseProduct },
      IngredientDialogResult
    >(IngredientDialogComponent, {
      data: { ingredient: product },
      width: '360px',
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) {
        return;
      }

      if (product?.id !== undefined) {
        await this.baseProductService.update(product.id, {
          name: result.name,
          quantity: result.quantity,
        });
        return;
      }

      const order = await this.baseProductService.getNextOrder(categoryId);
      await this.baseProductService.create({
        categoryId,
        name: result.name,
        quantity: result.quantity,
        order,
      });
    });
  }
}
