const { io } = require('socket.io-client');
const Redis = require('ioredis');

const socket = io('http://localhost:3000');
const redis = new Redis({ host: 'localhost', port: 6379 });

socket.on('connect', () => {
  console.log('Connected to socket server with id', socket.id);
});

socket.on('status_update', (data) => {
  console.log('status_update', data);
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
  process.exit(0);
});

async function run() {
  console.log('Setting statuses...');
  await redis.set('music_status', 'requested');
  await new Promise(r => setTimeout(r, 1000));
  await redis.set('music_status', 'processing:40');
  await new Promise(r => setTimeout(r, 1000));
  await redis.set('music_status', 'processing:70');
  await new Promise(r => setTimeout(r, 1000));
  await redis.set('music_status', 'complete');
  await new Promise(r => setTimeout(r, 1000));
  console.log('Done setting statuses; closing socket in 2s...');
  setTimeout(() => { socket.disconnect(); redis.quit(); }, 2000);
}

run().catch(e => {
  console.error('Error in run', e);
  process.exit(1);
});
