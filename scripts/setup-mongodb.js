// MongoDB Setup Script for Harmonia
// This script creates users and collections

// Load passwords from environment or use these placeholders
const rootPassword = "luCBrfAx6lUJgYQgi+iHRVTeNShs21FDLFN6C+F34IQ=";
const appPassword = "vcd7VKCS3I+8jEC4EhdPKNKyowh0ikAE5GK5Jarn7yA=";

print("\n=== Harmonia MongoDB Setup ===\n");

// Switch to admin database
db = db.getSiblingDB('admin');

// Create root user
try {
    db.createUser({
        user: "admin",
        pwd: rootPassword,
        roles: ["root"]
    });
    print("✓ Created admin user");
} catch (e) {
    if (e.code === 51003) {
        print("ℹ Admin user already exists");
    } else {
        print("✗ Error creating admin user: " + e.message);
    }
}

// Switch to harmonia database
db = db.getSiblingDB('harmonia');

// Create application user
try {
    db.createUser({
        user: "harmonia_app",
        pwd: appPassword,
        roles: [
            { role: "readWrite", db: "harmonia" },
            { role: "dbAdmin", db: "harmonia" }
        ]
    });
    print("✓ Created harmonia_app user");
} catch (e) {
    if (e.code === 51003) {
        print("ℹ harmonia_app user already exists");
    } else {
        print("✗ Error creating harmonia_app user: " + e.message);
    }
}

// Create collections
const collections = [
    "model_artifacts",
    "licenses",
    "inventory_versions",
    "jobs",
    "events"
];

print("\nCreating collections...");
collections.forEach(function(name) {
    try {
        db.createCollection(name);
        print("  ✓ " + name);
    } catch (e) {
        if (e.code === 48) {
            print("  ℹ " + name + " already exists");
        } else {
            print("  ✗ " + name + " error: " + e.message);
        }
    }
});

print("\n=== Setup Complete ===\n");
print("Collections in harmonia database:");
db.getCollectionNames().forEach(function(name) {
    print("  - " + name);
});

print("\nYou can now connect with:");
print("  mongosh mongodb://harmonia_app:****@localhost:27017/harmonia");
print("");
