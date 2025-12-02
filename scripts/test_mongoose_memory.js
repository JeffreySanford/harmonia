const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ModelArtifact = require('../src/models-js/modelArtifact');

async function run() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log('Started in-memory mongo at', uri);
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    const doc = await ModelArtifact.create({
      name: 'test-model',
      version: 'v0',
      path: '/models/test-model/v0',
      size_bytes: 12345,
      hashes: { sha256: 'deadbeef' },
      tags: ['test']
    });
    console.log('Created ModelArtifact:', doc.toJSON());

    const found = await ModelArtifact.findOne({ name: 'test-model' }).lean();
    console.log('Found:', found ? 'OK' : 'MISSING');
    process.exit(found ? 0 : 2);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(3);
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
}

run();
