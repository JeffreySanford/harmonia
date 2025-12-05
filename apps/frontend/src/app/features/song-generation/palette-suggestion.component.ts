import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

export interface PaletteSuggestion {
  genre: string;
  confidence: number;
  instruments: Array<{
    id: string;
    name: string;
    category: string;
    role: 'primary' | 'secondary' | 'accent' | 'bass' | 'drums' | 'melody';
    reasoning: string;
  }>;
  mood: string;
  tempoRange: {
    min: number;
    max: number;
    suggested: number;
  };
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface InstrumentSelection {
  instrument: {
    id: string;
    name: string;
    category: string;
    role: 'primary' | 'secondary' | 'accent' | 'bass' | 'drums' | 'melody';
    reasoning: string;
  };
  selected: boolean;
  userOverride?: boolean;
}

@Component({
  selector: 'harmonia-palette-suggestion',
  standalone: false,
  templateUrl: './palette-suggestion.component.html',
  styleUrls: ['./palette-suggestion.component.scss'],
})
export class PaletteSuggestionComponent {
  private readonly http = inject(HttpClient);

  @Input() narrative = '';
  @Input() generatedMetadata: any = null;
  @Input() isVisible = false;

  @Output() paletteAccepted = new EventEmitter<PaletteSuggestion>();
  @Output() paletteModified = new EventEmitter<InstrumentSelection[]>();

  // Component state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  readonly isLoading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  readonly error$ = this.errorSubject.asObservable();

  private paletteSubject = new BehaviorSubject<PaletteSuggestion | null>(null);
  readonly palette$ = this.paletteSubject.asObservable();

  // User selections (for modifications)
  instrumentSelections: InstrumentSelection[] = [];

  // UI state
  showAdvancedOptions = false;
  customTempo: number | null = null;
  customMood: string | null = null;

  /**
   * Get the count of selected instruments
   */
  get selectedInstrumentCount(): number {
    return this.instrumentSelections.filter(s => s.selected).length;
  }

  /**
   * Get the total number of instruments in the palette
   */
  get totalInstrumentCount(): number {
    const palette = this.paletteSubject.value;
    return palette?.instruments.length || 0;
  }

  /**
   * Check if any instruments are selected
   */
  get hasSelectedInstruments(): boolean {
    return this.selectedInstrumentCount > 0;
  }

  /**
   * Generate palette suggestions based on narrative
   */
  generatePalette(): void {
    if (!this.narrative.trim()) {
      this.errorSubject.next('Narrative is required to generate palette suggestions');
      return;
    }

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    const requestBody = {
      narrative: this.narrative,
      model: 'deepseek', // Default model
    };

    this.http
      .post<PaletteSuggestion>('/api/songs/suggest-palette', requestBody)
      .pipe(
        tap((palette) => {
          this.paletteSubject.next(palette);
          this.initializeInstrumentSelections(palette);
          this.loadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to generate palette suggestions';
          this.errorSubject.next(errorMessage);
          this.loadingSubject.next(false);
          return [];
        })
      )
      .subscribe();
  }

  /**
   * Initialize instrument selections from palette
   */
  private initializeInstrumentSelections(palette: PaletteSuggestion): void {
    this.instrumentSelections = palette.instruments.map((instrument) => ({
      instrument,
      selected: true, // Default all to selected
      userOverride: false,
    }));
  }

  /**
   * Toggle instrument selection
   */
  toggleInstrument(index: number): void {
    if (this.instrumentSelections[index]) {
      this.instrumentSelections[index].selected = !this.instrumentSelections[index].selected;
      this.instrumentSelections[index].userOverride = true;
      this.emitModifiedPalette();
    }
  }

  /**
   * Accept the current palette (with any modifications)
   */
  acceptPalette(): void {
    const currentPalette = this.paletteSubject.value;
    if (currentPalette) {
      // Apply any user modifications
      const modifiedPalette: PaletteSuggestion = {
        ...currentPalette,
        instruments: this.instrumentSelections
          .filter((selection) => selection.selected)
          .map((selection) => selection.instrument),
        tempoRange: {
          ...currentPalette.tempoRange,
          suggested: this.customTempo || currentPalette.tempoRange.suggested,
        },
        mood: this.customMood || currentPalette.mood,
      };

      this.paletteAccepted.emit(modifiedPalette);
    }
  }

  /**
   * Emit modified palette when user makes changes
   */
  private emitModifiedPalette(): void {
    this.paletteModified.emit([...this.instrumentSelections]);
  }

  /**
   * Regenerate palette with different model
   */
  regeneratePalette(): void {
    // Update model and regenerate
    this.generatePalette();
  }

  /**
   * Get role color for UI display
   */
  getRoleColor(role: string): string {
    const colors: { [key: string]: string } = {
      primary: '#1976d2',    // Blue
      secondary: '#388e3c',  // Green
      accent: '#f57c00',     // Orange
      bass: '#7b1fa2',       // Purple
      drums: '#d32f2f',      // Red
      melody: '#0097a7',     // Cyan
    };
    return colors[role] || '#757575';
  }

  /**
   * Get role icon for UI display
   */
  getRoleIcon(role: string): string {
    const icons: { [key: string]: string } = {
      primary: 'star',
      secondary: 'music_note',
      accent: 'flash_on',
      bass: 'volume_up',
      drums: 'album',
      melody: 'audiotrack',
    };
    return icons[role] || 'music_note';
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.paletteSubject.next(null);
    this.instrumentSelections = [];
    this.errorSubject.next(null);
    this.customTempo = null;
    this.customMood = null;
    this.showAdvancedOptions = false;
  }
}