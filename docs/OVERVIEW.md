# Harmonia: Scalable AI Music & Video Platform

## Overview
Harmonia is a modular, scalable platform for AI-powered music and video creation. It leverages Python for AI engines, Node.js for orchestration and frontend, Redis for state management, and Docker/Kubernetes for deployment. The architecture is designed for extensibility and future features.

## Core Services
- **Music Generation Service (Python)**: FastAPI app for LLM chat, parameter extraction, and music generation (MusicGen, Suno, Udio). Integrates with Ollama for LLM and Redis for session/job management.
- **Video Generation Service (Python/Node.js)**: Handles video synthesis, overlays, and vocal style integration. Communicates with Redis for job status.
- **Vocal Styles Service (Optional)**: Microservice for advanced vocal processing (TTS, style transfer).
- **Frontend (Node.js/Angular/React)**: SPA for user interaction, connects to backend via REST/WebSocket.

## Infrastructure
- **Docker**: Each service runs in its own container. Docker Compose for local development.
- **Kubernetes**: Orchestrates containers in production, handles scaling, service discovery, rolling updates.
- **Redis**: Centralized state for sessions, job queues, and caching. Used by all backend services.

## Workflow
1. User interacts with chat UI (frontend).
2. Frontend sends message to Music Generation API.
3. Music API uses LLM to extract parameters, manages session in Redis, generates music.
4. Video API receives music and parameters, generates video, updates Redis.
5. Frontend polls/subscribes for updates, displays results.

## Development Steps
- Write Dockerfiles for each service.
- Use Docker Compose for local orchestration (Ollama, Redis, APIs).
- Create Kubernetes manifests for production.
- Use Redis for all session/job state.
- Keep services stateless except for Redis.

## Scalability & Extensibility
- Add new engines/services as containers.
- Scale each service independently.
- Use Redis for cross-service communication.

---
Ready for future features and easy to extend!