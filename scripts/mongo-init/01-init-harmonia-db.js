// MongoDB initialization script - runs on first container start only
// Creates harmonia database, application user, collections with validation, and indexes

const appPassword = process.env.MONGO_HARMONIA_PASSWORD;
if (!appPassword) {
  throw new Error('MONGO_HARMONIA_PASSWORD is required to initialize Harmonia');
}

db = db.getSiblingDB('harmonia');

// Create application user with limited permissions.
db.createUser({
  user: 'harmonia_app',
  pwd: appPassword,
  roles: [
    {
      role: 'readWrite',
      db: 'harmonia'
    }
  ]
});

print('Created harmonia_app user');

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
      required: ['userId', 'jobType', 'status'],
      properties: {
        userId: {
          bsonType: 'objectId',
          description: 'Owning user - required'
        },
        jobType: {
          enum: ['generate', 'convert', 'analyze', 'train'],
          description: 'Job type - required'
        },
        status: {
          enum: [
            'pending',
            'queued',
            'processing',
            'completed',
            'failed',
            'cancelled'
          ],
          description: 'Job status - required'
        },
        priority: { bsonType: 'number' },
        modelId: { bsonType: 'string' },
        datasetId: { bsonType: 'string' },
        parameters: { bsonType: 'object' },
        progress: { bsonType: ['object', 'null'] },
        result: { bsonType: ['object', 'null'] },
        startedAt: { bsonType: ['date', 'null'] },
        completedAt: { bsonType: ['date', 'null'] },
        estimatedDuration: { bsonType: ['number', 'null'] },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  },
  validationLevel: 'strict',
  validationAction: 'error'
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

db.model_artifacts.createIndex({ name: 1, version: 1 }, { unique: true });
db.model_artifacts.createIndex({ tags: 1 });
db.model_artifacts.createIndex({ 'hashes.sha256': 1 });
db.jobs.createIndex({ userId: 1, createdAt: -1 });
db.jobs.createIndex({ userId: 1, status: 1, createdAt: -1 });
db.jobs.createIndex({ userId: 1, jobType: 1, createdAt: -1 });
db.inventory_versions.createIndex({ version_tag: 1 }, { unique: true });
db.inventory_versions.createIndex({ created_at: -1 });
db.events.createIndex({ created_at: 1 }, { expireAfterSeconds: 2592000 });

print('Created indexes');

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
