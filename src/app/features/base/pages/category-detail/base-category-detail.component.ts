import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { switchMap } from 'rxjs';

import { PageHeaderComponent } from '@app/shared/page-header/page-header.component';
import { BaseListTypeService } from '@core/services/base-list-type.service';

import {
  NameDialogComponent,
  type NameDialogData,
  type NameDialogResult,
} from '@features/base/dialogs/name-dialog/name-dialog.component';
import type { BaseProduct } from '@core/models/base-product.model';
import { BaseCategoryService } from '@core/services/base-category.service';
import { BaseProductService } from '@core/services/base-product.service';
import { ConfirmService } from '@core/services/confirm.service';
import { routeParamNumber$, routeParamNumberSignal } from '@core/utils/route-param.utils';

@Component({
  selector: 'app-base-category-detail',
  imports: [
    AsyncPipe,
    PageHeaderComponent,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDialogModule,
  ],
  templateUrl: './base-category-detail.component.html',
  styleUrl: './base-category-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseCategoryDetailComponent {
  private readonly baseCategoryService = inject(BaseCategoryService);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly baseProductService = inject(BaseProductService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmService = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly listTypeId$ = routeParamNumber$('listTypeId');

  protected readonly listTypeId = routeParamNumberSignal('listTypeId');

  private readonly categoryId$ = routeParamNumber$('id');

  protected readonly category = toSignal(
    this.categoryId$.pipe(switchMap((id) => this.baseCategoryService.getById(id))),
  );

  protected readonly listType = toSignal(
    this.listTypeId$.pipe(switchMap((id) => this.baseListTypeService.getById(id))),
  );

  protected baseSubtitle(): string {
    const typeName = this.listType()?.name;
    const categoryName = this.category()?.name;
    if (!typeName) {
      return 'Catégories';
    }
    return categoryName
      ? `Modèle — ${typeName} › Catégories › ${categoryName}`
      : `Modèle — ${typeName} › Catégories`;
  }

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

    const confirmed = await this.confirmService.confirm({
      title: 'Supprimer le produit',
      message: `Supprimer le produit « ${product.name} » de la liste de base ?`,
      confirmLabel: 'Supprimer',
    });
    if (confirmed) {
      await this.baseProductService.delete(product.id);
    }
  }

  private openDialog(categoryId: number, product?: BaseProduct): void {
    const dialogRef = this.dialog.open<NameDialogComponent, NameDialogData, NameDialogResult>(
      NameDialogComponent,
      {
        data: {
          title: product ? 'Modifier le produit' : 'Nouveau produit',
          placeholder: 'Ex. Lait',
          initialName: product?.name,
        },
        width: '360px',
      },
    );

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (result) => {
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
