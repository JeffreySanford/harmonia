// MongoDB initialization script - runs on first container start only
// Creates harmonia database, application user, collections with validation, and indexes

db = db.getSiblingDB('harmonia');

// Create application user with limited permissions
// Password comes from MONGO_HARMONIA_PASSWORD env var set in docker-compose
db.createUser({
  user: 'harmonia_app',
  pwd: process.env.MONGO_HARMONIA_PASSWORD || 'changeme',
  roles: [
    {
      role: 'readWrite',
      db: 'harmonia'
    }
  ]
});

print('Created harmonia_app user');

// Create collections with JSON schema validation
db.createCollection('model_artifacts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'version', 'path', 'size_bytes'],
      properties: {
        name: { bsonType: 'string', description: 'Model name - required' },
        version: { bsonType: 'string', description: 'Model version - required' },
        path: { bsonType: 'string', description: 'Local or storage path - required' },
        size_bytes: { bsonType: 'number', minimum: 0, description: 'File size in bytes - required' },
        hashes: { bsonType: 'object', description: 'SHA256 and other checksums' },
        license_id: { bsonType: 'objectId', description: 'Reference to licenses collection' },
        tags: { bsonType: 'array', items: { bsonType: 'string' }, description: 'Searchable tags' }
      }
    }
  }
});

db.createCollection('licenses', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      properties: {
        spdx_id: { bsonType: 'string' },
        text_path: { bsonType: 'string' },
        commercial_use: { bsonType: 'bool' },
        notes: { bsonType: 'string' }
      }
    }
  }
});

db.createCollection('inventory_versions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['version_tag', 'artifact_ids'],
      properties: {
        version_tag: { bsonType: 'string', description: 'Semantic version tag' },
        artifact_ids: { bsonType: 'array', items: { bsonType: 'objectId' } },
        datasets: { bsonType: 'array', items: { bsonType: 'objectId' } }
      }
    }
  }
});

db.createCollection('jobs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['type', 'status'],
      properties: {
        type: { enum: ['download', 'validate', 'inference', 'export'], description: 'Job type' },
        status: { enum: ['pending', 'running', 'success', 'failed'], description: 'Job status' },
        worker_id: { bsonType: 'string' },
        params: { bsonType: 'object' },
        started_at: { bsonType: 'date' },
        finished_at: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('events', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['event_type', 'created_at'],
      properties: {
        event_type: { bsonType: 'string' },
        payload: { bsonType: 'object' },
        created_at: { bsonType: 'date' }
      }
    }
  }
});

print('Created collections with validation schemas');

// Create indexes
db.model_artifacts.createIndex({ name: 1, version: 1 }, { unique: true });
db.model_artifacts.createIndex({ tags: 1 });
db.model_artifacts.createIndex({ 'hashes.sha256': 1 });

db.jobs.createIndex({ status: 1, worker_id: 1 });
db.jobs.createIndex({ type: 1, created_at: -1 });

db.inventory_versions.createIndex({ version_tag: 1 }, { unique: true });
db.inventory_versions.createIndex({ created_at: -1 });

// TTL index for events - auto-delete after 30 days
db.events.createIndex({ created_at: 1 }, { expireAfterSeconds: 2592000 });

print('Created indexes');

// Insert example document to verify setup
db.model_artifacts.insertOne({
  name: '_setup_test',
  version: 'v0',
  path: '/setup/test',
  size_bytes: 0,
  tags: ['setup', 'test'],
  createdAt: new Date()
});

print('Harmonia database initialized successfully');
print('Collections: ' + db.getCollectionNames().join(', '));
print('Ready for application connections');
