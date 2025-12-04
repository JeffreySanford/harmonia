import { TestBed } from '@angular/core/testing';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AuthUiService } from './auth-ui.service';
import { LoginModalComponent } from '../features/auth/login-modal/login-modal.component';

describe('AuthUiService', () => {
  let service: AuthUiService;
  let dialog: jest.Mocked<MatDialog>;

  beforeEach(() => {
    const dialogSpy = {
      open: jest.fn(),
      closeAll: jest.fn(),
    } as unknown as jest.Mocked<MatDialog>;

    TestBed.configureTestingModule({
      providers: [AuthUiService, { provide: MatDialog, useValue: dialogSpy }],
    });

    service = TestBed.inject(AuthUiService);
    dialog = TestBed.inject(MatDialog) as jest.Mocked<MatDialog>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should open login modal with correct configuration', () => {
    const mockDialogRef = {
      componentInstance: { mode: 'login' },
      afterClosed: () => of({ success: true }),
    };
    dialog.open.mockReturnValue(
      mockDialogRef as unknown as MatDialogRef<LoginModalComponent>
    );

    service.openLoginModal('login');

    expect(dialog.open).toHaveBeenCalledWith(LoginModalComponent, {
      width: '450px',
      maxWidth: '95vw',
      disableClose: false,
      panelClass: 'login-modal-panel',
      autoFocus: true,
      restoreFocus: true,
    });
  });

  it('should open modal in register mode', () => {
    const mockDialogRef = {
      componentInstance: { mode: 'login' },
      afterClosed: () => of({ success: true }),
    };
    dialog.open.mockReturnValue(
      mockDialogRef as unknown as MatDialogRef<LoginModalComponent>
    );

    service.openRegisterModal();

    expect(dialog.open).toHaveBeenCalled();
    expect(mockDialogRef.componentInstance.mode).toBe('register');
  });

  it('should close all dialogs', () => {
    service.closeAllDialogs();
    expect(dialog.closeAll).toHaveBeenCalled();
  });
});
