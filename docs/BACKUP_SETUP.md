# MongoDB Automated Backup Setup

## Overview

Harmonia includes automated MongoDB backup scripts that create daily compressed archives using `mongodump`. Backups are retained for 7 days and stored in `backups/mongo/`.

## Features

- **Daily automated backups** at 2:00 AM
- **Compressed archives** using gzip (`.archive.gz` format)
- **7-day retention** (older backups automatically deleted)
- **Disaster recovery seeds** (JSON exports for lightweight restore)
- **Docker-native** (works with `harmonia-mongo-i9` container)
- **Cross-platform** (Windows Task Scheduler or Linux/WSL cron)

## Prerequisites

- MongoDB container running (`docker compose -f docker-compose.mongo.yml up -d`)
- `.env` file with `MONGO_ROOT_PASSWORD` set
- Bash shell (Git Bash or WSL on Windows)
- Administrator privileges (Windows) or sudo access (Linux)

## Setup Options

### Option 1: Windows Task Scheduler (Recommended for Windows)

Run PowerShell as Administrator:

```powershell
.\scripts\setup-backup-scheduler.ps1
```

**Custom backup time:**

```powershell
.\scripts\setup-backup-scheduler.ps1 -BackupTime "03:30"
```

**Remove scheduled task:**

```powershell
.\scripts\setup-backup-scheduler.ps1 -Remove
```

### Option 2: Linux/WSL Cron

Run in WSL or Git Bash:

```bash
bash scripts/setup-backup-cron.sh
```

**For WSL, ensure cron service is running:**

```bash
sudo service cron start
sudo service cron status
```

## Manual Backup

Run a backup immediately without waiting for scheduled time:

```bash
bash scripts/backup-mongo.sh
```

## Verification

### Windows Task Scheduler

```powershell
# View task details
Get-ScheduledTask -TaskName "Harmonia MongoDB Daily Backup"

# Check task history
Get-ScheduledTaskInfo -TaskName "Harmonia MongoDB Daily Backup"

# Test backup manually
Start-ScheduledTask -TaskName "Harmonia MongoDB Daily Backup"
```

### Linux/WSL Cron

```bash
# View cron jobs
crontab -l | grep backup-mongo

# Monitor backup log
tail -f backups/mongo/backup.log

# View recent backups
ls -lh backups/mongo/
```

## Backup Files

Backups are stored in `backups/mongo/` with the following naming convention:

```plaintext
harmonia_YYYYMMDD_HHMMSS.archive.gz
```

**Example:**

```plaintext
backups/
├── mongo/
│   ├── harmonia_20241202_020001.archive.gz  (Today)
│   ├── harmonia_20241201_020001.archive.gz  (Yesterday)
│   ├── harmonia_20241130_020001.archive.gz  (2 days ago)
│   └── ...  (up to 7 days)
└── seeds/
    ├── dr-seed-20241202.json  (Disaster recovery seed)
    └── ...  (up to 7 days)
```

## Restore from Backup

### Full Database Restore

```bash
# Stop application containers
docker compose down

# Restore from archive
docker exec harmonia-mongo-i9 mongorestore \
  --username admin \
  --password "${MONGO_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  --gzip \
  --archive=/backups/harmonia_20241202_020001.archive.gz \
  --drop

# Restart application
docker compose up -d
```

### Disaster Recovery from Seed

```bash
# Restore from lightweight JSON seed
export MONGO_URI="mongodb://admin:${MONGO_ROOT_PASSWORD}@localhost:27017/harmonia?authSource=admin"
node scripts/restore-from-seed.js --input seeds/dr-seed-20241202.json
```

## Backup Script Details

The backup script (`scripts/backup-mongo.sh`) performs:

1. **Environment check** - Validates `MONGO_ROOT_PASSWORD` from `.env`
2. **Mongodump execution** - Creates compressed archive inside container
3. **Copy to host** - Transfers backup from container to `backups/mongo/`
4. **Retention cleanup** - Deletes backups older than 7 days
5. **Seed generation** - Creates disaster recovery JSON export
6. **Logging** - Outputs backup size and status

## Troubleshooting

### Backup fails with "Error: MONGO_ROOT_PASSWORD not set"

Ensure `.env` file exists in repository root and contains:

```bash
MONGO_ROOT_PASSWORD=your_secure_password_here
```

### Windows Task Scheduler task not running

1. Check task exists: `Get-ScheduledTask -TaskName "Harmonia MongoDB Daily Backup"`
2. Verify task history: `Get-ScheduledTaskInfo -TaskName "Harmonia MongoDB Daily Backup"`
3. Test manually: `Start-ScheduledTask -TaskName "Harmonia MongoDB Daily Backup"`
4. Check MongoDB container is running: `docker ps | grep harmonia-mongo-i9`

### WSL cron not running

```bash
# Start cron service
sudo service cron start

# Enable cron to start on boot (WSL 2)
echo "sudo service cron start" >> ~/.bashrc

# Check cron logs
grep CRON /var/log/syslog
```

### Backup directory permissions

Ensure `backups/mongo/` directory is writable:

```bash
mkdir -p backups/mongo
chmod 755 backups/mongo
```

## Storage Considerations

**Typical backup sizes:**

```plaintext
Empty database:        ~1 KB
Small dataset:         ~10-50 MB
Production (100k models): ~500 MB - 1 GB
```

**7-day retention storage:**

```plaintext
Small dataset:     ~350 MB (7 × 50 MB)
Production:        ~7 GB (7 × 1 GB)
```

**Recommendation:** Monitor `backups/mongo/` directory size. If exceeding 10 GB, consider:

- Reducing retention to 3-5 days
- Moving older backups to cloud storage (AWS S3, Azure Blob)
- Implementing incremental backups

## Security Notes

- Backups contain **sensitive data** (user info, API keys, model metadata)
- `.env` file with `MONGO_ROOT_PASSWORD` should **never** be committed to Git
- Backup archives should be **encrypted** if stored off-site
- Consider using MongoDB Atlas backups for production environments

## Cloud Backup Strategy

For production deployments, see:

- `docs/CLOUD_SYNC_STRATEGY.md` - Cloud storage integration
- `docs/DISASTER_RECOVERY.md` - Comprehensive recovery procedures

## Next Steps

1. ✅ Configure automated backups (this document)
2. Test backup manually: `bash scripts/backup-mongo.sh`
3. Verify backup file created: `ls -lh backups/mongo/`
4. Test restore procedure (see above)
5. Monitor first scheduled backup at 2:00 AM
6. Proceed to Phase 1: Application scaffolding

## References

- [MongoDB Backup Methods](https://www.mongodb.com/docs/manual/core/backups/)
- [mongodump Documentation](https://www.mongodb.com/docs/database-tools/mongodump/)
- [Windows Task Scheduler Guide](https://learn.microsoft.com/en-us/windows/win32/taskschd/task-scheduler-start-page)
- [Cron Schedule Expressions](https://crontab.guru/)
