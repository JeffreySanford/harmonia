import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface SongMetadata {
  title: string;
  lyrics: string;
  genre: string;
  mood: string;
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
export class SongGenerationPageComponent {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  title = 'Song Generation';

  // Form fields
  narrative = '';
  duration = 30;

  // Character limits
  readonly minNarrativeLength = 50;
  readonly maxNarrativeLength = 1000;
  readonly minDuration = 15;
  readonly maxDuration = 120;

  // Generated metadata
  generatedMetadata: SongMetadata | null = null;

  // Model options for Ollama (optional)
  readonly availableModels = ['deepseek-coder:6.7b', 'deepseek', 'minstral3'];
  selectedModel: string | undefined = undefined;

  // UI states
  isGenerating = false;
  isApproved = false;
  showMetadata = false;

  // Lyrics analysis mode
  generationMode: 'generate' | 'analyze' = 'generate';
  lyricsToAnalyze = '';
  readonly maxLyricsLength = 10000;
  isAnalyzing = false;
  analysisResult: any = null;

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
   * Generate song metadata from narrative
   * Currently simulated - ready for Ollama integration
   *
   * TODO: Replace with actual Ollama API call:
   * POST /api/songs/generate-metadata
   * { narrative, duration }
   */
  async generateMetadata(): Promise<void> {
    if (!this.isNarrativeValid) return;

    this.isGenerating = true;
    this.showMetadata = false;

    try {
      // Call backend endpoint - backend will fallback to simulated if Ollama not configured
      const resp: any = await this.http
        .post('/api/songs/generate-metadata', {
          narrative: this.narrative,
          duration: this.duration,
          model: this.selectedModel,
        })
        .toPromise();
      this.generatedMetadata = {
        title: resp.title || this.generateTitleFromNarrative(),
        lyrics: resp.lyrics || this.generateSampleLyrics(),
        genre: resp.genre || this.suggestGenre(),
        mood: resp.mood || this.suggestMood(),
        syllableCount:
          resp.syllableCount ||
          this.countSyllables(resp.lyrics || this.generateSampleLyrics()),
      };
    } catch (err) {
      console.warn(
        'Generate metadata failed; falling back to sample generator',
        err
      );
      const sampleLyrics = this.generateSampleLyrics();
      this.generatedMetadata = {
        title: this.generateTitleFromNarrative(),
        lyrics: sampleLyrics,
        genre: this.suggestGenre(),
        mood: this.suggestMood(),
        syllableCount: this.countSyllables(sampleLyrics),
      };
    }

    this.isGenerating = false;
    this.showMetadata = true;
    this.isApproved = false;
  }

  /**
   * Generate title from narrative (first few words)
   */
  private generateTitleFromNarrative(): string {
    const words = this.narrative.trim().split(/\s+/).slice(0, 4);
    return words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Suggest genre based on narrative keywords
   */
  private suggestGenre(): string {
    const narrativeLower = this.narrative.toLowerCase();

    if (narrativeLower.includes('rock') || narrativeLower.includes('guitar'))
      return 'rock';
    if (narrativeLower.includes('jazz') || narrativeLower.includes('saxophone'))
      return 'jazz';
    if (narrativeLower.includes('hip-hop') || narrativeLower.includes('rap'))
      return 'hip-hop';
    if (narrativeLower.includes('country') || narrativeLower.includes('rural'))
      return 'country';
    if (
      narrativeLower.includes('electronic') ||
      narrativeLower.includes('synth')
    )
      return 'electronic';
    if (
      narrativeLower.includes('classical') ||
      narrativeLower.includes('orchestra')
    )
      return 'classical';
    if (narrativeLower.includes('blues')) return 'blues';
    if (narrativeLower.includes('folk')) return 'folk';

    return 'pop'; // Default
  }

  /**
   * Suggest mood based on narrative keywords
   */
  private suggestMood(): string {
    const narrativeLower = this.narrative.toLowerCase();

    // Map of keywords to moods for simpler lookup
    const moodKeywords: Record<string, string[]> = {
      melancholic: ['sad', 'melanchol', 'lost'],
      romantic: ['love', 'romance'],
      aggressive: ['angry', 'aggress'],
      calm: ['calm', 'peace'],
      mysterious: ['dark', 'myster'],
      uplifting: ['happy', 'uplift'],
      nostalgic: ['nostalg', 'memory'],
      energetic: ['energy', 'exciting'],
    };

    // Find first matching mood
    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      if (keywords.some((keyword) => narrativeLower.includes(keyword))) {
        return mood;
      }
    }

    return 'calm'; // Default
  }

  /**
   * Generate sample lyrics with appropriate length
   * In production, this would be generated by Ollama
   */
  private generateSampleLyrics(): string {
    const wordsNeeded = this.targetWords;

    // Sample verse structure
    const verses = [
      'Walking through the empty streets at night',
      'Memories of you still burning bright',
      'The rain falls down like tears I cry',
      "Wondering when I'll say goodbye",
      'Every step I take reminds me of your face',
      'Lost in time and lost in space',
      'The city lights reflect my pain',
      'Dancing slowly in the rain',
    ];

    let lyrics = '';
    let currentWords = 0;
    let verseIndex = 0;

    while (currentWords < wordsNeeded && verseIndex < verses.length) {
      const line = verses[verseIndex];
      if (line) {
        lyrics += line + '\n';
        currentWords += line.split(/\s+/).length;
      }
      verseIndex++;
    }

    // If we need more words, repeat verses
    while (currentWords < wordsNeeded) {
      const line = verses[verseIndex % verses.length];
      if (line) {
        lyrics += line + '\n';
        currentWords += line.split(/\s+/).length;
      }
      verseIndex++;
    }

    return lyrics.trim();
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
  async regenerate(): Promise<void> {
    await this.generateMetadata();
  }

  /**
   * Approve metadata and continue to music generation
   *
   * TODO: Add API call to save approved song:
   * POST /api/songs/approve
   * { narrative, duration, title, lyrics, genre, mood }
   */
  async approveAndContinue(): Promise<void> {
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

    // Navigate to Music Generation with song data
    this.router.navigate(['/generate/music'], {
      state: {
        importedSong: {
          title: this.generatedMetadata.title,
          lyrics: this.generatedMetadata.lyrics,
          genre: this.generatedMetadata.genre,
          mood: this.generatedMetadata.mood,
          duration: this.duration,
        },
      },
    });
  }

  /**
   * Handle genre suggestion request
   */
  async onSuggestGenres(): Promise<void> {
    this.genreSuggestionState = 'loading';
    this.genreSuggestionError = '';

    try {
      const response = await this.http
        .post<string[]>('/api/songs/suggest-genres', {
          narrative: this.narrative,
          model: this.selectedModel,
        })
        .toPromise();

      if (response && response.length > 0) {
        this.genreSuggestions = response.map((genre) => ({
          genre,
          selected: false,
        }));
        this.genreSuggestionState = 'results';
      } else {
        throw new Error('No suggestions received');
      }
    } catch (error) {
      console.error('Genre suggestion error:', error);
      this.genreSuggestionError =
        'Failed to get genre suggestions. Please try again.';
      this.genreSuggestionState = 'error';
    }
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
   * Handle retry suggestions
   */
  onRetrySuggestions(): void {
    this.onSuggestGenres();
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
   * Analyze lyrics using DSL parser
   */
  async analyzeLyrics(): Promise<void> {
    if (!this.lyricsToAnalyze.trim()) return;

    this.isAnalyzing = true;
    this.analysisResult = null;

    try {
      const response = await this.http
        .post('/api/songs/analyze-lyrics', {
          lyrics: this.lyricsToAnalyze,
          validateOnly: false,
        })
        .toPromise();

      this.analysisResult = response;
    } catch (error: any) {
      this.analysisResult = {
        song: null,
        errors: [
          {
            line: 1,
            message: error.error?.message || 'Failed to analyze lyrics',
            severity: 'error',
          },
        ],
      };
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Validate lyrics without full parsing
   */
  async validateLyricsOnly(): Promise<void> {
    if (!this.lyricsToAnalyze.trim()) return;

    this.isAnalyzing = true;

    try {
      const response: any = await this.http
        .post('/api/songs/analyze-lyrics', {
          lyrics: this.lyricsToAnalyze,
          validateOnly: true,
        })
        .toPromise();

      this.analysisResult = {
        song: null,
        errors: response?.valid ? [] : response?.errors || [],
      };
    } catch (error: any) {
      this.analysisResult = {
        song: null,
        errors: [
          {
            line: 1,
            message: error.error?.message || 'Failed to validate lyrics',
            severity: 'error',
          },
        ],
      };
    } finally {
      this.isAnalyzing = false;
    }
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
}
