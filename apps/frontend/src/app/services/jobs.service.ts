/**
 * Jobs Service
 * HTTP client for job queue API endpoints
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Job, JobStatus, JobType } from '../store/jobs/jobs.state';

@Injectable({
  providedIn: 'root',
})
export class JobsService {
  private readonly apiUrl = '/api/jobs';

  constructor(private http: HttpClient) {}

  getJobs(filters?: {
    status?: JobStatus;
    type?: JobType;
    userId?: string;
  }): Observable<Job[]> {
    let params = new HttpParams();

    if (filters?.status) {
      params = params.set('status', filters.status);
    }

    if (filters?.type) {
      params = params.set('type', filters.type);
    }

    if (filters?.userId) {
      params = params.set('userId', filters.userId);
    }

    return this.http.get<Job[]>(this.apiUrl, { params });
  }

  getJobById(id: string): Observable<Job> {
    return this.http.get<Job>(`${this.apiUrl}/${id}`);
  }

  createJob(request: {
    jobType: JobType;
    parameters: Record<string, unknown>;
    priority?: number;
    modelId?: string;
    datasetId?: string;
  }): Observable<Job> {
    return this.http.post<Job>(this.apiUrl, request);
  }

  cancelJob(id: string): Observable<Job> {
    return this.http.post<Job>(`${this.apiUrl}/${id}/cancel`, {});
  }

  deleteJob(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
