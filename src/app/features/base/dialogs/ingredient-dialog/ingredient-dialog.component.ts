import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import type { BaseProduct } from '@core/models/base-product.model';

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
  templateUrl: './ingredient-dialog.component.html',
  styleUrl: './ingredient-dialog.component.scss',
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
