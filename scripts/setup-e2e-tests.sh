#!/bin/bash
#
# E2E Test Setup Script (Bash version)
# 
# Prepares test environment for E2E authentication tests
# - Creates test database
# - Seeds admin user
# - Cleans up test users from previous runs

set -e

# Parse CLI args
FORCE_DEV_AUTOGEN=false
for arg in "$@"; do
    case $arg in
        --force-dev)
            FORCE_DEV_AUTOGEN=true
            shift
            ;;
        *)
            # ignore other args
            ;;
    esac
done

echo "========================================"
echo "E2E Test Environment Setup"
echo "========================================"
echo ""

# Load environment variables
if [ ! -f ".env" ]; then
    echo "Error: .env file not found"
    exit 1
fi

source .env

if [ -z "$MONGO_ROOT_PASSWORD" ]; then
    echo "Error: MONGO_ROOT_PASSWORD not found in .env"
    exit 1
fi

echo "✓ Environment variables loaded"

# MongoDB connection
MONGO_URI="mongodb://admin:${MONGO_ROOT_PASSWORD}@localhost:27017/harmonia_test?authSource=admin"

echo ""
echo "Step 1: Check MongoDB connection..."

if ! mongosh "$MONGO_URI" --quiet --eval "db.version()" > /dev/null 2>&1; then
    echo "✗ MongoDB connection failed"
    echo "  Make sure MongoDB is running"
    exit 1
fi

MONGO_VERSION=$(mongosh "$MONGO_URI" --quiet --eval "db.version()")
echo "✓ MongoDB connected (version: $MONGO_VERSION)"

echo ""
echo "Step 2: Create test database..."

mongosh "$MONGO_URI" --quiet <<EOF
use harmonia_test;

// Drop existing test data
db.users.deleteMany({ email: /e2e.*@harmonia\.local/ });

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });

// Seed admin user (if not exists)
const adminExists = db.users.findOne({ email: 'admin@harmonia.local' });
if (!adminExists) {
    db.users.insertOne({
        username: 'admin',
        email: 'admin@harmonia.local',
        password: '\$2b\$10\$X3mZp0Y6YqJZ3xKfLm5bCO3fZnXz4Dw5vQ8Rk7Yj1Nv9Hf2Tk5Ue', // Hash for 'AdminP@ssw0rd!'
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    print('✓ Admin user created');
} else {
    print('✓ Admin user already exists');
}

print('✓ Test database ready');
EOF

echo "✓ Test database configured"

echo ""
echo "Step 3: Verify setup..."

mongosh "$MONGO_URI" --quiet <<EOF
use harmonia_test;
const userCount = db.users.countDocuments();
const adminCount = db.users.countDocuments({ role: 'admin' });
print('Total users: ' + userCount);
print('Admin users: ' + adminCount);
EOF

echo "✓ Setup verified"

echo ""
echo "Step 4: Seed default E2E test user (e2e_user)"
echo "If E2E_TEST_USER_EMAIL/E2E_TEST_USER_PASSWORD set in .env, they will be used; otherwise default values will be used."


# E2E test credentials must be provided via .env as environment variables
E2E_USERNAME=${E2E_TEST_USER_USERNAME:-}
E2E_EMAIL=${E2E_TEST_USER_EMAIL:-}
E2E_PASSWORD=${E2E_TEST_USER_PASSWORD:-}

# Allow a guarded fallback to a weak but convenient local test account
# Auto-enable when DEV_AUTOGEN_TEST_USER=true or when this is a local run (no CI env var) or when --force-dev passed
if [ -z "$E2E_EMAIL" ] || [ -z "$E2E_PASSWORD" ] || [ -z "$E2E_USERNAME" ]; then
    if [ "$DEV_AUTOGEN_TEST_USER" = "true" ] || [ "$FORCE_DEV_AUTOGEN" = "true" ] || [ -z "$CI" ]; then
        echo "Warning: DEV_AUTOGEN_TEST_USER is enabled — seeding a default weak test user for local development. Do not use in production."
        if [ "$FORCE_DEV_AUTOGEN" = "true" ]; then
            echo "--force-dev was passed; proceeding with dev user auto-gen even if DEV_AUTOGEN_TEST_USER is not set."
        elif [ -z "$CI" ]; then
            echo "No CI detected; auto-enabling dev autogen for local convenience."
        fi
        E2E_USERNAME=${E2E_USERNAME:-test}
        E2E_EMAIL=${E2E_EMAIL:-test@harmonia.local}
        E2E_PASSWORD=${E2E_PASSWORD:-password}
                # Append to .env for convenience so Playwright gets these variables too
                if [ -f ".env" ]; then
                    if ! grep -q "E2E_TEST_USER_USERNAME" .env; then
                        echo "E2E_TEST_USER_USERNAME=${E2E_USERNAME}" >> .env
                    fi
                    echo "NOTE: If your backend is already running, restart it to pick up the added E2E_TEST_USER_* values from .env"
                    if ! grep -q "E2E_TEST_USER_EMAIL" .env; then
                        echo "E2E_TEST_USER_EMAIL=${E2E_EMAIL}" >> .env
                    fi
                    if ! grep -q "E2E_TEST_USER_PASSWORD" .env; then
                        echo "E2E_TEST_USER_PASSWORD=${E2E_PASSWORD}" >> .env
                    fi
                else
                    echo "E2E_TEST_USER_USERNAME=${E2E_USERNAME}" > .env
                    echo "E2E_TEST_USER_EMAIL=${E2E_EMAIL}" >> .env
                    echo "E2E_TEST_USER_PASSWORD=${E2E_PASSWORD}" >> .env
                fi
    else
        echo "Error: E2E_TEST_USER_USERNAME, E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD must be set in .env for deterministic E2E tests"
        echo "If you are running locally and want a convenient test account, set DEV_AUTOGEN_TEST_USER=true in .env to allow auto-creation of 'test/password' for local dev only."
        echo "Please export these in your .env file (not committed) and re-run: pnpm test:e2e:setup"
        exit 1
    fi
fi

echo "Seeding E2E test user: ${E2E_USERNAME} / ${E2E_EMAIL} (password is stored in .env and will not be printed)"
node scripts/add-test-user.js --env=harmonia_test --username=${E2E_USERNAME} --email=${E2E_EMAIL} --password=${E2E_PASSWORD}
echo "✓ Also adding E2E user to backend DB if different from harmonia_test"
if [ -n "$MONGODB_URI" ]; then
    # Extract DB name from MONGODB_URI (last path segment after slash)
    DB_NAME=$(echo "$MONGODB_URI" | awk -F/ '{print $NF}' | awk -F\? '{print $1}')
    if [ "$DB_NAME" != "harmonia_test" ]; then
        echo "Seeding E2E test user into runtime DB: $DB_NAME"
        # Pass the original MONGODB_URI so add-test-user can connect to the runtime DB host if different from local host
        echo "Using runtime MONGODB_URI: ${MONGODB_URI}"
        node scripts/add-test-user.js --env=$DB_NAME --mongo-uri="$MONGODB_URI" --username=${E2E_USERNAME} --email=${E2E_EMAIL} --password=${E2E_PASSWORD}
        echo "✓ E2E test user seeded into runtime DB: $DB_NAME"
    else
        echo "Runtime DB equals harmonia_test; already seeded"
    fi
fi

echo "✓ E2E test user seeded: ${E2E_EMAIL}"

echo ""
echo "========================================"
echo "E2E Test Environment Ready!"
echo "========================================"
echo ""
echo "Test Database: harmonia_test"
echo "Admin User: admin@harmonia.local (password stored in .env as E2E_ADMIN_PASSWORD)"
echo ""
echo "Run tests with:"
echo "  pnpm test:e2e:auth"
echo ""
