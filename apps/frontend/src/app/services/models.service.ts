/**
 * Models Service
 * HTTP client for model artifacts API endpoints
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ModelArtifact } from '../store/models/models.state';

@Injectable({
  providedIn: 'root',
})
export class ModelsService {
  private readonly apiUrl = '/api/models';

  constructor(private http: HttpClient) {}

  getModels(filters?: {
    search?: string;
    type?: string;
    tags?: string[];
  }): Observable<ModelArtifact[]> {
    let params = new HttpParams();

    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    if (filters?.type) {
      params = params.set('type', filters.type);
    }

    if (filters?.tags && filters.tags.length > 0) {
      params = params.set('tags', filters.tags.join(','));
    }

    return this.http.get<ModelArtifact[]>(this.apiUrl, { params });
  }

  getModelById(id: string): Observable<ModelArtifact> {
    return this.http.get<ModelArtifact>(`${this.apiUrl}/${id}`);
  }

  createModel(
    model: Omit<ModelArtifact, 'id' | 'createdAt' | 'updatedAt'>
  ): Observable<ModelArtifact> {
    return this.http.post<ModelArtifact>(this.apiUrl, model);
  }

  updateModel(
    id: string,
    changes: Partial<ModelArtifact>
  ): Observable<ModelArtifact> {
    return this.http.patch<ModelArtifact>(`${this.apiUrl}/${id}`, changes);
  }

  deleteModel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
