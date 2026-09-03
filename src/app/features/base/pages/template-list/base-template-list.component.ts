import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import {
  NameDialogComponent,
  type NameDialogData,
  type NameDialogResult,
} from '@features/base/dialogs/name-dialog/name-dialog.component';
import type { BaseCategory } from '@core/models/base-category.model';
import { BaseCategoryService } from '@core/services/base-category.service';
import { BaseListTypeService } from '@core/services/base-list-type.service';
import { ConfirmService } from '@core/services/confirm.service';
import { routeParamNumber$ } from '@core/utils/route-param.utils';

@Component({
  selector: 'app-base-template-list',
  imports: [
    AsyncPipe,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDialogModule,
  ],
  templateUrl: './base-template-list.component.html',
  styleUrl: './base-template-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseTemplateListComponent {
  private readonly baseCategoryService = inject(BaseCategoryService);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmService = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly listTypeId$ = routeParamNumber$('listTypeId');

  protected readonly listType = toSignal(
    this.listTypeId$.pipe(switchMap((id) => this.baseListTypeService.getById(id))),
  );

  protected readonly categories$ = this.listTypeId$.pipe(
    switchMap((id) => this.baseCategoryService.getStandardCategories(id)),
  );

  protected openCreateDialog(): void {
    this.openDialog();
  }

  protected openEditDialog(category: BaseCategory): void {
    this.openDialog(category);
  }

  protected async deleteCategory(category: BaseCategory): Promise<void> {
    if (category.id === undefined) {
      return;
    }

    const confirmed = await this.confirmService.confirm({
      title: 'Supprimer la catégorie',
      message: `Supprimer la catégorie « ${category.name} » et tous ses produits de la liste de base ?`,
      confirmLabel: 'Supprimer',
    });

    if (confirmed) {
      await this.baseCategoryService.delete(category.id);
    }
  }

  private openDialog(category?: BaseCategory): void {
    const listType = this.listType();
    if (!listType?.id) {
      return;
    }

    const dialogRef = this.dialog.open<NameDialogComponent, NameDialogData, NameDialogResult>(
      NameDialogComponent,
      {
        data: {
          title: category ? 'Modifier la catégorie' : 'Nouvelle catégorie',
          placeholder: 'Ex. Frigo',
          initialName: category?.name,
        },
        width: '360px',
      },
    );

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (result) => {
      if (!result) {
        return;
      }

      if (category?.id !== undefined) {
        await this.baseCategoryService.update(category.id, { name: result.name });
        return;
      }

      const order = await this.baseCategoryService.getNextOrder(listType.id!);
      await this.baseCategoryService.create({
        listTypeId: listType.id!,
        name: result.name,
        order,
        type: 'standard',
      });
    });
  }
}
