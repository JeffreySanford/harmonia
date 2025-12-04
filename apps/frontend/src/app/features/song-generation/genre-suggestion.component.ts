import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface GenreSuggestion {
  genre: string;
  selected: boolean;
  feedback?: 'positive' | 'negative';
}

@Component({
  selector: 'harmonia-genre-suggestion',
  standalone: false,
  templateUrl: './genre-suggestion.component.html',
  styleUrls: ['./genre-suggestion.component.scss'],
})
export class GenreSuggestionComponent {
  @Input() narrative = '';
  @Input() state: 'empty' | 'loading' | 'results' | 'error' = 'empty';
  @Input() suggestions: GenreSuggestion[] = [];
  @Input() errorMessage = 'Failed to get genre suggestions';

  @Output() suggestGenres = new EventEmitter<void>();
  @Output() genreToggled = new EventEmitter<GenreSuggestion>();
  @Output() feedbackGiven = new EventEmitter<'positive' | 'negative'>();
  @Output() retryClicked = new EventEmitter<void>();

  get canSuggest(): boolean {
    return this.narrative.length >= 50;
  }

  onSuggestGenres(): void {
    if (this.canSuggest) {
      this.suggestGenres.emit();
    }
  }

  toggleGenre(suggestion: GenreSuggestion): void {
    suggestion.selected = !suggestion.selected;
    this.genreToggled.emit(suggestion);
  }

  giveFeedback(feedback: 'positive' | 'negative'): void {
    this.feedbackGiven.emit(feedback);
  }

  retry(): void {
    this.retryClicked.emit();
  }

  trackByGenre(_index: number, suggestion: GenreSuggestion): string {
    return suggestion.genre;
  }
}
