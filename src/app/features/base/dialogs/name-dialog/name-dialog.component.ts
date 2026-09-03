import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface NameDialogData {
  title: string;
  label?: string;
  placeholder?: string;
  initialName?: string;
  maxLength?: number;
}

export interface NameDialogResult {
  name: string;
}

@Component({
  selector: 'app-name-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './name-dialog.component.html',
  styleUrl: './name-dialog.component.scss',
})
export class NameDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<NameDialogComponent, NameDialogResult>);
  protected readonly data = inject<NameDialogData>(MAT_DIALOG_DATA);

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.initialName ?? '', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(this.data.maxLength ?? 100),
      ],
    }),
  });

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }

    this.dialogRef.close({ name: this.form.controls.name.value.trim() });
  }
}
