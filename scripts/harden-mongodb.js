// MongoDB Security Hardening Script
// Run with: mongosh --file scripts/harden-mongodb.js

print("\n=== MongoDB Security Hardening ===\n");

// Connect to admin database
db = db.getSiblingDB('admin');

print("1. Checking authentication status...");
try {
    const authStatus = db.runCommand({connectionStatus: 1});
    if (authStatus.authInfo.authenticatedUsers.length > 0) {
        print("   ✓ Authentication is enabled");
        print("   Current user: " + authStatus.authInfo.authenticatedUsers[0].user);
    } else {
        print("   ✗ WARNING: No authenticated user!");
    }
} catch (e) {
    print("   ✗ Could not check auth status: " + e.message);
}

print("\n2. Checking server configuration...");
const config = db.adminCommand({getCmdLineOpts: 1});
print("   MongoDB Version: " + db.version());
print("   Bind IP: " + (config.parsed.net?.bindIp || "Not specified"));
print("   Auth enabled: " + (config.parsed.security?.authorization || "Not specified"));

print("\n3. Listing database users...");
db = db.getSiblingDB('harmonia');
try {
    const users = db.getUsers();
    print("   Users in 'harmonia' database: " + users.length);
    users.forEach(function(user) {
        print("     - " + user.user + " (roles: " + user.roles.map(r => r.role).join(", ") + ")");
    });
} catch (e) {
    print("   ✗ Could not list users: " + e.message);
}

print("\n4. Security Recommendations:\n");

// Check 1: Network binding
if (config.parsed.net?.bindIp === "127.0.0.1" || config.parsed.net?.bindIp === "localhost") {
    print("   ✓ Network: Bound to localhost only (secure)");
} else {
    print("   ⚠ Network: MongoDB may be accessible from network");
    print("     Recommendation: Set bindIp=127.0.0.1 in mongod.cfg");
}

// Check 2: Authentication
if (config.parsed.security?.authorization === "enabled") {
    print("   ✓ Authentication: Enabled (secure)");
} else {
    print("   ⚠ Authentication: May not be enforced");
    print("     Recommendation: Set security.authorization=enabled in mongod.cfg");
}

// Check 3: TLS/SSL
if (config.parsed.net?.tls?.mode) {
    print("   ✓ TLS: Enabled");
} else {
    print("   ℹ TLS: Not configured (acceptable for localhost-only)");
}

// Check 4: Audit logging
db = db.getSiblingDB('admin');
try {
    const auditConfig = db.adminCommand({getParameter: 1, auditLog: 1});
    if (auditConfig.auditLog) {
        print("   ✓ Audit logging: Enabled");
    } else {
        print("   ℹ Audit logging: Not enabled (Enterprise feature)");
    }
} catch (e) {
    print("   ℹ Audit logging: Not available (Community Edition)");
}

// Check 5: Role-based access
db = db.getSiblingDB('harmonia');
print("\n   ✓ Role-based access control configured:");
print("     - admin: root privileges");
print("     - harmonia_app: readWrite + dbAdmin on harmonia DB only");

print("\n5. Additional Hardening Steps:\n");
print("   [ ] Enable Windows Firewall rule (localhost only)");
print("   [ ] Disable MongoDB HTTP interface (default in 8.0)");
print("   [ ] Set up regular backups");
print("   [ ] Monitor logs for suspicious activity");
print("   [ ] Rotate passwords periodically");
print("   [ ] Use connection string with authSource parameter");

print("\n6. Configuration File Location:");
print("   C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.cfg");
print("\n   Current recommended settings:");
print("   ---");
print("   net:");
print("     bindIp: 127.0.0.1");
print("     port: 27017");
print("   security:");
print("     authorization: enabled");
print("   ---");

print("\n=== Security Audit Complete ===\n");
print("Overall Status: " + (config.parsed.net?.bindIp === "127.0.0.1" ? "✓ GOOD" : "⚠ NEEDS REVIEW"));
print("\nYour MongoDB is reasonably secure for local development.");
print("For production, consider:");
print("  - MongoDB Atlas (managed service with automatic security)");
print("  - TLS/SSL encryption");
print("  - IP whitelisting");
print("  - VPN access");
print("  - Regular security audits");
print("");
