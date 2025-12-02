/**
 * Datasets Service
 * HTTP client for datasets API endpoints
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Dataset, AudioSample } from '../store/datasets/datasets.state';

@Injectable({
  providedIn: 'root',
})
export class DatasetsService {
  private readonly apiUrl = '/api/datasets';

  constructor(private http: HttpClient) {}

  getDatasets(filters?: {
    search?: string;
    category?: string;
    tags?: string[];
  }): Observable<Dataset[]> {
    let params = new HttpParams();

    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    if (filters?.category) {
      params = params.set('category', filters.category);
    }

    if (filters?.tags && filters.tags.length > 0) {
      params = params.set('tags', filters.tags.join(','));
    }

    return this.http.get<Dataset[]>(this.apiUrl, { params });
  }

  getDatasetById(id: string): Observable<Dataset> {
    return this.http.get<Dataset>(`${this.apiUrl}/${id}`);
  }

  getDatasetSamples(
    datasetId: string,
    options?: { limit?: number; offset?: number }
  ): Observable<AudioSample[]> {
    let params = new HttpParams();

    if (options?.limit) {
      params = params.set('limit', options.limit.toString());
    }

    if (options?.offset) {
      params = params.set('offset', options.offset.toString());
    }

    return this.http.get<AudioSample[]>(
      `${this.apiUrl}/${datasetId}/samples`,
      { params }
    );
  }

  createDataset(
    dataset: Omit<Dataset, 'id' | 'createdAt' | 'updatedAt'>
  ): Observable<Dataset> {
    return this.http.post<Dataset>(this.apiUrl, dataset);
  }

  updateDataset(
    id: string,
    changes: Partial<Dataset>
  ): Observable<Dataset> {
    return this.http.patch<Dataset>(`${this.apiUrl}/${id}`, changes);
  }

  deleteDataset(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
