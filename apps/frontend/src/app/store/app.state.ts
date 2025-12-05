/**
 * Root State Interface
 * Defines the complete application state tree
 */

import { AuthState } from './auth/auth.state';
import { ModelsState } from './models/models.state';
import { DatasetsState } from './datasets/datasets.state';
import { JobsState } from './jobs/jobs.state';
import { LibraryState } from './library/library.state';
import { ProfileState } from './profile/profile.state';
import { SongGenerationState } from './song-generation/song-generation.state';

export interface AppState {
  auth: AuthState;
  models: ModelsState;
  datasets: DatasetsState;
  jobs: JobsState;
  library: LibraryState;
  profile: ProfileState;
  songGeneration: SongGenerationState;
}
