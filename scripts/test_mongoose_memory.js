const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ModelArtifact = require('../src/models-js/modelArtifact');

async function run() {
  let mongod;
  const externalUri = process.env.MONGODB_URI?.trim();

  try {
    let uri = externalUri;
    if (!uri) {
      mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      console.log('Started in-memory MongoDB at', uri);
    } else {
      console.log('Using external MongoDB test service at', uri);
    }

    await mongoose.connect(uri);

    const doc = await ModelArtifact.create({
      name: 'test-model',
      version: 'v0',
      path: '/models/test-model/v0',
      size_bytes: 12345,
      hashes: { sha256: 'deadbeef' },
      tags: ['test'],
    });
    console.log('Created ModelArtifact:', doc.toJSON());

    const found = await ModelArtifact.findOne({ name: 'test-model' }).lean();
    console.log('Found:', found ? 'OK' : 'MISSING');

    if (!found) process.exitCode = 2;
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 3;
  } finally {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }
}

run().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exitCode = 4;
});
