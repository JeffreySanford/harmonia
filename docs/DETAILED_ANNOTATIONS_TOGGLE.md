# UI Toggle for Detailed Annotations Display

## Overview

The Detailed Annotations Toggle feature provides users with control over the display of song annotations in the song generation interface. This allows users to switch between a clean, simplified view and a detailed view showing all performance directions, audio cues, and timing information.

## Feature Description

**Purpose**: Enable users to customize their workflow by showing/hiding detailed song annotations based on their expertise level and current task.

**User Benefit**: Beginners can work with simplified views, while professionals can access full annotation details when needed.

## User Interface

### Toggle Control

**Location**: Song Generation Page, in the metadata section header

**Control Type**: Material Slide Toggle

**Label**: "Show Detailed Annotations"

**Default State**: Off (simplified view)

**Visual States**:

- **Off**: Clean interface, annotations hidden
- **On**: Full annotations displayed with syntax highlighting

### Visual Design

```text
┌─────────────────────────────────────────────────────────────┐
│ Song Generation                                            │
├─────────────────────────────────────────────────────────────┤
│ [ ] Show Detailed Annotations                              │
│                                                            │
│ Title: Rain on Empty Streets                              │
│ Lyrics: [Verse]                                           │
│         I walk alone...                                    │
│                                                            │
│ [Generate Music]                                           │
└─────────────────────────────────────────────────────────────┘
```

When toggle is ON:

```text
┌─────────────────────────────────────────────────────────────┐
│ Song Generation                                            │
├─────────────────────────────────────────────────────────────┤
│ [x] Show Detailed Annotations                              │
│                                                            │
│ Title: Rain on Empty Streets                              │
│ Lyrics: [Verse](slow, melancholic)                        │
│         I walk alone... <fade_in_strings beat=4>          │
│                                                            │
│ [Generate Music]                                           │
└─────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Component Structure

```typescript
// song-generation-page.component.ts
export class SongGenerationPageComponent {
  showDetailedAnnotations = false;

  toggleAnnotations(): void {
    this.showDetailedAnnotations = !this.showDetailedAnnotations;
    // Update display logic
  }
}
```

### Template Integration

```html
<!-- song-generation-page.component.html -->
<mat-slide-toggle
  [checked]="showDetailedAnnotations"
  (change)="toggleAnnotations()"
>
  Show Detailed Annotations
</mat-slide-toggle>

<div class="lyrics-display" [class.detailed]="showDetailedAnnotations">
  <!-- Lyrics content with conditional annotation display -->
</div>
```

### CSS Styling

```scss
// song-generation-page.component.scss
.lyrics-display {
  .annotation {
    display: none;
  }

  &.detailed {
    .annotation {
      display: inline;
      color: #666;
      font-style: italic;
    }

    .section-marker {
      font-weight: bold;
      color: #1976d2;
    }

    .performance-direction {
      color: #388e3c;
    }

    .audio-cue {
      color: #f57c00;
      font-weight: bold;
    }
  }
}
```

## Annotation Types

### Section Markers

**Format**: `[Section Name]`

**Examples**:

- `[Verse]`
- `[Chorus]`
- `[Bridge]`
- `[Outro]`

**Display**: Bold, blue color when detailed view enabled

### Performance Directions

**Format**: `(direction1, direction2, ...)`

**Examples**:

- `(slow, melancholic)`
- `(build, crescendo)`
- `(piano, intimate)`
- `(distorted, aggressive)`

**Display**: Green, italic when detailed view enabled

### Audio Cues

**Format**: `<cue_type parameters>`

**Examples**:

- `<fade_in_strings beat=4>`
- `<drum_fill duration=2>`
- `<guitar_solo start=16 end=32>`
- `<mix_transition type=crossfade>`

**Display**: Orange, bold when detailed view enabled

## User Experience Flow

### Simplified View (Default)

1. User sees clean lyrics without annotations
2. Focus on creative content input
3. Reduced cognitive load for beginners
4. Faster workflow for simple songs

### Detailed View (Toggle On)

1. User enables detailed annotations
2. Full DSL syntax becomes visible
3. Professional annotations are highlighted
4. Advanced users can edit annotations directly

## Integration Points

### Song Annotation DSL

- Leverages `SONG_ANNOTATION_DSL.md` grammar
- Supports all annotation types
- Maintains parsing compatibility

### M-MSL Parser

- Compatible with M-MSL timing system
- Supports beat-level annotations
- Integrates with audio cue system

## Accessibility

### Keyboard Navigation

- Toggle accessible via Tab navigation
- Space/Enter to activate toggle
- Screen reader announces state changes

### Visual Indicators

- Clear on/off states
- Color-coded annotation types
- Sufficient contrast ratios

## Testing Scenarios

### Unit Tests

```typescript
describe('DetailedAnnotationsToggle', () => {
  it('should start in simplified view', () => {
    expect(component.showDetailedAnnotations).toBeFalse();
  });

  it('should toggle annotation display', () => {
    component.toggleAnnotations();
    expect(component.showDetailedAnnotations).toBeTrue();
  });
});
```

### E2E Tests

```typescript
describe('Detailed Annotations Toggle', () => {
  it('should hide annotations by default', () => {
    // Verify annotations not visible
  });

  it('should show annotations when toggled on', () => {
    // Toggle on and verify display
  });
});
```

## Future Enhancements

### Granular Control

- Individual annotation type toggles
- Section-specific visibility
- Custom annotation colors

### Advanced Features

- Annotation presets
- Import/export annotation settings
- Collaborative annotation editing

## Related Documentation

- `SONG_ANNOTATION_DSL.md` - Annotation grammar and syntax
- `MMSL_SPEC.md` - Timing and cue system
- `SONG_MUSIC_GENERATION_WORKFLOW.md` - Generation workflow
