# Harmonia Development Setup Guide

Complete setup guide for Harmonia development environment

## Overview

This guide covers the complete setup process for developing Harmonia locally, including prerequisites, development environment configuration, Docker services, and deployment options.

## Prerequisites

### System Requirements

- **OS**: Windows 10/11, macOS, or Linux with administrative access
- **RAM**: 16GB minimum, 32GB recommended for AI/ML workloads
- **Storage**: 200GB+ free space (AI models are large)
- **Network**: Stable internet connection for downloading dependencies

### Required Software

- **Node.js 18+**: Runtime for frontend and backend
- **pnpm**: Package manager for dependency management
- **Git**: Version control
- **MongoDB 8.0+**: Database (native or Docker)
- **Docker Desktop**: Containerized services (optional but recommended)

## Quick Start (15 minutes)

### 1. Clone Repository

```bash
git clone https://github.com/jeffreysanford/harmonia.git
cd harmonia
```

### 2. Install Node.js and pnpm

**Windows/macOS:**

- Download Node.js 18+ LTS from [nodejs.org](https://nodejs.org/)
- Install pnpm globally:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

**Linux (Ubuntu/Debian):**

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
corepack enable
corepack prepare pnpm@latest --activate
```

**Verify installations:**

```bash
node --version  # Should show v18.x.x
pnpm --version  # Should show 8.x.x
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Setup Database

### Option A: Native MongoDB (Recommended for Windows)

1. Download MongoDB 8.0+ from [mongodb.com](https://www.mongodb.com/try/download/community)
2. Install as Windows service
3. Create database and user (see `docs/MONGODB_SETUP.md`)

### Option B: Docker MongoDB

```bash
# Install Docker Desktop from docker.com
# Then run:
docker run -d --name mongodb -p 27017:27017 mongo:8.0
```

### 5. Start Development Environment

```bash
# Start both frontend and backend with hot reload
pnpm run dev

# Or start services individually:
pnpm run backend:dev    # Backend on http://localhost:3000
pnpm run frontend:dev   # Frontend on http://localhost:4200
```

### 6. Verify Setup

Open browser to:

- **Frontend**: [http://localhost:4200](http://localhost:4200)
- **Backend API**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Detailed Setup

### Python Setup (For ML Development)

If working on AI/ML features:

**Windows:**

1. Download Python 3.11+ from [python.org](https://python.org/downloads/)
2. Install with PATH option enabled
3. Verify: `python --version`

**Linux/macOS:**

```bash
# Install Python 3.11+
sudo apt-get install python3.11 python3.11-venv  # Ubuntu/Debian
# or
brew install python@3.11  # macOS with Homebrew
```

### MongoDB Setup

#### Native Installation (Windows)

1. **Download**: Get MongoDB 8.0+ Community Server
2. **Install**: Run installer, select "Complete" setup
3. **Service**: Install as Windows service
4. **Configuration**: Use default settings

#### Database Initialization

```javascript
// Run in MongoDB shell or create init script
use harmonia
db.createUser({
  user: "harmonia_app",
  pwd: "secure_password",
  roles: ["readWrite"]
})
```

#### Docker Installation

```bash
# Pull and run MongoDB
docker pull mongo:8.0
docker run -d \
  --name harmonia-mongo \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:8.0

# Create application database
docker exec -it harmonia-mongo mongosh
use harmonia
db.createUser({user: "harmonia_app", pwd: "app_password", roles: ["readWrite"]})
```

## Docker Services

### ML/Music Generation Container

Harmonia uses Docker for AI/ML workloads:

```bash
# Start ML container
pnpm run docker:ml:start

# Access container shell
pnpm run docker:ml:shell

# Stop container
pnpm run docker:ml:stop
```

**Container Details:**

- **Image**: `harmonia-harmonia` (618MB)
- **Purpose**: Python/MusicGen for audio generation
- **Port**: 8000 (internal)
- **Mounts**: Models, datasets, artifacts

### Docker Compose Setup

For production-like local development:

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:8.0
    ports:
      - '27017:27017'
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password

  ml-service:
    image: harmonia-harmonia:latest
    ports:
      - '8000:8000'
    volumes:
      - ./models:/workspace/models:ro
      - ./artifacts:/workspace/artifacts
    environment:
      - PYTHONPATH=/workspace
```

## WSL2 Development (Windows)

### WSL2 Setup

For GPU-accelerated development on Windows:

1. **Install WSL2**:

   ```powershell
   wsl --install
   wsl --set-default-version 2
   ```

2. **Install Ubuntu**:

   ```powershell
   wsl --install -d Ubuntu
   ```

3. **Configure GPU Support**:
   - Install NVIDIA drivers in Windows
   - Install CUDA toolkit in WSL2
   - Verify: `nvidia-smi` in WSL2 terminal

### Docker in WSL2

```bash
# Install Docker in WSL2
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Configure Docker to use WSL2
# In Docker Desktop: Settings > General > Use WSL2
```

### Development Workflow

```bash
# In WSL2 terminal
cd /mnt/c/repos/harmonia
pnpm install
pnpm run dev

# GPU workloads run in Docker containers
pnpm run docker:ml:start
```

## Environment Configuration

### .env Setup

Create `.env` file in project root:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/harmonia
MONGODB_USER=harmonia_app
MONGODB_PASS=your_password

# Backend
NODE_ENV=development
PORT=3000
JWT_SECRET=your_jwt_secret

# Frontend
API_BASE_URL=http://localhost:3000/api

# AI/ML (Optional)
OLLAMA_URL=http://localhost:11434
USE_OLLAMA=true
```

### Development vs Production

**Development**:

- Hot reload enabled
- Debug logging
- Local services
- Mock data fallbacks

**Production**:

- Optimized builds
- External databases
- CDN assets
- Security hardening

## Troubleshooting

### Common Issues

**Port Conflicts**:

```bash
# Check what's using ports
netstat -ano | findstr :3000
netstat -ano | findstr :4200
netstat -ano | findstr :27017

# Kill process or change ports in .env
```

**MongoDB Connection Issues**:

```bash
# Test connection
mongosh mongodb://localhost:27017/harmonia

# Check service status (Windows)
services.msc  # Look for MongoDB Server

# Check Docker container
docker ps | grep mongo
docker logs harmonia-mongo
```

**Node.js/Python Version Issues**:

```bash
# Check versions
node --version
python --version
pnpm --version

# Clear caches
pnpm store prune
rm -rf node_modules
pnpm install
```

**Docker Issues**:

```bash
# Check Docker status
docker --version
docker ps

# Restart Docker service
# Windows: Restart Docker Desktop
# Linux: sudo systemctl restart docker
```

### Performance Optimization

**For Large Projects**:

- Use SSD storage
- Increase Node.js memory: `export NODE_OPTIONS="--max-old-space-size=4096"`
- Use Docker for isolated services
- Monitor resource usage with Task Manager/Activity Monitor

**For AI/ML Development**:

- Use GPU acceleration when available
- Cache model downloads
- Use smaller models for development
- Monitor GPU memory usage

## Development Workflow

### Daily Development

```bash
# Start development servers
pnpm run dev

# Run tests
pnpm test
pnpm test:e2e

# Lint and format code
pnpm lint
pnpm format

# Build for production
pnpm build
```

### Code Quality

- **Linting**: ESLint for TypeScript/JavaScript
- **Formatting**: Prettier for consistent code style
- **Testing**: Jest for unit tests, Playwright for E2E
- **Type Checking**: TypeScript strict mode

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes, test, commit
git add .
git commit -m "Add new feature"

# Push and create PR
git push origin feature/new-feature
```

## Deployment

### Local Production Testing

```bash
# Build and serve production version
pnpm build
pnpm serve

# Test production build
curl http://localhost:8080
```

### Docker Deployment

```bash
# Build production images
docker build -t harmonia-app:latest .

# Run with Docker Compose
docker-compose up -d
```

### Cloud Deployment

**Supported Platforms**:

- Vercel (Frontend)
- Railway/DigitalOcean (Backend)
- MongoDB Atlas (Database)
- Docker containers for AI services

## Advanced Configuration

### Custom Model Setup

For AI/ML development:

```bash
# Download models to local directory
mkdir models
# Download your models here

# Configure model paths
export HARMONIA_MODELS_ROOT=./models
```

### Multi-Environment Setup

```bash
# Development
cp .env.example .env.development

# Staging
cp .env.example .env.staging

# Production
cp .env.example .env.production
```

### CI/CD Pipeline

GitHub Actions workflow includes:

- Dependency installation
- Linting and type checking
- Unit and integration tests
- Build verification
- Docker image creation

## Support

### Getting Help

1. **Check Documentation**: This guide and related docs
2. **Search Issues**: GitHub issues for known problems
3. **Community**: Discord/GitHub Discussions
4. **Logs**: Check application logs for error details

### Useful Commands

```bash
# Health checks
curl http://localhost:3000/api/health
curl http://localhost:4200

# Database status
mongosh --eval "db.stats()"

# Docker status
docker ps
docker stats

# Application logs
pnpm run backend:logs
pnpm run frontend:logs
```

## Next Steps

After setup completion:

1. **Explore the codebase** in `apps/frontend/` and `apps/backend/`
2. **Run the test suite** to verify everything works
3. **Check out documentation** in `docs/` directory
4. **Start development** on your assigned tasks
5. **Join the team** for code reviews and collaboration

Welcome to Harmonia development! 🎵
