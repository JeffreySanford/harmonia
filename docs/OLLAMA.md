# Ollama Model Integration

This document describes how Harmonia will integrate with Ollama-powered models for song metadata generation (title, lyrics, genre, mood). It documents current models in use, capabilities, development/testing setup, and migration plan to `minstral3`.

## What is Ollama

Ollama is a local LLM server that can host models such as `deepseek` (prototype) and `minstral3` (upcoming). It exposes a simple HTTP interface that Harmonia can call in the backend to generate metadata for song generation.

## Models

### deepseek (deepseek-coder)

- Capabilities: Designed for content-generation tasks (text completion). The `deepseek-coder` variant is available in the local Ollama instance as `deepseek-coder:6.7b`.
- Use case: Prototype metadata generation (title, short lyric lines, genre, mood). Good for proof-of-concept and early dev iteration.
- Current situation: Installed locally under Ollama; verified `v1/models` endpoint lists `deepseek-coder:6.7b`.
- Behavioral notes:
  - May return free-text explanations outside of strict JSON if not constrained properly.
  - Content may require JSON extraction and cleanup.
- Upgrade path: Keep for local development; move to `minstral3` (or other models) when better quality and contract assurances are needed.

### minstral3 (minstral3)

- Capabilities: High-quality instruction-following LLM intended for higher-fidelity language tasks and consistent JSON outputs when prompted properly.
- Use case: Production-grade metadata generation with more natural, varied lyrics, improved genre/mood suggestions, and fewer hallucinations.
- Current situation: Not yet present in our local Ollama instance. Plan is to add it to `OLLAMA_MODEL` and perform contract mapping if necessary.
- Migration notes:
  - Confirm `minstral3` JSON contract (title, lyrics, genre, mood) — if different, add `responseMapper` to translate to a stable schema.
  - Re-run tests and verify that lyrics quality meets acceptance criteria.

## Integration Overview

- Backend will provide an `OllamaService` that calls the model via `OLLAMA_URL` + `v1/completions` (or applicable path) and extracts JSON object from text output.
- Controller endpoint `/api/songs/generate-metadata` will accept narrative and duration and return a structured JSON.
- Frontend will call the backend endpoint and allow users to edit metadata before approving.
- Toggling: `USE_OLLAMA` flag controls whether to invoke the model; fallback to simulated generation if false.

## Development / Local Setup

- The recommended local developer flow:
  1. Run Ollama server locally (e.g., `ollama server` or as per their docs).
  2. Verify local models with `curl -sS $OLLAMA_URL/v1/models`.
  3. Test model generation with `curl -sS -X POST $OLLAMA_URL/v1/completions -d '{"model":"deepseek","prompt":"..."}'`.
  4. Use `pnpm run llm:check` or `pnpm run llm:probe` to quickly test connectivity and a sample generation.

## Safety & Operational Guardrails

- Input size limit: Limit `narrative` to 1000 characters.
- Rate limiting: Add backend rate limit for the endpoint (per IP/user).
- `USE_OLLAMA` toggle: Default `false` in `.env.example` to avoid accidental model usage.
- Production usage: Require explicit enablement (via environment or service account permissions).

## Migration to minstral3

- For local developer validation, use the `scripts/debug-llm.ts` helper to run raw model outputs or a live Ollama probe through the `mapResponseForModel` registry:

```bash
# Run a local mapping probe using ts-node (dev only)
pnpm run llm:debug -- --model deepseek-coder:6.7b --llm

# Or map a sample nested json file
pnpm run llm:debug -- --model minstral3 --raw-file ./tests/sample-minstral3.json
```

## Example Prompts

- Minimal JSON-only strict prompt (recommended for better parsing):

````bash
You are a music metadata generator.
Output exactly one JSON object and nothing else with fields: title, lyrics, genre, mood.
Lyrics must be 3-6 short lines suitable for a 30-second melancholic song.
Narrative: "A melancholic story about rain and lost love in a quiet city"
```bash

- The service should sanitize and limit prompt length prior to sending to the model.

## Notes

- Because LLM output can include extraneous text or markdown fences, we parse the first JSON object found in the output. This is robust for many outputs but not guaranteed for all models. The `responseMapper` may be used to convert model-specific formats into the standard schema.
````
