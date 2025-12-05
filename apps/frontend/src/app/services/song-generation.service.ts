/**
 * Song Generation Service
 * Frontend service for song generation operations
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SongMetadata, SongGenerationResult, GenerationProgress } from '../store/song-generation/song-generation.state';

@Injectable({
  providedIn: 'root'
})
export class SongGenerationService {
  constructor(private http: HttpClient) {}

  /**
   * Generate song metadata from narrative
   */
  generateMetadata(narrative: string, duration: number, model: string): Observable<SongMetadata> {
    return this.http.post<SongMetadata>('/api/songs/generate-metadata', {
      narrative,
      duration,
      model
    }).pipe(
      catchError((error) => {
        throw new Error(error.error?.message || 'Failed to generate metadata');
      })
    );
  }

  /**
   * Generate complete song with metadata
   */
  generateSong(narrative: string, duration: number, model: string): Observable<SongGenerationResult> {
    return this.http.post<SongGenerationResult>('/api/songs/generate-song', {
      narrative,
      duration,
      model
    }).pipe(
      catchError((error) => {
        throw new Error(error.error?.message || 'Failed to generate song');
      })
    );
  }

  /**
   * Get progress updates (placeholder for future websocket/polling implementation)
   */
  getProgressUpdates(): Observable<GenerationProgress> {
    // Placeholder - in a real implementation, this might connect to websockets
    // or poll for progress updates
    return of({
      stage: 'idle',
      progress: 0,
      message: ''
    });
  }
}