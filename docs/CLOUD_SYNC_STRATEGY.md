# Cloud Sync Strategy

**Architecture for syncing MongoDB Community Edition to cloud storage with future migration path.**

---

## Overview

**Current Setup:** MongoDB Community Edition on i9 (localhost)  
**Future Goal:** Selective sync to jeffreysanford.us or cloud provider  
**Design Principle:** Cloud-ready architecture without immediate implementation

---

## MongoDB Community Edition for Long-Term Storage

### ✅ MongoDB Community is Suitable for Your Use Case

**Why Community Edition Works:**

1. **Full Feature Set for Local Development**
   - No data size limits (unlimited storage)
   - All CRUD operations, indexes, aggregations
   - Replica sets support (for HA later)
   - Change streams (for sync triggers)

2. **Production-Grade Reliability**
   - ACID transactions
   - Point-in-time backups via mongodump
   - Binary replication logs (oplog)
   - Crash recovery and journaling

3. **Long-Term Storage Characteristics**
   - Models: ~100GB+ (static, rarely changes)
   - Metadata: <1GB (dynamic, frequent updates)
   - Logs/Events: <10GB/year (append-only)
   - **Total Growth:** ~1-2GB/month (sustainable for years)

4. **Limitations That Don't Affect You**
   - ❌ No MongoDB Atlas automatic scaling (not needed for single-node)
   - ❌ No Atlas monitoring/alerting (can use Prometheus/Grafana)
   - ❌ No cross-region replication (not needed yet)

**Verdict:** MongoDB Community Edition is perfect for 3-5 years of local development before considering Enterprise/Atlas.

---

## Cloud Sync Architecture (Future-Ready)

### Design Principles

1. **Separation of Concerns**
   - **Hot Data:** MongoDB on i9 (primary source of truth)
   - **Cold Storage:** Cloud object storage (S3/GCS/Azure Blob)
   - **Metadata Sync:** Lightweight API to jeffreysanford.us

2. **Incremental Sync Strategy**
   - Sync daily backups to cloud (full dumps)
   - Sync metadata changes in real-time (API calls)
   - Models remain local (too large, rarely accessed remotely)

3. **Minimal Remote Footprint**
   - No full MongoDB on jeffreysanford.us (too resource-heavy)
   - Lightweight metadata API (Express.js + SQLite or JSON store)
   - Static file server for documentation

---

## Phase 1: Cloud-Ready Local Setup (Current)

### Infrastructure Components

```plaintext
┌─────────────────────────────────────────┐
│          i9 Development Machine         │
│                                         │
│  ┌─────────────┐    ┌──────────────┐  │
│  │  MongoDB    │───▶│   Backups    │  │
│  │  Community  │    │  (mongodump) │  │
│  │   (Docker)  │    └──────────────┘  │
│  └─────────────┘           │           │
│         │                  │           │
│         ▼                  ▼           │
│  ┌─────────────┐    ┌──────────────┐  │
│  │   Mongoose  │    │  Seed Files  │  │
│  │    Models   │    │    (JSON)    │  │
│  └─────────────┘    └──────────────┘  │
│         │                  │           │
│         ▼                  ▼           │
│  ┌───────────────────────────────────┐│
│  │   NestJS API (Future)             ││
│  │   - REST endpoints                ││
│  │   - WebSocket events              ││
│  │   - Cloud sync triggers           ││
│  └───────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**Current State:**

- ✅ MongoDB with persistent volumes
- ✅ Daily backups with mongodump
- ✅ JSON seed files for DR
- ✅ Mongoose schemas with validation
- ⏳ NestJS API (Phase 1)

---

## Phase 2: Lightweight Cloud Metadata Sync (Future)

### Option A: jeffreysanford.us Lightweight API

**Architecture:**

```plaintext
i9 MongoDB ──(API calls)──▶ jeffreysanford.us
    │                           │
    │                      ┌────▼─────┐
    └──(Daily backup)─────▶│  SQLite  │
                           │  or JSON │
                           └──────────┘
                                 │
                           ┌─────▼──────┐
                           │   Public   │
                           │ Read-Only  │
                           │    API     │
                           └────────────┘
```

**jeffreysanford.us Components:**

- **Lightweight Node.js API** (Express.js, <50MB RAM)
- **SQLite database** (metadata only, <100MB)
- **Static file server** (documentation, inventories)
- **No MongoDB** (avoids 500MB+ RAM overhead)

**What Gets Synced:**

- ✅ Model metadata (name, size, license, source URL)
- ✅ Inventory summaries (JSON files)
- ✅ License manifests
- ✅ Documentation (static HTML/MD)
- ❌ **NOT** model weights (too large, stored locally)
- ❌ **NOT** datasets (too large, stored locally)

**Implementation Steps (Future):**

1. Create NestJS endpoint: `POST /api/sync/metadata`
2. Deploy Express.js API to jeffreysanford.us
3. Set up cron job on i9 to push metadata daily
4. Expose read-only API: `GET /api/models`

---

### Option B: Cloud Object Storage Only

**Architecture:**

```plaintext
i9 MongoDB ──(Daily backup)──▶ S3/GCS/Azure Blob
    │                               │
    └────────────────────────────────┘
         (Restore from cloud)
```

**Cloud Storage Options:**

1. **AWS S3** ($0.023/GB/month)
   - ~$3/month for backups (100GB compressed ~10GB)
   - Lifecycle policies (delete old backups)
   - Versioning for safety

2. **Google Cloud Storage** ($0.020/GB/month)
   - Similar pricing to S3
   - Better egress costs (free to GCP services)

3. **Backblaze B2** ($0.005/GB/month)
   - **Cheapest option**: ~$1/month for 100GB
   - S3-compatible API
   - 3x cheaper than AWS

4. **Azure Blob Storage** ($0.018/GB/month)
   - Good if already in Azure ecosystem

**What Gets Synced:**

- ✅ Daily mongodump archives (.archive.gz)
- ✅ Seed files (JSON)
- ✅ Checksums and inventories
- ✅ Encrypted backups (GPG or AES-256)

**Implementation Steps (Future):**

1. Install AWS CLI / gsutil / rclone
2. Configure encrypted backup script
3. Set up daily upload cron job
4. Implement retention policy (30 days)

---

## Phase 3: Full Cloud Migration (3-5 Years Out)

### Option C: MongoDB Atlas (When Scale Demands It)

**When to Migrate:**

- Multiple users accessing remotely
- Need for high availability (99.9%+ uptime)
- Cross-region replication required
- Data exceeds 500GB
- Team collaboration needs cloud access

**MongoDB Atlas Pricing (Estimate):**

- **M10 Shared Cluster:** $57/month (10GB storage, 2GB RAM)
- **M30 Dedicated:** $305/month (40GB storage, 8GB RAM, backups)
- **M40 Dedicated:** $580/month (80GB storage, 16GB RAM)

**Migration Path:**

1. Export via mongodump from i9
2. Create Atlas cluster (M10 to start)
3. Import via mongorestore to Atlas
4. Update connection strings in NestJS
5. Keep i9 as warm standby

---

## Recommended Approach

### Immediate (Phase 0): Local-First, Cloud-Ready

**Implementation:**

- ✅ Use MongoDB Community Edition on i9
- ✅ Daily backups with mongodump (already implemented)
- ✅ JSON seed files for quick restores
- ⏳ Add encryption to backups (GPG)
- ⏳ Document cloud sync interfaces

**No Cloud Costs:** $0/month

---

### Short-Term (Phase 1-2): Lightweight Cloud Backup

**Implementation:**

- Create encrypted backup sync to Backblaze B2 ($1-2/month)
- Deploy lightweight metadata API to jeffreysanford.us (read-only)
- Keep all models and heavy data local
- Expose public inventory API (no authentication needed)

**Cloud Costs:** $1-5/month

**Files to Create (Future):**

```plaintext
scripts/
  sync-to-cloud.sh          # Upload backups to B2/S3
  restore-from-cloud.sh     # Download and restore from cloud
  encrypt-backup.sh         # GPG encrypt before upload

docs/
  CLOUD_BACKUP.md           # Backup sync documentation
  JEFFREYSANFORD_DEPLOY.md  # Deployment guide for metadata API
```

---

### Long-Term (Phase 3+): Cloud-Native

**Implementation:**

- Migrate to MongoDB Atlas when team grows
- Or: Self-host MongoDB on AWS/GCP/Azure
- Full cloud infrastructure (Kubernetes, load balancers)

**Cloud Costs:** $50-500/month (depending on scale)

---

## Security Considerations

### Data Classification

1. **Public (Can Sync to jeffreysanford.us)**
   - Model metadata (names, sizes, licenses)
   - Inventories and checksums
   - Documentation
   - License manifests

2. **Private (Keep on i9)**
   - Model weights (100GB+)
   - Training datasets
   - Intermediate artifacts
   - User data (if any)

3. **Encrypted Cloud Storage**
   - Backup archives (mongodump)
   - Seed files with sensitive data
   - Use GPG or AWS KMS

---

## Cloud Sync Interface Design (Future)

### NestJS Sync Service (Phase 1)

**Create cloud-ready service with no implementation:**

```typescript
// src/services/cloud-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';

export interface SyncConfig {
  provider: 'jeffreysanford' | 's3' | 'gcs' | 'backblaze' | 'none';
  endpoint?: string;
  apiKey?: string;
  bucket?: string;
  enabled: boolean;
}

@Injectable()
export class CloudSyncService {
  private readonly logger = new Logger(CloudSyncService.name);
  private config: SyncConfig;

  constructor() {
    // Load from environment or config
    this.config = {
      provider: 'none',
      enabled: false,
    };
  }

  /**
   * Sync metadata to cloud (future implementation)
   */
  async syncMetadata(data: any): Promise<void> {
    if (!this.config.enabled) {
      this.logger.debug('Cloud sync disabled, skipping metadata sync');
      return;
    }

    // TODO: Implement when cloud endpoint ready
    this.logger.warn('Cloud sync not yet implemented');
  }

  /**
   * Upload backup to cloud storage (future implementation)
   */
  async uploadBackup(filePath: string): Promise<void> {
    if (!this.config.enabled) {
      this.logger.debug('Cloud sync disabled, skipping backup upload');
      return;
    }

    // TODO: Implement S3/GCS/Backblaze upload
    this.logger.warn('Cloud backup upload not yet implemented');
  }

  /**
   * Check if cloud sync is available
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
```

**Environment Variables (Add to `.env.example`):**

```bash
# Cloud Sync Configuration (Future)
CLOUD_SYNC_ENABLED=false
CLOUD_SYNC_PROVIDER=none
# CLOUD_SYNC_PROVIDER=jeffreysanford
# CLOUD_SYNC_ENDPOINT=https://api.jeffreysanford.us/sync
# CLOUD_SYNC_API_KEY=your_api_key_here
```

---

## Storage Sizing Estimates

### Current Storage Needs (i9)

```plaintext
models/                    ~100GB   (static, rarely changes)
datasets/                  ~50GB    (static, rarely changes)
MongoDB data/              ~1GB     (grows ~100MB/month)
backups/mongo/             ~10GB    (compressed, 7-day retention)
seeds/                     ~10MB    (JSON, negligible)
logs/                      ~1GB/year
─────────────────────────────────────
Total:                     ~162GB   
Growth Rate:               ~1-2GB/month
```

### Cloud Storage Needs (Future)

**Scenario 1: Backup-Only (Recommended)**

```plaintext
Daily backups (7 days)     ~10GB    ($0.05-0.23/month)
Seed files                 ~10MB    (negligible)
─────────────────────────────────────
Total:                     ~10GB    
Monthly Cost:              $0.05-2/month (Backblaze to AWS)
```

**Scenario 2: Metadata Sync to jeffreysanford.us**

```plaintext
Metadata database          ~100MB   (SQLite or JSON)
Static files               ~50MB    (docs, inventories)
API server RAM             ~50MB    (Node.js Express)
─────────────────────────────────────
Total:                     ~200MB   
Monthly Cost:              $0 (fits on small server)
```

**Scenario 3: Full Cloud Migration (Not Recommended Yet)**

```plaintext
MongoDB Atlas M30          ~150GB   ($305/month)
Object storage             ~10GB    ($0.20/month)
Egress fees                ~10GB    ($1/month)
─────────────────────────────────────
Monthly Cost:              ~$306/month
```

---

## Implementation Checklist

### ✅ Already Implemented (Phase 0)

- [x] MongoDB Community Edition with Docker
- [x] Persistent volumes for data
- [x] Daily backup script (mongodump)
- [x] JSON seed files for DR
- [x] Backup retention (7 days)

### ⏳ Cloud-Ready Preparation (Phase 1)

- [ ] Add backup encryption (GPG)
- [ ] Create cloud sync service stub (NestJS)
- [ ] Document cloud sync interfaces
- [ ] Add `CLOUD_SYNC_ENABLED=false` to .env

### 🔮 Future Implementation (Phase 2+)

- [ ] Set up Backblaze B2 or S3 account
- [ ] Implement automated cloud backup upload
- [ ] Deploy lightweight metadata API to jeffreysanford.us
- [ ] Create public read-only inventory endpoint
- [ ] Add cloud restore scripts

---

## Conclusion

**Answer: Yes, MongoDB Community Edition is perfect for long-term storage.**

**Recommended Strategy:**

1. **Now:** Keep everything local on i9 with daily backups (Phase 0)
2. **3-6 months:** Add encrypted cloud backups to Backblaze B2 ($1-2/month)
3. **6-12 months:** Deploy lightweight metadata API to jeffreysanford.us (read-only)
4. **3+ years:** Consider MongoDB Atlas if team/scale demands it

**Key Insight:** Your models are static (100GB) and rarely change. MongoDB is overkill for cloud sync—just sync metadata (1MB) and keep models local. Use object storage (S3/B2) for disaster recovery backups only.

**Next Steps:**

1. Complete MongoDB installation on i9 (10 min)
2. Test backup/restore workflow (5 min)
3. Document cloud sync interfaces (no implementation)
4. Revisit cloud sync when you have remote access needs

---

## References

- MongoDB Community vs Enterprise: <https://www.mongodb.com/community/licensing>
- MongoDB Atlas Pricing: <https://www.mongodb.com/pricing>
- Backblaze B2 Pricing: <https://www.backblaze.com/b2/cloud-storage-pricing.html>
- AWS S3 Pricing: <https://aws.amazon.com/s3/pricing/>
