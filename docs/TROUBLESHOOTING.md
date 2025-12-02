# Troubleshooting Guide

**Common issues and solutions for Harmonia development environment.**

---

## MongoDB Issues

### Issue: "Connection refused" or "ECONNREFUSED"

**Symptoms:**

```plaintext
MongoServerError: connect ECONNREFUSED 127.0.0.1:27017
```

**Solutions:**

1. **Check if MongoDB service is running:**

   ```powershell
   Get-Service MongoDB
   # Should show: Running
   ```

2. **Start MongoDB if stopped:**

   ```powershell
   Start-Service MongoDB
   ```

3. **Verify MongoDB is listening:**

   ```bash
   netstat -ano | grep :27017
   # Should show: TCP    127.0.0.1:27017
   ```

---

### Issue: "Authentication failed"

**Symptoms:**

```plaintext
MongoServerError: Authentication failed
```

**Solutions:**

1. **Verify passwords in .env:**

   ```bash
   cat .env | grep MONGO
   ```

2. **Check connection string format:**

   ```bash
   # Correct format:
   mongodb://harmonia_app:PASSWORD@localhost:27017/harmonia?authSource=harmonia
   
   # Common mistakes:
   # ❌ Missing authSource parameter
   # ❌ Wrong database in URL
   # ❌ Special characters not URL-encoded
   ```

3. **Test with mongosh:**

   ```bash
   mongosh "mongodb://harmonia_app:PASSWORD@localhost:27017/harmonia?authSource=harmonia"
   ```

4. **Reset user password if needed:**

   ```javascript
   // Connect as admin
   mongosh "mongodb://admin:ADMIN_PASSWORD@localhost:27017/admin?authSource=admin"
   
   // Reset password
   use harmonia
   db.changeUserPassword('harmonia_app', 'NEW_PASSWORD')
   ```

---

### Issue: mongosh command not found

**Symptoms:**

```plaintext
bash: mongosh: command not found
```

**Solutions:**

1. **Install MongoDB Shell:**

   ```powershell
   .\scripts\install-mongosh.bat
   ```

2. **Or download manually:**
   - Visit: <https://www.mongodb.com/try/download/shell>
   - Download MSI installer
   - Run installer
   - Restart PowerShell

3. **Verify installation:**

   ```powershell
   mongosh --version
   ```

---

## PNPM Issues

### Issue: "Unexpected non-whitespace character" in package.json

**Symptoms:**

```plaintext
ERROR  Unexpected non-whitespace character after JSON at position 360
```

**Solution:**

**Validate JSON syntax:**

```bash
# Check for duplicate JSON objects
cat package.json | jq .
```

The `package.json` should have only ONE root object, not multiple.

---

### Issue: pnpm command not found

**Symptoms:**

```plaintext
bash: pnpm: command not found
```

**Solutions:**

1. **Install pnpm via corepack (recommended):**

   ```powershell
   corepack enable
   corepack prepare pnpm@latest --activate
   ```

2. **Or install via npm:**

   ```bash
   npm install -g pnpm
   ```

3. **Verify installation:**

   ```bash
   pnpm --version
   ```

---

### Issue: "Unexpected build scripts"

**Symptoms:**

```plaintext
Warning: Ignored build scripts: mongodb-memory-server
```

**Solution:**

This is expected and safe. To allow build scripts:

```bash
pnpm approve-builds
```

---

## Node.js / TypeScript Issues

### Issue: Module not found errors

**Symptoms:**

```plaintext
Error: Cannot find module 'mongoose'
```

**Solutions:**

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Check node_modules exists:**

   ```bash
   ls node_modules/
   ```

3. **Clear and reinstall:**

   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

---

### Issue: TypeScript compilation errors

**Symptoms:**

```plaintext
error TS2307: Cannot find module '@nestjs/common'
```

**Solutions:**

1. **NestJS not installed yet** (expected in Phase 0):
   - These errors will resolve in Phase 1 when NestJS is scaffolded
   - Files like `src/services/cloud-sync.service.ts` are documentation/templates

2. **For actual TS errors, rebuild:**

   ```bash
   pnpm build
   ```

---

## Git Issues

### Issue: .env file accidentally committed

**Symptoms:**

```plaintext
warning: .env contains passwords
```

**Solutions:**

1. **Remove from git history:**

   ```bash
   git rm --cached .env
   git commit -m "Remove .env from git"
   ```

2. **Verify .gitignore:**

   ```bash
   cat .gitignore | grep .env
   # Should show: .env
   ```

3. **Rotate passwords immediately:**

   ```bash
   openssl rand -base64 32  # Generate new passwords
   # Update .env and MongoDB users
   ```

---

## Windows-Specific Issues

### Issue: "Execution policy" errors in PowerShell

**Symptoms:**

```plaintext
.\script.ps1 : File cannot be loaded because running scripts is disabled
```

**Solutions:**

1. **Allow current script:**

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\script.ps1
   ```

2. **Or change policy (Admin):**

   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

---

### Issue: Permission denied errors

**Symptoms:**

```plaintext
Error: EPERM: operation not permitted
```

**Solutions:**

1. **Run PowerShell as Administrator**
2. **Check if file is locked:**
   - Close VS Code
   - Close Docker Desktop
   - Try again

3. **Check antivirus:**
   - Add `C:\repos\harmonia` to exclusions

---

## Performance Issues

### Issue: MongoDB using too much RAM

**Symptoms:**

- System slow
- MongoDB using 8GB+ RAM

**Solutions:**

1. **Check WiredTiger cache size:**

   ```javascript
   db.serverStatus().wiredTiger.cache
   ```

2. **Adjust cache in mongod.cfg:**

   ```yaml
   storage:
     wiredTiger:
       engineConfig:
         cacheSizeGB: 2  # Reduce from default
   ```

3. **Restart MongoDB:**

   ```powershell
   Restart-Service MongoDB
   ```

---

### Issue: pnpm install very slow

**Symptoms:**

- Installation taking 10+ minutes

**Solutions:**

1. **Use faster mirror:**

   ```bash
   pnpm config set registry https://registry.npmmirror.com
   ```

2. **Clear pnpm cache:**

   ```bash
   pnpm store prune
   ```

3. **Check network connection**

---

## Docker Issues (if using Docker MongoDB)

### Issue: Port 27017 already in use

**Symptoms:**

```plaintext
Error: bind: Only one usage of each socket address is normally permitted
```

**Solutions:**

1. **Check what's using port:**

   ```bash
   netstat -ano | grep :27017
   ```

2. **Stop native MongoDB service:**

   ```powershell
   Stop-Service MongoDB
   ```

3. **Or use different port for Docker:**

   ```yaml
   ports:
     - "27018:27017"  # External:Internal
   ```

---

### Issue: Docker daemon not running

**Symptoms:**

```plaintext
Error: Cannot connect to the Docker daemon
```

**Solutions:**

1. **Start Docker Desktop:**
   - Open Docker Desktop app
   - Wait for "Docker is running" status

2. **Verify Docker is running:**

   ```bash
   docker ps
   ```

---

## Network Issues

### Issue: Cannot access MongoDB from application

**Symptoms:**

- mongosh works
- Application gets connection refused

**Solutions:**

1. **Check connection string in application:**

   ```javascript
   // Make sure using localhost, not 0.0.0.0
   mongodb://localhost:27017
   ```

2. **Verify MongoDB bound correctly:**

   ```bash
   netstat -ano | grep :27017
   # Should show: 127.0.0.1:27017 (not 0.0.0.0:27017)
   ```

3. **Check firewall rules:**

   ```powershell
   Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*MongoDB*"}
   ```

---

## Development Environment Issues

### Issue: VS Code terminal not showing bash

**Symptoms:**

- Only PowerShell available
- Bash commands fail

**Solutions:**

1. **Check Git Bash installation:**

   ```powershell
   Test-Path "C:\Program Files\Git\bin\bash.exe"
   ```

2. **Add bash to VS Code:**
   - Open Settings (Ctrl+,)
   - Search "terminal.integrated.profiles.windows"
   - Add Git Bash profile

3. **Or use WSL2:**

   ```powershell
   wsl --install
   ```

---

### Issue: Hot reload not working

**Symptoms:**

- Changes not reflected
- Need to restart manually

**Solutions:**

1. **For TypeScript:**

   ```bash
   pnpm dev  # Uses ts-node with watch mode
   ```

2. **For NestJS (Phase 1):**

   ```bash
   pnpm start:dev  # Built-in hot reload
   ```

---

## Getting More Help

### 1. Check logs

**MongoDB logs:**

```powershell
Get-Content "C:\Program Files\MongoDB\Server\8.0\log\mongod.log" -Tail 50
```

**Application logs:**

```bash
# In development mode
pnpm dev
# Watch for errors in console
```

---

### 2. Run diagnostics

**MongoDB security audit:**

```bash
.\scripts\harden-mongodb.bat
```

**File size audit:**

```bash
python scripts/audit_file_sizes.py
```

**License audit:**

```bash
python scripts/check_licenses_ci.py
```

---

### 3. Verify environment

**Check all prerequisites:**

```powershell
# Node.js
node --version  # Should be 18+

# pnpm
pnpm --version  # Should be 8+

# MongoDB
mongosh --version  # Should be latest

# Git
git --version

# Python
python --version  # Should be 3.11+
```

---

### 4. Review documentation

- `docs/I9_MONGODB_INSTALL.md` - MongoDB setup
- `docs/QUICKSTART_MONGODB.md` - Quick start guide
- `docs/PNPM.md` - Package manager guide
- `docs/DEV_ONBOARDING.md` - Developer onboarding
- `docs/MONGODB_SECURITY.md` - Security guide

---

### 5. Reset environment (nuclear option)

**If all else fails:**

```bash
# 1. Backup important data
.\scripts\backup-mongo.sh

# 2. Stop services
Stop-Service MongoDB
docker compose down

# 3. Clean everything
rm -rf node_modules pnpm-lock.yaml
rm -rf models/* datasets/*

# 4. Reinstall
pnpm install

# 5. Restart MongoDB
Start-Service MongoDB

# 6. Re-run setup
.\scripts\setup-mongodb.bat
```

---

## Prevention Tips

### 1. Keep dependencies updated

```bash
# Check for updates
pnpm outdated

# Update all
pnpm update
```

---

### 2. Regular backups

```bash
# Manual backup
.\scripts\backup-mongo.sh

# Automated (recommended)
# Set up Windows Task Scheduler for daily backups
```

---

### 3. Monitor system resources

```powershell
# Check MongoDB resource usage
Get-Process mongod | Select-Object CPU,WS

# Check disk space
Get-PSDrive C
```

---

### 4. Follow coding standards

```bash
# Before committing
python scripts/audit_file_sizes.py
python scripts/check_licenses_ci.py
pnpm test
```

---

## Quick Reference Commands

```bash
# MongoDB
mongosh "mongodb://harmonia_app:PASSWORD@localhost:27017/harmonia?authSource=harmonia"
Get-Service MongoDB
Restart-Service MongoDB

# PNPM
pnpm install
pnpm test:mongo
pnpm seed:generate
pnpm seed:restore

# Git
git status
git add .
git commit -m "message"

# Scripts
.\scripts\setup-mongodb.bat
.\scripts\harden-mongodb.bat
.\scripts\backup-mongo.sh

# Diagnostics
netstat -ano | grep :27017
Get-Process mongod
pnpm --version
```

---

**Last Updated:** December 2, 2025  
**Covers:** Phase 0 infrastructure setup
