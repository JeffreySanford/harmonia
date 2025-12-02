# i9 MongoDB Installation & Security Guide

**Step-by-step guide to install, secure, and configure MongoDB on your i9 Windows machine for Harmonia development.**

---

## Prerequisites

- Windows 11 with WSL2 enabled (or Windows 10 with WSL2)
- Docker Desktop installed and running
- At least 8GB RAM available for MongoDB
- Administrative access

---

## Installation Steps

### Step 1: Prepare Environment

```bash
# From bash/WSL terminal
cd /mnt/c/repos/harmonia

# Create secure password
# Generate a strong password and save to .env
echo "MONGO_ROOT_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "MONGO_HARMONIA_PASSWORD=$(openssl rand -base64 32)" >> .env

# Display passwords (save these securely)
cat .env | grep MONGO
```

### Step 2: Create Docker Compose Configuration

Create `docker-compose.mongo.yml`:

```yaml
version: '3.8'

services:
  mongo:
    image: mongo:7.0
    container_name: harmonia-mongo-i9
    restart: unless-stopped
    ports:
      - "127.0.0.1:27017:27017"  # Bind to localhost only
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: harmonia
    volumes:
      - mongo-data:/data/db
      - mongo-config:/data/configdb
      - ./backups/mongo:/backups
      - ./scripts/mongo-init:/docker-entrypoint-initdb.d:ro
    networks:
      - harmonia-net
    command: >
      --auth
      --wiredTigerCacheSizeGB 8
      --maxConns 1000
      --bind_ip_all
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  mongo-express:
    image: mongo-express:1.0-20
    container_name: harmonia-mongo-ui
    restart: unless-stopped
    ports:
      - "127.0.0.1:8081:8081"  # Bind to localhost only
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: admin
      ME_CONFIG_MONGODB_ADMINPASSWORD: ${MONGO_ROOT_PASSWORD}
      ME_CONFIG_MONGODB_URL: mongodb://admin:${MONGO_ROOT_PASSWORD}@mongo:27017/
      ME_CONFIG_BASICAUTH_USERNAME: harmonia
      ME_CONFIG_BASICAUTH_PASSWORD: ${MONGO_HARMONIA_PASSWORD}
    depends_on:
      mongo:
        condition: service_healthy
    networks:
      - harmonia-net

networks:
  harmonia-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16

volumes:
  mongo-data:
    driver: local
  mongo-config:
    driver: local
```

### Step 3: Create MongoDB Initialization Script

Create `scripts/mongo-init/01-init-harmonia-db.js`:

```javascript
// MongoDB initialization script - runs on first container start
db = db.getSiblingDB('harmonia');

// Create application user with limited permissions
db.createUser({
  user: 'harmonia_app',
  pwd: process.env.MONGO_HARMONIA_PASSWORD || 'changeme',
  roles: [
    {
      role: 'readWrite',
      db: 'harmonia'
    }
  ]
});

// Create collections with validation schemas
db.createCollection('model_artifacts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'version', 'path', 'size_bytes'],
      properties: {
        name: { bsonType: 'string' },
        version: { bsonType: 'string' },
        path: { bsonType: 'string' },
        size_bytes: { bsonType: 'number' }
      }
    }
  }
});

db.createCollection('licenses');
db.createCollection('inventory_versions');
db.createCollection('jobs');
db.createCollection('events');

// Create indexes
db.model_artifacts.createIndex({ name: 1, version: 1 }, { unique: true });
db.model_artifacts.createIndex({ tags: 1 });
db.jobs.createIndex({ status: 1, worker_id: 1 });
db.events.createIndex({ created_at: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

print('Harmonia database initialized successfully');
```

### Step 4: Start MongoDB

```bash
# From project root
docker compose -f docker-compose.mongo.yml up -d

# Check logs
docker logs harmonia-mongo-i9

# Verify health
docker ps
# Should show harmonia-mongo-i9 as "healthy"
```

### Step 5: Test Connection

```bash
# Install mongosh if not present
# Windows: Download from https://www.mongodb.com/try/download/shell

# Test connection
docker exec -it harmonia-mongo-i9 mongosh -u admin -p "${MONGO_ROOT_PASSWORD}" --authenticationDatabase admin

# In mongosh:
use harmonia
show collections
db.model_artifacts.find()
exit
```

---

## Security Configuration

### Network Security

**Firewall Rules (Windows Defender):**

```powershell
# Run as Administrator in PowerShell
# Block external access to MongoDB port
New-NetFirewallRule -DisplayName "Block MongoDB External" -Direction Inbound -LocalPort 27017 -Protocol TCP -Action Block -RemoteAddress Internet

# Allow localhost only
New-NetFirewallRule -DisplayName "Allow MongoDB Localhost" -Direction Inbound -LocalPort 27017 -Protocol TCP -Action Allow -RemoteAddress 127.0.0.1
```

**Docker Compose Security:**

- Ports bound to `127.0.0.1` only (no external access)
- Custom bridge network with subnet isolation
- Read-only mount for init scripts

### Authentication & Authorization

**User Roles:**

- `admin` (root): Full administrative access
- `harmonia_app`: Read/write access to `harmonia` database only

**Connection Strings:**

```bash
# For admin operations (backups, user management)
MONGO_ADMIN_URI="mongodb://admin:${MONGO_ROOT_PASSWORD}@localhost:27017/admin?authSource=admin"

# For application (Node.js/Python)
MONGO_URI="mongodb://harmonia_app:${MONGO_HARMONIA_PASSWORD}@localhost:27017/harmonia?authSource=harmonia"
```

Add to `.env`:

```bash
MONGO_ADMIN_URI=mongodb://admin:YOUR_ROOT_PASSWORD@localhost:27017/admin?authSource=admin
MONGO_URI=mongodb://harmonia_app:YOUR_APP_PASSWORD@localhost:27017/harmonia?authSource=harmonia
```

### Secrets Management

**Never commit credentials to git:**

```bash
# Verify .gitignore includes
cat .gitignore | grep -E "\.env$|docker-compose\.override"

# If not present, add:
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
echo "docker-compose.override.yml" >> .gitignore
```

**Rotate passwords regularly:**

```bash
# Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# Update in MongoDB
docker exec -it harmonia-mongo-i9 mongosh -u admin -p "${MONGO_ROOT_PASSWORD}" --authenticationDatabase admin --eval "
  db.getSiblingDB('harmonia').changeUserPassword('harmonia_app', '${NEW_PASSWORD}')
"

# Update .env
sed -i "s/MONGO_HARMONIA_PASSWORD=.*/MONGO_HARMONIA_PASSWORD=${NEW_PASSWORD}/" .env
```

---

## Performance Tuning for i9

### Memory Configuration

**Recommended settings for i9 with 32GB RAM:**

```yaml
# In docker-compose.mongo.yml
command: >
  --auth
  --wiredTigerCacheSizeGB 12      # ~40% of total RAM
  --maxConns 2000                  # High connection limit for dev
  --slowOpThresholdMs 100          # Log slow queries
  --logLevel info
```

**If running other heavy services (inference), reduce to 8GB.**

### Disk I/O Optimization

**Use SSD volume for data:**

```yaml
volumes:
  mongo-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: C:/mongo-data  # Place on fastest SSD
```

**Enable compression:**

```yaml
command: >
  --wiredTigerCollectionBlockCompressor snappy
  --wiredTigerIndexPrefixCompression true
```

### Connection Pooling

**Node.js (Mongoose):**

```typescript
mongoose.connect(process.env.MONGO_URI!, {
  maxPoolSize: 50,
  minPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
});
```

---

## Backup Strategy

### Automated Backups

Create `scripts/backup-mongo.sh`:

```bash
#!/bin/bash
BACKUP_DIR="./backups/mongo/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Dump database
docker exec harmonia-mongo-i9 mongodump \
  --username admin \
  --password "${MONGO_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  --db harmonia \
  --gzip \
  --archive="/backups/harmonia_$(date +%Y%m%d_%H%M%S).archive.gz"

# Keep last 7 days only
find ./backups/mongo -name "*.archive.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
```

**Schedule with cron (WSL) or Task Scheduler (Windows):**

```bash
# Add to crontab
crontab -e
# Add: 0 2 * * * /mnt/c/repos/harmonia/scripts/backup-mongo.sh
```

### Restore Procedure

```bash
# List backups
ls -lh backups/mongo/

# Restore from backup
BACKUP_FILE="backups/mongo/harmonia_20251202_020000.archive.gz"

docker exec -i harmonia-mongo-i9 mongorestore \
  --username admin \
  --password "${MONGO_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  --db harmonia \
  --gzip \
  --archive="/backups/$(basename $BACKUP_FILE)" \
  --drop
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Check MongoDB status
docker exec harmonia-mongo-i9 mongosh \
  -u admin -p "${MONGO_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  --eval "db.serverStatus()"

# Check disk usage
docker exec harmonia-mongo-i9 mongosh \
  -u admin -p "${MONGO_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  --eval "db.stats(1024*1024)" harmonia
```

### Log Monitoring

```bash
# Follow logs
docker logs -f harmonia-mongo-i9

# Search for slow queries
docker logs harmonia-mongo-i9 | grep "Slow query"
```

### Compact Database

```bash
# Run monthly to reclaim space
docker exec harmonia-mongo-i9 mongosh \
  -u admin -p "${MONGO_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  harmonia \
  --eval "db.runCommand({compact: 'model_artifacts'})"
```

---

## Troubleshooting

### Can't Connect

**Check container is running:**

```bash
docker ps | grep harmonia-mongo
```

**Check firewall:**

```powershell
Get-NetFirewallRule -DisplayName "*MongoDB*"
```

**Check credentials:**

```bash
cat .env | grep MONGO
```

### Mongo Express Not Loading

**Check container logs:**

```bash
docker logs harmonia-mongo-ui
```

**Verify network connectivity:**

```bash
docker network inspect harmonia-net
```

### Performance Issues

**Check cache hit ratio:**

```bash
docker exec harmonia-mongo-i9 mongosh \
  -u admin -p "${MONGO_ROOT_PASSWORD}" \
  --eval "db.serverStatus().wiredTiger.cache"
```

**If cache ratio < 90%, increase `wiredTigerCacheSizeGB`.**

---

## Next Steps

1. ✅ Start MongoDB container
2. ✅ Test admin connection
3. ✅ Configure firewall rules
4. ⏳ Run migration: `MONGO_URI=<uri> node scripts/migrate_inventory_to_db.js`
5. ⏳ Access Mongo Express: `http://localhost:8081`
6. ⏳ Set up automated backups
7. ⏳ Update application `.env` with `MONGO_URI`

---

## Quick Reference

**Start/Stop:**

```bash
docker compose -f docker-compose.mongo.yml up -d     # Start
docker compose -f docker-compose.mongo.yml down      # Stop (keeps data)
docker compose -f docker-compose.mongo.yml down -v   # Stop and delete data
```

**Connect:**

```bash
# Via mongosh
docker exec -it harmonia-mongo-i9 mongosh -u harmonia_app -p <password> harmonia

# Via Mongo Express
# Browser: http://localhost:8081
# Username: harmonia
# Password: <MONGO_HARMONIA_PASSWORD>
```

**Backup:**

```bash
./scripts/backup-mongo.sh
```

**Monitor:**

```bash
docker stats harmonia-mongo-i9
docker logs -f harmonia-mongo-i9
```
