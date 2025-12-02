#!/usr/bin/env node
/**
 * Disaster Recovery Restoration Script
 * 
 * Restores MongoDB collections from seed JSON file.
 * Use this to rebuild database after catastrophic failure.
 * 
 * Usage:
 *   MONGO_URI=<uri> node scripts/restore-from-seed.js [--seed-file path/to/seed.json] [--force]
 * 
 * Options:
 *   --seed-file    Path to seed JSON (default: seeds/disaster-recovery-seed.json)
 *   --force        Skip confirmation prompt
 *   --drop         Drop existing collections before restore
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Import models
const ModelArtifact = require('../src/models-js/modelArtifact');

const DEFAULT_SEED_FILE = path.resolve(__dirname, '../seeds/disaster-recovery-seed.json');

async function loadSeedData(seedFile) {
  if (!fs.existsSync(seedFile)) {
    console.error(`Seed file not found: ${seedFile}`);
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  console.log(`Loaded seed data version ${data.version}`);
  console.log(`Generated at: ${data.generated_at}`);
  console.log(`Total documents: ${data.metadata.total_documents}`);
  return data;
}

async function confirmRestore(seedData, options) {
  if (options.force) return true;
  
  console.log('\n⚠️  WARNING: This will restore data to MongoDB');
  if (options.drop) {
    console.log('⚠️  --drop flag set: Existing collections will be DROPPED');
  }
  console.log(`\nCollections to restore: ${Object.keys(seedData.collections).join(', ')}`);
  console.log(`Total documents: ${seedData.metadata.total_documents}`);
  
  // In non-interactive mode, fail safe
  if (!process.stdin.isTTY) {
    console.log('\nNon-interactive mode: use --force to proceed');
    return false;
  }
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    readline.question('\nProceed with restore? (yes/no): ', (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function restoreCollection(db, collectionName, documents, options) {
  if (!documents || documents.length === 0) {
    console.log(`  ${collectionName}: No documents to restore`);
    return { inserted: 0, updated: 0 };
  }
  
  const collection = db.collection(collectionName);
  
  if (options.drop) {
    console.log(`  ${collectionName}: Dropping existing collection...`);
    try {
      await collection.drop();
    } catch (err) {
      if (err.code !== 26) { // 26 = NamespaceNotFound, ok to ignore
        throw err;
      }
    }
  }
  
  console.log(`  ${collectionName}: Restoring ${documents.length} documents...`);
  
  let inserted = 0;
  let updated = 0;
  
  for (const doc of documents) {
    try {
      // Convert _id string to ObjectId if needed
      if (doc._id && typeof doc._id === 'string' && !doc._id.startsWith('seed_')) {
        doc._id = new mongoose.Types.ObjectId(doc._id);
      } else if (doc._id && typeof doc._id === 'string') {
        // Keep seed_ prefixed IDs as strings for tracking
        // In production, these would be ObjectIds
      }
      
      // Convert date strings to Date objects
      ['createdAt', 'updatedAt', 'created_at', 'started_at', 'finished_at', 'published_at'].forEach(field => {
        if (doc[field] && typeof doc[field] === 'string') {
          doc[field] = new Date(doc[field]);
        }
      });
      
      // Upsert document
      const result = await collection.replaceOne(
        { _id: doc._id },
        doc,
        { upsert: true }
      );
      
      if (result.upsertedCount > 0) {
        inserted++;
      } else if (result.modifiedCount > 0) {
        updated++;
      }
    } catch (err) {
      console.error(`    Error restoring document ${doc._id}:`, err.message);
    }
  }
  
  console.log(`  ${collectionName}: ✅ ${inserted} inserted, ${updated} updated`);
  return { inserted, updated };
}

async function restoreDatabase(seedData, options) {
  const mongoUri = process.env.MONGO_URI;
  
  if (!mongoUri) {
    console.error('MONGO_URI environment variable not set');
    console.error('Example: MONGO_URI=mongodb://user:pass@localhost:27017/harmonia node scripts/restore-from-seed.js');
    process.exit(1);
  }
  
  console.log('\nConnecting to MongoDB...');
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  const db = mongoose.connection.db;
  console.log('✅ Connected\n');
  
  console.log('Starting restore...\n');
  
  const stats = {
    collections: 0,
    inserted: 0,
    updated: 0
  };
  
  // Restore collections in order
  const collectionOrder = [
    'licenses',          // No dependencies
    'model_artifacts',   // Depends on licenses (optional)
    'inventory_versions', // Depends on model_artifacts
    'jobs',              // Independent
    'events'             // Independent
  ];
  
  for (const collectionName of collectionOrder) {
    if (seedData.collections[collectionName]) {
      const result = await restoreCollection(
        db,
        collectionName,
        seedData.collections[collectionName],
        options
      );
      stats.collections++;
      stats.inserted += result.inserted;
      stats.updated += result.updated;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('RESTORE COMPLETE');
  console.log('='.repeat(60));
  console.log(`Collections restored: ${stats.collections}`);
  console.log(`Documents inserted: ${stats.inserted}`);
  console.log(`Documents updated: ${stats.updated}`);
  console.log(`Total operations: ${stats.inserted + stats.updated}`);
  console.log('='.repeat(60) + '\n');
  
  await mongoose.disconnect();
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    seedFile: DEFAULT_SEED_FILE,
    force: false,
    drop: false
  };
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed-file' && args[i + 1]) {
      options.seedFile = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--force') {
      options.force = true;
    } else if (args[i] === '--drop') {
      options.drop = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: MONGO_URI=<uri> node scripts/restore-from-seed.js [options]');
      console.log('\nOptions:');
      console.log('  --seed-file <path>  Path to seed JSON (default: seeds/disaster-recovery-seed.json)');
      console.log('  --force             Skip confirmation prompt');
      console.log('  --drop              Drop existing collections before restore');
      console.log('  --help, -h          Show this help message');
      process.exit(0);
    }
  }
  
  try {
    const seedData = await loadSeedData(options.seedFile);
    const confirmed = await confirmRestore(seedData, options);
    
    if (!confirmed) {
      console.log('\nRestore cancelled');
      process.exit(0);
    }
    
    await restoreDatabase(seedData, options);
    console.log('✅ Disaster recovery restore completed successfully\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Restore failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
