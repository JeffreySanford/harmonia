import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  selectFormData,
  selectCurrentResult,
  selectProgress,
  selectLoading,
  selectError,
  selectProgressPercentage,
  selectProgressMessage,
} from '../../store/song-generation/song-generation.selectors';
import {
  generateMetadata,
  clearError,
} from '../../store/song-generation/song-generation.actions';

interface SongMetadata {
  title: string;
  lyrics: string;
  genre: string;
  mood: string;
  melody: string;
  tempo: number;
  key: string;
  instrumentation: string[];
  intro: {
    enabled: boolean;
    style: 'with-music' | 'sung' | 'no-music';
    content?: string;
  };
  outro: {
    enabled: boolean;
    style: 'with-music' | 'sung' | 'no-music';
    content?: string;
  };
  syllableCount: number;
}

interface ValidationResult {
  status: 'valid' | 'warning' | 'error';
  message: string;
}

interface GenreSuggestion {
  genre: string;
  selected: boolean;
  feedback?: 'positive' | 'negative';
}

/**
 * Song Generation Page Component
 *
 * Allows users to generate song metadata (title, lyrics, genre, mood) from narrative descriptions.
 *
 * Features:
 * - Narrative textarea input (50-1000 characters)
 * - Duration slider (15-120 seconds)
 * - AI metadata generation (simulated, ready for Ollama integration)
 * - Syllable counting and duration validation
 * - Editable generated metadata
 * - Approval workflow → Export to Music Generation
 *
 * Workflow:
 * 1. User enters narrative
 * 2. User sets desired duration
 * 3. Click "Generate Song Metadata"
 * 4. AI generates title, lyrics, genre, mood
 * 5. User reviews/edits metadata
 * 6. Syllable count validated against duration
 * 7. Click "Approve & Continue" → Navigate to Music Generation with pre-filled data
 */
@Component({
  selector: 'harmonia-song-generation-page',
  standalone: false,
  templateUrl: './song-generation-page.component.html',
  styleUrls: ['./song-generation-page.component.scss'],
})
export class SongGenerationPageComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly destroy$ = new Subject<void>();

  title = 'Song Generation';

  // Form fields (will be synced with store)
  narrative = '';
  duration = 30;

  // Character limits
  readonly minNarrativeLength = 50;
  readonly maxNarrativeLength = 1000;
  readonly minDuration = 15;
  readonly maxDuration = 120;

  // Model options for Ollama (optional)
  readonly availableModels = ['deepseek-coder:6.7b', 'deepseek', 'minstral3'];
  selectedModel: string | undefined = undefined;

  // UI states
  isApproved = false;
  showMetadata = false;

  // Generated metadata
  generatedMetadata: SongMetadata | null = null;

  // Accepted palette from AI suggestions
  acceptedPalette: any = null;

  // Lyrics analysis mode
  generationMode: 'generate' | 'analyze' = 'generate';
  lyricsToAnalyze = '';
  readonly maxLyricsLength = 10000;
  isAnalyzing = false;
  analysisResult: any = null;

  // Reactive subjects for backward compatibility
  private isGeneratingSubject = new BehaviorSubject<boolean>(false);
  readonly isGenerating$ = this.isGeneratingSubject.asObservable();

  // NGRX selectors
  readonly formData$ = this.store.select(selectFormData);
  readonly currentResult$ = this.store.select(selectCurrentResult);
  readonly progress$ = this.store.select(selectProgress);
  readonly loading$ = this.store.select(selectLoading);
  readonly error$ = this.store.select(selectError);
  readonly progressPercentage$ = this.store.select(selectProgressPercentage);
  readonly progressMessage$ = this.store.select(selectProgressMessage);

  ngOnInit(): void {
    // Subscribe to form data changes to sync local component state
    this.formData$.pipe(takeUntil(this.destroy$)).subscribe((formData) => {
      this.narrative = formData.narrative;
      this.duration = formData.duration;
      this.selectedModel = formData.model;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Genre suggestion states
  genreSuggestionState: 'empty' | 'loading' | 'results' | 'error' = 'empty';
  genreSuggestions: GenreSuggestion[] = [];
  genreSuggestionError = 'Failed to get genre suggestions';

  // Genre options (17 standard genres)
  readonly genres = [
    '1940s big band',
    'rat pack (swing/lounge)',
    'jazz',
    'blues',
    "rock 'n' roll",
    'classical',
    'pop',
    'hip hop',
    'country',
    'folk',
    'electronic/dance',
    'reggae',
    'industrial',
    'house',
    'metal',
    'gospel',
    'melodic rock ballads',
  ];

  // Mood options (8 standard moods)
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

  /**
   * Get character count for narrative input
   */
  get characterCount(): number {
    return this.narrative.length;
  }

  /**
   * Get character count for lyrics analysis input
   */
  get lyricsCharacterCount(): number {
    return this.lyricsToAnalyze.length;
  }

  /**
   * Check if narrative is valid length
   */
  get isNarrativeValid(): boolean {
    return (
      this.narrative.length >= this.minNarrativeLength &&
      this.narrative.length <= this.maxNarrativeLength
    );
  }

  /**
   * Get target syllable count for current duration
   * Formula: duration * 4.5 syllables/second
   */
  get targetSyllables(): number {
    return Math.round(this.duration * 4.5);
  }

  /**
   * Get target word count (approximate)
   * Formula: syllables / 4 (average word length)
   */
  get targetWords(): number {
    return Math.round(this.targetSyllables / 4);
  }

  /**
   * Get recommended narrative word count
   * Formula: target words * 2 (narratives are more descriptive than lyrics)
   */
  get recommendedNarrativeWords(): number {
    return this.targetWords * 2;
  }

  /**
   * Format duration for display
   */
  formatDuration(value: number): string {
    return `${value}s`;
  }

  /**
   * Count syllables in text
   * Algorithm: Count vowel groups, adjust for silent 'e', minimum 1 per word
   */
  countSyllables(text: string): number {
    const words = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/);
    return words.reduce((count, word) => {
      if (word.length === 0) return count;

      // Count vowel groups
      const vowelGroups = word.match(/[aeiouy]+/g);
      let syllables = vowelGroups ? vowelGroups.length : 0;

      // Adjust for silent 'e'
      if (word.endsWith('e') && syllables > 1) syllables--;

      // Minimum 1 syllable per word
      return count + Math.max(1, syllables);
    }, 0);
  }

  /**
   * Validate lyrics length against duration
   * Green: Within ±10% of target
   * Yellow: Within ±20% of target
   * Red: Outside ±20% of target
   */
  validateLyrics(): ValidationResult {
    if (!this.generatedMetadata) {
      return { status: 'error', message: 'No lyrics to validate' };
    }

    const syllableCount = this.generatedMetadata.syllableCount;
    const target = this.targetSyllables;
    const min10 = target * 0.9;
    const max10 = target * 1.1;
    const min20 = target * 0.8;
    const max20 = target * 1.2;

    if (syllableCount >= min10 && syllableCount <= max10) {
      return {
        status: 'valid',
        message: `Perfect! ${syllableCount} syllables (target: ${Math.floor(
          min10
        )}-${Math.ceil(max10)})`,
      };
    }

    if (syllableCount >= min20 && syllableCount <= max20) {
      return {
        status: 'warning',
        message: `Close. ${syllableCount} syllables (target: ${Math.floor(
          min10
        )}-${Math.ceil(max10)})`,
      };
    }

    return {
      status: 'error',
      message: `Too ${
        syllableCount < target ? 'short' : 'long'
      }. ${syllableCount} syllables (target: ${Math.floor(min10)}-${Math.ceil(
        max10
      )})`,
    };
  }

  /**
   * Generate complete song with full properties
   * Uses NGRX store to dispatch generateMetadata action
   */
  generateMetadata(): void {
    if (!this.isNarrativeValid) return;

    this.showMetadata = false;
    this.store.dispatch(clearError());

    this.store.dispatch(
      generateMetadata({
        narrative: this.narrative,
        duration: this.duration,
        model: this.selectedModel || 'deepseek',
      })
    );
  }

  /**
   * Update syllable count when lyrics are edited
   */
  onLyricsChange(): void {
    if (this.generatedMetadata) {
      this.generatedMetadata.syllableCount = this.countSyllables(
        this.generatedMetadata.lyrics
      );
      this.isApproved = false; // Reset approval if edited
    }
  }

  /**
   * Regenerate metadata with same narrative
   */
  regenerate(): void {
    this.generateMetadata();
  }

  /**
   * Approve metadata and continue to music generation
   *
   * TODO: Add API call to save approved song:
   * POST /api/songs/approve
   * { narrative, duration, title, lyrics, genre, mood, melody, tempo, key, instrumentation, intro, outro }
   */
  approveAndContinue(): void {
    if (!this.generatedMetadata) return;

    const validation = this.validateLyrics();
    if (validation.status === 'error') {
      alert(
        'Please adjust lyrics length to match the target duration before approving.'
      );
      return;
    }

    this.isApproved = true;

    // In production, save to backend
    // const songId = await this.songService.approveSong(this.generatedMetadata);

    // Navigate to Music Generation with complete song data
    this.router.navigate(['/generate/music'], {
      state: {
        importedSong: {
          title: this.generatedMetadata.title,
          lyrics: this.generatedMetadata.lyrics,
          genre: this.generatedMetadata.genre,
          mood: this.generatedMetadata.mood,
          melody: this.generatedMetadata.melody,
          tempo: this.generatedMetadata.tempo,
          key: this.generatedMetadata.key,
          instrumentation: this.generatedMetadata.instrumentation,
          intro: this.generatedMetadata.intro,
          outro: this.generatedMetadata.outro,
          duration: this.duration,
        },
      },
    });
  }

  /**
   * Handle genre toggle in suggestions
   */
  onGenreToggled(suggestion: GenreSuggestion): void {
    // Update the suggestion in the array
    const index = this.genreSuggestions.findIndex(
      (s) => s.genre === suggestion.genre
    );
    if (index !== -1) {
      this.genreSuggestions[index] = suggestion;
    }
  }

  /**
   * Handle user feedback on suggestions
   */
  onFeedbackGiven(feedback: 'positive' | 'negative'): void {
    // Store feedback for future improvement
    console.log(
      'User feedback:',
      feedback,
      'for suggestions:',
      this.genreSuggestions
    );

    // In production, send to backend for analytics
    // this.http.post('/api/feedback/genre-suggestions', { feedback, suggestions: this.genreSuggestions });

    // Reset suggestions after feedback
    this.genreSuggestionState = 'empty';
    this.genreSuggestions = [];
  }

  /**
   * Handle generation mode change
   */
  onModeChange(event: any): void {
    this.generationMode = event.value;
    // Reset analysis result when switching modes
    this.analysisResult = null;
    this.lyricsToAnalyze = '';
  }

  /**
   * Show DSL help/guide
   */
  showDslHelp(event: Event): void {
    event.preventDefault();
    // TODO: Open dialog with DSL guide or navigate to documentation
    alert(
      'Song Annotation DSL Guide:\n\n' +
        '[Section Name] - Define song sections\n' +
        '(Performance instruction) - Vocal delivery notes\n' +
        '<SFX name params...> - Audio cues and effects\n\n' +
        'Example:\n' +
        '[Verse 1]\n' +
        '(soft spoken)\n' +
        'Lyrics here...\n' +
        '<SFX footsteps repeat=4>'
    );
  }

  /**
   * Check if analyzed song can be used (has song data and no critical errors)
   */
  canUseAnalyzedSong(): boolean {
    if (!this.analysisResult?.song) return false;
    if (!this.analysisResult.errors) return true;
    return (
      this.analysisResult.errors.filter((e: any) => e.severity === 'error')
        .length === 0
    );
  }

  /**
   * Use the analyzed song for generation
   */
  useAnalyzedSong(): void {
    if (!this.analysisResult?.song) return;

    // TODO: Convert parsed DSL song to generation workflow
    // For now, extract basic info and set narrative
    const song = this.analysisResult.song;
    let narrative = '';

    if (song.title) narrative += `Song title: ${song.title}. `;
    if (song.bpm) narrative += `BPM: ${song.bpm}. `;
    if (song.key) narrative += `Key: ${song.key}. `;

    // Extract lyrics as narrative
    const lyrics = song.sections
      .flatMap((section: any) => section.items)
      .filter((item: any) => item.type === 'lyric')
      .map((item: any) => item.text)
      .join(' ')
      .trim();

    if (lyrics) {
      narrative += `Lyrics content: ${lyrics}`;
    }

    this.narrative = narrative;
    this.generationMode = 'generate';

    // Clear analysis result
    this.analysisResult = null;
    this.lyricsToAnalyze = '';
  }

  /**
   * Handle palette suggestion acceptance
   */
  onPaletteAccepted(palette: any): void {
    // Store the accepted palette for use in music generation
    this.acceptedPalette = palette;
    console.log('Palette accepted:', palette);
    // TODO: Store in NGRX state or pass to music generation workflow
  }

  /**
   * Handle palette modifications
   */
  onPaletteModified(modifications: any[]): void {
    console.log('Palette modified:', modifications);
    // TODO: Update local state or NGRX store with modifications
  }
}
