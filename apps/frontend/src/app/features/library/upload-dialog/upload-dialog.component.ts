import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

export interface UploadDialogResult {
  file: File;
  type: 'song' | 'music' | 'audio' | 'style';
  title: string;
  description?: string;
}

@Component({
  selector: 'harmonia-upload-dialog',
  templateUrl: './upload-dialog.component.html',
  styleUrls: ['./upload-dialog.component.scss'],
  standalone: false,
})
export class UploadDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<UploadDialogComponent>);

  uploadForm: FormGroup = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    type: ['song', Validators.required],
  });

  selectedFile: File | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0] || null;
    }
  }

  onUpload(): void {
    if (this.uploadForm.valid && this.selectedFile) {
      const result: UploadDialogResult = {
        file: this.selectedFile,
        type: this.uploadForm.value.type,
        title: this.uploadForm.value.title,
        description: this.uploadForm.value.description || undefined,
      };
      this.dialogRef.close(result);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
