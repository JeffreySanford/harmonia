# Harmonia

**Enterprise-grade AI music and video generation platform with full-stack architecture, real-time collaboration, and persistent data management.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Nx](https://img.shields.io/badge/Nx-22.1.3-blue)](https://nx.dev)
[![Angular](https://img.shields.io/badge/Angular-21.0.2-red)](https://angular.io)
[![NestJS](https://img.shields.io/badge/NestJS-11.1.9-e0234e)](https://nestjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.0.6-green)](https://www.mongodb.com)

---

## 🚀 Quick Start

### New Developers

```bash
# 1. Clone repository
git clone https://github.com/jeffreysanford/harmonia.git
cd harmonia

# 2. Install dependencies
pnpm install

# 3. Start MongoDB
docker compose -f docker-compose.mongo.yml up -d

# 4. Run development servers (frontend + backend)
pnpm dev
```

**Access Points:**

- **Frontend:** <http://localhost:4200>
- **Backend API:** <http://localhost:3333/api>
- **Mongo Express UI:** <http://localhost:8081>

### Prerequisites

- **Node.js 20+** (LTS)
- **pnpm 10.23.0+** (`npm install -g pnpm`)
- **Docker Desktop** (for MongoDB)
- **Git** for version control
- **16GB+ RAM** recommended for AI model inference

---

## 📦 What's Included

### 🎨 Frontend (Angular 21)

- **Legendary SCSS Theme** - 2,344 lines of aurora/sunset/prairie color system
- **Material Design 3** - Custom palettes with elevation, typography, animations
- **NGRX State Management** - 4 feature stores (auth, models, datasets, jobs)
- **WebSocket Integration** - Socket.IO client for real-time job updates
- **Responsive Layout** - Flexbox-based with sidebar navigation (4 routes)
- **Custom ESLint Rules** - Enforces NgModule pattern (no standalone components)

### ⚙️ Backend (NestJS 11)

- **JWT Authentication** - bcrypt password hashing, token-based auth
- **RESTful API** - Comprehensive endpoints with validation
- **WebSocket Gateway** - Socket.IO server for job status broadcasting
- **MongoDB Integration** - Mongoose schemas with TypeScript types
- **Job Queue System** - Async task processing for AI generation
- **Security Hardening** - Firewall configuration, user permissions

### 🏗️ Infrastructure

- **Nx 22.1.3 Monorepo** - Build caching, parallel execution, dependency graph
- **pnpm Workspace** - Fast installs (3x faster than npm), disk space efficiency
- **Docker Compose** - MongoDB 8.0.6 + Mongo Express UI
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

# Run all tests
pnpm test

# Lint all projects
pnpm lint

# Auto-fix linting errors
pnpm lint:fix
```

### Full Command Reference

See [DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) for comprehensive dev guide.

---

## 🎯 Application Features

### Current Navigation Routes

1. **Song Generation** (`/generate/song`) 🎵
2. **Music Generation** (`/generate/music`) 🎼
3. **Video Generation** (`/generate/video`) 🎬
4. **Video Editing** (`/edit/video`) ✂️

### Planned Features (Phase 1)

- [ ] User authentication UI
- [ ] Song generation feature module
- [ ] Music generation feature module
- [ ] Video generation feature module
- [ ] Video editing with storyboard
- [ ] Job history and management

---

## 📚 Documentation

### Getting Started

- [**DEVELOPMENT_WORKFLOW.md**](docs/DEVELOPMENT_WORKFLOW.md) - Complete dev guide
- [**QUICKSTART_MONGODB.md**](docs/QUICKSTART_MONGODB.md) - MongoDB setup (10 min)

### Architecture

- [**COMPONENT_ARCHITECTURE.md**](docs/COMPONENT_ARCHITECTURE.md) - Angular patterns
- [**NX_WORKSPACE_GUIDE.md**](docs/NX_WORKSPACE_GUIDE.md) - Nx configuration
- [**NGRX_PATTERNS.md**](docs/NGRX_PATTERNS.md) - State management
- [**WEBSOCKET_INTEGRATION.md**](docs/WEBSOCKET_INTEGRATION.md) - Real-time updates

### Standards

- [**CODING_STANDARDS.md**](docs/CODING_STANDARDS.md) - Draconian rules
- [**DTO_AND_EXAMPLES.md**](docs/DTO_AND_EXAMPLES.md) - Data transfer objects

---

## 📊 Technology Stack

- **Angular 21.0.2** + **NGRX 20.1.0** + **Material Design 3**
- **NestJS 11.1.9** + **Socket.IO 4.8.1** + **Mongoose 8.9**
- **Nx 22.1.3** + **pnpm 10.23.0** + **TypeScript 5.9.3**
- **MongoDB 8.0.6** + **Docker** + **Jest/Playwright**

---

## 🎯 Project Status

### Phase 0: Foundation (✅ Complete)

- MongoDB 8.0.6 hardened
- PNPM 10.23.0 workspace
- 27 documentation files

### Phase 1: Full-Stack (🔄 In Progress)

- ✅ Nx monorepo + Angular 21 + NestJS 11
- ✅ Legendary SCSS theme (2,344 lines)
- ✅ NGRX state (4 stores)
- ✅ WebSocket integration
- ✅ Custom ESLint rules
- ✅ Flexbox layout
- ⏳ Feature modules
- ⏳ Authentication UI

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

Built with ❤️ using Angular, NestJS, and MongoDB
