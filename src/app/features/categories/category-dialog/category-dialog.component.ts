import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import type { BaseCategory } from '../../../core/models/base-category.model';

export interface CategoryDialogData {
  category?: BaseCategory;
}

export interface CategoryDialogResult {
  name: string;
}

@Component({
  selector: 'app-category-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.category ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nom</mat-label>
          <input matInput formControlName="name" placeholder="Ex. Frigo" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Le nom est obligatoire</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Annuler</button>
      <button mat-flat-button type="button" [disabled]="form.invalid" (click)="submit()">
        Enregistrer
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .full-width {
      width: 100%;
      min-width: 280px;
    }
  `,
})
export class CategoryDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<CategoryDialogComponent, CategoryDialogResult>);
  protected readonly data = inject<CategoryDialogData>(MAT_DIALOG_DATA);

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.category?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
  });

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }

    this.dialogRef.close({ name: this.form.controls.name.value.trim() });
  }
}
