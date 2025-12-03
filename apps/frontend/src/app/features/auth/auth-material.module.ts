import { NgModule } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

/**
 * Material Design modules for authentication components.
 * 
 * **Components Included**:
 * - `MatDialogModule` (8 KB) - Modal dialog for login/register
 * - `MatFormFieldModule` (4 KB) - Form field wrappers
 * - `MatInputModule` (2.5 KB) - Text inputs (email, username, password)
 * - `MatButtonModule` (3 KB) - Submit and action buttons
 * - `MatIconModule` (1.5 KB) - Icons for form fields (email, lock, visibility)
 * - `MatProgressSpinnerModule` (2 KB) - Loading spinner for async operations
 * - `MatMenuModule` (4 KB) - Dropdown menu for user menu
 * - `MatDividerModule` (0.5 KB) - Dividers in menu
 * 
 * **Total Bundle Size**: ~25.5 KB
 * 
 * **Usage**: Imported in `AuthModule` for authentication components.
 * 
 * @see {@link file://./docs/MATERIAL_MODULES.md} for architecture documentation
 */
@NgModule({
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatDividerModule,
  ],
  exports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatDividerModule,
  ]
})
export class AuthMaterialModule { }
