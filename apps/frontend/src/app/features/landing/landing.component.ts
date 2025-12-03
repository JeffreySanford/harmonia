import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthModule } from '../auth/auth.module';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
  standalone: true,
  imports: [CommonModule, AuthModule, MatButtonModule, MatCardModule],
  template: `
    <div class="landing-container">
      <div class="landing-hero">
        <h1 class="landing-title">Harmonia</h1>
        <p class="landing-subtitle">AI-Powered Music Generation</p>
        <p class="landing-description">
          Create stunning music, songs, and soundscapes with cutting-edge AI technology.
          Transform your ideas into professional audio in seconds.
        </p>
        
        <div class="landing-actions">
          <button 
            mat-raised-button 
            color="primary" 
            class="landing-button primary"
            (click)="openLoginModal()">
            Sign In
          </button>
          <button 
            mat-raised-button 
            class="landing-button secondary"
            (click)="openRegisterModal()">
            Create Account
          </button>
        </div>
      </div>

      <div class="landing-features">
        <mat-card class="feature-card">
          <mat-card-header>
            <mat-card-title>Song Generation</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            Create complete songs with vocals, lyrics, and instrumentation
          </mat-card-content>
        </mat-card>

        <mat-card class="feature-card">
          <mat-card-header>
            <mat-card-title>Music Generation</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            Generate instrumental tracks, beats, and background music
          </mat-card-content>
        </mat-card>

        <mat-card class="feature-card">
          <mat-card-header>
            <mat-card-title>Video Generation</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            Create music videos and visual content for your tracks
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .landing-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .landing-hero {
      text-align: center;
      max-width: 800px;
      margin-bottom: 4rem;
    }

    .landing-title {
      font-size: 4rem;
      font-weight: 700;
      margin: 0 0 1rem 0;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    }

    .landing-subtitle {
      font-size: 1.5rem;
      font-weight: 300;
      margin: 0 0 2rem 0;
      opacity: 0.9;
    }

    .landing-description {
      font-size: 1.1rem;
      line-height: 1.6;
      margin: 0 0 3rem 0;
      opacity: 0.85;
    }

    .landing-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .landing-button {
      font-size: 1.1rem;
      padding: 0.75rem 2rem;
      min-width: 180px;
      height: 56px;
    }

    .landing-button.primary {
      background-color: white;
      color: #667eea;
    }

    .landing-button.secondary {
      background-color: rgba(255, 255, 255, 0.2);
      color: white;
      border: 2px solid white;
    }

    .landing-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .landing-features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      max-width: 1200px;
      width: 100%;
    }

    .feature-card {
      background-color: rgba(255, 255, 255, 0.95);
      color: #333;
    }

    ::ng-deep .feature-card .mat-mdc-card-header {
      padding: 1rem 1rem 0 1rem;
    }

    ::ng-deep .feature-card .mat-mdc-card-title {
      font-size: 1.25rem;
      font-weight: 600;
    }

    ::ng-deep .feature-card .mat-mdc-card-content {
      padding: 1rem;
      color: #666;
    }

    @media (max-width: 768px) {
      .landing-title {
        font-size: 2.5rem;
      }

      .landing-subtitle {
        font-size: 1.2rem;
      }

      .landing-features {
        grid-template-columns: 1fr;
      }
    }
  `]
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
