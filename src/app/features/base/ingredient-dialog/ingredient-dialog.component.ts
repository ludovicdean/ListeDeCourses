import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import type { BaseProduct } from '../../../core/models/base-product.model';

export interface IngredientDialogData {
  ingredient?: BaseProduct;
}

export interface IngredientDialogResult {
  name: string;
  quantity: number;
}

@Component({
  selector: 'app-ingredient-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.ingredient ? 'Modifier l’ingrédient' : 'Nouvel ingrédient' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nom</mat-label>
          <input matInput formControlName="name" placeholder="Ex. Crème fraîche 20 cl" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Le nom est obligatoire</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Quantité</mat-label>
          <input matInput type="number" formControlName="quantity" min="0.01" step="any" />
          @if (form.controls.quantity.hasError('min')) {
            <mat-error>La quantité doit être supérieure à 0</mat-error>
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
    .form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .full-width {
      width: 100%;
      min-width: 280px;
    }
  `,
})
export class IngredientDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<IngredientDialogComponent, IngredientDialogResult>);
  protected readonly data = inject<IngredientDialogData>(MAT_DIALOG_DATA);

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.ingredient?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    quantity: new FormControl(this.data.ingredient?.quantity ?? 1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01)],
    }),
  });

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }

    this.dialogRef.close({
      name: this.form.controls.name.value.trim(),
      quantity: this.form.controls.quantity.value,
    });
  }
}
