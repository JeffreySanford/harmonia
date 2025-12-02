# Local MongoDB Setup Guide

This document explains when to use in-memory MongoDB vs. a real MongoDB instance, and how to set up a local MongoDB server on your i9 machine.

## When to Use Each

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

## Setting Up MongoDB on i9 Locally

### Option 1: Docker (Recommended)

Create `docker-compose.mongo.yml`:

```yaml
version: '3.8'

services:
  mongo:
    image: mongo:7
    container_name: harmonia-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: harmonia
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:-changeme}
      MONGO_INITDB_DATABASE: harmonia
    volumes:
      - mongo-data:/data/db
      - mongo-config:/data/configdb
      - ./scripts/mongo-init:/docker-entrypoint-initdb.d
    command: --wiredTigerCacheSizeGB 4

  mongo-express:
    image: mongo-express:latest
    container_name: harmonia-mongo-ui
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: harmonia
      ME_CONFIG_MONGODB_ADMINPASSWORD: ${MONGO_PASSWORD:-changeme}
      ME_CONFIG_MONGODB_URL: mongodb://harmonia:${MONGO_PASSWORD:-changeme}@mongo:27017/
    depends_on:
      - mongo

volumes:
  mongo-data:
  mongo-config:
```

Start the server:

```bash
# Create password in .env
echo "MONGO_PASSWORD=your_secure_password_here" >> .env

# Start MongoDB
docker compose -f docker-compose.mongo.yml up -d

# Check logs
docker logs harmonia-mongo

# Access Mongo Express UI
# Open http://localhost:8081 in browser
```

Connection string for local development:

```bash
export MONGO_URI="mongodb://harmonia:your_secure_password_here@localhost:27017/harmonia?authSource=admin"
```

### Option 2: Native Installation (Windows)

1. Download MongoDB Community Server from [mongodb.com](https://www.mongodb.com/try/download/community)

2. Install with custom options:
   - Install location: `C:\Program Files\MongoDB\Server\7.0`
   - Data directory: `C:\data\db`
   - Log directory: `C:\data\log`

3. Run as Windows Service or manually:

```powershell
# Manual start
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath C:\data\db

# Or install as service (as admin)
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --install --serviceName MongoDB --dbpath C:\data\db --logpath C:\data\log\mongod.log
```

1. Install MongoDB Shell (mongosh):

```powershell
# Download from mongodb.com/try/download/shell
# Add to PATH
```

### Option 3: WSL2 MongoDB (if using WSL)

```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install
sudo apt update
sudo apt install -y mongodb-org

# Start service
sudo systemctl start mongod
sudo systemctl enable mongod

# Check status
sudo systemctl status mongod
```

## Recommended Setup for Harmonia Development

### Local i9 Setup Strategy

1. **Run MongoDB in Docker** (easiest, most portable):

   ```bash
   docker compose -f docker-compose.mongo.yml up -d
   ```

2. **Configure connection in `.env`**:

   ```bash
   MONGO_URI=mongodb://harmonia:your_password@localhost:27017/harmonia?authSource=admin
   ```

3. **Use in-memory for tests**:
   - Unit tests automatically use `mongodb-memory-server`
   - No configuration needed for tests
   - Tests run isolated from dev DB

4. **Migration workflow**:

   ```bash
   # Run migration to populate local MongoDB
   MONGO_URI="mongodb://harmonia:password@localhost:27017/harmonia?authSource=admin" node scripts/migrate_inventory_to_db.js
   ```

### Performance Tuning for i9

In `docker-compose.mongo.yml`, adjust based on your i9 specs:

```yaml
command: [
  "--wiredTigerCacheSizeGB", "8",  # Use ~50% of available RAM for MongoDB
  "--maxConns", "1000"
]
```

For native install, create `C:\data\mongod.cfg`:

```yaml
systemLog:
  destination: file
  path: C:\data\log\mongod.log
storage:
  dbPath: C:\data\db
  wiredTiger:
    engineConfig:
      cacheSizeGB: 8
net:
  port: 27017
  bindIp: 127.0.0.1
```

## Connecting from Your Code

### TypeScript/Node (using Mongoose)

```typescript
import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/harmonia';

await mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
```

### Python (using pymongo)

```python
from pymongo import MongoClient

mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
client = MongoClient(mongo_uri)
db = client['harmonia']
```

## Backup Strategy

### Docker volumes backup

```bash
# Backup
docker run --rm -v harmonia_mongo-data:/data -v $(pwd)/backups:/backup ubuntu tar czf /backup/mongo-backup-$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm -v harmonia_mongo-data:/data -v $(pwd)/backups:/backup ubuntu tar xzf /backup/mongo-backup-20251202.tar.gz -C /
```

## Summary Recommendation

**For your i9 setup:**

- ✅ Use Docker MongoDB for local development (persistent data)
- ✅ Keep `mongodb-memory-server` for unit tests and CI
- ✅ Run `migrate_inventory_to_db.js` to seed local MongoDB from inventory files
- ✅ Use Mongo Express (web UI) for quick data inspection
- ✅ Configure connection string in `.env` (never commit to repo)

This gives you the best of both worlds: fast, isolated tests with memory-server, and a production-like environment for development work.
