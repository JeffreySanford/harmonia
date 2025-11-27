const axios = require('axios');
const { io } = require('socket.io-client');
const redis = require('ioredis');

const EXPECTED = [
  { service: 'music', status: 'requested' },
  { service: 'music', status: 'processing:40' },
  { service: 'music', status: 'processing:70' },
  { service: 'music', status: 'complete' }
];

async function main() {
  // Connect to socket
  const socket = io('http://localhost:3000');
  const got = [];

  const timeout = setTimeout(() => {
    console.error('Timeout waiting for events', got);
    process.exit(2);
  }, 20000);

  socket.on('connect', async () => {
    console.log('Socket connected');
    // Post to API
    try {
      await axios.post('http://localhost:3000/api/music', { lyrics: 'A 10 second funny song about coding success' });
      console.log('Posted /api/music');
    } catch (e) {
      console.error('POST to API failed', e.message || e);
      process.exit(6);
    }
    // Trigger microservice simulate endpoint which generates events and audio file
    try {
      await axios.get('http://localhost:8001/simulate');
      console.log('Triggered microservice simulate');
    } catch (e) {
      console.error('Failed to trigger simulate', e.message || e);
      process.exit(7);
    }
  });

  socket.on('status_update', (payload) => {
    console.log('status_update', payload);
    if (payload.service !== 'music') return;
    const idx = EXPECTED.findIndex(e => e.service === payload.service && e.status === payload.status);
    if (idx === -1) return;
    if (got.includes(idx)) return;
    const nextExpectedIdx = got.length === 0 ? 0 : got[got.length - 1] + 1;
    if (idx === nextExpectedIdx) {
      got.push(idx);
      if (got.length === EXPECTED.length) {
        clearTimeout(timeout);
        console.log('Full sequence received, now verify url present');
        // Expect final payload to include url
        const lastPayload = payload;
        if (lastPayload && lastPayload.url) {
          console.log('Final payload included url:', lastPayload.url);
          process.exit(0);
        }
        console.error('Final payload did not include url; generator may not have published a downloadable file');
        process.exit(0);
      }
    } else {
      console.error('Out of order payload', payload, 'expected index', nextExpectedIdx);
      clearTimeout(timeout);
      process.exit(3);
    }
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connect_error', err);
    process.exit(5);
  });
}

main();
