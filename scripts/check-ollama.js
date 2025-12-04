#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const url = process.env.OLLAMA_URL || 'http://localhost:11434';
const model = process.env.OLLAMA_MODEL || 'deepseek';
(async () => {
  try {
    console.log(`Checking Ollama at ${url}`);
    const res = await fetch(`${url}/v1/models`);
    if (!res.ok) {
      console.error('Failed to list models', res.status, await res.text());
      process.exit(2);
    }
    const models = await res.json();
    console.log('Models available:', models.data.map((m) => m.id).join(', '));
    // Quick generation probe
    const genRes = await fetch(`${url}/v1/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt:
          'Return a JSON object {"title":"x","lyrics":"y","genre":"g","mood":"m"}',
        max_tokens: 80,
      }),
    });
    if (!genRes.ok) {
      console.error('Generation failed', genRes.status, await genRes.text());
      process.exit(3);
    }
    const out = await genRes.text();
    console.log('Generation probe output (first 200 chars):');
    console.log(out.substring(0, 200));
    process.exit(0);
  } catch (err) {
    console.error('Error connecting to Ollama:', err.message);
    process.exit(1);
  }
})();
