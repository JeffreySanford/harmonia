# Song & Music Generation Workflow

## Overview

This document describes the complete workflow for generating music from narrative descriptions using a two-stage AI pipeline:

1. **Stage 1 - Song Metadata Generation**: User narrative → AI-generated title, lyrics, genre, mood (via Ollama/Deepseek)
2. **Stage 2 - Audio Generation**: Song metadata → Generated audio file (via MusicGen model)

## Architecture Philosophy

**Two-Stage Process**: We separate metadata generation (LLM) from audio generation (specialized audio model) for better quality, flexibility, and user control.

```text
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│  Narrative  │ -> │   Ollama     │ -> │   Review/   │ -> │   MusicGen   │
│   Input     │    │  (Deepseek)  │    │   Approve   │    │   (Audio)    │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
     User              Metadata           User Control        Audio File
     Input            Generation          Validation          Generation
```

## User Workflow (10 Steps)

### Song Generation View

1. **User enters narrative description**
   - Free-form text (500-1000 characters)
   - Example: "A melancholic story about lost love set in a rainy city, with reflective and introspective mood"

2. **User sets desired song duration**
   - Duration slider: 15-120 seconds (default 30s)
   - Affects lyrics length calculation

3. **Click "Generate Song Metadata"**
   - UI shows loading state
   - Backend calls Ollama API

4. **AI generates song metadata**
   - Title (e.g., "Rain on Empty Streets")
   - Lyrics (duration-aware, 120-150 words for 30s)
   - Genre (from 12 standard options)
   - Mood/style descriptors

5. **User reviews AI-generated metadata**
   - All fields are editable
   - Syllable count displayed with validation
   - Can regenerate if unsatisfied

6. **User approves metadata**
   - Click "Approve & Continue to Music Generation"
   - Metadata saved to database
   - Navigate to Music Generation view

### Music Generation View

1. **Import approved song data**
   - Title, lyrics, genre, mood pre-filled
   - Duration locked to song duration
   - Read-only song fields (editable in Song view)

2. **User adjusts music parameters**
   - BPM slider (60-180, default from genre)
   - Instrumentation multi-select
   - Additional style parameters

3. **Click "Generate Music"**
   - Backend creates async job
   - Frontend subscribes via WebSocket

4. **Audio generation completes**
   - Progress bar updates in real-time (0-100%)
   - Download button appears on completion
   - Audio player embedded for preview

## Lyrics Duration Calculation

### Singing Speed Formula

**Standard singing speed**: 4-5 syllables per second

```text
Target syllables = Duration (seconds) × 4.5 syllables/second

Examples:
- 15s song: 67-75 syllables (~17 words)
- 30s song: 135-150 syllables (~34 words)
- 60s song: 270-300 syllables (~68 words)
- 120s song: 540-600 syllables (~135 words)
```

### Syllable Counting Algorithm

```typescript
function countSyllables(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
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
```

### Validation Rules

- **Green (Valid)**: Syllables within ±10% of target
- **Yellow (Warning)**: Syllables within ±20% of target
- **Red (Error)**: Syllables outside ±20% of target

```typescript
const target = duration * 4.5;
const min = target * 0.9;
const max = target * 1.1;
const valid = syllableCount >= min && syllableCount <= max;
```

## Genre & Style System

### 12 Standard Genres

Structured dropdown (not free-form text):

1. **Pop** - Default BPM: 120, Style: upbeat, catchy melodies
2. **Rock** - Default BPM: 140, Style: energetic, guitar-driven
3. **Hip-Hop** - Default BPM: 95, Style: rhythmic, beat-focused
4. **Country** - Default BPM: 110, Style: storytelling, acoustic
5. **Jazz** - Default BPM: 120, Style: improvisational, complex
6. **Blues** - Default BPM: 90, Style: soulful, 12-bar structure
7. **Electronic** - Default BPM: 128, Style: synthetic, danceable
8. **R&B** - Default BPM: 85, Style: smooth, vocal-focused
9. **Folk** - Default BPM: 100, Style: acoustic, narrative
10. **Classical** - Default BPM: 110, Style: orchestral, structured
11. **Indie** - Default BPM: 115, Style: experimental, alternative
12. **Alternative** - Default BPM: 125, Style: non-mainstream, diverse

### Style Parameters Structure

**Not free-form text** - Use structured parameters:

```typescript
interface SongStyle {
  genre: string;              // From 12 standard genres
  mood: string;               // e.g., "melancholic", "energetic", "reflective"
  vocalsStyle: string;        // e.g., "clean", "raspy", "smooth", "aggressive"
  instrumentation: string[];  // e.g., ["acoustic-guitar", "piano", "strings"]
  tempo: number;              // BPM (60-180)
}
```

### Mood Descriptors (8 Options)

Dropdown or multi-select:

1. **Energetic** - High energy, upbeat
2. **Melancholic** - Sad, reflective
3. **Romantic** - Love-themed, emotional
4. **Aggressive** - Intense, powerful
5. **Calm** - Peaceful, relaxing
6. **Mysterious** - Dark, enigmatic
7. **Uplifting** - Positive, inspiring
8. **Nostalgic** - Reminiscent, wistful

## State Management (NGRX)

### Song Metadata State

```typescript
interface SongState {
  metadata: SongMetadata | null;
  loading: boolean;
  error: string | null;
  approved: boolean;
}

interface SongMetadata {
  id?: string;
  narrative: string;
  duration: number;
  generatedTitle: string;
  generatedLyrics: string;
  suggestedGenre: string;
  suggestedMood: string;
  syllableCount: number;
  createdAt?: Date;
  approvedAt?: Date;
}
```

### Actions

```typescript
// Song Generation
generateSongMetadata({ narrative, duration })
generateSongMetadataSuccess({ metadata })
generateSongMetadataFailure({ error })

// Editing
updateSongMetadata({ metadata })
regenerateSongMetadata({ narrative, duration })

// Approval
approveSongMetadata({ metadata })
approveSongMetadataSuccess({ songId })

// Export
exportToMusicGeneration({ songId })
```

### State Flow

```text
1. User enters narrative + duration
   → Dispatch: generateSongMetadata({ narrative, duration })

2. Effect calls backend API
   → HTTP POST /api/songs/generate-metadata

3. Backend success
   → Dispatch: generateSongMetadataSuccess({ metadata })
   → Update UI with editable fields

4. User edits lyrics/title
   → Dispatch: updateSongMetadata({ metadata })

5. User clicks "Approve"
   → Dispatch: approveSongMetadata({ metadata })
   → Save to database

6. User clicks "Continue to Music"
   → Dispatch: exportToMusicGeneration({ songId })
   → Router.navigate(['/generate/music'], { state: { songId } })

7. Music Generation view reads song data
   → Select: selectApprovedSong(songId)
   → Pre-fill form fields
```

## Backend Architecture

### Song Metadata Endpoints

#### 1. Generate Metadata (Ollama Integration)

**Endpoint**: `POST /api/songs/generate-metadata`

**Request**:

```typescript
{
  narrative: string;      // User's narrative description
  duration: number;       // Desired song duration (15-120s)
  regenerate?: boolean;   // If regenerating from previous
}
```

**Response**:

```typescript
{
  title: string;          // AI-generated title
  lyrics: string;         // AI-generated lyrics (duration-aware)
  genre: string;          // Suggested genre (from 12 options)
  mood: string;           // Suggested mood
  syllableCount: number;  // Calculated syllable count
  targetSyllables: number;// Target based on duration
  validationStatus: 'valid' | 'warning' | 'error';
}
```

**Ollama Prompt Design** (Future Implementation):

```typescript
const prompt = `
You are a professional songwriter. Generate song metadata from this narrative.

Narrative: "${narrative}"
Duration: ${duration} seconds
Target lyrics length: ${targetSyllables} syllables (${targetWords} words)

Requirements:
- Write lyrics that would take approximately ${duration} seconds to sing
- Use natural phrasing and verse structure
- Include ${targetWords} words (±5 words)
- Choose genre from: pop, rock, hip-hop, country, jazz, blues, electronic, r&b, folk, classical, indie, alternative
- Suggest one mood: energetic, melancholic, romantic, aggressive, calm, mysterious, uplifting, nostalgic

Return JSON:
{
  "title": "...",
  "lyrics": "...",
  "genre": "...",
  "mood": "..."
}
`;
```

#### 2. Approve Song Metadata

**Endpoint**: `POST /api/songs/approve`

**Request**:

```typescript
{
  narrative: string;
  duration: number;
  title: string;          // Edited by user
  lyrics: string;         // Edited by user
  genre: string;
  mood: string;
}
```

**Response**:

```typescript
{
  songId: string;         // MongoDB ObjectId
  createdAt: Date;
  approvedAt: Date;
}
```

**Database Schema**:

```typescript
// MongoDB Schema
const SongSchema = new Schema({
  narrative: { type: String, required: true },
  duration: { type: Number, required: true },
  title: { type: String, required: true },
  lyrics: { type: String, required: true },
  genre: { type: String, enum: STANDARD_GENRES, required: true },
  mood: { type: String, enum: MOOD_OPTIONS, required: true },
  syllableCount: { type: Number, required: true },
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
});
```

#### 3. Generate Music (MusicGen Integration)

**Endpoint**: `POST /api/music/generate`

**Request**:

```typescript
{
  songId?: string;        // If importing from approved song
  title: string;
  lyrics: string;
  genre: string;
  mood: string;
  duration: number;
  bpm: number;
  instrumentation: string[];
  vocalsStyle: string;
}
```

**Response**:

```typescript
{
  jobId: string;          // For WebSocket tracking
  estimatedDuration: number; // Estimated generation time
}
```

**MusicGen Service** (Future Implementation):

```typescript
@Injectable()
export class MusicGenService {
  async generate(params: MusicGenerationParams): Promise<Job> {
    // 1. Create async job
    const job = await this.jobsService.create({
      type: 'music-generation',
      parameters: params,
      status: 'queued',
    });

    // 2. Start background process
    this.processQueue.add({
      jobId: job.id,
      lyrics: params.lyrics,
      genre: params.genre,
      bpm: params.bpm,
      duration: params.duration,
    });

    // 3. Return job for WebSocket tracking
    return job;
  }

  private async executeMusicGen(job: Job): Promise<void> {
    // Python script integration
    const result = await this.pythonService.execute('musicgen_cli.py', {
      lyrics: job.parameters.lyrics,
      genre: job.parameters.genre,
      duration: job.parameters.duration,
      bpm: job.parameters.bpm,
    });

    // Emit progress via WebSocket
    this.jobsGateway.emitJobProgress(job.id, 100);
    this.jobsGateway.emitJobCompleted(job.id, result.audioPath);
  }
}
```

## Validation & Error Handling

### Client-Side Validation

#### Narrative Input

- **Min length**: 50 characters
- **Max length**: 1000 characters
- **Error**: "Narrative must be between 50-1000 characters"

#### Duration

- **Min**: 15 seconds
- **Max**: 120 seconds
- **Default**: 30 seconds

#### Lyrics Validation

```typescript
function validateLyrics(lyrics: string, duration: number): ValidationResult {
  const syllableCount = countSyllables(lyrics);
  const targetSyllables = duration * 4.5;
  const minSyllables = targetSyllables * 0.9;
  const maxSyllables = targetSyllables * 1.1;

  if (syllableCount < minSyllables) {
    return {
      status: 'error',
      message: `Lyrics too short: ${syllableCount} syllables (need ${Math.floor(minSyllables)}-${Math.ceil(maxSyllables)})`,
    };
  }

  if (syllableCount > maxSyllables) {
    return {
      status: 'error',
      message: `Lyrics too long: ${syllableCount} syllables (need ${Math.floor(minSyllables)}-${Math.ceil(maxSyllables)})`,
    };
  }

  return { status: 'valid', message: 'Lyrics length matches duration' };
}
```

### Backend Validation

#### Profanity Filter

```typescript
// Optional: Filter inappropriate content
import Filter from 'bad-words';

const filter = new Filter();

function validateContent(text: string): boolean {
  return !filter.isProfane(text);
}
```

#### Genre Validation

```typescript
const STANDARD_GENRES = [
  'pop', 'rock', 'hip-hop', 'country', 'jazz', 'blues',
  'electronic', 'r&b', 'folk', 'classical', 'indie', 'alternative',
];

function validateGenre(genre: string): boolean {
  return STANDARD_GENRES.includes(genre.toLowerCase());
}
```

## WebSocket Integration

### Job Progress Events

```typescript
// Frontend subscription
websocketService.on(`job:${jobId}:progress`, (data) => {
  store.dispatch(updateJobProgress({ jobId, progress: data.progress }));
});

websocketService.on(`job:${jobId}:completed`, (data) => {
  store.dispatch(jobCompleted({ jobId, result: data.result }));
});

websocketService.on(`job:${jobId}:failed`, (data) => {
  store.dispatch(jobFailed({ jobId, error: data.error }));
});
```

### Backend Gateway Events

```typescript
@WebSocketGateway()
export class JobsGateway {
  @WebSocketServer()
  server: Server;

  emitJobProgress(jobId: string, progress: number): void {
    this.server.emit(`job:${jobId}:progress`, { progress });
  }

  emitJobCompleted(jobId: string, result: any): void {
    this.server.emit(`job:${jobId}:completed`, { result });
  }

  emitJobFailed(jobId: string, error: string): void {
    this.server.emit(`job:${jobId}:failed`, { error });
  }
}
```

## UI/UX Guidelines

### Song Generation Layout

```text
┌────────────────────────────────────────────────┐
│  Song Generation                               │
├────────────────────────────────────────────────┤
│                                                │
│  1. Narrative Input                            │
│  ┌──────────────────────────────────────────┐ │
│  │ [Large textarea 500-1000 chars]          │ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│  Character count: 345/1000                     │
│                                                │
│  2. Duration                                   │
│  ├──────●────────────────────────┤            │
│  15s        30s        60s        120s         │
│                                                │
│  [Generate Song Metadata Button]               │
│                                                │
│  3. Generated Metadata (after generation)      │
│  Title: [Editable input]                       │
│  Lyrics: [Editable textarea with syllable      │
│           count: 135/150 ✓]                    │
│  Genre: [Dropdown: Rock ▼]                     │
│  Mood: [Dropdown: Melancholic ▼]               │
│                                                │
│  [Regenerate] [Approve & Continue to Music]    │
└────────────────────────────────────────────────┘
```

#### Visual Feedback

- **Loading state**: Spinner + "Generating metadata..."
- **Syllable count color**:
  - Green: Within ±10% of target
  - Yellow: Within ±20% of target
  - Red: Outside ±20% of target
- **Duration indicator**: "Target: 135-150 syllables for 30s song"

#### Music Generation Layout with Song Import

```text
┌────────────────────────────────────────────────┐
│  Music Generation                              │
├────────────────────────────────────────────────┤
│                                                │
│  [Import from Song Generation] (if available)  │
│                                                │
│  Song Details (from import)                    │
│  Title: "Rain on Empty Streets" (read-only)    │
│  Lyrics: [Collapsed accordion with full text]  │
│  Genre: Rock (locked)                          │
│  Duration: 30s (locked)                        │
│                                                │
│  Music Parameters                              │
│  BPM: ├────●──────────┤ 140                    │
│       60        120        180                 │
│                                                │
│  Instrumentation:                              │
│  ☑ Electric Guitar  ☑ Drums  ☑ Bass           │
│  ☐ Piano  ☐ Strings  ☐ Synth                  │
│                                                │
│  Vocals Style: [Dropdown: Clean ▼]             │
│                                                │
│  [Generate Music]                              │
│                                                │
│  Progress: ████████░░░░░░░░░░░ 40%            │
│  Estimated time remaining: 2 minutes           │
└────────────────────────────────────────────────┘
```

## Testing Strategy

### Unit Tests

#### Syllable Counter

```typescript
describe('countSyllables', () => {
  it('should count single-syllable words', () => {
    expect(countSyllables('cat dog run')).toBe(3);
  });

  it('should count multi-syllable words', () => {
    expect(countSyllables('beautiful amazing wonderful')).toBe(10);
  });

  it('should handle silent e', () => {
    expect(countSyllables('love hope care')).toBe(3);
  });
});
```

#### Lyrics Validation View

```typescript
describe('validateLyrics', () => {
  it('should validate correct syllable count', () => {
    const result = validateLyrics('A simple test song here', 5); // ~20 syllables for 5s
    expect(result.status).toBe('valid');
  });

  it('should error on too short lyrics', () => {
    const result = validateLyrics('Short', 30);
    expect(result.status).toBe('error');
  });
});
```

### Integration Tests

### Song Generation API Flow

```typescript
describe('Song Generation Flow', () => {
  it('should generate metadata from narrative', async () => {
    const response = await request(app)
      .post('/api/songs/generate-metadata')
      .send({ narrative: 'Test narrative', duration: 30 });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('title');
    expect(response.body).toHaveProperty('lyrics');
  });

  it('should approve and save song metadata', async () => {
    const response = await request(app)
      .post('/api/songs/approve')
      .send({
        narrative: 'Test',
        duration: 30,
        title: 'Test Song',
        lyrics: 'Test lyrics',
        genre: 'rock',
        mood: 'energetic',
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('songId');
  });
});
```

### E2E Tests

```typescript
test('complete song-to-music workflow', async ({ page }) => {
  // 1. Navigate to Song Generation
  await page.goto('/generate/song');

  // 2. Enter narrative
  await page.fill('textarea[name="narrative"]', 'A sad story about loss');
  
  // 3. Set duration
  await page.getByLabel('Duration').fill('30');

  // 4. Generate metadata
  await page.click('button:has-text("Generate")');
  await page.waitForSelector('.metadata-result');

  // 5. Verify lyrics appear
  const lyrics = await page.inputValue('textarea[name="lyrics"]');
  expect(lyrics.length).toBeGreaterThan(0);

  // 6. Approve
  await page.click('button:has-text("Approve")');

  // 7. Should navigate to Music Generation
  await expect(page).toHaveURL('/generate/music');

  // 8. Verify pre-filled data
  const title = await page.inputValue('input[name="title"]');
  expect(title).toBe('A sad story about loss');
});
```

## Future Enhancements

### Ollama Integration Implementation

When ready to implement Ollama:

1. **Add Ollama HTTP Service**

   ```typescript
   @Injectable()
   export class OllamaService {
     async generate(prompt: string, model: string = 'deepseek'): Promise<string> {
       const response = await axios.post('http://localhost:11434/api/generate', {
         model,
         prompt,
         stream: false,
       });
       return response.data.response;
     }
   }
   ```

2. **Prompt Engineering**
   - Test different prompts for quality
   - Add few-shot examples
   - Implement temperature control
   - Add retry logic for malformed JSON

3. **Quality Improvements**
   - Add rhyme scheme detection
   - Implement verse/chorus structure
   - Add melody contour suggestions
   - Generate multiple options for user selection

### Advanced Features

- **Collaborative Editing**: Multiple users edit same song
- **Version History**: Track changes to lyrics/metadata
- **Style Transfer**: Apply style of existing song to new lyrics
- **Multi-Language**: Generate lyrics in different languages
- **Voice Selection**: Choose AI voice for vocals preview
- **Remix Mode**: Generate variations of existing songs

## Glossary

- **Narrative**: User's story/description input for AI song generation
- **Metadata**: Song information (title, lyrics, genre, mood) before audio generation
- **Syllable Count**: Number of syllables in lyrics, used for duration validation
- **Ollama**: Local LLM server for running AI models (Deepseek)
- **MusicGen**: Meta's audio generation model for creating music
- **BPM**: Beats Per Minute, tempo of the music
- **Instrumentation**: Musical instruments used in the composition
- **Vocals Style**: Singing style (clean, raspy, smooth, aggressive)

## References

- [MusicGen Documentation](https://github.com/facebookresearch/audiocraft)
- [Ollama API Reference](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Deepseek Model](https://github.com/deepseek-ai/DeepSeek-Coder)
- [NGRX Best Practices](https://ngrx.io/guide/store/best-practices)
- [WebSocket.IO Documentation](https://socket.io/docs/v4/)

---

**Document Version**: 1.0.0  
**Last Updated**: December 2, 2025  
**Status**: Design & Implementation In Progress
