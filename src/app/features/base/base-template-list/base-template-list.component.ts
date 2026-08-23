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
import { BaseListTypeService } from '../../../core/services/base-list-type.service';
import type { BaseCategory } from '../../../core/models/base-category.model';
import {
  CategoryDialogComponent,
  type CategoryDialogResult,
} from '../../categories/category-dialog/category-dialog.component';

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
  template: `
    @if (listType(); as listTypeValue) {
      <mat-toolbar color="primary">
        <a mat-icon-button [routerLink]="['/type', listTypeValue.id]" aria-label="Retour">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <span>Base — {{ listTypeValue.name }}</span>
        <span class="spacer"></span>
        <button mat-icon-button aria-label="Ajouter une catégorie" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
        </button>
      </mat-toolbar>

      <p class="hint">
        Modèle réutilisé à chaque nouvelle session. Les catégories ci-dessous alimentent le bouton
        « Préparer une liste ».
      </p>

      @if (listTypeValue.hasMealCategories) {
        <section class="section">
          <h3>Catégories spéciales</h3>
          <mat-nav-list>
            <a mat-list-item [routerLink]="['/base', listTypeValue.id, 'ingredients']">
              <mat-icon matListItemIcon>restaurant</mat-icon>
              <span matListItemTitle>Ingrédients Repas</span>
              <span matListItemLine>Ingrédients avec quantités libres</span>
            </a>
            <a mat-list-item [routerLink]="['/base', listTypeValue.id, 'meals']">
              <mat-icon matListItemIcon>menu_book</mat-icon>
              <span matListItemTitle>Repas</span>
              <span matListItemLine>Nom du repas et lien recette</span>
            </a>
          </mat-nav-list>
        </section>
      }

      <section class="section">
        <h3>Catégories</h3>

        @if (categories$ | async; as categories) {
          @if (categories.length === 0) {
            <p class="empty-state">Aucune catégorie. Ajoutez-en une pour commencer.</p>
          } @else {
            <mat-nav-list>
              @for (category of categories; track category.id) {
                <a mat-list-item [routerLink]="['/base', listTypeValue.id, 'category', category.id]">
                  <span matListItemTitle>{{ category.name }}</span>
                  <span matListItemMeta class="actions">
                    <button
                      mat-icon-button
                      aria-label="Modifier"
                      (click)="openEditDialog(category); $event.preventDefault(); $event.stopPropagation()"
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      aria-label="Supprimer"
                      (click)="deleteCategory(category); $event.preventDefault(); $event.stopPropagation()"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  </span>
                </a>
              }
            </mat-nav-list>
          }
        }
      </section>
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

    .section {
      padding: 0 0 16px;
    }

    .section h3 {
      margin: 0;
      padding: 8px 16px;
      font-size: 0.875rem;
      font-weight: 600;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .empty-state {
      padding: 8px 16px 24px;
      text-align: center;
      opacity: 0.7;
    }

    .actions {
      display: inline-flex;
      align-items: center;
    }
  `,
})
export class BaseTemplateListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly baseCategoryService = inject(BaseCategoryService);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly dialog = inject(MatDialog);

  private readonly listTypeId$ = this.route.paramMap.pipe(
    map((params) => Number(params.get('listTypeId'))),
  );

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

    const confirmed = confirm(
      `Supprimer la catégorie « ${category.name} » et tous ses produits de la liste de base ?`,
    );

    if (confirmed) {
      await this.baseCategoryService.delete(category.id);
    }
  }

  private openDialog(category?: BaseCategory): void {
    const listType = this.listType();
    if (!listType?.id) {
      return;
    }

    const dialogRef = this.dialog.open<
      CategoryDialogComponent,
      { category?: BaseCategory },
      CategoryDialogResult
    >(CategoryDialogComponent, {
      data: { category },
      width: '360px',
    });

    dialogRef.afterClosed().subscribe(async (result) => {
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
