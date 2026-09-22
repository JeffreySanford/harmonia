import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  MusicRuntimeCatalogResponse,
  MusicRuntimeStatus,
} from '../store/music-runtime/music-runtime.state';

@Injectable({
  providedIn: 'root',
})
export class MusicRuntimeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/music/runtime';

  getCatalog(): Observable<MusicRuntimeCatalogResponse> {
    return this.http.get<MusicRuntimeCatalogResponse>(
      `${this.baseUrl}/catalog`
    );
  }

  getStatus(): Observable<MusicRuntimeStatus> {
    return this.http.get<MusicRuntimeStatus>(
      `${this.baseUrl}/status`
    );
  }

  selectModel(modelId: string): Observable<MusicRuntimeStatus> {
    return this.http.post<MusicRuntimeStatus>(
      `${this.baseUrl}/select`,
      { modelId }
    );
  }

  stopRuntime(): Observable<MusicRuntimeStatus> {
    return this.http.post<MusicRuntimeStatus>(
      `${this.baseUrl}/stop`,
      {}
    );
  }
}
