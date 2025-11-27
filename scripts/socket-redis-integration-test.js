const { io } = require('socket.io-client');
const Redis = require('ioredis');

const EXPECTED = [
  { service: 'music', status: 'requested' },
  { service: 'music', status: 'processing:40' },
  { service: 'music', status: 'processing:70' },
  { service: 'music', status: 'complete' }
];

const socket = io('http://localhost:3000');
const redis = new Redis({ host: 'localhost', port: 6379 });

let got = [];
let timeout = setTimeout(() => {
  console.error('Timeout waiting for events', got);
  process.exit(2);
}, 10000);

socket.on('connect', () => {
  console.log('Connected to socket, id=', socket.id);
  publishSequence();
});
socket.on('connect_error', (err) => {
  console.error('Socket connect_error', err);
});
socket.on('status_update', (payload) => {
  console.log('status_update', payload);
  if (payload.service !== 'music') return; // ignore other services
  // Track music events and ensure they appear in order
  const idx = EXPECTED.findIndex(e => e.service === payload.service && e.status === payload.status);
  if (idx === -1) return; // ignore unknown statuses
  // If we've already accepted this index, ignore duplicates
  if (got.includes(idx)) return;
  // find next expected index
  const nextExpectedIdx = got.length === 0 ? 0 : got[got.length - 1] + 1;
  if (idx === nextExpectedIdx) {
    got.push(idx);
    if (got.length === EXPECTED.length) {
      clearTimeout(timeout);
      console.log('All expected events received, success');
      process.exit(0);
    }
  } else {
    console.error('Out of order payload', payload, 'expected index', nextExpectedIdx);
    clearTimeout(timeout);
    process.exit(3);
  }
});

async function publishSequence() {
  try {
    await redis.set('music_status', 'requested');
    await redis.publish('status_updates', JSON.stringify({ service: 'music', status: 'requested' }));
    await new Promise(r => setTimeout(r, 500));
    await redis.set('music_status', 'processing:40');
    await redis.publish('status_updates', JSON.stringify({ service: 'music', status: 'processing:40' }));
    await new Promise(r => setTimeout(r, 500));
    await redis.set('music_status', 'processing:70');
    await redis.publish('status_updates', JSON.stringify({ service: 'music', status: 'processing:70' }));
    await new Promise(r => setTimeout(r, 500));
    await redis.set('music_status', 'complete');
    await redis.publish('status_updates', JSON.stringify({ service: 'music', status: 'complete' }));
  } catch (e) {
    console.error('Error publishing sequence', e);
    process.exit(4);
  }
}

// If connect hasn't happened within 3s, fail fast
setTimeout(() => {
  if (!socket.connected) {
    console.error('Socket did not connect in time');
    process.exit(5);
  }
}, 10000);
