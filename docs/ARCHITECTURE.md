# Harmonia Architecture Overview

This document describes the high-level architecture and design goals for the Harmonia project: a sophisticated AI-powered music generation platform featuring a two-stage LLM + MusicGen pipeline, comprehensive song metadata generation, and real-time collaborative workflows.

## Goals

- **Two-Stage AI Pipeline**: Separate metadata generation (Ollama/LLM) from audio synthesis (MusicGen) for superior quality and user control
- **Reproducible Local Development**: Full-stack local development with Ollama models for metadata and MusicGen for audio
- **Comprehensive Song Generation**: Narrative-to-song pipeline with genre suggestions, instrument selection, lyrics generation, and structured annotations
- **Real-Time Collaboration**: WebSocket-powered progress tracking and live generation status updates
- **Enterprise-Grade Frontend**: Angular + Material 3 + NGRX with sophisticated state management for complex AI workflows
- **Modular AI Services**: Specialized Ollama services for different generation tasks (metadata, genres, instruments, annotations)

## Core Components

### AI Pipeline Architecture

**Stage 1 - Metadata Generation (Ollama)**:

- **OllamaService**: Central service managing all LLM interactions
- **MetadataGenerationService**: Song title, lyrics, genre, mood generation
- **GenreSuggestionService**: AI-powered genre recommendations from narrative analysis
- **InstrumentSelectionService**: Intelligent instrument palette suggestions
- **AnnotationDSLService**: Structured song annotation generation using Song Annotation DSL

**Stage 2 - Audio Generation (MusicGen)**:

- **MusicGenService**: Audio synthesis from metadata and instrument specifications
- **WebSocket Progress Tracking**: Real-time generation status updates
- **Artifact Management**: Audio file storage and retrieval

### Data Flow Architecture

```text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   User Input    │ -> │   Ollama LLM     │ -> │   User Review    │ -> │   MusicGen       │
│   (Narrative)   │    │   Metadata Gen   │    │   & Approval     │    │   Audio Synth    │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └──────────────────┘
       │                        │                        │                        │
   Narrative Text          Structured JSON          Editable Metadata         Audio File
   (500-2000 chars)        (title, lyrics,         (user can modify)         (WAV/MP3)
                           genre, mood)            before approval           + metadata
```

### Technology Stack

- **Frontend**: Angular 21 + Material Design 3 + NGRX State Management
- **Backend**: NestJS 11 + MongoDB 8.0 + WebSocket Gateway
- **AI Models**: Ollama (deepseek-coder, minstral3) + MusicGen (facebook/musicgen-\*)
- **Real-Time**: Socket.IO for live generation progress and collaboration
- **Data**: MongoDB with Mongoose schemas for songs, users, and generation jobs
- **Containerization**: Docker for ML workloads with CUDA support

## Infrastructure Topology

### Native Services (Windows)

- **MongoDB 8.0**: `localhost:27017` with authentication and RBAC
- **NestJS Backend**: `localhost:3000` with comprehensive REST APIs and WebSocket gateway
- **Angular Frontend**: `localhost:4200` with Material Design 3 and NGRX state management
- **Ollama Server**: Local LLM server hosting deepseek-coder and minstral3 models

### Docker Services

- **MusicGen Container**: Python 3.11 + PyTorch + CUDA for audio synthesis
- **ML Worker Container**: Async job processing for heavy AI computations

### External Dependencies

- **Hugging Face Hub**: Model downloads with token authentication
- **Ollama Models**: Local LLM hosting for metadata generation

## Complete Data Flow (Song Generation)

1. **User Input Phase**:

   - User enters narrative description (500-2000 characters)
   - Optional: AI genre suggestions via Ollama analysis
   - User sets duration (15-120 seconds) and adjusts parameters

2. **Metadata Generation Phase**:

   - Frontend calls `/api/songs/generate-metadata` with narrative and duration
   - Backend invokes Ollama service with structured prompts
   - LLM generates title, lyrics, genre, mood, syllable count
   - Response includes duration-aware lyrics (120-150 words for 30s)

3. **User Review & Edit Phase**:

   - Frontend displays generated metadata in editable form
   - User can modify title, lyrics, genre, mood
   - Syllable count validation and warnings
   - Optional: Regenerate with different parameters

4. **Instrument Selection Phase**:

   - User can expand instrument panel for detailed control
   - AI suggests instrument palettes based on genre/mood
   - User selects instruments, presets, and priorities
   - Per-section overrides available

5. **Audio Generation Phase**:

   - User approves metadata → triggers MusicGen synthesis
   - Backend creates async job with WebSocket progress tracking
   - Frontend subscribes to real-time progress updates (0-100%)
   - MusicGen processes metadata + instrument specs → audio file

6. **Completion & Playback**:
   - WebSocket broadcasts completion event
   - Frontend displays download button and embedded audio player
   - Generated audio stored with metadata linkage

## Key Architectural Decisions

### Two-Stage AI Pipeline

**Why**: Separating metadata generation (LLM) from audio synthesis (specialized model) provides:

- Better quality control and user editing opportunities
- Flexible metadata refinement before expensive audio generation
- Reusability of metadata for different audio styles
- Cost optimization (regenerate metadata cheaply, audio generation once)

### Ollama Integration Strategy

**Why Local Models**:

- Privacy: No external API calls for user content
- Cost: Zero API costs for development and production
- Speed: Local inference eliminates network latency
- Reliability: No external service dependencies

### WebSocket-First Architecture

**Why Real-Time Updates**:

- AI generation can take 30-120 seconds
- Users need progress feedback and cancellation options
- Enables future collaborative features
- Supports live parameter adjustment during generation

### Comprehensive State Management

**Why NGRX for Complex Workflows**:

- Multi-stage song generation requires complex state
- Real-time WebSocket updates need predictable state mutations
- Undo/redo capabilities for user edits
- Cross-component coordination for generation pipeline
