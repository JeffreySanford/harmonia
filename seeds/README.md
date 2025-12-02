# Disaster Recovery Seed Files

This directory contains JSON seed files for MongoDB disaster recovery.

## Files

- `disaster-recovery-seed.json` - Main DR seed file with initial data
- Custom seed files can be generated and stored here

## Purpose

Seed files allow you to:

1. **Quick recovery** after database corruption or loss
2. **Environment setup** - seed new dev/staging databases
3. **Testing** - consistent test data across environments
4. **Version control** - track database schema and initial data

## Usage

### Restore from Seed

```bash
# Full restore (will prompt for confirmation)
MONGO_URI="mongodb://user:pass@localhost:27017/harmonia" node scripts/restore-from-seed.js

# Force restore without prompt
MONGO_URI="mongodb://user:pass@localhost:27017/harmonia" node scripts/restore-from-seed.js --force

# Drop existing collections and restore (DESTRUCTIVE)
MONGO_URI="mongodb://user:pass@localhost:27017/harmonia" node scripts/restore-from-seed.js --drop --force

# Restore from custom seed file
MONGO_URI="mongodb://user:pass@localhost:27017/harmonia" node scripts/restore-from-seed.js --seed-file seeds/my-custom-seed.json
```

### Generate New Seed

```bash
# Generate seed from current database
MONGO_URI="mongodb://user:pass@localhost:27017/harmonia" node scripts/generate-seed.js

# Generate to custom location
MONGO_URI="mongodb://user:pass@localhost:27017/harmonia" node scripts/generate-seed.js --output seeds/backup-$(date +%Y%m%d).json
```

## Seed File Format

```json
{
  "version": "1.0.0",
  "generated_at": "2025-12-02T00:00:00Z",
  "collections": {
    "model_artifacts": [...],
    "licenses": [...],
    "inventory_versions": [...],
    "jobs": [...],
    "events": [...]
  },
  "metadata": {
    "total_documents": 123,
    "collections_count": 5
  }
}
```

## Automated Seed Generation

Add to your backup script (`scripts/backup-mongo.sh`):

```bash
# Generate fresh seed file daily
MONGO_URI="$MONGO_ADMIN_URI" node scripts/generate-seed.js --output "seeds/dr-seed-$(date +%Y%m%d).json"

# Keep only last 7 days of seed files
find seeds -name "dr-seed-*.json" -mtime +7 -delete
```

## Disaster Recovery Procedure

1. **Fresh MongoDB installation:**

   ```bash
   docker compose -f docker-compose.mongo.yml up -d
   ```

2. **Wait for healthy status:**

   ```bash
   docker ps | grep harmonia-mongo
   ```

3. **Restore from seed:**

   ```bash
   MONGO_URI="mongodb://harmonia_app:password@localhost:27017/harmonia" \
   node scripts/restore-from-seed.js --force
   ```

4. **Verify data:**

   ```bash
   docker exec -it harmonia-mongo-i9 mongosh -u harmonia_app -p password harmonia
   # In mongosh:
   db.model_artifacts.countDocuments()
   db.inventory_versions.find()
   ```

5. **Run migration for latest inventory:**

   ```bash
   MONGO_URI="..." node scripts/migrate_inventory_to_db.js
   ```

## Security Notes

- ⚠️ Seed files contain database structure and may include sensitive data
- ✅ Keep seed files in private repositories only
- ✅ Never commit credentials or API keys in seed files
- ✅ Use `.gitignore` patterns for auto-generated seed files with dates

## Maintenance

- **Weekly:** Generate fresh seed file
- **After major changes:** Generate seed and commit to repo
- **Before destructive operations:** Generate seed as safety backup
- **Test quarterly:** Restore to staging environment to verify seed validity
