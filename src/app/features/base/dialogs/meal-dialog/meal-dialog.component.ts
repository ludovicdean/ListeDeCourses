import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import type { BaseMeal } from '@core/models/base-meal.model';

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
  templateUrl: './meal-dialog.component.html',
  styleUrl: './meal-dialog.component.scss',
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
