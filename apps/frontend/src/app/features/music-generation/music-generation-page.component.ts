import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

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
 * Generates audio music files from song metadata using MusicGen model.
 *
 * Features:
 * - Import approved song metadata from Song Generation
 * - Pre-filled fields from imported song (title, lyrics, genre, duration)
 * - BPM slider with genre-based defaults
 * - Instrumentation multi-select
 * - Vocals style selection
 * - Audio generation with progress tracking
 *
 * Workflow:
 * 1. Import song from Song Generation (optional)
 * 2. Review/adjust music parameters (BPM, instrumentation)
 * 3. Click "Generate Music"
 * 4. Backend creates async job
 * 5. WebSocket tracks progress (0-100%)
 * 6. Download audio file on completion
 */
@Component({
  selector: 'harmonia-music-generation-page',
  standalone: false,
  templateUrl: './music-generation-page.component.html',
  styleUrls: ['./music-generation-page.component.scss'],
})
export class MusicGenerationPageComponent implements OnInit {
  private readonly router = inject(Router);

  title = 'Music Generation';

  // Imported song data
  importedSong: ImportedSong | null = null;
  hasImportedSong = false;
  lyricsExpanded = false;

  // Form fields
  musicTitle = '';
  lyrics = '';
  genre = 'pop';
  mood = 'calm';
  duration = 30;
  bpm = 120;
  vocalsStyle = 'clean';
  selectedInstruments: string[] = [];

  // UI state
  isGenerating = false;
  progress = 0;
  generatedAudioUrl: string | null = null;

  // Genre options (12 standard genres with default BPM)
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

  // Mood options
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

  // Vocals style options
  readonly vocalsStyles = [
    { value: 'clean', label: 'Clean' },
    { value: 'raspy', label: 'Raspy' },
    { value: 'smooth', label: 'Smooth' },
    { value: 'aggressive', label: 'Aggressive' },
    { value: 'breathy', label: 'Breathy' },
  ];

  // Instrumentation options
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
    // Check for imported song data from navigation state
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state?.['importedSong']) {
      this.importedSong = navigation.extras.state['importedSong'];
      this.hasImportedSong = true;
    }
  }

  ngOnInit(): void {
    // Pre-fill form if song was imported
    if (this.importedSong) {
      this.musicTitle = this.importedSong.title;
      this.lyrics = this.importedSong.lyrics;
      this.genre = this.importedSong.genre;
      this.mood = this.importedSong.mood;
      this.duration = this.importedSong.duration;

      // Set BPM based on genre
      const genreData = this.genres.find((g) => g.value === this.genre);
      if (genreData) {
        this.bpm = genreData.defaultBpm;
      }

      // Set default instrumentation based on genre
      this.selectedInstruments = this.getDefaultInstruments(this.genre);
    }
  }

  /**
   * Get default instruments for a genre
   */
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

  /**
   * Update BPM when genre changes
   */
  onGenreChange(): void {
    const genreData = this.genres.find((g) => g.value === this.genre);
    if (genreData) {
      this.bpm = genreData.defaultBpm;
    }
    // Update default instruments
    if (!this.hasImportedSong) {
      this.selectedInstruments = this.getDefaultInstruments(this.genre);
    }
  }

  /**
   * Format BPM value for display
   */
  formatBpm(value: number): string {
    return `${value} BPM`;
  }

  /**
   * Toggle instrument selection
   */
  toggleInstrument(instrument: string): void {
    const index = this.selectedInstruments.indexOf(instrument);
    if (index >= 0) {
      this.selectedInstruments.splice(index, 1);
    } else {
      this.selectedInstruments.push(instrument);
    }
  }

  /**
   * Check if instrument is selected
   */
  isInstrumentSelected(instrument: string): boolean {
    return this.selectedInstruments.includes(instrument);
  }

  /**
   * Toggle lyrics expansion
   */
  toggleLyrics(): void {
    this.lyricsExpanded = !this.lyricsExpanded;
  }

  /**
   * Estimate generation time based on duration
   * Approximation: 10-20 seconds per second of audio
   */
  get estimatedGenerationTime(): string {
    const seconds = this.duration * 15; // Average 15s per audio second
    if (seconds < 60) {
      return `${seconds} seconds`;
    }
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  /**
   * Generate music from parameters
   *
   * TODO: Replace with actual backend call:
   * POST /api/music/generate
   * { title, lyrics, genre, mood, duration, bpm, instrumentation, vocalsStyle }
   */
  generateMusic(): void {
    if (!this.musicTitle || !this.genre) {
      alert('Please enter a title and select a genre');
      return;
    }

    this.isGenerating = true;
    this.progress = 0;
    this.generatedAudioUrl = null;

    // Simulate progress (in production, use WebSocket)
    const interval = setInterval(() => {
      this.progress += 5;
      if (this.progress >= 100) {
        clearInterval(interval);
        this.isGenerating = false;

        // Simulated audio URL (in production, from backend)
        this.generatedAudioUrl = '/assets/sample-audio.mp3';
      }
    }, 500);

    // In production:
    // const job = await this.musicService.generate({
    //   title: this.musicTitle,
    //   lyrics: this.lyrics,
    //   genre: this.genre,
    //   mood: this.mood,
    //   duration: this.duration,
    //   bpm: this.bpm,
    //   instrumentation: this.selectedInstruments,
    //   vocalsStyle: this.vocalsStyle
    // });
    //
    // this.websocketService.on(`job:${job.jobId}:progress`, (data) => {
    //   this.progress = data.progress;
    // });
    //
    // this.websocketService.on(`job:${job.jobId}:completed`, (data) => {
    //   this.generatedAudioUrl = data.audioUrl;
    //   this.isGenerating = false;
    // });
  }

  /**
   * Download generated audio file
   */
  downloadAudio(): void {
    if (this.generatedAudioUrl) {
      // In production, trigger download from URL
      window.open(this.generatedAudioUrl, '_blank');
    }
  }

  /**
   * Navigate back to Song Generation
   */
  backToSongGeneration(): void {
    this.router.navigate(['/generate/song']);
  }
}
