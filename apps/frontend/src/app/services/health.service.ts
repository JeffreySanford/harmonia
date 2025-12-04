import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly url = '/api/__health';
  private readonly http = inject(HttpClient);

  isBackendReachable(): Observable<boolean> {
    return this.http.get(this.url).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}
