import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import type { BaseMeal } from '../../../core/models/base-meal.model';

export interface MealDialogData {
  meal?: BaseMeal;
}

export interface MealDialogResult {
  name: string;
  recipeUrl?: string;
}

@Component({
  selector: 'app-meal-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.meal ? 'Modifier le repas' : 'Nouveau repas' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nom du repas</mat-label>
          <input matInput formControlName="name" placeholder="Ex. Gratin dauphinois" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Le nom est obligatoire</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Lien vers la recette (optionnel)</mat-label>
          <input matInput formControlName="recipeUrl" placeholder="https://..." />
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
export class MealDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<MealDialogComponent, MealDialogResult>);
  protected readonly data = inject<MealDialogData>(MAT_DIALOG_DATA);

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.meal?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    recipeUrl: new FormControl(this.data.meal?.recipeUrl ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }

    const recipeUrl = this.form.controls.recipeUrl.value.trim();

    this.dialogRef.close({
      name: this.form.controls.name.value.trim(),
      recipeUrl: recipeUrl || undefined,
    });
  }
}
