#!/usr/bin/env node
/*
Simple migration helper: reads `inventory/combined_inventory.json` and inserts model artifacts
into MongoDB. Use `MONGO_URI` env var to point to a running MongoDB. If not set, it will only
dry-run and print the intended operations.
*/
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ModelArtifact = require('../src/models-js/modelArtifact');

async function main() {
  const invPath = path.resolve(process.cwd(), 'inventory', 'combined_inventory.json');
  if (!fs.existsSync(invPath)) {
    console.error('inventory/combined_inventory.json not found');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(invPath, 'utf8'));
  const models = data.models || [];
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log('MONGO_URI not set — dry-run mode. Items to import:');
    for (const m of models) {
      console.log('-', m.name || m.path, m.version || '<no-version>', m.path || '<no-path>');
    }
    process.exit(0);
  }
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  for (const m of models) {
    const doc = {
      name: m.name || (m.path || '').split('/').slice(-1)[0],
      version: m.version || 'v0',
      path: m.path || '',
      size_bytes: m.size_bytes || 0,
      hashes: m.hashes || {}
    };
    await ModelArtifact.updateOne({ name: doc.name, version: doc.version }, { $set: doc }, { upsert: true });
    console.log('Upserted', doc.name, doc.version);
  }
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(2); });
