import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NxWelcome } from './nx-welcome';
import { ApiService } from './api.service';
import { HttpClientModule } from '@angular/common/http';
import { DashboardComponent } from './dashboard.component';

@Component({
  imports: [NxWelcome, RouterModule, HttpClientModule, DashboardComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'frontend';
  apiMessage: string = '';

  constructor(private apiService: ApiService) {
    this.apiService.getHello().subscribe({
      next: (res) => {
        this.apiMessage = res.message || JSON.stringify(res);
      },
      error: () => {
        this.apiMessage = 'API not reachable';
      }
    });
  }
}
