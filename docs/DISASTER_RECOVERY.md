# Disaster Recovery Guide

**Complete guide for MongoDB disaster recovery using seed files and backups.**

---

## Recovery Scenarios

### Scenario 1: Complete Data Loss (Catastrophic Failure)

**Symptoms:**

- MongoDB container corrupted or deleted
- Volumes deleted accidentally
- Disk failure

**Recovery Steps:**

1. **Recreate MongoDB infrastructure** (5 minutes)

   ```bash
   cd /mnt/c/repos/harmonia
   
   # Ensure passwords in .env
   cat .env | grep MONGO
   
   # Start fresh MongoDB
   docker compose -f docker-compose.mongo.yml up -d
   
   # Wait for healthy
   docker ps | grep harmonia-mongo
   ```

2. **Restore from seed file** (2 minutes)

   ```bash
   # Set connection
   export MONGO_URI="mongodb://harmonia_app:$(grep MONGO_HARMONIA_PASSWORD .env | cut -d '=' -f2)@localhost:27017/harmonia?authSource=harmonia"
   
   # Restore seed data
   pnpm seed:restore --force
   
   # Or with Node directly:
   node scripts/restore-from-seed.js --force
   ```

3. **Restore from latest backup** (if available, 5 minutes)

   ```bash
   # Find latest backup
   ls -lh backups/mongo/*.archive.gz
   
   # Restore (replace date with actual backup)
   BACKUP_FILE="backups/mongo/harmonia_20251202_020000.archive.gz"
   
   docker cp "$BACKUP_FILE" harmonia-mongo-i9:/backups/
   
   docker exec harmonia-mongo-i9 mongorestore \
     --username admin \
     --password "$(grep MONGO_ROOT_PASSWORD .env | cut -d '=' -f2)" \
     --authenticationDatabase admin \
     --db harmonia \
     --gzip \
     --archive="/backups/$(basename $BACKUP_FILE)"
   ```

4. **Sync with current inventory** (2 minutes)

   ```bash
   # Update from filesystem
   node scripts/migrate_inventory_to_db.js
   ```

5. **Verify recovery** (1 minute)

   ```bash
   docker exec -it harmonia-mongo-i9 mongosh \
     -u harmonia_app \
     -p "$(grep MONGO_HARMONIA_PASSWORD .env | cut -d '=' -f2)" \
     harmonia
   
   # In mongosh:
   db.model_artifacts.countDocuments()
   db.inventory_versions.find().pretty()
   exit
   ```

**Total Recovery Time:** ~15 minutes

---

### Scenario 2: Partial Data Corruption

**Symptoms:**

- Some collections corrupted
- Data inconsistencies
- Failed migrations

**Recovery Steps:**

1. **Backup current state** (even if corrupted)

   ```bash
   pnpm seed:generate --output "seeds/pre-recovery-$(date +%Y%m%d_%H%M%S).json"
   ```

2. **Restore specific collections**

   ```bash
   # Option 1: Drop and restore all
   pnpm seed:restore --drop --force
   
   # Option 2: Restore from mongodump backup
   docker exec harmonia-mongo-i9 mongorestore \
     --username admin \
     --password "${MONGO_ROOT_PASSWORD}" \
     --authenticationDatabase admin \
     --db harmonia \
     --collection model_artifacts \
     --gzip \
     --drop \
     --archive="/backups/latest.archive.gz"
   ```

3. **Rebuild indexes**

   ```bash
   docker exec -it harmonia-mongo-i9 mongosh \
     -u admin \
     -p "${MONGO_ROOT_PASSWORD}" \
     --authenticationDatabase admin \
     harmonia \
     --eval "db.model_artifacts.reIndex()"
   ```

---

### Scenario 3: Accidental Data Deletion

**Symptoms:**

- Models deleted by mistake
- Jobs cleared unintentionally
- Inventory versions lost

**Recovery Steps:**

1. **Stop all writes immediately**

   ```bash
   # Pause application services
   docker compose -f docker-compose.dev.yml down
   ```

2. **Check latest backup age**

   ```bash
   ls -lht backups/mongo/*.archive.gz | head -1
   ```

3. **Restore from backup**

   ```bash
   # See Scenario 1, Step 3
   ```

4. **Compare with seed file**

   ```bash
   # Generate current state
   pnpm seed:generate --output seeds/current-state.json
   
   # Manually compare (or use jq)
   diff seeds/disaster-recovery-seed.json seeds/current-state.json
   ```

---

## Backup Strategy

### Daily Automated Backups

**Already configured in `scripts/backup-mongo.sh`:**

- Runs at 2:00 AM via Task Scheduler/cron
- Creates mongodump archive
- Generates JSON seed file
- Retains 7 days of backups

**Verify backup job:**

```bash
# Check last backup
ls -lh backups/mongo/ | tail -5

# Check last seed
ls -lh seeds/ | grep dr-seed
```

### Manual Backup (Before Risky Operations)

```bash
# Before schema changes, major migrations, etc.
./scripts/backup-mongo.sh

# Generate seed with custom name
pnpm seed:generate --output "seeds/pre-migration-$(date +%Y%m%d).json"
```

---

## Testing Recovery Procedures

**Run quarterly to ensure DR plan works:**

1. **Create test database:**

   ```bash
   docker run -d --name harmonia-mongo-test \
     -p 27018:27017 \
     -e MONGO_INITDB_ROOT_USERNAME=admin \
     -e MONGO_INITDB_ROOT_PASSWORD=testpass \
     mongo:7.0
   ```

2. **Restore seed to test DB:**

   ```bash
   MONGO_URI="mongodb://admin:testpass@localhost:27018/harmonia?authSource=admin" \
   node scripts/restore-from-seed.js --force
   ```

3. **Verify data integrity:**

   ```bash
   docker exec harmonia-mongo-test mongosh \
     -u admin -p testpass \
     --authenticationDatabase admin \
     harmonia \
     --eval "printjson(db.getCollectionNames())"
   ```

4. **Cleanup:**

   ```bash
   docker stop harmonia-mongo-test
   docker rm harmonia-mongo-test
   ```

---

## Seed File Management

### When to Generate New Seeds

- ✅ **After initial setup** (baseline)
- ✅ **Before major schema changes**
- ✅ **After adding significant data**
- ✅ **Weekly** (automated in backup script)
- ✅ **Before releases**

### Seed File Retention

```bash
# Keep these in version control:
seeds/disaster-recovery-seed.json  # Master baseline

# Auto-generated (gitignored):
seeds/dr-seed-YYYYMMDD.json       # Daily backups (7 days retention)
```

### Update Master Seed

```bash
# Generate from production state
pnpm seed:generate

# Review changes
git diff seeds/disaster-recovery-seed.json

# Commit if significant updates
git add seeds/disaster-recovery-seed.json
git commit -m "chore: update disaster recovery seed with new models"
```

---

## Recovery Time Objectives (RTO)

| Scenario | Target RTO | Actual Time | Data Loss |
|----------|------------|-------------|-----------|
| Complete loss | 30 minutes | ~15 minutes | Up to 24 hours (last backup) |
| Partial corruption | 15 minutes | ~10 minutes | Minimal |
| Accidental deletion | 10 minutes | ~5 minutes | None (from backup) |

---

## Recovery Point Objectives (RPO)

- **Daily backups:** 24-hour RPO
- **Seed files:** 24-hour RPO (if automated)
- **To reduce RPO:** Increase backup frequency or use replica sets with point-in-time recovery

---

## Emergency Contact & Escalation

**If recovery fails:**

1. Check logs: `docker logs harmonia-mongo-i9`
2. Verify MongoDB version compatibility
3. Check disk space: `df -h`
4. Review seed file integrity: `node -e "JSON.parse(require('fs').readFileSync('seeds/disaster-recovery-seed.json'))"`
5. Escalate to: [Add team contacts]

---

## Preventive Measures

**Reduce disaster likelihood:**

- ✅ Use Docker volumes (not bind mounts) for data persistence
- ✅ Configure automated backups (already done)
- ✅ Test restores quarterly
- ✅ Use replica sets for production (future enhancement)
- ✅ Monitor disk space: `docker system df`
- ✅ Keep MongoDB and Docker updated
- ✅ Use volume snapshots (cloud providers)

---

## Quick Reference

```bash
# Generate seed
pnpm seed:generate

# Restore seed
pnpm seed:restore

# Backup (mongodump)
./scripts/backup-mongo.sh

# Restore backup
# See Scenario 1, Step 3

# Test connection
docker exec -it harmonia-mongo-i9 mongosh -u harmonia_app -p password harmonia

# Check health
docker ps | grep harmonia-mongo
```

---

## Next Steps

- [ ] Test seed restore to empty database
- [ ] Schedule backup script (Task Scheduler/cron)
- [ ] Document custom seed generation procedures
- [ ] Set up monitoring/alerting for backup failures
- [ ] Consider replica set for production deployments
