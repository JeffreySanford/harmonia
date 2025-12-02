# Phase 0: Foundation & Infrastructure Setup

**Goal:** Establish robust local development environment, persistent storage, CI/CD foundations, and documentation before building frontend/backend applications.

**Status:** In Progress  
**Target Completion:** Before Phase 1 (Angular/NestJS scaffolding)

---

## Completed Items ✅

### Infrastructure & Tooling
- [x] Downloader scripts with `.env` token support
- [x] Remove hard-coded secrets
- [x] Full model/dataset download (100GB+ MusicGen, EnCodec, Demucs)
- [x] Generate inventories and checksums (SHA256)
- [x] Smoke-check script with JSON reporting
- [x] PNPM migration and workspace setup
- [x] TypeScript DTOs and Mongoose model scaffolds

### Documentation
- [x] Architecture overview (`ARCHITECTURE.md`)
- [x] Docker/WSL2 setup guide (`DOCKER_WSL2_GUIDE.md`)
- [x] Draconian coding standards (`CODING_STANDARDS.md`)
- [x] MCP/AI operator instructions (`MCP_INSTRUCTIONS.md`)
- [x] CI smoke check design (`CI_SMOKE_DESIGN.md`)
- [x] Inference optimizations guide (`INFERENCE_OPTIMIZATIONS.md`)
- [x] Developer onboarding (`DEV_ONBOARDING.md`)
- [x] Legal/license audit framework (`LEGAL_AND_LICENSE_AUDIT.md`)
- [x] Resource & cost planning (`RESOURCE_COST_PLANNING.md`)
- [x] Ethical usage guidelines (`ETHICAL_USAGE.md`)
- [x] Persistent storage design (`PERSISTENT_STORAGE.md`)
- [x] MongoDB schema guide (`MONGO_SCHEMA_GUIDE.md`)
- [x] DTO examples (`DTO_AND_EXAMPLES.md`)
- [x] PNPM benefits & security (`PNPM.md`)
- [x] MongoDB local setup (`MONGODB_SETUP.md`)
- [x] i9 MongoDB installation guide (`I9_MONGODB_INSTALL.md`)
- [x] License CI policy (`LICENSING_CI.md`)

### CI/CD
- [x] Smoke check workflow (`.github/workflows/smoke.yml`)
- [x] License check workflow (`.github/workflows/license_check.yml`)
- [x] Mongoose memory-server test workflow (`.github/workflows/test_mongoose.yml`)
- [x] Release workflow with strict checks (`.github/workflows/release.yml`)

---

## In Progress 🔄

### Priority 1: MongoDB Setup on i9
- [x] Create `docker-compose.mongo.yml` with security hardening
- [x] Write initialization script (`scripts/mongo-init/01-init-harmonia-db.js`)
- [x] Create backup script (`scripts/backup-mongo.sh`)
- [ ] **Install and start MongoDB container on i9**
  - Generate secure passwords in `.env`
  - Run `docker compose -f docker-compose.mongo.yml up -d`
  - Verify health check passes
  - Test admin connection via mongosh
- [ ] **Configure Windows firewall rules**
  - Block external access to port 27017
  - Allow localhost only
- [ ] **Set up Mongo Express UI**
  - Access http://localhost:8081
  - Verify authentication works
  - Test collection browsing
- [ ] **Run migration to seed database**
  - Execute `node scripts/migrate_inventory_to_db.js`
  - Verify model_artifacts populated from inventory
  - Validate indexes created correctly

### Priority 2: File Size Refactoring
- [ ] Audit all files >400 lines
- [ ] Refactor any files >500 lines into modules
- [ ] Update imports and references
- [ ] Add ESLint `max-lines` rule
- [ ] Add pre-commit hook for file size checks
- [ ] Update documentation with refactored paths

### Priority 3: PNPM Validation
- [ ] Run `pnpm install` on i9
- [ ] Execute `pnpm test:mongo` successfully
- [ ] Verify lockfile integrity
- [ ] Test workspace commands
- [ ] Validate CI workflows use pnpm correctly

---

## Pending (Phase 0 Completion) ⏳

### MongoDB Operations
- [ ] Configure automated backups (cron/Task Scheduler)
- [ ] Test backup/restore procedure
- [ ] Document connection strings in `.env.example`
- [ ] Set up monitoring (optional: Prometheus + Grafana)
- [ ] Performance tuning based on i9 specs

### CI/CD Hardening
- [ ] Add GitHub Actions annotations for license warnings
- [ ] Implement artifact caching for smoke checks
- [ ] Add issue auto-creation on workflow failures
- [ ] Set up dependabot for security updates
- [ ] Configure branch protection rules

### Docker Infrastructure
- [ ] Finalize `Dockerfile.worker` for inference
- [ ] Create `docker-compose.dev.yml` for full stack
- [ ] Add GPU passthrough configuration
- [ ] Document multi-stage build optimization
- [ ] Add healthchecks to all services

### Manifest & Licensing
- [ ] Populate license metadata in inventory
- [ ] Fetch missing license files from upstream
- [ ] Complete legal checklist for MusicGen/EnCodec/Demucs
- [ ] Document license compliance requirements
- [ ] Add SPDX identifiers to all code files

### Testing & Quality
- [ ] Add integration tests for MongoDB operations
- [ ] Create E2E test for download → inventory → DB migration flow
- [ ] Set up code coverage reporting
- [ ] Add performance benchmarks for critical paths
- [ ] Configure SonarQube or similar code quality tool

---

## Phase 0 Exit Criteria

Before moving to Phase 1 (Angular/NestJS scaffolds), all of the following must be complete:

1. ✅ **MongoDB running on i9** with:
   - Secure authentication configured
   - Automated backups working
   - UI accessible at localhost:8081
   - Database seeded with inventory data

2. ✅ **PNPM validated** with:
   - All dependencies installed successfully
   - Tests passing (`pnpm test:mongo`)
   - CI workflows using pnpm
   - Lockfile committed

3. ✅ **File size compliance** with:
   - No files >500 lines
   - Refactoring documented
   - Linting rules enforced

4. ✅ **CI passing** with:
   - Smoke checks (scheduled + PR)
   - License checks (soft mode on PR, strict on release)
   - Mongoose tests
   - No workflow failures

5. ✅ **Documentation complete** with:
   - All setup guides tested
   - Architecture decisions recorded
   - Coding standards enforced
   - Onboarding verified by new developer

6. ✅ **Legal/licensing** with:
   - License files present or metadata recorded
   - Compliance checklist completed
   - Audit trail in place

---

## Phase 0 Timeline Estimate

| Task Category | Estimated Time | Status |
|--------------|----------------|--------|
| MongoDB setup & validation | 2-3 hours | 🔄 In Progress |
| PNPM install & test | 30 minutes | ⏳ Pending |
| File size refactoring | 1-2 hours | ⏳ Pending |
| CI hardening | 1 hour | ⏳ Pending |
| Documentation updates | 1 hour | ⏳ Pending |
| **Total remaining** | **5-7 hours** | |

---

## Next Actions (Immediate)

**Run these commands on your i9 to complete MongoDB setup:**

```bash
# 1. Navigate to project
cd /mnt/c/repos/harmonia

# 2. Generate secure passwords
echo "MONGO_ROOT_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "MONGO_HARMONIA_PASSWORD=$(openssl rand -base64 32)" >> .env

# 3. Display passwords (save these!)
cat .env | grep MONGO

# 4. Start MongoDB
docker compose -f docker-compose.mongo.yml up -d

# 5. Wait for health check (10-20 seconds)
docker ps

# 6. Test connection
docker exec -it harmonia-mongo-i9 mongosh -u admin -p "$(grep MONGO_ROOT_PASSWORD .env | cut -d '=' -f2)" --authenticationDatabase admin

# 7. In mongosh, verify setup:
use harmonia
show collections
db.model_artifacts.find()
exit

# 8. Access Mongo Express
# Open browser: http://localhost:8081
# Username: harmonia
# Password: <MONGO_HARMONIA_PASSWORD from .env>

# 9. Run migration
export MONGO_URI="mongodb://harmonia_app:$(grep MONGO_HARMONIA_PASSWORD .env | cut -d '=' -f2)@localhost:27017/harmonia?authSource=harmonia"
node scripts/migrate_inventory_to_db.js

# 10. Verify data migrated
docker exec -it harmonia-mongo-i9 mongosh -u harmonia_app -p "$(grep MONGO_HARMONIA_PASSWORD .env | cut -d '=' -f2)" harmonia
db.model_artifacts.countDocuments()
exit
```

---

## Post Phase 0 (Phase 1 Preview)

Once Phase 0 is complete, we will:
- Scaffold Angular frontend with Material Design 3 + NGRX
- Create NestJS backend with DTOs, controllers, services
- Connect backend to MongoDB using Mongoose models
- Implement authentication (JWT + sessions)
- Build first features (model browsing, inventory viewer)

**Phase 0 is the foundation. Take time to get it right.**
