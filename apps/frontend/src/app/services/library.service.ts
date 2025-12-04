/**
 * Library Service
 * HTTP client for library API endpoints
 */

import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LibraryItem {
  id: string;
  userId: string;
  songId?: string;
  type: 'song' | 'music' | 'audio' | 'style';
  title: string;
  description?: string;
  fileUrl: string;
  fileType?: 'wav' | 'mp3' | 'flac' | 'json';
  fileSize?: number;
  duration?: number;
  thumbnailUrl?: string;
  metadata?: {
    genre?: string;
    mood?: string;
    bpm?: number;
    key?: string;
    instruments?: string[];
    model?: string;
    generationTime?: number;
  };
  isPublic: boolean;
  playCount: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryFilters {
  type?: 'all' | 'song' | 'music' | 'audio' | 'style';
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'title' | 'mostPlayed';
}

export interface LibraryResponse {
  items: LibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateLibraryItemRequest {
  type: 'song' | 'music' | 'audio' | 'style';
  title: string;
  description?: string;
  songId?: string;
}

export interface UpdateLibraryItemRequest {
  title?: string;
  description?: string;
  isPublic?: boolean;
  metadata?: any;
}

export interface UploadFileRequest {
  file: File;
  type: 'song' | 'music' | 'audio' | 'style';
  title: string;
  description?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LibraryService {
  private readonly apiUrl = 'http://localhost:3000/api/library';
  private readonly http = inject(HttpClient);

  getLibrary(
    filters: LibraryFilters = {},
    page = 1
  ): Observable<LibraryResponse> {
    let params = new HttpParams().set('page', page.toString());

    if (filters.type && filters.type !== 'all') {
      params = params.set('type', filters.type);
    }
    if (filters.search) {
      params = params.set('search', filters.search);
    }
    if (filters.sortBy) {
      params = params.set('sortBy', filters.sortBy);
    }

    return this.http.get<LibraryResponse>(this.apiUrl, { params });
  }

  getLibraryItem(id: string): Observable<LibraryItem> {
    return this.http.get<LibraryItem>(`${this.apiUrl}/${id}`);
  }

  createLibraryItem(item: CreateLibraryItemRequest): Observable<LibraryItem> {
    return this.http.post<LibraryItem>(this.apiUrl, item);
  }

  updateLibraryItem(
    id: string,
    item: UpdateLibraryItemRequest
  ): Observable<LibraryItem> {
    return this.http.put<LibraryItem>(`${this.apiUrl}/${id}`, item);
  }

  deleteLibraryItem(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  uploadFile(uploadData: UploadFileRequest): Observable<LibraryItem> {
    const formData = new FormData();
    formData.append('file', uploadData.file);
    formData.append('type', uploadData.type);
    formData.append('title', uploadData.title);
    if (uploadData.description) {
      formData.append('description', uploadData.description);
    }

    return this.http.post<LibraryItem>(`${this.apiUrl}/upload`, formData);
  }

  incrementPlayCount(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/play`, {});
  }

  incrementDownloadCount(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/download`, {});
  }
}
