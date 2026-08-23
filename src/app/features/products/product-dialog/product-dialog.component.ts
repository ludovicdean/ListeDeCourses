import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import type { BaseProduct } from '../../../core/models/base-product.model';

export interface ProductDialogData {
  product?: BaseProduct;
}

export interface ProductDialogResult {
  name: string;
}

@Component({
  selector: 'app-product-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.product ? 'Modifier le produit' : 'Nouveau produit' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nom</mat-label>
          <input matInput formControlName="name" placeholder="Ex. Lait" />
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
export class ProductDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<ProductDialogComponent, ProductDialogResult>);
  protected readonly data = inject<ProductDialogData>(MAT_DIALOG_DATA);

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.product?.name ?? '', {
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
