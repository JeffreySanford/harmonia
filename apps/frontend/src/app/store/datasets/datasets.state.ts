/**
 * Datasets State
 * Manages dataset metadata and sample previews.
 */

import { EntityState } from '@ngrx/entity';

export interface AudioSample {
  id: string;
  datasetId: string;
  name?: string;
  path?: string;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  metadata?: Record<string, unknown>;
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  sampleCount?: number;
  sizeBytes?: number;
  license?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetsState extends EntityState<Dataset> {
  selectedDatasetId: string | null;
  selectedSamples: AudioSample[];
  loading: boolean;
  samplesLoading: boolean;
  error: string | null;
  filters: {
    search: string;
    category: string | null;
    tags: string[];
  };
}
