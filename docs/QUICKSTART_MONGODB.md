# Quick Start: MongoDB Setup on i9

**This guide gets MongoDB running on your i9 in ~10 minutes.**

---

## Prerequisites Check

```bash
# Verify Docker is running
docker ps

# Verify you're in the harmonia repo
pwd
# Should show: /mnt/c/repos/harmonia or C:\repos\harmonia

# Verify WSL2/bash shell
echo $SHELL
# Should show: /bin/bash or similar
```

---

## Step 1: Generate Secure Passwords (2 minutes)

```bash
cd /mnt/c/repos/harmonia

# Generate passwords and save to .env
echo "MONGO_ROOT_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "MONGO_HARMONIA_PASSWORD=$(openssl rand -base64 32)" >> .env

# Display passwords - SAVE THESE IN YOUR PASSWORD MANAGER
echo "=== SAVE THESE PASSWORDS ==="
cat .env | grep MONGO
echo "============================"
```

**Important:** Copy these passwords to a password manager or secure note. You'll need them to connect.

---

## Step 2: Start MongoDB (3 minutes)

```bash
# Start MongoDB and Mongo Express
docker compose -f docker-compose.mongo.yml up -d

# Wait 10-20 seconds for startup
sleep 15

# Check status - should show "healthy"
docker ps | grep harmonia-mongo
```

**Expected output:**

```plaintext
harmonia-mongo-i9   healthy   0.0.0.0:27017->27017/tcp
harmonia-mongo-ui   Up        0.0.0.0:8081->8081/tcp
```

---

## Step 3: Test Connection (2 minutes)

```bash
# Get root password
export MONGO_ROOT_PASSWORD=$(grep MONGO_ROOT_PASSWORD .env | cut -d '=' -f2)

# Connect via mongosh
docker exec -it harmonia-mongo-i9 mongosh -u admin -p "${MONGO_ROOT_PASSWORD}" --authenticationDatabase admin
```

**In mongosh terminal:**

```javascript
// Switch to harmonia database
use harmonia

// List collections (should see: model_artifacts, licenses, jobs, etc.)
show collections

// Check the test document
db.model_artifacts.find()

// Exit
exit
```

✅ **Success:** If you see collections and a `_setup_test` document, MongoDB is ready!

---

## Step 4: Access Web UI (1 minute)

1. Open browser: <http://localhost:8081>
2. Login credentials:
   - **Username:** `harmonia`
   - **Password:** (your `MONGO_HARMONIA_PASSWORD` from `.env`)
3. Navigate to `harmonia` database
4. Browse collections

✅ **Success:** If you can see the `model_artifacts` collection in the UI, web access is working!

---

## Step 5: Seed Database (2 minutes)

```bash
# Get app password
export MONGO_HARMONIA_PASSWORD=$(grep MONGO_HARMONIA_PASSWORD .env | cut -d '=' -f2)

# Set connection string
export MONGO_URI="mongodb://harmonia_app:${MONGO_HARMONIA_PASSWORD}@localhost:27017/harmonia?authSource=harmonia"

# Run migration (dry-run mode if MONGO_URI not set)
node scripts/migrate_inventory_to_db.js
```

**Expected output:**

```plaintext
Upserted facebook v0
Upserted foo v0
```

**Verify data:**

```bash
docker exec -it harmonia-mongo-i9 mongosh \
  -u harmonia_app \
  -p "${MONGO_HARMONIA_PASSWORD}" \
  harmonia \
  --eval "db.model_artifacts.countDocuments()"
```

✅ **Success:** Should show count of 3 (2 models + 1 test document)

---

## Troubleshooting

### Container Won't Start

**Check logs:**

```bash
docker logs harmonia-mongo-i9
```

**Common issues:**

- Port 27017 already in use → Stop other MongoDB instances
- Permission error → Run Docker as admin (Windows) or add user to docker group (Linux)

### Can't Connect

**Verify container is healthy:**

```bash
docker inspect harmonia-mongo-i9 | grep -A 10 Health
```

**Test network:**

```bash
docker exec harmonia-mongo-i9 ping -c 1 localhost
```

### Wrong Password

**Reset passwords:**

```bash
# Remove containers (keeps volumes)
docker compose -f docker-compose.mongo.yml down

# Generate new passwords
mv .env .env.backup
echo "MONGO_ROOT_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "MONGO_HARMONIA_PASSWORD=$(openssl rand -base64 32)" >> .env

# Remove volumes (THIS DELETES ALL DATA)
docker volume rm harmonia_mongo-data harmonia_mongo-config

# Start fresh
docker compose -f docker-compose.mongo.yml up -d
```

### Mongo Express Not Loading

**Check logs:**

```bash
docker logs harmonia-mongo-ui
```

**Common fix - restart after MongoDB is healthy:**

```bash
docker restart harmonia-mongo-ui
```

---

## Security Checklist

After setup, verify these security measures are in place:

- [ ] Passwords are random 32-character strings (not `changeme`)
- [ ] `.env` is in `.gitignore` (never commit passwords)
- [ ] MongoDB port bound to `127.0.0.1` only (not `0.0.0.0`)
- [ ] Mongo Express requires authentication
- [ ] Firewall blocks external access to port 27017 (Windows Defender)

**Set firewall rules (Windows PowerShell as Admin):**

```powershell
New-NetFirewallRule -DisplayName "Block MongoDB External" -Direction Inbound -LocalPort 27017 -Protocol TCP -Action Block -RemoteAddress Internet
New-NetFirewallRule -DisplayName "Allow MongoDB Localhost" -Direction Inbound -LocalPort 27017 -Protocol TCP -Action Allow -RemoteAddress 127.0.0.1
```

---

## Daily Operations

**Start MongoDB:**

```bash
docker compose -f docker-compose.mongo.yml up -d
```

**Stop MongoDB:**

```bash
docker compose -f docker-compose.mongo.yml down
```

**Backup:**

```bash
./scripts/backup-mongo.sh
```

**View data:**

- Web UI: <http://localhost:8081>
- CLI: `docker exec -it harmonia-mongo-i9 mongosh -u harmonia_app -p <password> harmonia`

---

## Connection Strings for Development

Add these to your `.env` for application use:

```bash
# Admin connection (backups, user management)
MONGO_ADMIN_URI=mongodb://admin:${MONGO_ROOT_PASSWORD}@localhost:27017/admin?authSource=admin

# Application connection (Node.js, Python)
MONGO_URI=mongodb://harmonia_app:${MONGO_HARMONIA_PASSWORD}@localhost:27017/harmonia?authSource=harmonia
```

**Test in Node.js:**

```javascript
const mongoose = require('mongoose');
await mongoose.connect(process.env.MONGO_URI);
console.log('Connected!');
```

**Test in Python:**

```python
from pymongo import MongoClient
import os
client = MongoClient(os.getenv('MONGO_URI'))
db = client['harmonia']
print(f"Collections: {db.list_collection_names()}")
```

---

## Next Steps

Once MongoDB is running and seeded:

1. Install Node dependencies: `pnpm install`
2. Run memory-server test: `pnpm test:mongo`
3. Validate CI workflows pass
4. Review Phase 0 checklist: `docs/PHASE_0_CHECKLIST.md`

**For detailed setup, see:** `docs/I9_MONGODB_INSTALL.md`

---

## Summary

You now have:

- ✅ MongoDB 7.0 running in Docker on your i9
- ✅ Secure authentication configured
- ✅ Web UI at <http://localhost:8081>
- ✅ Database seeded with model inventory
- ✅ Automated backup script ready
- ✅ Network security (localhost only)

**Total setup time:** ~10 minutes  
**Ready for:** Phase 0 completion and Phase 1 development
