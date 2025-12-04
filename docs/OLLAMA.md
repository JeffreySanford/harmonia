# Ollama Model Integration

This document describes how Harmonia integrates with Ollama-powered models for comprehensive song and music generation. It covers metadata generation, genre suggestions, instrument selection, lyrics-to-melody coupling, and advanced prompting capabilities. The system supports both local development with `deepseek-coder` and production deployment with `minstral3`.

## What is Ollama

Ollama is a local LLM server that hosts models such as `deepseek-coder` (current) and `minstral3` (upcoming). It provides a simple HTTP interface for Harmonia's backend to generate rich musical content including metadata, genre suggestions, instrument recommendations, and structured annotations.

## Models

### deepseek-coder (deepseek-coder:6.7b)

- **Capabilities**: Multi-purpose content generation including structured JSON output, creative writing, and analytical tasks. The `deepseek-coder` variant excels at code-like structured generation and follows complex prompts reliably.
- **Use Cases**:
  - Song metadata generation (title, lyrics, genre, mood)
  - Genre suggestion based on narrative analysis
  - Instrument palette recommendations
  - Song annotation DSL generation
  - Lyrics-to-melody coupling suggestions
- **Current Status**: Installed locally under Ollama; verified via `v1/models` endpoint.
- **Behavioral Notes**:
  - May include free-text explanations outside strict JSON - requires extraction and cleanup
  - Excellent at following structured prompts with clear schemas
  - Good performance with creative writing tasks
- **Upgrade Path**: Maintain for local development; transition to `minstral3` for production when higher quality and consistency are required.

### minstral3

- **Capabilities**: High-quality instruction-following LLM optimized for creative content generation, consistent JSON outputs, and complex multi-step reasoning tasks.
- **Use Cases**:
  - Production-grade metadata generation with natural, varied lyrics
  - Advanced genre analysis and multi-genre suggestions
  - Sophisticated instrument selection and arrangement planning
  - Complex song structure generation with annotations
  - Style transfer and conditioning prompts
- **Current Status**: Not yet deployed in local Ollama instance. Planned addition to `OLLAMA_MODEL` configuration.
- **Migration Notes**:
  - Verify JSON contract compatibility across all generation types
  - Test multi-stage pipeline performance
  - Validate lyrics quality and musical coherence
  - Implement `responseMapper` for any model-specific format differences

## Integration Overview

Harmonia's Ollama integration provides a comprehensive AI-powered music generation pipeline with multiple specialized endpoints and services.

### Core Services

- **OllamaService**: Central service handling all model communications via `OLLAMA_URL` + `v1/completions`
- **MetadataGenerationService**: Handles song metadata (title, lyrics, genre, mood) generation
- **GenreSuggestionService**: Analyzes narratives to suggest relevant musical genres
- **InstrumentSelectionService**: Recommends instrument palettes and configurations
- **AnnotationDSLService**: Generates structured song annotations using the Song Annotation DSL
- **LyricsMelodyService**: Provides lyrics-to-melody coupling suggestions

### API Endpoints

#### Song Metadata Generation

```typescript
POST / api / songs / generate - metadata;
interface GenerateMetadataRequest {
  narrative: string; // User story/description (500-1000 chars)
  duration?: number; // Desired song length in seconds (15-120)
  model?: string; // Optional model override
}
interface GenerateMetadataResponse {
  title: string;
  lyrics: string; // Duration-aware lyrics (120-150 words for 30s)
  genre: string;
  mood: string[];
  syllableCount: number;
}
```

#### Genre Suggestion

```typescript
POST / api / songs / suggest - genres;
interface SuggestGenresRequest {
  narrative: string; // Story to analyze (10-1000 chars)
  model?: string; // Optional model override
}
interface SuggestGenresResponse {
  genres: string[]; // Array of suggested genres
  confidence?: number[]; // Optional confidence scores
}
```

#### Instrument Selection

```typescript
POST / api / songs / suggest - instruments;
interface SuggestInstrumentsRequest {
  genre: string; // Primary genre
  mood: string[]; // Mood descriptors
  narrative?: string; // Optional story context
  expand?: boolean; // Return detailed instrument options
}
interface SuggestInstrumentsResponse {
  palette: Instrument[]; // Recommended instrument palette
  alternatives?: Instrument[][]; // Alternative suggestions
}
```

#### Song Annotation Generation

```typescript
POST / api / songs / generate - annotations;
interface GenerateAnnotationsRequest {
  lyrics: string; // Song lyrics
  structure?: string[]; // Desired song structure
  style?: string; // Musical style guidance
}
interface GenerateAnnotationsResponse {
  annotations: string; // DSL-formatted annotations
  sections: Section[]; // Parsed section structure
}
```

### Frontend Integration

- **Song Generation View**: Calls metadata generation with narrative input
- **Genre Suggestion Component**: Provides AI-powered genre recommendations with user feedback
- **Instrument Expand Panel**: Shows AI-suggested instrument palettes with manual override options
- **Annotation Editor**: Uses DSL generation for structured song markup
- **Toggling**: `USE_OLLAMA` flag controls all AI features; fallback to defaults when disabled

## Development / Local Setup

### Recommended Developer Workflow

1. **Start Ollama server locally**: `ollama serve` (or as per Ollama documentation)
2. **Verify model availability**: `curl -sS $OLLAMA_URL/v1/models`
3. **Test basic connectivity**: `curl -sS -X POST $OLLAMA_URL/v1/completions -d '{"model":"deepseek-coder","prompt":"Hello"}'`
4. **Run comprehensive tests**: Use the provided npm scripts for full validation

### Testing Scripts

```bash
# Quick connectivity and model check
pnpm run llm:check

# Full probe with sample generations
pnpm run llm:probe

# Test specific features
pnpm run llm:test-metadata     # Song metadata generation
pnpm run llm:test-genres       # Genre suggestions
pnpm run llm:test-instruments  # Instrument selection
pnpm run llm:test-annotations  # DSL annotation generation

# Debug raw model outputs
pnpm run llm:debug -- --model deepseek-coder:6.7b --feature metadata
```

### Feature-Specific Testing

#### Metadata Generation Testing

```bash
# Test with different narrative lengths and durations
curl -X POST http://localhost:3000/api/songs/generate-metadata \
  -H "Content-Type: application/json" \
  -d '{"narrative": "A story about lost love in the rain", "duration": 30}'
```

#### Genre Suggestion Testing

```bash
# Test genre analysis
curl -X POST http://localhost:3000/api/songs/suggest-genres \
  -H "Content-Type: application/json" \
  -d '{"narrative": "A melancholic tale of heartbreak and redemption"}'
```

#### Instrument Selection Testing

```bash
# Test instrument recommendations
curl -X POST http://localhost:3000/api/songs/suggest-instruments \
  -H "Content-Type: application/json" \
  -d '{"genre": "Blues", "mood": ["melancholic", "reflective"]}'
```

## Safety & Operational Guardrails

### Input Validation & Limits

- **Narrative input**: 10-1000 characters for genre suggestions, 50-2000 characters for metadata generation
- **Duration limits**: 15-120 seconds for song generation
- **Rate limiting**: Backend rate limits per IP/user (configurable via environment)
- **Model timeout**: 30-second timeout for individual model calls
- **Concurrent requests**: Limited to prevent Ollama server overload

### Feature-Specific Guardrails

#### Metadata Generation

- Syllable count validation (120-150 syllables for 30s songs)
- Genre validation against approved genre list
- Mood descriptor sanitization
- Title length limits (3-50 characters)

#### Genre Suggestions

- Maximum 5 genre suggestions per request
- Confidence scoring for quality filtering
- Fallback to general genres if analysis fails
- User feedback collection for improvement

#### Instrument Selection

- Maximum 12 instruments per palette
- Preset validation against available instrument libraries
- Articulation parameter bounds checking
- Priority level validation (High/Med/Low)

#### Annotation Generation

- DSL syntax validation before processing
- Maximum annotation length limits
- Section structure validation
- Audio cue parameter sanitization

### Operational Controls

- **`USE_OLLAMA`** flag: Master toggle for all AI features (default `false` in `.env.example`)
- **Model fallback**: Graceful degradation to default values when Ollama unavailable
- **Error handling**: Comprehensive error responses with user-friendly messages
- **Logging**: Structured logging for all AI interactions (without exposing prompts)
- **Caching**: Response caching for repeated requests to reduce model load

### Production Deployment

- **Model versioning**: Explicit model version pinning for consistency
- **Performance monitoring**: Response time and success rate tracking
- **Cost monitoring**: Token usage tracking for budget management
- **A/B testing**: Framework for comparing model performance
- **Gradual rollout**: Feature flags for controlled deployment of new capabilities

## Migration to minstral3

- For local developer validation, use the `scripts/debug-llm.ts` helper to run raw model outputs or a live Ollama probe through the `mapResponseForModel` registry:

```bash
# Run a local mapping probe using ts-node (dev only)
pnpm run llm:debug -- --model deepseek-coder:6.7b --llm

# Or map a sample nested json file
pnpm run llm:debug -- --model minstral3 --raw-file ./tests/sample-minstral3.json
```

## Example Prompts

### Song Metadata Generation

**Structured JSON Prompt** (recommended):

```text
You are a music metadata generator. Output exactly one JSON object with fields: title, lyrics, genre, mood, syllableCount.
Lyrics must be suitable for a {duration}-second song.
Narrative: "{narrative}"
```

**Creative Enhancement Prompt**:

```text
Create song metadata for this story: "{narrative}"
Return as JSON with title, lyrics (aim for {wordCount} words), genre, mood array, and syllable count.
Make the lyrics poetic and emotionally resonant.
```

### Genre Suggestion

**Analytical Genre Prompt**:

```
Analyze this story and suggest 3-5 musical genres that would fit its mood and themes.
Story: "{narrative}"
Return as JSON array of genre strings, ordered by relevance.
```

**Detailed Genre Analysis**:

```json
{
  "genres": ["Genre1", "Genre2", "Genre3"],
  "reasoning": [
    "Why Genre1 fits...",
    "Why Genre2 fits...",
    "Why Genre3 fits..."
  ]
}
```

### Instrument Selection

**Basic Palette Recommendation**:

```text
Suggest an instrument palette for a {genre} song with {mood} mood.
Return 6-8 instruments as JSON array with name, type, and priority (High/Med/Low).
```

**Detailed Instrument Configuration**:

```text
For a {genre} song about: "{narrative}"

Suggest instruments with:
- Name and type
- Priority level (High/Med/Low)
- Recommended preset/articulation
- Role in the arrangement

Return as JSON array.
```

### Song Annotation DSL Generation

**Basic Structure Annotation**:

```
Convert these lyrics into Song Annotation DSL format:

{lyrics}

Add section markers [Verse], [Chorus], etc.
Include performance directions (whisper), (spoken), etc.
Add audio cues <SFX>, <instrument>, etc. where appropriate.
```

**Advanced Annotation with Style**:

```
Create detailed song annotations for {style} music:

{lyrics}

Use DSL syntax:
- [Section markers] for structure
- (Performance directions) for delivery
- <Audio cues> for instrumentation and effects

Focus on {genre} conventions and {mood} atmosphere.
```

### Multi-Feature Combined Prompts

**Complete Song Generation**:

```
Generate a complete song specification from this narrative: "{narrative}"

Return JSON with:
- metadata: {title, lyrics, genre, mood}
- genres: [suggested alternatives]
- instruments: [palette with priorities]
- annotations: "DSL formatted annotations"
```

**Iterative Refinement**:

```
Given this feedback: "{userFeedback}"
And original narrative: "{narrative}"

Refine the song metadata, considering the user's preferences.
Return updated JSON with improved title, lyrics, and genre suggestions.
```

## Notes

- Because LLM output can include extraneous text or markdown fences, we parse the first JSON object found in the output. This is robust for many outputs but not guaranteed for all models. The `responseMapper` may be used to convert model-specific formats into the standard schema.

```

```
