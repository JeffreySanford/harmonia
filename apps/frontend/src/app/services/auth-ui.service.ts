import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { LoginModalComponent } from '../features/auth/login-modal/login-modal.component';

/**
 * Auth UI Service
 * 
 * Provides UI-related authentication functionality:
 * - Open login/register modal
 * - Handle modal results
 * - Navigate after authentication
 * 
 * **Usage Example**:
 * ```typescript
 * constructor(private authUiService: AuthUiService) {}
 * 
 * openLogin() {
 *   this.authUiService.openLoginModal().subscribe(result => {
 *     if (result?.success) {
 *       console.log('User logged in successfully');
 *     }
 *   });
 * }
 * ```
 * 
 * @see {@link file://./docs/AUTHENTICATION_SYSTEM.md} for architecture
 */
@Injectable({
  providedIn: 'root'
})
export class AuthUiService {
  private dialog = inject(MatDialog);

  /**
   * Open login/register modal dialog
   * 
   * @param mode - Initial mode: 'login' or 'register'
   * @returns Observable of dialog result
   */
  openLoginModal(mode: 'login' | 'register' = 'login'): MatDialogRef<LoginModalComponent, { success: boolean }> {
    const dialogRef = this.dialog.open(LoginModalComponent, {
      width: '450px',
      maxWidth: '95vw',
      disableClose: false,
      panelClass: 'login-modal-panel',
      autoFocus: true,
      restoreFocus: true
    });

    // Set initial mode
    if (dialogRef.componentInstance) {
      dialogRef.componentInstance.mode = mode;
    }

    return dialogRef;
  }

  /**
   * Open login modal in register mode
   * 
   * @returns Observable of dialog result
   */
  openRegisterModal(): MatDialogRef<LoginModalComponent, { success: boolean }> {
    return this.openLoginModal('register');
  }

  /**
   * Close all open dialogs
   */
  closeAllDialogs(): void {
    this.dialog.closeAll();
  }
}
