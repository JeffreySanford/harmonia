# MongoDB Security Hardening Guide

**Complete guide to securing MongoDB for production-ready local development.**

---

## Overview

This guide documents the security measures implemented for Harmonia's MongoDB installation, providing a defense-in-depth approach suitable for local development with production-grade security practices.

---

## Security Layers

### Layer 1: Network Isolation

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

---

### Layer 2: Authentication & Authorization

**Configuration:**

```yaml
# mongod.cfg
security:
  authorization: enabled
```

**Users created:**

1. **Admin User** (root privileges)
   - Username: `admin`
   - Password: Stored in `.env` (MONGO_ROOT_PASSWORD)
   - Roles: `root` (full database access)
   - Use case: Administrative tasks, user management

2. **Application User** (limited privileges)
   - Username: `harmonia_app`
   - Password: Stored in `.env` (MONGO_HARMONIA_PASSWORD)
   - Roles: `readWrite`, `dbAdmin` on `harmonia` database only
   - Use case: Application connections, normal operations

**Connection strings:**

```bash
# Admin connection
mongodb://admin:${MONGO_ROOT_PASSWORD}@localhost:27017/admin?authSource=admin

# Application connection
mongodb://harmonia_app:${MONGO_HARMONIA_PASSWORD}@localhost:27017/harmonia?authSource=harmonia
```

---

### Layer 3: Role-Based Access Control (RBAC)

**Principle of Least Privilege:**

```javascript
// Admin user - full access
{
  user: "admin",
  roles: ["root"]
}

// App user - limited to harmonia database only
{
  user: "harmonia_app",
  roles: [
    { role: "readWrite", db: "harmonia" },
    { role: "dbAdmin", db: "harmonia" }
  ]
}
```

**What this prevents:**

- ❌ Application cannot modify admin database
- ❌ Application cannot create/drop databases
- ❌ Application cannot manage users
- ✅ Application can read/write data in harmonia DB only
- ✅ Application can manage indexes and collections in harmonia DB

---

### Layer 4: Password Security

**Password requirements:**

- ✅ 32-character base64-encoded strings
- ✅ Generated with `openssl rand -base64 32`
- ✅ Stored in `.env` (gitignored)
- ✅ Never committed to version control

**Password rotation schedule:**

- Development: Every 90 days
- Production: Every 30 days

**Rotation procedure:**

```bash
# 1. Generate new passwords
openssl rand -base64 32  # For MONGO_ROOT_PASSWORD
openssl rand -base64 32  # For MONGO_HARMONIA_PASSWORD

# 2. Update users in MongoDB
mongosh "mongodb://admin:OLD_PASSWORD@localhost:27017/admin" --eval "
db.changeUserPassword('admin', 'NEW_ROOT_PASSWORD')
"

mongosh "mongodb://admin:NEW_ROOT_PASSWORD@localhost:27017/admin" --eval "
db = db.getSiblingDB('harmonia');
db.changeUserPassword('harmonia_app', 'NEW_APP_PASSWORD')
"

# 3. Update .env file
# 4. Restart application services
```

---

## Attack Surface Analysis

### Threat Model

| Attack Vector | Risk Level | Mitigation |
|---------------|------------|------------|
| External network access | ❌ **Eliminated** | Bound to 127.0.0.1 only |
| Unauthenticated access | ❌ **Eliminated** | Authorization required |
| Privilege escalation | 🟡 **Low** | RBAC limits app user |
| Brute force attacks | 🟡 **Low** | 32-char passwords, localhost only |
| SQL injection | ✅ **N/A** | MongoDB uses BSON, not SQL |
| Man-in-the-middle | 🟡 **Low** | Localhost only (TLS not needed) |
| Physical access | 🟡 **Acceptable** | Encrypted disk recommended |

---

## Security Checklist

### ✅ Implemented

- [x] Network binding to localhost only
- [x] Authentication enabled
- [x] Role-based access control
- [x] Strong passwords (32-char)
- [x] Passwords stored in .env (not committed)
- [x] Separate admin and application users
- [x] Least privilege principle applied
- [x] Config file backed up before changes
- [x] Service restart after hardening

### 🟡 Recommended for Production

- [ ] TLS/SSL encryption (required for external access)
- [ ] Audit logging enabled (Enterprise feature)
- [ ] IP whitelisting (if exposing to network)
- [ ] VPN access only
- [ ] Regular security audits
- [ ] Automated backup verification
- [ ] Intrusion detection system
- [ ] Rate limiting on connections

### ℹ️ Not Applicable (Localhost Development)

- [ ] Certificate-based authentication
- [ ] Kerberos integration
- [ ] LDAP authentication
- [ ] Cross-region replication
- [ ] Load balancing
- [ ] DDoS protection

---

## Verification & Testing

### 1. Verify Network Binding

**Test external access (should fail):**

```bash
# From another machine on network
mongosh mongodb://192.168.1.x:27017
# Expected: Connection timeout or refused
```

**Test localhost access (should work):**

```bash
mongosh mongodb://localhost:27017
# Expected: Connection succeeds (but auth fails without credentials)
```

---

### 2. Verify Authentication

**Test unauthenticated access (should fail):**

```bash
mongosh mongodb://localhost:27017/harmonia --eval "db.model_artifacts.find()"
# Expected: MongoServerError: command find requires authentication
```

**Test with credentials (should work):**

```bash
mongosh "mongodb://harmonia_app:PASSWORD@localhost:27017/harmonia?authSource=harmonia" \
  --eval "db.model_artifacts.find()"
# Expected: Returns data or empty array
```

---

### 3. Verify Role-Based Access

**Test app user privilege limits:**

```bash
# Should succeed (within privileges)
mongosh "mongodb://harmonia_app:PASSWORD@localhost:27017/harmonia?authSource=harmonia" \
  --eval "db.model_artifacts.insertOne({test: 'data'})"

# Should fail (outside privileges)
mongosh "mongodb://harmonia_app:PASSWORD@localhost:27017/harmonia?authSource=harmonia" \
  --eval "db.getSiblingDB('admin').getUsers()"
# Expected: not authorized on admin to execute command
```

---

### 4. Run Security Audit Script

```bash
# Automated security check
.\scripts\harden-mongodb.bat

# Or directly
mongosh --file scripts/harden-mongodb.js
```

**Expected output:**

```plaintext
✓ Network: Bound to localhost only (secure)
✓ Authentication: Enabled (secure)
✓ Role-based access control configured
Overall Status: ✓ GOOD
```

---

## Incident Response

### Suspected Breach

1. **Immediate actions:**

   ```bash
   # Stop MongoDB service
   Stop-Service MongoDB
   
   # Review logs for suspicious activity
   Get-Content "C:\Program Files\MongoDB\Server\8.0\log\mongod.log" | Select-String "failed"
   ```

2. **Rotate all passwords:**
   - Follow password rotation procedure above
   - Update all application configs
   - Notify team members

3. **Audit user access:**

   ```javascript
   db = db.getSiblingDB('admin');
   db.getUsers();
   // Remove any unauthorized users
   db.dropUser('suspicious_user');
   ```

---

### Failed Authentication Attempts

**Monitor authentication failures:**

```bash
# Check MongoDB logs
Select-String "Authentication failed" "C:\Program Files\MongoDB\Server\8.0\log\mongod.log"
```

**Action thresholds:**

- 1-5 failures: Normal (mistyped password)
- 10+ failures: Investigate source
- 50+ failures: Potential attack, rotate passwords

---

## Compliance & Best Practices

### OWASP Top 10 (Database Security)

| Risk | Status | Mitigation |
|------|--------|------------|
| Broken Access Control | ✅ **Mitigated** | RBAC enforced |
| Cryptographic Failures | ✅ **Mitigated** | Strong passwords, localhost only |
| Injection | ✅ **N/A** | MongoDB uses BSON, Mongoose sanitizes |
| Insecure Design | ✅ **Mitigated** | Defense in depth |
| Security Misconfiguration | ✅ **Mitigated** | Hardening script applied |
| Vulnerable Components | 🟡 **Monitor** | Keep MongoDB updated |
| Auth & Session Failures | ✅ **Mitigated** | Authentication required |
| Software & Data Integrity | ✅ **Mitigated** | Backup strategy implemented |
| Security Logging Failures | 🟡 **Partial** | MongoDB logs enabled (not audit) |
| Server-Side Request Forgery | ✅ **N/A** | Not applicable to MongoDB |

---

### CIS MongoDB Benchmark Alignment

**Level 1 (Basic Security):**

- ✅ 1.1 Enable authentication
- ✅ 1.2 Enable role-based access control
- ✅ 2.1 Bind to localhost
- ✅ 2.2 Disable HTTP interface (default in 8.0)
- ✅ 3.1 Use strong passwords

**Level 2 (Enhanced Security):**

- 🟡 4.1 Enable TLS/SSL (not needed for localhost)
- 🟡 5.1 Enable audit logging (Enterprise feature)
- ✅ 6.1 Regular backups configured

---

## Maintenance Schedule

### Weekly

- ✅ Verify MongoDB service is running
- ✅ Check disk space for logs/data
- ✅ Review recent log entries

### Monthly

- ✅ Test backup restoration
- ✅ Update MongoDB to latest patch version
- ✅ Review user access lists

### Quarterly

- ✅ Rotate passwords
- ✅ Run security audit script
- ✅ Review and update documentation

### Annually

- ✅ Major version upgrade (if needed)
- ✅ Security training for team
- ✅ Disaster recovery drill

---

## Additional Resources

### Official MongoDB Documentation

- Security Checklist: <https://www.mongodb.com/docs/manual/administration/security-checklist/>
- Enable Auth: <https://www.mongodb.com/docs/manual/tutorial/enable-authentication/>
- RBAC: <https://www.mongodb.com/docs/manual/core/authorization/>

### Harmonia-Specific Docs

- `docs/I9_MONGODB_INSTALL.md` - Installation guide
- `docs/QUICKSTART_MONGODB.md` - 10-minute setup
- `docs/DISASTER_RECOVERY.md` - Backup and recovery
- `scripts/harden-mongodb.js` - Security audit script
- `scripts/enable-mongodb-auth.ps1` - Authentication enabler

---

## Summary

**Current Security Posture: HARDENED** 🔒

Your MongoDB installation is production-ready for local development with:

- ✅ Network isolation (localhost only)
- ✅ Authentication required
- ✅ Role-based access control
- ✅ Strong passwords
- ✅ Verified and tested

**For cloud deployment, additionally implement:**

- TLS/SSL encryption
- IP whitelisting
- VPN access
- MongoDB Atlas (managed security)

---

**Last Updated:** December 2, 2025  
**MongoDB Version:** 8.0.6  
**Security Level:** Production-Ready for Local Development
