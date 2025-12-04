# Ollama Integration Guide

**Version**: 2.0
**Last Updated**: December 4, 2025
**Status**: Active
**Models**: deepseek-coder:6.7b (current), minstral3 (upcoming)

## Overview

Harmonia's Ollama integration provides comprehensive AI-powered music generation through local LLM deployment. This system supports the complete Narrative → Lyric → Music → Video pipeline with multi-model orchestration, robust error handling, and production-ready guardrails.

## Architecture

### Core Components

- **OllamaService**: Central service handling all model communications via HTTP API
- **MetadataGenerationService**: Song metadata creation (title, lyrics, genre, mood)
- **GenreSuggestionService**: Narrative analysis for genre recommendations
- **InstrumentSelectionService**: AI-driven instrument palette suggestions
- **AnnotationDSLService**: Structured song annotation generation
- **LyricsMelodyService**: Lyrics-to-melody coupling suggestions

### Multi-Model Support

Ollama enables side-by-side model execution with per-request switching:

- **deepseek-coder:6.7b**: Current production model for structured JSON generation
- **minstral3**: Upcoming model for enhanced quality and consistency
- **Model Registry**: Response mappers normalize outputs across different models

## Models

### deepseek-coder:6.7b (Current)

**Capabilities**:

- Structured JSON output with reliable schema compliance
- Creative writing with consistent formatting
- Code-like structured generation patterns

**Use Cases**:

- Song metadata generation (title, lyrics, genre, mood)
- Genre suggestion based on narrative analysis
- Instrument palette recommendations
- Song annotation DSL generation
- Lyrics-to-melody coupling suggestions

**Status**: Active in local Ollama instance
**Behavioral Notes**:

- May include free-text explanations outside JSON - requires extraction
- Excellent structured prompt following
- Good creative writing performance

### minstral3 (Upcoming)

**Capabilities**:

- High-quality instruction following
- Consistent JSON outputs
- Complex multi-step reasoning
- Enhanced creative content generation

**Migration Path**:

- Verify JSON contract compatibility
- Test multi-stage pipeline performance
- Validate lyrics quality and coherence
- Implement responseMapper for format differences

## API Endpoints

### Song Metadata Generation

```typescript
POST / api / songs / generate - metadata;
interface GenerateMetadataRequest {
  narrative: string; // User story (500-1000 chars)
  duration?: number; // Song length in seconds (15-120)
  model?: string; // Optional model override
}
interface GenerateMetadataResponse {
  title: string;
  lyrics: string; // Duration-aware lyrics
  genre: string;
  mood: string[];
  syllableCount: number;
}
```

### Genre Suggestion

```typescript
POST / api / songs / suggest - genres;
interface SuggestGenresRequest {
  narrative: string; // Story to analyze (10-1000 chars)
  model?: string; // Optional model override
}
interface SuggestGenresResponse {
  genres: string[]; // Suggested genres
  confidence?: number[]; // Optional confidence scores
}
```

### Instrument Selection

```typescript
POST / api / songs / suggest - instruments;
interface SuggestInstrumentsRequest {
  genre: string; // Primary genre
  mood: string[]; // Mood descriptors
  narrative?: string; // Optional context
  expand?: boolean; // Detailed options
}
interface SuggestInstrumentsResponse {
  palette: Instrument[]; // Recommended palette
  alternatives?: Instrument[][]; // Alternative suggestions
}
```

### Song Annotation Generation

```typescript
POST / api / songs / generate - annotations;
interface GenerateAnnotationsRequest {
  lyrics: string; // Song lyrics
  structure?: string[]; // Desired structure
  style?: string; // Musical style
}
interface GenerateAnnotationsResponse {
  annotations: string; // DSL-formatted annotations
  sections: Section[]; // Parsed structure
}
```

## Configuration

### Environment Variables

```bash
OLLAMA_URL=http://localhost:11434     # Ollama server URL
OLLAMA_MODEL=deepseek-coder:6.7b      # Default model
USE_OLLAMA=true                       # Enable/disable AI features
```

### Model Management

**Creating Model Aliases**:

```bash
# Create lyric drafting model
ollama create lyric_draft --file Modelfiles/lyric-draft.modelfile

# Create polishing model
ollama create lyric_polish --file Modelfiles/lyric-polish.modelfile
```

**Modelfile Example**:

```text
FROM deepseek-coder:6.7b
PARAMETER temperature 0.6
PARAMETER top_p 0.9
SYSTEM "You are a creative songwriter specializing in structured lyrics."
```

## Development Setup

### Local Development

1. **Install Ollama**: Follow official installation guide
2. **Start Server**: `ollama serve`
3. **Pull Models**: `ollama pull deepseek-coder:6.7b`
4. **Verify**: `curl http://localhost:11434/api/models`

### Testing Scripts

```bash
# Connectivity check
pnpm run llm:check

# Full probe with generations
pnpm run llm:probe

# Feature-specific testing
pnpm run llm:test-metadata
pnpm run llm:test-genres
pnpm run llm:test-instruments
pnpm run llm:test-annotations

# Debug raw outputs
pnpm run llm:debug -- --model deepseek-coder:6.7b --feature metadata
```

### Docker Deployment

**Recommended for Production**:

```yaml
version: '3.8'
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - '11434:11434'
    volumes:
      - ./models:/root/.ollama/models
    environment:
      - OLLAMA_HOST=0.0.0.0
    deploy:
      resources:
        limits:
          memory: 16G
        reservations:
          memory: 8G
```

## Safety & Guardrails

### Input Validation

- **Narrative Length**: 10-1000 characters for suggestions, 50-2000 for metadata
- **Duration Limits**: 15-120 seconds
- **Rate Limiting**: Per IP/user with configurable thresholds
- **Model Timeout**: 30-second limit per request
- **Concurrent Requests**: Limited to prevent server overload

### Feature-Specific Guardrails

#### Metadata Generation

- Syllable count validation (120-150 for 30s songs)
- Genre validation against approved lists
- Mood descriptor sanitization
- Title length limits (3-50 characters)

#### Genre Suggestions

- Maximum 5 suggestions per request
- Confidence scoring for quality filtering
- Fallback to general genres on failure

#### Instrument Selection

- Maximum 12 instruments per palette
- Preset validation against libraries
- Articulation parameter bounds checking

#### Annotation Generation

- DSL syntax validation
- Maximum annotation length limits
- Section structure validation

### Operational Controls

- **`USE_OLLAMA` Flag**: Master toggle for AI features
- **Model Fallback**: Graceful degradation to defaults
- **Error Handling**: Comprehensive user-friendly responses
- **Logging**: Structured logging without exposing prompts
- **Caching**: Response caching for repeated requests

## Pipeline Integration

### High-Level Workflow

1. **Narrative Generation**: Story/arc/mood creation
2. **Lyric Drafting**: Initial title, lyrics, genre, mood
3. **Lyric Polishing**: Editing for rhyme, meter, tone
4. **Music Specification**: Tempo, key, sections, BPM, chords
5. **Audio Production**: Using spec + lyrics for timing
6. **Storyboard Generation**: Timestamped shots and camera instructions
7. **Video Composition**: Feed metadata to video generation

### Draft+Polish Strategy

Recommended two-pass workflow:

- **Draft**: Use deepseek-coder for initial generation
- **Polish**: Use specialized model for refinement

## Response Mapping

### Problem

Different LLMs return varied JSON structures, arrays for lyrics, or nested objects.

### Solution

Model registry with mappers that normalize outputs to canonical schema:

```typescript
// Example mapper
function mapDeepSeekResponse(raw: any): SongMetadata {
  return {
    title: raw.title,
    lyrics: Array.isArray(raw.lyrics) ? raw.lyrics.join('\n') : raw.lyrics,
    genre: raw.genre,
    mood: Array.isArray(raw.mood) ? raw.mood : [raw.mood],
    syllableCount: raw.syllableCount || 0,
  };
}
```

## Example Prompts

### Song Metadata Generation

**Structured JSON Prompt**:

```text
You are a music metadata generator. Output exactly one JSON object with fields: title, lyrics, genre, mood, syllableCount.
Lyrics must be suitable for a {duration}-second song.
Narrative: "{narrative}"
```

**Creative Enhancement**:

```text
Create song metadata for: "{narrative}"
Return JSON with title, lyrics (aim for {wordCount} words), genre, mood array, and syllable count.
Make lyrics poetic and emotionally resonant.
```

### Genre Suggestion

**Analytical Prompt**:

```text
Analyze this story and suggest 3-5 musical genres that fit its mood and themes.
Story: "{narrative}"
Return as JSON array of genre strings, ordered by relevance.
```

### Instrument Selection

**Palette Recommendation**:

```text
Suggest an instrument palette for a {genre} song with {mood} mood.
Return 6-8 instruments as JSON array with name, type, and priority (High/Med/Low).
```

### Song Annotation DSL

**Structure Annotation**:

```text
Convert these lyrics into Song Annotation DSL format:

{lyrics}

Add section markers [Verse], [Chorus], etc.
Include performance directions (whisper), (spoken), etc.
Add audio cues <SFX>, <instrument>, etc. where appropriate.
```

## Production Deployment

### Resource Optimization

- **Model Selection**: Use quantized variants (q4/q8) for memory efficiency
- **GPU Utilization**: Prefer GPU instances when available
- **Memory Management**: Monitor usage and limit concurrency
- **Caching Strategy**: Cache frequent requests to reduce load

### Monitoring & Maintenance

- **Performance Tracking**: Response times and success rates
- **Usage Monitoring**: Token consumption and cost tracking
- **Model Updates**: Regular model version updates
- **Backup Strategy**: Model and configuration backups

## Migration to minstral3

### Preparation Steps

1. **Compatibility Testing**: Verify JSON contract alignment
2. **Performance Benchmarking**: Compare response quality and speed
3. **Integration Testing**: Full pipeline testing with new model
4. **Gradual Rollout**: Feature flags for controlled deployment

### Implementation

```typescript
// Add to model registry
const modelMappers = {
  'deepseek-coder:6.7b': mapDeepSeekResponse,
  minstral3: mapMinstralResponse,
};
```

## Troubleshooting

### Common Issues

**Connection Failed**:

- Verify Ollama server is running: `ollama serve`
- Check URL configuration: `OLLAMA_URL`
- Test basic connectivity: `curl http://localhost:11434/api/models`

**Model Not Found**:

- Pull model: `ollama pull deepseek-coder:6.7b`
- Verify model name in requests

**Poor Response Quality**:

- Adjust temperature parameters in Modelfile
- Try different models
- Review prompt engineering

**Memory Issues**:

- Use smaller quantized models
- Reduce concurrent requests
- Monitor system resources

### Debug Commands

```bash
# Check server status
curl http://localhost:11434/api/tags

# Test basic generation
curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "deepseek-coder:6.7b", "prompt": "Hello"}'

# Check model info
ollama show deepseek-coder:6.7b
```

## Future Enhancements

- **Model Fine-tuning**: Custom training for music-specific tasks
- **Multi-model Coordination**: Parallel processing with different models
- **Advanced Prompting**: Few-shot learning and chain-of-thought
- **Performance Optimization**: Model quantization and acceleration
- **Monitoring Dashboard**: Real-time performance and usage metrics
