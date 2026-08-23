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
  ProductDialogComponent,
  type ProductDialogResult,
} from '../../products/product-dialog/product-dialog.component';

@Component({
  selector: 'app-base-category-detail',
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
    @if (category(); as categoryValue) {
      <mat-toolbar color="primary">
        <a mat-icon-button [routerLink]="['/base', listTypeId()]" aria-label="Retour">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <span>{{ categoryValue.name }}</span>
        <span class="spacer"></span>
        <button mat-icon-button aria-label="Ajouter un produit" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
        </button>
      </mat-toolbar>

      @if (products$ | async; as products) {
        @if (products.length === 0) {
          <p class="empty-state">Aucun produit dans cette catégorie.</p>
        } @else {
          <mat-list>
            @for (product of products; track product.id) {
              <mat-list-item>
                <span matListItemTitle>{{ product.name }}</span>
                <span matListItemMeta class="actions">
                  <button mat-icon-button aria-label="Modifier" (click)="openEditDialog(product)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button aria-label="Supprimer" (click)="deleteProduct(product)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </span>
              </mat-list-item>
            }
          </mat-list>
        }
      }
    } @else {
      <mat-toolbar color="primary">
        <a mat-icon-button [routerLink]="['/base', listTypeId()]" aria-label="Retour">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <span>Catégorie introuvable</span>
      </mat-toolbar>
    }
  `,
  styles: `
    .spacer {
      flex: 1;
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
export class BaseCategoryDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly baseCategoryService = inject(BaseCategoryService);
  private readonly baseProductService = inject(BaseProductService);
  private readonly dialog = inject(MatDialog);

  private readonly listTypeId$ = this.route.paramMap.pipe(
    map((params) => Number(params.get('listTypeId'))),
  );

  protected readonly listTypeId = toSignal(this.listTypeId$);

  private readonly categoryId$ = this.route.paramMap.pipe(
    map((params) => Number(params.get('id'))),
  );

  protected readonly category = toSignal(
    this.categoryId$.pipe(switchMap((id) => this.baseCategoryService.getById(id))),
  );

  protected readonly products$ = this.categoryId$.pipe(
    switchMap((id) => this.baseProductService.getByCategory(id)),
  );

  protected openCreateDialog(): void {
    const category = this.category();
    if (!category?.id) {
      return;
    }

    this.openDialog(category.id);
  }

  protected openEditDialog(product: BaseProduct): void {
    const category = this.category();
    if (!category?.id) {
      return;
    }

    this.openDialog(category.id, product);
  }

  protected async deleteProduct(product: BaseProduct): Promise<void> {
    if (product.id === undefined) {
      return;
    }

    const confirmed = confirm(`Supprimer le produit « ${product.name} » de la liste de base ?`);
    if (confirmed) {
      await this.baseProductService.delete(product.id);
    }
  }

  private openDialog(categoryId: number, product?: BaseProduct): void {
    const dialogRef = this.dialog.open<
      ProductDialogComponent,
      { product?: BaseProduct },
      ProductDialogResult
    >(ProductDialogComponent, {
      data: { product },
      width: '360px',
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) {
        return;
      }

      if (product?.id !== undefined) {
        await this.baseProductService.update(product.id, {
          name: result.name,
        });
        return;
      }

      const order = await this.baseProductService.getNextOrder(categoryId);
      await this.baseProductService.create({
        categoryId,
        name: result.name,
        order,
      });
    });
  }
}
