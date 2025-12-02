#!/bin/bash
# MongoDB backup script for Harmonia i9 installation
# Run daily via cron or Windows Task Scheduler

set -e

BACKUP_DIR="./backups/mongo"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="harmonia_${TIMESTAMP}.archive.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Load MongoDB password from .env
if [ -f .env ]; then
  export $(cat .env | grep MONGO_ROOT_PASSWORD | xargs)
fi

if [ -z "$MONGO_ROOT_PASSWORD" ]; then
  echo "Error: MONGO_ROOT_PASSWORD not set in .env"
  exit 1
fi

echo "Starting MongoDB backup at $(date)"

# Create backup using mongodump
docker exec harmonia-mongo-i9 mongodump \
  --username admin \
  --password "${MONGO_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  --db harmonia \
  --gzip \
  --archive="/backups/${ARCHIVE_NAME}"

# Copy backup from container to host
docker cp harmonia-mongo-i9:/backups/${ARCHIVE_NAME} ${BACKUP_DIR}/

echo "Backup created: ${BACKUP_DIR}/${ARCHIVE_NAME}"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "harmonia_*.archive.gz" -mtime +7 -delete

# Generate disaster recovery seed file
echo "Generating disaster recovery seed file..."
export MONGO_URI="mongodb://admin:${MONGO_ROOT_PASSWORD}@localhost:27017/harmonia?authSource=admin"
node "$(dirname "$0")/generate-seed.js" --output "${BACKUP_DIR}/../seeds/dr-seed-$(date +%Y%m%d).json" || echo "Warning: Seed generation failed"

# Keep only last 7 days of seed files
find "${BACKUP_DIR}/../seeds" -name "dr-seed-*.json" -mtime +7 -delete

echo "Backup completed successfully at $(date)"
echo "Backup size: $(du -h ${BACKUP_DIR}/${ARCHIVE_NAME} | cut -f1)"
