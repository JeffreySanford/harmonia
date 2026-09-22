import {
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';
import { WebSocketService } from '../../services/websocket.service';
import { AppState } from '../../store/app.state';
import { selectAuthToken } from '../../store/auth/auth.selectors';
import * as MusicRuntimeActions from '../../store/music-runtime/music-runtime.actions';
import {
  selectModelsForSelectedProvider,
  selectRuntimeHardware,
  selectRuntimeLoading,
  selectRuntimeProviders,
  selectRuntimeStatus,
  selectRuntimeSwitching,
  selectSelectedRuntimeModelId,
  selectSelectedRuntimeProviderId,
} from '../../store/music-runtime/music-runtime.selectors';
import {
  HardwareProfile,
  MusicModelCatalogEntry,
  MusicProviderDefinition,
  MusicRuntimeStatus,
} from '../../store/music-runtime/music-runtime.state';

interface ImportedSong {
  title: string;
  lyrics: string;
  genre: string;
  mood: string;
  duration: number;
}

interface InstrumentOption {
  value: string;
  label: string;
  icon: string;
}

/**
 * Music Generation Page Component
 *
 * Music-generation workstation surface with an explicit provider/model runtime
 * selector. Provider lifecycle is managed by NgRx + NestJS and streamed over
 * Socket.IO; fake audio generation is intentionally not used.
 */
@Component({
  selector: 'harmonia-music-generation-page',
  standalone: false,
  templateUrl: './music-generation-page.component.html',
  styleUrls: ['./music-generation-page.component.scss'],
})
export class MusicGenerationPageComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly store = inject(Store<AppState>);
  private readonly websocket = inject(WebSocketService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroy$ = new Subject<void>();

  title = 'Music Generation';

  importedSong: ImportedSong | null = null;
  hasImportedSong = false;
  lyricsExpanded = false;

  musicTitle = '';
  lyrics = '';
  genre = 'pop';
  mood = 'calm';
  duration = 30;
  bpm = 120;
  vocalsStyle = 'clean';
  selectedInstruments: string[] = [];

  isGenerating = false;
  progress = 0;
  generatedAudioUrl: string | null = null;

  selectedProviderId: string | null = null;
  selectedModelId: string | null = null;
  runtimeModels: MusicModelCatalogEntry[] = [];
  runtimeStatus: MusicRuntimeStatus | null = null;
  hardware: HardwareProfile | null = null;
  runtimeSwitching = false;
  runtimeLoading = false;

  readonly providers$ = this.store.select(selectRuntimeProviders);
  readonly models$ = this.store.select(selectModelsForSelectedProvider);

  readonly genres = [
    { value: 'pop', label: 'Pop', defaultBpm: 120 },
    { value: 'rock', label: 'Rock', defaultBpm: 140 },
    { value: 'hip-hop', label: 'Hip-Hop', defaultBpm: 95 },
    { value: 'country', label: 'Country', defaultBpm: 110 },
    { value: 'jazz', label: 'Jazz', defaultBpm: 120 },
    { value: 'blues', label: 'Blues', defaultBpm: 90 },
    { value: 'electronic', label: 'Electronic', defaultBpm: 128 },
    { value: 'r&b', label: 'R&B', defaultBpm: 85 },
    { value: 'folk', label: 'Folk', defaultBpm: 100 },
    { value: 'classical', label: 'Classical', defaultBpm: 110 },
    { value: 'indie', label: 'Indie', defaultBpm: 115 },
    { value: 'alternative', label: 'Alternative', defaultBpm: 125 },
  ];

  readonly moods = [
    'energetic',
    'melancholic',
    'romantic',
    'aggressive',
    'calm',
    'mysterious',
    'uplifting',
    'nostalgic',
  ];

  readonly vocalsStyles = [
    { value: 'clean', label: 'Clean' },
    { value: 'raspy', label: 'Raspy' },
    { value: 'smooth', label: 'Smooth' },
    { value: 'aggressive', label: 'Aggressive' },
    { value: 'breathy', label: 'Breathy' },
  ];

  readonly instruments: InstrumentOption[] = [
    { value: 'electric-guitar', label: 'Electric Guitar', icon: 'music_note' },
    { value: 'acoustic-guitar', label: 'Acoustic Guitar', icon: 'music_note' },
    { value: 'bass', label: 'Bass', icon: 'music_note' },
    { value: 'drums', label: 'Drums', icon: 'music_note' },
    { value: 'piano', label: 'Piano', icon: 'piano' },
    { value: 'synth', label: 'Synthesizer', icon: 'keyboard' },
    { value: 'strings', label: 'Strings', icon: 'music_note' },
    { value: 'brass', label: 'Brass', icon: 'music_note' },
    { value: 'saxophone', label: 'Saxophone', icon: 'music_note' },
  ];

  constructor() {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state?.['importedSong']) {
      this.importedSong = navigation.extras.state['importedSong'];
      this.hasImportedSong = true;
    }
  }

  ngOnInit(): void {
    if (this.importedSong) {
      this.musicTitle = this.importedSong.title;
      this.lyrics = this.importedSong.lyrics;
      this.genre = this.importedSong.genre;
      this.mood = this.importedSong.mood;
      this.duration = this.importedSong.duration;

      const genreData = this.genres.find((g) => g.value === this.genre);
      if (genreData) {
        this.bpm = genreData.defaultBpm;
      }
      this.selectedInstruments = this.getDefaultInstruments(this.genre);
    }

    this.store.dispatch(MusicRuntimeActions.loadCatalog());

    this.store
      .select(selectAuthToken)
      .pipe(
        filter((token): token is string => Boolean(token)),
        take(1)
      )
      .subscribe((token) => this.websocket.connect(token));

    this.store
      .select(selectSelectedRuntimeProviderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((providerId) => {
        this.selectedProviderId = providerId;
      });

    this.store
      .select(selectSelectedRuntimeModelId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((modelId) => {
        this.selectedModelId = modelId;
      });

    this.models$
      .pipe(takeUntil(this.destroy$))
      .subscribe((models) => {
        this.runtimeModels = models;
      });

    this.store
      .select(selectRuntimeStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        this.runtimeStatus = status;
      });

    this.store
      .select(selectRuntimeHardware)
      .pipe(takeUntil(this.destroy$))
      .subscribe((hardware) => {
        this.hardware = hardware;
      });

    this.store
      .select(selectRuntimeSwitching)
      .pipe(takeUntil(this.destroy$))
      .subscribe((switching) => {
        this.runtimeSwitching = switching;
      });

    this.store
      .select(selectRuntimeLoading)
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.runtimeLoading = loading;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onProviderChange(providerId: string): void {
    this.store.dispatch(
      MusicRuntimeActions.chooseProvider({ providerId })
    );
  }

  onModelChange(modelId: string): void {
    const model = this.runtimeModels.find(
      (candidate) => candidate.id === modelId
    );

    if (!model) {
      return;
    }

    if (!model.selectable) {
      this.snackBar.open(
        model.disabledReason || 'This model is not available on this runtime.',
        'Close',
        { duration: 5000 }
      );
      return;
    }

    this.generatedAudioUrl = null;
    this.store.dispatch(MusicRuntimeActions.selectModel({ modelId }));
  }

  stopRuntime(): void {
    this.store.dispatch(MusicRuntimeActions.stopRuntime());
  }

  modelOptionLabel(model: MusicModelCatalogEntry): string {
    const size = model.modelSize ? ` · ${model.modelSize}` : '';
    const fit =
      model.hardwareFit === 'recommended'
        ? 'Recommended'
        : model.hardwareFit === 'supported'
          ? 'Supported'
          : model.hardwareFit === 'experimental'
            ? 'Experimental'
            : 'Unavailable';

    return `${model.name}${size} · ${fit}`;
  }

  get selectedRuntimeModel(): MusicModelCatalogEntry | null {
    if (!this.selectedModelId) {
      return null;
    }
    return (
      this.runtimeModels.find(
        (model) => model.id === this.selectedModelId
      ) || null
    );
  }

  get maxDurationSeconds(): number {
    return this.selectedRuntimeModel?.maxDurationSeconds || 120;
  }

  get runtimeReady(): boolean {
    return Boolean(
      this.runtimeStatus?.state === 'ready' &&
        this.runtimeStatus.healthy &&
        this.runtimeStatus.modelId === this.selectedModelId
    );
  }

  get runtimeStateIcon(): string {
    switch (this.runtimeStatus?.state) {
      case 'ready':
      case 'healthy':
        return 'check_circle';
      case 'error':
        return 'error';
      case 'stopped':
        return 'stop_circle';
      case 'building':
      case 'starting':
      case 'health-checking':
      case 'loading-model':
      case 'unloading-model':
      case 'stopping':
        return 'sync';
      default:
        return 'memory';
    }
  }

  formatVram(value: number | null | undefined): string {
    return value === null || value === undefined
      ? 'Unknown'
      : `${value.toFixed(1)} GB`;
  }

  private getDefaultInstruments(genre: string): string[] {
    const defaults: Record<string, string[]> = {
      pop: ['electric-guitar', 'drums', 'bass', 'synth'],
      rock: ['electric-guitar', 'drums', 'bass'],
      'hip-hop': ['drums', 'bass', 'synth'],
      country: ['acoustic-guitar', 'drums', 'bass'],
      jazz: ['piano', 'bass', 'drums', 'saxophone'],
      blues: ['electric-guitar', 'bass', 'drums'],
      electronic: ['synth', 'drums'],
      'r&b': ['piano', 'bass', 'drums'],
      folk: ['acoustic-guitar'],
      classical: ['piano', 'strings'],
      indie: ['acoustic-guitar', 'drums', 'bass'],
      alternative: ['electric-guitar', 'drums', 'bass'],
    };
    return defaults[genre] || ['electric-guitar', 'drums', 'bass'];
  }

  onGenreChange(): void {
    const genreData = this.genres.find((g) => g.value === this.genre);
    if (genreData) {
      this.bpm = genreData.defaultBpm;
    }
    if (!this.hasImportedSong) {
      this.selectedInstruments = this.getDefaultInstruments(this.genre);
    }
  }

  formatBpm(value: number): string {
    return `${value} BPM`;
  }

  toggleInstrument(instrument: string): void {
    const index = this.selectedInstruments.indexOf(instrument);
    if (index >= 0) {
      this.selectedInstruments.splice(index, 1);
    } else {
      this.selectedInstruments.push(instrument);
    }
  }

  isInstrumentSelected(instrument: string): boolean {
    return this.selectedInstruments.includes(instrument);
  }

  toggleLyrics(): void {
    this.lyricsExpanded = !this.lyricsExpanded;
  }

  get estimatedGenerationTime(): string {
    const seconds = this.duration * 15;
    if (seconds < 60) {
      return `${seconds} seconds`;
    }
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  /**
   * Audio generation remains intentionally disabled until a provider adapter
   * returns a real artifact. This avoids the previous fake sample-audio success.
   */
  generateMusic(): void {
    if (!this.musicTitle || !this.genre) {
      this.snackBar.open(
        'Please enter a title and select a genre.',
        'Close',
        { duration: 4000 }
      );
      return;
    }

    if (!this.runtimeReady) {
      this.snackBar.open(
        'Select a compatible model and wait for its runtime to become ready.',
        'Close',
        { duration: 5000 }
      );
      return;
    }

    this.generatedAudioUrl = null;
    this.progress = 0;
    this.isGenerating = false;

    this.snackBar.open(
      `${this.runtimeStatus?.modelName || 'Selected model'} is ready. Audio generation wiring is the next provider-adapter step; Harmonia will not create a fake audio file.`,
      'OK',
      { duration: 7000 }
    );
  }

  downloadAudio(): void {
    if (this.generatedAudioUrl) {
      window.open(this.generatedAudioUrl, '_blank');
    }
  }

  backToSongGeneration(): void {
    this.router.navigate(['/generate/song']);
  }
}
