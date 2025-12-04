# Docker Setup Guide for Harmonia

## Overview

Harmonia uses Docker for ML/music generation workloads. The application database (MongoDB) runs natively on Windows for better performance and easier management. This guide covers Docker setup, management, and best practices.

## Services

### Active Services

1. **ML/Music Generation Container** (`harmonia-dev`)
   - Port: `8000`
   - Image: `harmonia-harmonia` (618 MB)
   - Purpose: Python/MusicGen music generation
   - Commands: `pnpm run docker:ml:start/stop/shell`

### Native Services (Not Docker)

1. **MongoDB 8.0** (Native Windows Service)
   - Port: `127.0.0.1:27017`
   - Service: `MongoDB Server (MongoDB)`
   - See: `docs/MONGODB_SECURITY.md`, `docs/I9_MONGODB_INSTALL.md`

### Optional Services

1. **Worker Container** (`harmonia/worker:dev`)
   - Alternative ML inference worker with NVIDIA GPU support
   - Not currently used (harmonia-dev is primary ML container)
   - Requires: NVIDIA Container Toolkit

## Quick Start

### Starting the Application

```bash
# Start both frontend and backend (auto-checks MongoDB)
pnpm run dev

# MongoDB check runs automatically via "predev" hook
```

### Starting ML Container (For Music Generation)

```bash
# Start ML/music generation container
pnpm run docker:ml:start

# Open shell in container
pnpm run docker:ml:shell

# Stop ML container
pnpm run docker:ml:stop
```

### Checking MongoDB

```bash
# Verify MongoDB is running (native Windows service)
powershell -c "Get-Service MongoDB"

# Or use the pre-dev check
bash scripts/docker-start.sh
```

### Checking Status

```bash
# View container status
pnpm run docker:status

# Or manually
docker ps -a --filter "name=harmonia"
```

## Docker Commands Reference

### NPM Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start app (auto-checks MongoDB) |
| `pnpm run docker:ml:start` | Start ML container |
| `pnpm run docker:ml:stop` | Stop ML container |
| `pnpm run docker:ml:shell` | Open bash in ML container |
| `pnpm run docker:status` | Show container status |
| `pnpm run docker:cleanup` | Remove dangling images |

### Manual Docker Compose

```bash
# Start ML container
docker-compose up -d harmonia

# Stop ML container
docker-compose stop harmonia

# View logs
docker logs harmonia-dev

# Restart ML container
docker restart harmonia-dev
```

## Configuration

### Environment Variables

Required in `.env`:

```bash
# MongoDB Connection (Native Windows Service)
MONGODB_URI=mongodb://localhost:27017/harmonia

# MongoDB Admin Credentials (for native installation)
MONGO_ROOT_PASSWORD=<generated-password>
MONGO_HARMONIA_PASSWORD=<generated-password>

# JWT Secret
JWT_SECRET=<generated-secret>

# Hugging Face (for ML models)
HUGGINGFACE_HUB_TOKEN=<your-token>
```

### Generate Secure Passwords

```bash
# Generate passwords/secrets
openssl rand -base64 32
openssl rand -base64 64
```

## Container Details

### ML/Music Generation Container (`harmonia-dev`)

- **Image**: `harmonia-harmonia:latest`
- **Base**: Ubuntu 22.04
- **Port Binding**: `0.0.0.0:8000` (for Python API if needed)
- **Volumes**:
  - `./:/workspace:rw` - Project files
  - `./models:/workspace/models:rw` - ML models
- **Environment**: `PYTHONUNBUFFERED=1`
- **Purpose**: MusicGen, Python ML workloads
- **Shell**: `docker exec -it harmonia-dev bash`

## Volumes

### Bind Mounts (ML Container)

```bash
# List mounted directories
docker inspect harmonia-dev --format '{{json .Mounts}}' | jq
```

### Volume Locations

- `./:/workspace` - Full project directory (read/write)
- `./models:/workspace/models` - ML model files (read/write)

### MongoDB Data (Native)

- Database files: `C:\Program Files\MongoDB\Server\8.0\data`
- Configuration: `C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg`
- Logs: `C:\Program Files\MongoDB\Server\8.0\log\mongod.log`
- Backup: `bash scripts/backup-mongo.sh` (see `BACKUP_SETUP.md`)

## Networks

ML container uses default Docker bridge network:

```bash
# Network: bridge (default)
# ML container accessible on: localhost:8000
# MongoDB accessible on: localhost:27017 (host network)
```

## Maintenance

### Cleanup Dangling Images

```bash
# Remove unused images (safe)
pnpm run docker:cleanup

# Or manually
docker image prune -f
```

### Remove Stopped Containers

```bash
# Remove all stopped containers
docker container prune -f
```

### Full System Cleanup (⚠️ Use with caution)

```bash
# Remove ALL unused Docker resources
docker system prune -a --volumes
```

## Troubleshooting

### MongoDB Won't Start

```bash
# Check native MongoDB service
powershell -c "Get-Service MongoDB"

# Start MongoDB service
net start MongoDB

# Check MongoDB logs
type "C:\Program Files\MongoDB\Server\8.0\log\mongod.log"

# Common issues:
# 1. Service not started
# 2. Port 27017 already in use
# 3. Insufficient memory
```

### ML Container Won't Start

```bash
# Check container status
docker ps -a | grep harmonia

# View container logs
docker logs harmonia-dev

# Restart container
docker restart harmonia-dev

# Common issues:
# 1. Port 8000 already in use
# 2. Volume mount permissions
# 3. Image not built
```

### Connection Refused

```bash
# Check MongoDB (native)
powershell -c "Get-Service MongoDB"

# Test MongoDB connection
mongosh mongodb://localhost:27017/harmonia

# Check ML container
docker ps | grep harmonia-dev
```

### Out of Disk Space

```bash
# Check Docker disk usage
docker system df

# Clean up dangling images (safe)
pnpm run docker:cleanup

# Clean up stopped containers
docker container prune -f

# Clean up unused volumes (⚠️ removes data)
docker volume prune -f
```

## Best Practices

### ✅ DO

- Ensure native MongoDB service is running before app starts
- Use `pnpm run dev` which auto-checks MongoDB
- Use `docker-compose` for ML container management
- Regularly backup MongoDB (see `BACKUP_SETUP.md`)
- Clean up dangling images periodically (`pnpm run docker:cleanup`)
- Keep ML container stopped when not generating music (saves resources)

### ❌ DON'T

- Commit `.env` file to version control
- Run MongoDB in Docker (native is faster and already hardened)
- Expose ML container ports publicly without firewall
- Leave ML container running 24/7 (only needed for generation)
- Leave dangling images accumulating (wastes disk space)

## Auto-Start on App Launch

The `predev` npm script automatically checks MongoDB:

```json
{
  "scripts": {
    "predev": "bash scripts/docker-start.sh",
    "dev": "nx run-many --target=serve --projects=frontend,backend --parallel=2"
  }
}
```

**What it does**:

- ✅ Verifies native MongoDB service is running
- ✅ Shows error message if MongoDB is stopped
- ✅ Fast check (< 1 second)
- ✅ Does NOT start any Docker containers

**ML Container**:

- Managed separately with `pnpm run docker:ml:start`
- Only needed when generating music
- Not started automatically (saves resources)

**To disable auto-check**: Remove the `"predev"` script from `package.json`

## Monitoring

### Container Health

```bash
# Check container health status
docker inspect harmonia-mongo-i9 | grep -A 10 Health

# View real-time stats
docker stats harmonia-mongo-i9
```

### Logs

```bash
# Follow MongoDB logs
docker logs -f harmonia-mongo-i9

# Follow Mongo Express logs
docker logs -f harmonia-mongo-ui

# Last 100 lines
docker logs --tail 100 harmonia-mongo-i9
```

## Advanced Usage

### GPU Support (ML Workloads)

For ML inference with NVIDIA GPUs:

```bash
# Build worker image
docker-compose -f docker-compose.dev.yml build worker

# Run with GPU support
docker-compose -f docker-compose.dev.yml up worker
```

Requirements:

- NVIDIA GPU
- NVIDIA Container Toolkit installed
- Docker configured with `nvidia` runtime

### Custom MongoDB Configuration

Edit `docker-compose.mongo.yml` to customize:

- Cache size: `--wiredTigerCacheSizeGB`
- Max connections: `--maxConns`
- Log verbosity: `--logLevel`

## Related Documentation

- `BACKUP_SETUP.md` - MongoDB backup strategies
- `MONGODB_SETUP.md` - Detailed MongoDB configuration
- `MONGODB_SECURITY.md` - Security best practices
- `PERSISTENT_STORAGE.md` - Volume management

---

**Last Updated**: December 3, 2025  
**Docker Version**: 29.0.1  
**Docker Compose Version**: 2.40.3  
**Architecture**: Native MongoDB + Docker ML Container  
**Total Docker Images**: 1 (harmonia-harmonia, 618 MB)
