import { Component } from '@angular/core';
// Module imports (provided by `LandingModule` instead)
// CommonModule is provided by LandingModule; no direct import needed in component.
import { inject } from '@angular/core';
// Material modules are provided by LandingModule; avoid direct module imports here.
import { AuthUiService } from '../../services/auth-ui.service';

/**
 * Landing Page Component
 *
 * Welcome page for unauthenticated users with prominent
 * sign-in/sign-up buttons. Redirects authenticated users
 * to /generate/song.
 */
@Component({
  selector: 'harmonia-landing',
  standalone: false,
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  private readonly authUiService = inject(AuthUiService);

  openLoginModal(): void {
    this.authUiService.openLoginModal();
  }

  openRegisterModal(): void {
    this.authUiService.openRegisterModal();
  }
}
