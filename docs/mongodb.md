# MongoDB Setup & Configuration Guide

## Overview

This guide covers MongoDB setup, security hardening, and schema design for Harmonia. The system uses a native MongoDB installation on Windows for optimal performance.

## When to Use Different MongoDB Configurations

### In-Memory MongoDB (mongodb-memory-server)

**Best for:**

- Unit tests
- CI/CD pipelines
- Quick prototyping
- Testing schema changes
- Ephemeral data scenarios

**Advantages:**

- No installation required
- Fast startup/teardown
- Isolated test environment
- No port conflicts
- Perfect for CI

**Limitations:**

- Data doesn't persist
- Single-instance only (no replication)
- Limited to test scenarios

### Real MongoDB Instance

**Best for:**

- Local development
- Staging environments
- Persistent data needs
- Testing replica sets
- Performance testing
- Integration with other services

**Advantages:**

- Full MongoDB features
- Persistent storage
- Replica set support
- Production-like environment
- Better performance profiling

## Security Hardening Guide

### Security Layers

#### Layer 1: Network Isolation

**Configuration:**

```yaml
# mongod.cfg
net:
  bindIp: 127.0.0.1
  port: 27017
```

**What it does:**

- ✅ Binds MongoDB to localhost only
- ✅ Prevents external network access
- ✅ No internet exposure possible

**Verification:**

```bash
netstat -ano | grep :27017
# Should show: TCP    127.0.0.1:27017
```

#### Layer 2: Authentication & Authorization

**Configuration:**

```yaml
# mongod.cfg
security:
  authorization: enabled
```

**What it does:**

- ✅ Requires username/password for all connections
- ✅ Enables role-based access control
- ✅ Prevents anonymous access

**Verification:**

```javascript
// This should fail without credentials
db.runCommand({ connectionStatus: 1 })

// This should succeed with admin credentials
db.auth("admin", "your_secure_password")
```

#### Layer 3: User Management

**Default Users Created:**

```javascript
// Admin user (full access)
db.createUser({
  user: "admin",
  pwd: "secure_admin_password",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

// Application user (limited access)
db.createUser({
  user: "harmonia_app",
  pwd: "secure_app_password",
  roles: [
    { role: "readWrite", db: "harmonia" },
    { role: "dbAdmin", db: "harmonia" }
  ]
})
```

**What it does:**

- ✅ Separate admin and application users
- ✅ Principle of least privilege
- ✅ Application user can't modify system or other databases

#### Layer 4: Encryption at Rest (Optional)

**Configuration:**

```yaml
# mongod.cfg
security:
  enableEncryption: true
  encryptionKeyFile: /path/to/keyfile
```

**What it does:**

- 🔒 Encrypts data files on disk
- 🔒 Protects against physical theft
- 🔒 Required for HIPAA/FIPS compliance

#### Layer 5: Audit Logging (Enterprise)

**Configuration:**

```yaml
# mongod.cfg
auditLog:
  destination: file
  format: JSON
  path: /var/log/mongodb/audit.log
```

**What it does:**

- 📊 Logs all database operations
- 📊 Tracks user actions for compliance
- 📊 Helps with security investigations

### Security Checklist

#### ✅ Implemented

- [x] Network binding to localhost only
- [x] Authentication enabled
- [x] Role-based access control
- [x] Strong passwords (32-char)
- [x] Passwords stored in .env (not committed)
- [x] Separate admin and application users
- [x] Least privilege principle applied
- [x] Config file backed up before changes
- [x] Service restart after hardening

#### 🟡 Recommended for Production

- [ ] TLS/SSL encryption (required for external access)
- [ ] Audit logging enabled (Enterprise feature)
- [ ] IP whitelisting (if exposing to network)
- [ ] VPN access only
- [ ] Regular security audits
- [ ] Automated backup verification
- [ ] Intrusion detection system
- [ ] Rate limiting on connections

## Schema Design Guide

### Schema Principles

- **Aggregate roots**: Model collections around aggregate roots (e.g., `model_artifacts`, `inventory_versions`, `jobs`) — keep each aggregate's invariants in a single place.
- **Normalized references**: Use `ObjectId` references for shared resources, avoid duplicating large binary payloads.
- **Small embedded documents**: Embed small immutable snapshots inside parent documents when it improves read performance and the embedded data is immutable.

### Core Collections

#### model_artifacts

```typescript
interface ModelArtifact {
  name: string;
  version: string;
  path: string; // s3/path or local path
  size_bytes: number;
  hashes: { sha256: string };
  license_id: ObjectId; // -> licenses
  tags: string[];
  created_at: Date;
  created_by: string;
}
```

#### licenses

```typescript
interface License {
  spdx_id: string;
  text_path: string; // local path or object storage pointer
  commercial_use: boolean;
  notes: string;
}
```

#### inventory_versions

```typescript
interface InventoryVersion {
  version_tag: string;
  artifact_ids: ObjectId[]; // -> model_artifacts
  datasets: ObjectId[]; // -> datasets
  published_by: string;
  published_at: Date;
}
```

#### jobs

```typescript
interface Job {
  type: 'download' | 'validate' | 'inference';
  status: 'pending' | 'running' | 'success' | 'failed';
  worker_id: string;
  params: any; // stored as JSON
  logs: string[]; // embedded tail log
  started_at: Date;
  finished_at?: Date;
}
```

### Mongoose Schema Patterns

Use `type` + `interface` to keep TypeScript types in sync with Mongoose schemas.

```typescript
// src/models/modelArtifact.ts
import { Schema, Document } from 'mongoose';

export interface IModelArtifact extends Document {
  name: string;
  version: string;
  path: string;
  size_bytes: number;
  hashes: { sha256: string };
  license_id: Schema.Types.ObjectId;
  tags: string[];
  created_at: Date;
  created_by: string;
}

const ModelArtifactSchema = new Schema<IModelArtifact>({
  name: { type: String, required: true },
  version: { type: String, required: true },
  path: { type: String, required: true },
  size_bytes: { type: Number, required: true },
  hashes: {
    sha256: { type: String, required: true }
  },
  license_id: { type: Schema.Types.ObjectId, ref: 'License', required: true },
  tags: [{ type: String }],
  created_at: { type: Date, default: Date.now },
  created_by: { type: String, required: true }
});

// Indexes for performance
ModelArtifactSchema.index({ name: 1, version: 1 }, { unique: true });
ModelArtifactSchema.index({ tags: 1 });
ModelArtifactSchema.index({ created_at: -1 });

export default ModelArtifactSchema;
```

## Installation & Setup

### Native MongoDB Installation (Current Production)

1. **Download MongoDB Community Server**

   ```bash
   # Download from https://www.mongodb.com/try/download/community
   # Choose Windows MSI installer
   ```

2. **Install as Windows Service**

   ```bash
   # Run MSI installer as Administrator
   # Choose "Complete" installation
   # Install MongoDB Compass if desired
   ```

3. **Configure Data Directory**

   ```bash
   # Create data directory
   mkdir "C:\Program Files\MongoDB\Server\8.0\data"
   ```

4. **Update Configuration**

   ```yaml
   # C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg
   storage:
     dbPath: "C:\\Program Files\\MongoDB\\Server\\8.0\\data"

   net:
     bindIp: 127.0.0.1
     port: 27017

   security:
     authorization: enabled
   ```

5. **Install as Service**

   ```bash
   mongod --config "C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg" --install
   ```

6. **Start Service**

   ```bash
   net start MongoDB
   ```

### Initial Database Setup

1. **Connect as Admin**

   ```bash
   mongo --port 27017
   ```

2. **Create Admin User**

   ```javascript
   use admin
   db.createUser({
     user: "admin",
     pwd: "your_secure_admin_password",
     roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
   })
   ```

3. **Create Application Database**

   ```javascript
   use harmonia
   db.createUser({
     user: "harmonia_app",
     pwd: "your_secure_app_password",
     roles: [
       { role: "readWrite", db: "harmonia" },
       { role: "dbAdmin", db: "harmonia" }
     ]
   })
   ```

4. **Create Collections**

   ```javascript
   db.createCollection("model_artifacts")
   db.createCollection("licenses")
   db.createCollection("inventory_versions")
   db.createCollection("jobs")
   db.createCollection("events")
   ```

### Environment Configuration

```bash
# .env file
MONGODB_URI=mongodb://harmonia_app:your_secure_app_password@localhost:27017/harmonia
MONGODB_ADMIN_URI=mongodb://admin:your_secure_admin_password@localhost:27017/admin
```

## Backup & Recovery

### Automated Backups

```bash
# Daily backup script (backup-mongo.sh)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --db harmonia --out /backups/harmonia_$DATE
```

### Point-in-Time Recovery

```bash
# Restore from backup
mongorestore --db harmonia /backups/harmonia_20241204_120000/harmonia
```

## Monitoring & Maintenance

### Key Metrics to Monitor

- Connection count
- Memory usage
- Disk I/O
- Query performance
- Replication lag (if using replica sets)

### Maintenance Tasks

- Regular index optimization
- Collection compaction
- Log rotation
- Security updates
