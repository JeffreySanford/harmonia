import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(@Inject(HttpClient) public http: HttpClient) {}

  getHello(): Observable<any> {
    return this.http.get('/api');
  }
}
