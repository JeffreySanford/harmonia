import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ApiService } from './api.service';
import { inject } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { DashboardComponent } from './dashboard.component';

@Component({
  imports: [RouterModule, HttpClientModule, DashboardComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'frontend';
  apiMessage = '';
  private apiService = inject(ApiService);

  constructor() {
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
