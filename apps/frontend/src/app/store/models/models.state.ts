/**
 * Models State
 * Manages locally known model artifacts.
 */

import { EntityState } from '@ngrx/entity';

export interface ModelArtifact {
  id: string;
  name: string;
  version: string;
  type: string;
  repositoryId?: string;
  path?: string;
  sizeBytes?: number;
  sha256?: string;
  license?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ModelsState extends EntityState<ModelArtifact> {
  selectedModelId: string | null;
  loading: boolean;
  error: string | null;
  filters: {
    search: string;
    modelType: string | null;
    tags: string[];
  };
}
