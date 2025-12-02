#!/usr/bin/env node
/**
 * Generate Disaster Recovery Seed File
 * 
 * Exports current MongoDB state to JSON seed file for disaster recovery.
 * Run this after major changes or on a schedule to maintain DR backups.
 * 
 * Usage:
 *   MONGO_URI=<uri> node scripts/generate-seed.js [--output path/to/output.json]
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DEFAULT_OUTPUT = path.resolve(__dirname, '../seeds/disaster-recovery-seed.json');

async function exportCollection(db, collectionName) {
  const collection = db.collection(collectionName);
  const documents = await collection.find({}).toArray();
  
  // Convert ObjectIds and Dates to strings for JSON serialization
  return documents.map(doc => {
    const serialized = { ...doc };
    
    // Convert _id
    if (serialized._id) {
      serialized._id = serialized._id.toString();
    }
    
    // Convert dates
    ['createdAt', 'updatedAt', 'created_at', 'started_at', 'finished_at', 'published_at'].forEach(field => {
      if (serialized[field] instanceof Date) {
        serialized[field] = serialized[field].toISOString();
      }
    });
    
    return serialized;
  });
}

async function generateSeed(outputPath) {
  const mongoUri = process.env.MONGO_URI;
  
  if (!mongoUri) {
    console.error('MONGO_URI environment variable not set');
    process.exit(1);
  }
  
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  const db = mongoose.connection.db;
  console.log('✅ Connected\n');
  
  console.log('Exporting collections...\n');
  
  const collections = {
    model_artifacts: await exportCollection(db, 'model_artifacts'),
    licenses: await exportCollection(db, 'licenses'),
    inventory_versions: await exportCollection(db, 'inventory_versions'),
    jobs: await exportCollection(db, 'jobs'),
    events: await exportCollection(db, 'events')
  };
  
  let totalDocs = 0;
  for (const [name, docs] of Object.entries(collections)) {
    console.log(`  ${name}: ${docs.length} documents`);
    totalDocs += docs.length;
  }
  
  const seedData = {
    "$schema": "./seed_schema.json",
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    description: "Disaster recovery seed data for Harmonia MongoDB collections",
    collections,
    metadata: {
      total_documents: totalDocs,
      collections_count: Object.keys(collections).length,
      seed_purpose: "disaster_recovery",
      restore_instructions: "Use scripts/restore-from-seed.js to restore this data"
    }
  };
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(seedData, null, 2), 'utf8');
  
  console.log(`\n✅ Seed file generated: ${outputPath}`);
  console.log(`Total documents: ${totalDocs}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB\n`);
  
  await mongoose.disconnect();
}

async function main() {
  const args = process.argv.slice(2);
  let outputPath = DEFAULT_OUTPUT;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputPath = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: MONGO_URI=<uri> node scripts/generate-seed.js [options]');
      console.log('\nOptions:');
      console.log('  --output <path>  Output path (default: seeds/disaster-recovery-seed.json)');
      console.log('  --help, -h       Show this help message');
      process.exit(0);
    }
  }
  
  try {
    await generateSeed(outputPath);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seed generation failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
