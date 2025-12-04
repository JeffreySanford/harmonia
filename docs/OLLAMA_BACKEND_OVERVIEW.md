# Ollama Backend Overview for Harmonia

This document outlines how the Harmonia platform uses a local Ollama instance to provide multi-model LLM support for the Narrative → Lyric → Music → Video pipeline. It describes efficient local deployment (Docker), per-model orchestration, prompts & strategies for lyric generation, and backend integration patterns and guardrails.

---

## TL;DR

- Ollama hosts multiple models side-by-side; you can switch per-request by passing the model name.
- Run Ollama locally (on Docker or VM) and register aliases (Modelfiles) for quick switching.
- Backend will expose an endpoint `POST /api/songs/generate-metadata` with an optional `model` override; the service normalizes model outputs with mappers and provides reliable JSON.
- In low-memory environments (DigitalOcean 2vCPU limited memory) use smaller quantized models (e.g., Mistral 7B / Mixtral / deepseek-coder 6.7b or q4/q8 variants) and tune quantization.

---

## Key Concepts

- Multi-model: Ollama lets you pull and run multiple models side-by-side. Your application selects the model by name.
- Modelfile / aliases: A Modelfile allows you to set default args & parameters and create a named alias.
- Model registry & response mappers: Different models may produce different JSON shapes. The backend normalizes them with a `mapResponseForModel(model, raw)` mapper.

---

## High-Level Pipeline (narrative → lyrics → music → video)

1. Narrative generation (Ollama): generate story/arc/mood.
2. Lyric drafting (Ollama): generate a draft of title, lyrics, genre, mood.
3. Lyric polishing (Ollama / other model): editing pass for rhyme, meter, and tone.
4. Generate music spec JSON (Ollama): tempo, key, sections, BPM, chord suggestions.
5. Produce audio (external audio engine like MusicGen/Neural synth): using spec + lyrics for timing.
6. Storyboard generation (Ollama): map lyrics timestamped to shots & camera instructions.
7. Compose final video (external pipeline): feed storyboard metadata to video generation engine.

We recommend a “draft+polish” two-pass workflow for lyrics (e.g., draft with `deepseek` or `mixtral`, polish with `lyric-polish` alias using a larger fine-tuned model).

---

## Backend Integration Overview (Harmonia)

- Endpoint: `POST /api/songs/generate-metadata`

  - Request: `{ narrative: string, duration: number, model?: string }`
  - Response: `{ title, lyrics, genre, mood, syllableCount }` (consistent, normalized schema)
  - The `model` field is optional; the server uses `OLLAMA_MODEL` if not provided.

- Configuration/Env:

  - `OLLAMA_URL` - `http://localhost:11434` (default)
  - `OLLAMA_MODEL` - default model id for the server
  - `USE_OLLAMA` - boolean toggle (default: false in CI/production setups)

- Implementation details:
  - `OllamaService.generateMetadata(narrative, duration, modelOverride?)` invokes `OLLAMA_URL/v1/completions` or the appropriate Ollama endpoint.
  - `OllamaService` extracts JSON (first object inside the model output), then delegates to `mapResponseForModel(model, json)` to canonicalize the output.
  - If the model call fails, OllamaService falls back to a sample generator for dev convenience.
  - The backend limits narrative length (1000 characters), and the route verifies input DTO constraints.

---

## Model Registry & Response Mapping

- Problem: Different LLMs sometimes return different JSON shapes, arrays for lyrics, or nested objects.
- Solution: A model registry/mappers file maps model ids → mapper functions that normalize a raw output into canonical schema.

Example: `mapResponseForModel('minstral3:1.0', raw)` returns `{ title, lyrics, genre, mood }`.

This is already implemented in `apps/backend/src/llm/mappers.ts` and used by `OllamaService`.

---

## Sample Modelfiles & Aliases

Create a simple Modelfile for your lyric drafting model (`~/Modelfiles/lyric-draft.modelfile`):

```text
FROM deepseek-r1:14b
PARAMETER temperature 0.6
# Additional tuning and settings
```

Create an alias:

```bash
ollama create lyric_draft --file ~/Modelfiles/lyric-draft.modelfile
ollama run lyric_draft "Write a short melancholic 30s indie chorus..."
```

Do the same for `lyric_polish`, `narrative`, and `storyboard` models.

---

## Docker Hosting Recommendations (DigitalOcean / small VM)

When hosting Ollama in a DigitalOcean droplet (or similar small VM), consider the following:

- Use the smallest feasible model / quantized variants (q4 / q8) to reduce memory. Try `Mistral 7B` or `Mixtral` for low memory.
- Use Docker for reproducible deployment and model storage volumes; bind model directories to a volume so models persist between restarts.
- Use an instance with GPU (if available) for better performance; otherwise choose smaller models or lower quantization.
- Use swap cautiously for short-term memory spikes; prefer to limit concurrency to avoid memory thrashing.
- Monitor usage (swap, memory, CPU, load) and restrict concurrent calls to the generation endpoint.

Suggested `docker-compose.yml` snippet (conceptual):

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    ports:
      - '11434:11434'
    volumes:
      - ollama-models:/var/lib/ollama/models
      - ollama-logs:/var/log/ollama
    environment:
      - OLLAMA_SERVER_OPTS=--some-option
    # For GPU:
    # deploy: resources: reservations: devices: - capabilities: [gpu]

volumes:
  ollama-models:
  ollama-logs:
```

Note: `ollama/ollama` is a placeholder for an official/public image; adapt the image you prefer or build your own.

---

## Memory & Performance Tips

- Pick smaller quantized models (q4_0 / q4_K / q8_0) for low-memory servers.
- Prefer `Mistral 7B` or `Mixtral 8x7B` for a balance between quality and memory footprint.
- For production inference at scale, use GPU-enabled hosts (NVIDIA) and model quantization appropriate for GPU type.
- Limit concurrent requests, and add a request queue or rate limiter. Prefer background jobs if orchestration is heavy.

---

## Prompt Strategies & Lyric Generation

Best practices for lyric generation (two-phase):

1. Draft: ask for 3 short chorus/verse variants, specify genre, mood, rhyme scheme, and syllable targets.
2. Polish: pass the draft to an editing model to tighten rhymes and meter and to create a final structured JSON response.

Prompt example (draft):

```text
System: You are a music metadata generator.
User: Write a short, 2-verse + chorus lyric for a 30s melancholic indie song. Make lines ~8-10 syllables each. Output JSON with {title, lyrics, genre, mood}.
```

Prompt example (polish):

```text
User: Improve the lyric for better internal rhyme and syllable consistency, keeping 3 lines per section and preserving the vibe. Output the same JSON.
```

---

## Developer Tools & Test Safety

- Local scripts available in the repo:
  - `scripts/check-ollama.js` - quick server & model probe.
  - `scripts/debug-llm.ts` - run model or raw JSON through `mapResponseForModel` to validate mappers and outputs.
  - `scripts/debug-llm.js` - stable JS wrapper that does the same as the TS script but avoids ts-node/ESM issues.
  - `scripts/mock-ollama-server.js` - a tiny mock server to emulate the Ollama HTTP API for local dev/CI.
- Unit tests: add mappers tests, model-specific normalization tests.
- CI: Keep `USE_OLLAMA=false` by default in `.env.example` to prevent accidental model calls; mock Ollama in CI unit tests.

Usage examples:

1. Run the mock server locally to simulate an Ollama instance:

```bash
pnpm run llm:mock
```

1. Run the stable JS debug script (uses a local or mocked Ollama):

```bash
pnpm run llm:debug:js -- --model deepseek --llm
```

1. Use the shell wrapper if you prefer:

```bash
./scripts/debug-llm.sh --model deepseek --llm
```

---

## Operational Guardrails

- Input validation and size limits (e.g., narrative ≤ 1000 characters).
- Rate limiting (gateway / IP / token based) to protect the Ollama container.
- Monitoring: request latencies, model load/unload warnings, OOM events.
- Fallback: always include a dev fallback that generates sample lyrics or a static stub if Ollama is down.

---

## Tests & Migration

- Add a model registry test suite: ensure `deepseek` and `minstral3` outputs normalize to canonical shape.
- Add an integration test for `POST /api/songs/generate-metadata` that validates the shape and the optional `model` override.
- Add e2e: mock Ollama by setting `USE_OLLAMA=false` or by using a minimal mock server.

---

## Suggested Next Steps

1. Decide model targets for production (choose a default model that fits your hardware constraints).
2. If hosting on limited memory, choose quantized Mistral/DeepSeek or Mixtral variants.
3. Add production rate limiting + observability (metrics & logs).
4. Build Modelfiles and aliases for `narrative`, `lyric_draft`, `lyric_polish`, `metadata`, `storyboard`.
5. Add a `mapResponseForModel` registry mapping, and tests verifying `minstral3` and `deepseek` outputs.
6. Add `scripts/debug-llm.ts` into your dev workflow to test and validate per-model outputs and mapping.

---

If you want, I can now:

- Create example Modelfiles for `lyric_draft` and `lyric_polish` with system prompts
- Add an example Docker `docker-compose.yml` for Ollama with recommended volumes & memory guardrails
- Add CI mock for Ollama calls to test the `generate-metadata` endpoint

Tell me which one you'd like first.
