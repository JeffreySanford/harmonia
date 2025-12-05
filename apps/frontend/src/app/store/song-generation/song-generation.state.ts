/**
 * Song Generation State
 * Manages song generation process, metadata, progress, and results
 */

export interface SongMetadata {
  title: string;
  lyrics: string;
  genre: string;
  mood: string[];
  bpm?: number;
  key?: string;
  duration?: number;
  instruments?: string[];
}

export interface GenerationProgress {
  stage: 'idle' | 'generating-metadata' | 'generating-song' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentStepIndex?: number;
}

export interface SongGenerationResult {
  id: string;
  metadata: SongMetadata;
  audioUrl?: string;
  stemUrls?: { [instrument: string]: string };
  createdAt: string;
  duration: number;
}

export interface SongGenerationState {
  // Current generation request
  currentRequest: {
    narrative: string;
    duration: number;
    model: string;
    genre?: string;
    mood?: string[];
  } | null;

  // Generation progress
  progress: GenerationProgress;

  // Results
  currentResult: SongGenerationResult | null;
  history: SongGenerationResult[];

  // UI state
  loading: boolean;
  error: string | null;

  // Form state
  formData: {
    narrative: string;
    duration: number;
    model: string;
    genre: string;
    mood: string[];
  };
}

export const initialSongGenerationState: SongGenerationState = {
  currentRequest: null,
  progress: {
    stage: 'idle',
    progress: 0,
    message: '',
  },
  currentResult: null,
  history: [],
  loading: false,
  error: null,
  formData: {
    narrative: '',
    duration: 30,
    model: 'deepseek',
    genre: '',
    mood: [],
  },
};