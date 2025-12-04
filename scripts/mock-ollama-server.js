#!/usr/bin/env node
// Minimal mock server for Ollama v1 completions
const http = require('http');

const PORT = process.env.MOCK_OLLAMA_PORT || 11434;

function sendJson(res, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(s);
}

const server = http.createServer((req, res) => {
  if (req.url === '/v1/completions' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const prompt = parsed.prompt || '';
        // Very simple rule: if prompt includes 'melancholic', return a specific JSON
        let text = '';
        if (prompt && prompt.toLowerCase().includes('melancholic')) {
          text = JSON.stringify({
            title: 'Mock Rain',
            lyrics: 'Raindrops\non the street',
            genre: 'indie',
            mood: 'melancholic',
          });
        } else {
          text = JSON.stringify({
            song: { name: 'Mock Song', lyrics: ['Line A', 'Line B'] },
            genres: ['pop'],
            mood: 'happy',
          });
        }
        const response = { choices: [{ text }] };
        sendJson(res, response);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
      }
    });
    return;
  }
  // default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`Mock Ollama server listening on http://localhost:${PORT}`);
  console.log('Endpoints:\n  POST /v1/completions');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down mock server...');
  server.close(() => process.exit(0));
});
