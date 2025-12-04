# Harmonia Quick Start

**Get up and running with Harmonia development in under 15 minutes.**

---

## Prerequisites

Before starting, ensure you have:

- ✅ Windows 10/11 with administrative access
- ✅ 16GB+ RAM (32GB recommended for AI workloads)
- ✅ 200GB+ free disk space (models are large!)
- ✅ Native MongoDB 8.0+ or Docker Desktop (for ML container)

---

## Step 1: Clone Repository (1 minute)

```bash
git clone https://github.com/jeffreysanford/harmonia.git
cd harmonia
```plaintext

---

## Step 2: Install Prerequisites (5 minutes)

### 2a. Install Node.js 18+

Download and install: <https://nodejs.org/> (LTS version)

```bash
node --version  # Should be v18.0.0 or higher
```

### 2b. Install pnpm

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version  # Should be 8.0+
```

### 2c. Install Python 3.11+ (Optional - Only for ML Development)

If you plan to work on ML/music generation:

Download: <https://www.python.org/downloads/>

```bash
python --version  # Should be 3.11+
```

**Note**: ML workloads run in Docker container (harmonia-dev), so Python is optional for most development.

### 2d. Install MongoDB 8.0+

Native MongoDB is recommended for production performance.

**Download**: <https://www.mongodb.com/try/download/community>

**Or follow**: `docs/MONGODB_SECURITY.md` for hardened installation

**Verify installation**:

```powershell
# Check service status
Get-Service MongoDB

# Connect with mongosh
mongosh mongodb://localhost:27017
```

---

## Step 3: Configure Environment (2 minutes)

### 3a. Set up environment variables

```powershell
# Already done! Your .env has:
# - MONGO_ROOT_PASSWORD
# - MONGO_HARMONIA_PASSWORD
# - HUGGINGFACE_HUB_TOKEN
# - CLOUD_SYNC_ENABLED=false
```

### 3b. Install dependencies

```bash
pnpm install
```

Expected output:

```plaintext
Packages: +254
Done in 5s
```

---

## Step 4: Set Up MongoDB (3 minutes)

### 4a. Install MongoDB Shell (if needed)

```powershell
.\scripts\install-mongosh.bat
```

### 4b. Initialize database

```powershell
.\scripts\setup-mongodb.bat
```

Expected output:

```plaintext
✓ Created admin user
✓ Created harmonia_app user
✓ Created 5 collections
```

### 4c. Harden security

```powershell
.\scripts\enable-mongodb-auth.ps1
```

Expected output:

```plaintext
✓ MongoDB is now hardened and secure
```

---

## Step 5: Verify Installation (2 minutes)

### 5a. Test MongoDB connection

```powershell
mongosh "mongodb://harmonia_app:PASSWORD@localhost:27017/harmonia?authSource=harmonia" --eval "db.model_artifacts.countDocuments()"
```

Expected output: `0` (no documents yet)

### 5b. Test Mongoose

```bash
pnpm test:mongo
```

Expected output:

```plaintext
Created ModelArtifact: {...}
Found: OK
```

### 5c. Verify security

```bash
.\scripts\harden-mongodb.bat
```

Expected output:

```plaintext
Overall Status: ✓ GOOD
```

---

## Step 6: Optional - Download Models (Optional, ~1 hour)

⚠️ **Warning:** This downloads 100GB+ of data!

```bash
# Download MusicGen models
bash scripts/download_model_facebook.sh

# Or download specific models
bash scripts/download_musicgen_full.sh
```

Skip this for now if you just want to develop!

---

## You're Ready! 🎉

### What You Have Now

- ✅ MongoDB running and secured
- ✅ PNPM package manager configured  
- ✅ Dependencies installed
- ✅ Database initialized with collections
- ✅ Authentication enabled
- ✅ Development environment ready

### Next Steps

#### Option A: Start Development (Phase 1)

```bash
# Coming soon: Angular + NestJS scaffolding
pnpm dev
```

#### Option B: Explore Documentation

- `docs/ARCHITECTURE.md` - System architecture
- `docs/DEV_ONBOARDING.md` - Developer guide
- `docs/MONGODB_SECURITY.md` - Security practices
- `docs/TROUBLESHOOTING.md` - Common issues

#### Option C: Work with Models

```bash
# Generate seed data
pnpm seed:generate

# List models (once downloaded)
ls models/

# Check inventories
cat inventory/combined_inventory.json
```

---

## Common Commands

### MongoDB

```bash
# Connect to database
mongosh "mongodb://harmonia_app:PASSWORD@localhost:27017/harmonia?authSource=harmonia"

# Start/stop service (PowerShell Admin)
Start-Service MongoDB
Stop-Service MongoDB
Restart-Service MongoDB

# Backup database
.\scripts\backup-mongo.sh

# Restore from seed
pnpm seed:restore
```

### Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test:mongo

# Build TypeScript
pnpm build

# Start dev server (Phase 1+)
pnpm dev
```

### Maintenance

```bash
# Check file sizes
python scripts/audit_file_sizes.py

# Check licenses
python scripts/check_licenses_ci.py

# Security audit
.\scripts\harden-mongodb.bat
```

---

## Troubleshooting

### MongoDB won't start

```powershell
# Check service status
Get-Service MongoDB

# Check if port is in use
netstat -ano | grep :27017

# View logs
Get-Content "C:\Program Files\MongoDB\Server\8.0\log\mongod.log" -Tail 50
```

### pnpm install fails

```bash
# Clear cache and retry
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Authentication errors

```bash
# Verify passwords in .env
cat .env | grep MONGO

# Test connection
mongosh "mongodb://localhost:27017"
# Should require authentication
```

### More help

See `docs/TROUBLESHOOTING.md` for comprehensive solutions.

---

## Development Workflow

### 1. Start your day

```bash
# Pull latest changes
git pull origin master

# Update dependencies
pnpm install

# Start MongoDB (if not auto-start)
Start-Service MongoDB

# Verify everything works
pnpm test:mongo
```

### 2. Make changes

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make your changes
# (edit files)

# Test changes
pnpm build
pnpm test
```

### 3. Commit and push

```bash
# Check what changed
git status

# Add files
git add .

# Commit with meaningful message
git commit -m "feat: add new feature"

# Push to GitHub
git push origin feature/my-feature
```

### 4. End your day

```bash
# Backup MongoDB (optional)
.\scripts\backup-mongo.sh

# Stop services to save resources (optional)
Stop-Service MongoDB
```

---

## Project Structure

```plaintext
harmonia/
├── docs/               # Documentation (you are here!)
├── scripts/            # Automation scripts
│   ├── setup-mongodb.bat
│   ├── harden-mongodb.bat
│   └── backup-mongo.sh
├── src/                # TypeScript source code
│   ├── models/         # Mongoose schemas
│   ├── dto/            # Data transfer objects
│   └── services/       # Business logic
├── models/             # Downloaded AI models (gitignored)
├── datasets/           # Training datasets (gitignored)
├── inventory/          # Model inventories
├── seeds/              # MongoDB seed files
├── tests/              # Test files
├── .env                # Environment variables (gitignored, YOU HAVE THIS)
├── package.json        # Dependencies
├── pnpm-lock.yaml      # Lock file
└── tsconfig.json       # TypeScript config
```

---

## Architecture Overview

```plaintext
┌─────────────────────────────────────────┐
│       Harmonia Architecture             │
├─────────────────────────────────────────┤
│                                         │
│  Frontend (Phase 1)                     │
│  ┌──────────────────────────┐          │
│  │  Angular + Material UI   │          │
│  │  NGRX State Management   │          │
│  └────────────┬─────────────┘          │
│               │                         │
│  Backend (Phase 1)                      │
│  ┌────────────▼─────────────┐          │
│  │  NestJS REST API         │          │
│  │  + WebSocket Gateway     │          │
│  └────────────┬─────────────┘          │
│               │                         │
│  Database (Phase 0 - DONE!)             │
│  ┌────────────▼─────────────┐          │
│  │  MongoDB Community 8.0   │          │
│  │  + Mongoose ODM          │          │
│  └──────────────────────────┘          │
│                                         │
│  AI Models (Downloaded)                 │
│  ┌──────────────────────────┐          │
│  │  MusicGen, EnCodec       │          │
│  │  PyTorch / Hugging Face  │          │
│  └──────────────────────────┘          │
│                                         │
└─────────────────────────────────────────┘
```

---

## Phase Roadmap

### ✅ Phase 0: Infrastructure (COMPLETE!)

- MongoDB installed and secured
- PNPM configured
- Documentation created
- Scripts and automation ready

### 🔄 Phase 1: Application Scaffold (Next)

- Angular frontend with Material Design
- NestJS backend with REST API
- Authentication and authorization
- Basic model browser UI

### 🔮 Phase 2: Core Features (Future)

- Audio generation interface
- Job queue and processing
- Real-time updates via WebSocket
- Model management UI

### 🔮 Phase 3: Advanced Features (Future)

- Cloud sync (optional)
- Multi-user support
- Advanced audio editing
- Performance optimizations

---

## Getting Help

### Documentation

- 📖 Full docs in `docs/` folder
- 🔧 Troubleshooting: `docs/TROUBLESHOOTING.md`
- 🔒 Security: `docs/MONGODB_SECURITY.md`
- 🏗️ Architecture: `docs/ARCHITECTURE.md`

### Commands

```bash
# Run security audit
.\scripts\harden-mongodb.bat

# Check file sizes
python scripts/audit_file_sizes.py

# Test Mongoose
pnpm test:mongo
```

### Community

- 💬 Open an issue on GitHub
- 📧 Contact project maintainers
- 📝 Check existing documentation

---

## Tips for Success

### 1. Keep MongoDB Secure

- ✅ Never commit `.env` file
- ✅ Rotate passwords every 90 days
- ✅ Run security audits monthly
- ✅ Keep MongoDB updated

### 2. Follow Coding Standards

- ✅ Max 500 lines per file
- ✅ Use TypeScript strict mode
- ✅ Run linters before committing
- ✅ Write meaningful commit messages

### 3. Backup Regularly

```bash
# Manual backup
.\scripts\backup-mongo.sh

# Set up automated daily backups
# (See docs/DISASTER_RECOVERY.md)
```

### 4. Monitor Resources

```powershell
# Check MongoDB memory usage
Get-Process mongod | Select-Object WS

# Check disk space
Get-PSDrive C
```

---

## Congratulations! 🎉

You're now ready to start developing with Harmonia!

**What's Next?**

- Explore the codebase
- Read architecture docs
- Start Phase 1 development
- Build amazing AI-powered features!

---

**Last Updated:** December 2, 2025  
**Phase:** 0 Complete, Ready for Phase 1  
**Time to Complete:** ~15 minutes
