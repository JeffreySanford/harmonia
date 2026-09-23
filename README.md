# Harmonia

**Enterprise-grade AI music and video generation platform with full-stack architecture, real-time collaboration, and persistent data management.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Nx](https://img.shields.io/badge/Nx-22.7.12-blue)](https://nx.dev)
[![Angular](https://img.shields.io/badge/Angular-21.0.2-red)](https://angular.io)
[![NestJS](https://img.shields.io/badge/NestJS-11.1.9-e0234e)](https://nestjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green)](https://www.mongodb.com)
[![Docker](https://img.shields.io/badge/Docker-29.0.1-blue)](https://www.docker.com)

[![CI](https://github.com/jeffreysanford/harmonia/actions/workflows/ci.yml/badge.svg)](https://github.com/jeffreysanford/harmonia/actions/workflows/ci.yml)

---

## 🚀 Quick Start

### New Developers

```bash
# 1. Clone repository
git clone https://github.com/jeffreysanford/harmonia.git
cd harmonia

# 2. Install dependencies
pnpm install

# 3. Copy .env.example to .env and set both MongoDB passwords and JWT_SECRET
# Start Docker Desktop (NVIDIA runtime is optional; use --gpu when available)

# 4. Start Docker infrastructure and both development servers
pnpm start:all
# Optional NVIDIA acceleration: pnpm start:all --gpu
# Optional omissions: pnpm start:all --no-worker / --no-tools
```

**Access Points:**

- **Frontend:** <http://localhost:4200>
- **Backend API:** <http://localhost:3000/api>
- **MongoDB:** `127.0.0.1:27017` (authenticated)
- **Mongo Express:** <http://localhost:8081>
- **ML worker:** `harmonia-worker` (no published HTTP port)

`pnpm start` also runs `start:all`, implemented in `scripts/start-all.cjs`.
The canonical runtime is `docker-compose.yml`, with optional NVIDIA settings in
`docker-compose.gpu.yml`. Missing containers are created, stopped containers are
started, unhealthy containers are restarted, dirty image/config changes are
recreated, and unchanged healthy containers stay running. MongoDB uses Docker;
the worker is CPU-compatible by default. Ollama (`11434`) is external and checked
only when `USE_OLLAMA=true`. Redis (`6379`) remains optional and is not provisioned.

Run `pnpm test:all` for application tests, startup contracts, and Compose
validation; use `pnpm lint:all` for code, docs, lifecycle scripts, and Compose.
Set `RUN_DOCKER_START_TESTS=1` when you explicitly want the isolated real-Docker
startup lifecycle test.

### Prerequisites

- **Node.js 20.19+** (LTS)
- **pnpm 12.6.0** (`npm install -g pnpm`)
- **Docker Desktop with Compose supporting `build --provenance` and `up --wait`**
- **NVIDIA container runtime** only when using `pnpm start:all --gpu`
- **Git** for version control
- **16GB+ RAM** recommended for AI model inference

---

## 📦 What's Included

### 🎨 Frontend (Angular 20)

- **Legendary SCSS Theme** - 2,344 lines of aurora/sunset/prairie color system
- **Material Design 3** - Custom palettes with elevation, typography, animations
- **Dedicated Material Modules** - Tree-shaking architecture (67% bundle size reduction)
- **NGRX State Management** - 4 feature stores (auth, models, datasets, jobs)
- **WebSocket Integration** - Socket.IO client for real-time job updates
- **Responsive Layout** - Flexbox-based with sidebar navigation (4 routes)
- **Custom ESLint Rules** - Enforces NgModule pattern (no standalone components)
- **Intelligent UI Controls** - Duration sliders with completion time estimation

### ⚙️ Backend (NestJS 11)

- **JWT Authentication** - bcrypt password hashing, token-based auth
- **RESTful API** - Comprehensive endpoints with validation
- **WebSocket Gateway** - Socket.IO server for job status broadcasting
- **MongoDB Integration** - Mongoose schemas with TypeScript types
- **Job Queue System** - Async task processing for AI generation
- **Security Hardening** - Firewall configuration, user permissions

### 🏗️ Infrastructure

- **Nx 22.7.12 Monorepo** - Build caching, parallel execution, dependency graph
- **pnpm Workspace** - Fast installs (3x faster than npm), disk space efficiency
- **Docker MongoDB 7.0** - Authenticated local database with persistent volumes
- **Docker ML Worker** - Python 3.11, PyTorch, MusicGen for music generation
- **Automated Backups** - MongoDB dump scripts with cron/Task Scheduler
- **CI/CD Pipelines** - GitHub Actions with smoke tests and license validation

### 🎵 AI Models & Data

- **MusicGen Models** - facebook/musicgen-small/medium/large (~100GB)
- **Audio Datasets** - GTZAN, MusicCaps, NSynth, FMA, AudioTagging
- **Checksum Validation** - SHA256 verification for all model files
- **Structured Inventories** - JSON manifests with metadata and checksums

---

## 🛠️ Development Commands

### Quick Commands

```bash
# Start both frontend + backend (parallel)
pnpm dev

# Start frontend only
pnpm dev:frontend

# Start backend only
pnpm dev:backend

# Build all applications
pnpm build:all

# Run the full local qualification test suite
pnpm test:all

# Lint code, docs, lifecycle scripts, and Compose
pnpm lint:all

# Auto-fix linting errors
pnpm lint:fix
```

### Full Command Reference

See [DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) for comprehensive dev guide.

---

## 🎯 Application Features

### Implemented Features

#### 🎵 Song Generation (`/generate/song`)

- **Two-Stage AI Pipeline**: Ollama metadata generation + MusicGen audio synthesis
- **Real-Time Progress**: WebSocket streaming with detailed status updates
- **Advanced Metadata**: Title, lyrics, genre, mood, syllable/word counts
- **Instrument Selection**: Multi-instrument support with progress tracking
- **Narrative-Driven**: AI interprets user stories to create songs
- **WebSocket Integration**: Live progress updates and error handling

#### 🔐 Authentication System (`/auth`)

- **JWT-Based Auth**: Secure token authentication with bcrypt hashing
- **User Registration/Login**: Complete authentication flow
- **Protected Routes**: Route guards and role-based access
- **Session Management**: Persistent login state with auto-refresh

#### 🎼 Music Generation (`/generate/music`)

- **AI-Powered Composition**: MusicGen models for audio synthesis
- **Multiple Model Sizes**: Small, medium, large variants
- **Instrument Libraries**: Extensive instrument selection
- **Duration Control**: Configurable song lengths

#### 🎬 Video Generation (`/generate/video`) - _Planned_

- **AI Video Synthesis**: Future video generation capabilities
- **Storyboard Integration**: Planned editing features

#### 📊 Job Monitoring (`/jobs`)

- **Real-Time Dashboard**: Live job status and progress tracking
- **Generation History**: Complete job history with results
- **WebSocket Updates**: Instant status notifications
- **Error Handling**: Comprehensive error reporting and recovery

### Technical Architecture

#### Frontend (Angular 21)

- **Material Design 3**: Custom theme with 2,344+ lines of SCSS
- **NGRX State Management**: 4 feature stores (auth, song-generation, jobs, models)
- **WebSocket Client**: Socket.IO integration for real-time updates
- **Component Architecture**: Sophisticated component hierarchy with lazy loading
- **Responsive Design**: Flexbox-based layout with sidebar navigation
- **TypeScript Strict**: Full type safety with custom ESLint rules

#### Backend (NestJS 11)

- **JWT Authentication**: Complete auth system with guards and strategies
- **RESTful APIs**: Comprehensive endpoints for song generation pipeline
- **WebSocket Gateway**: Real-time progress broadcasting and room management
- **MongoDB Integration**: Mongoose schemas with full TypeScript support
- **Job Queue System**: Async processing for AI generation tasks
- **Security Hardening**: Rate limiting, input validation, CORS

#### AI Pipeline

- **Ollama Integration**: DeepSeek-Coder and Mistral3 for metadata generation
- **MusicGen Models**: Facebook's MusicGen for high-quality audio synthesis
- **Two-Stage Processing**: Metadata generation → Audio synthesis
- **Progress Tracking**: Detailed progress events with WebSocket streaming
- **Error Recovery**: Automatic retry and recovery mechanisms

#### Infrastructure

- **Nx Monorepo**: Build caching, parallel execution, dependency management
- **Docker ML Container**: Python 3.11 + PyTorch + MusicGen environment
- **MongoDB 7.0**: Docker service with authentication and persistent volumes
- **WebSocket Architecture**: Room-based event routing for multi-user support
- **Automated Backups**: MongoDB dump scripts with scheduling

---

## 📚 Documentation

---

## **CI**

- **Workflow**: GitHub Actions workflow `ci.yml` runs unit tests across a small matrix and includes an optional Docker build job.
- **Badge**: The build status badge is at the top of this README and links to the workflow run history.
- **Run optional Docker build**: In the GitHub Actions UI, open the **Actions** tab → select the `CI` workflow → **Run workflow** → set `run_docker_build: true` and run. This will build the `Dockerfile.worker` image in CI (cached via buildx).
- **Local smoke recommended**: Locally you can verify the worker image quickly after building:

```bash
# build locally (may be slow)
docker build -f Dockerfile.worker -t harmonia/worker:local-ci .

# run a smoke script inside the image
docker run --rm harmonia/worker:local-ci bash -lc "python3 - <<'PY'\nimport json,sys\nout={}\ntry:\n  import torch\n  out['torch']=getattr(torch,'__version__',str(torch))\nexcept Exception as e:\n  out['torch_error']=str(e)\nprint(json.dumps(out))\nPY"
```

If you want, I can open a branch and PR with these README updates and the workflow changes; confirm the branch name to use.

### Getting Started

- [**DEVELOPMENT_WORKFLOW.md**](docs/DEVELOPMENT_WORKFLOW.md) - Complete dev guide
- [**MONGODB_SECURITY.md**](docs/MONGODB_SECURITY.md) - MongoDB native setup & hardening
- [**DOCKER_SETUP.md**](docs/DOCKER_SETUP.md) - Docker ML container setup

### Architecture

- [**COMPONENT_ARCHITECTURE.md**](docs/COMPONENT_ARCHITECTURE.md) - Angular patterns
- [**MATERIAL_MODULES.md**](docs/MATERIAL_MODULES.md) - Material Design tree-shaking
- [**NX_WORKSPACE_GUIDE.md**](docs/NX_WORKSPACE_GUIDE.md) - Nx configuration
- [**NGRX_PATTERNS.md**](docs/NGRX_PATTERNS.md) - State management
- [**WEBSOCKET_INTEGRATION.md**](docs/WEBSOCKET_INTEGRATION.md) - Real-time updates
- [**TYPESCRIPT_CONFIGURATION.md**](docs/TYPESCRIPT_CONFIGURATION.md) - TypeScript setup

### Standards

- [**CODING_STANDARDS.md**](docs/CODING_STANDARDS.md) - Draconian rules
- [**DTO_AND_EXAMPLES.md**](docs/DTO_AND_EXAMPLES.md) - Data transfer objects

---

## 📊 Technology Stack

- **Angular 21.0.2** + **NGRX 20.1.0** + **Material Design 3**
- **NestJS 11.1.9** + **Socket.IO 4.8.1** + **Mongoose 8.9**
- **Nx 22.7.12** + **pnpm 12.6.0** + **TypeScript 5.9.3**
- **MongoDB 7.0 (Docker)** + **Docker 29.0.1 (ML Worker)** + **Jest/Playwright**
- **Ollama (DeepSeek-Coder, Mistral3)** + **MusicGen (Small/Medium/Large)**

---

## 🎯 Project Status

### Phase 0: Foundation (✅ Complete)

- MongoDB 7.0 Docker runtime with authenticated application user
- PNPM 12.6.0 workspace
- Docker ML worker setup (harmonia-worker)
- 27 documentation files

### Phase 1: Full-Stack Implementation (🔄 In Progress)

- ✅ Nx monorepo + Angular 21 + NestJS 11
- ✅ Legendary SCSS theme (2,344+ lines)
- ✅ NGRX state management (4 stores: auth, song-generation, jobs, models)
- ✅ WebSocket integration with room-based event routing
- ✅ Custom ESLint rules and TypeScript strict mode
- ✅ Flexbox responsive layout with sidebar navigation
- ✅ Authentication system (JWT + guards + UI)
- 🔄 Song generation E2E pipeline (Ollama + MusicGen)
- 🔄 Job monitoring dashboard
- ✅ Material Design modules (5 modules, 67% bundle reduction)
- ✅ Feature modules with lazy loading (4 routes)
- ✅ Enhanced UI controls (duration sliders, completion estimates)
- ✅ JWT authentication system with bcrypt hashing
- ✅ User registration/login with protected routes
- ✅ Two-stage AI pipeline (Ollama + MusicGen)
- ✅ Real-time song generation with WebSocket progress
- ✅ Job monitoring dashboard with live updates
- ✅ MongoDB integration with Mongoose schemas
- ✅ RESTful APIs for song generation pipeline
- ✅ Error handling and recovery mechanisms

### Phase 2: Advanced Features (🔄 In Progress)

- ⏳ Video generation capabilities
- ⏳ Advanced video editing with storyboard
- ⏳ Multi-user collaboration features
- ⏳ Enhanced AI model selection and fine-tuning
- ⏳ Cloud deployment and scaling
- ⏳ Performance optimizations and caching

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

Built with ❤️ using Angular, NestJS, and MongoDB
