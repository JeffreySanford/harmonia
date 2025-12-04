#!/usr/bin/env ts-node
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
let dotenv: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  dotenv = require('dotenv');
} catch (e) {
  dotenv = null;
}
import { mapResponseForModel } from '../apps/backend/src/llm/mappers';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function usage() {
  console.log(`Usage: debug-llm.ts [--model model-id] [--llm] [--raw '{...}' | --raw-file <file>]

Options:
  --model <id>        OLLAMA model id (deepseek, deepseek-coder:6.7b, minstral3)
  --llm               Query the local Ollama server and map the returned raw output
  --raw <json>        Use provided raw JSON (string) as model output to map
  --raw-file <path>   Read raw JSON from file to map
`);
}

async function callOllama(modelId: string, narrative: string) {
  const url = process.env.OLLAMA_URL || 'http://localhost:11434';
  const body = {
    model: modelId,
    prompt: `You are a music metadata generator. Output exactly one JSON object with keys: title, lyrics, genre, mood. Narrative: ${narrative}`,
    temperature: 0.6,
    max_tokens: 400,
  };
  const res = await axios.post(`${url}/v1/completions`, body, {
    timeout: 20_000,
  });
  const text = res.data?.choices?.[0]?.text || res.data?.text || '';
  return text;
}

function extractJson(text: string): any | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = text.substring(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    try {
      return JSON.parse(candidate.replace(/'/g, '"'));
    } catch (e2) {
      return null;
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    usage();
    process.exit(0);
  }

  let modelId: string | undefined;
  if (argv.includes('--model')) {
    const mi = argv.indexOf('--model');
    if (mi !== -1 && argv[mi + 1]) modelId = argv[mi + 1];
  }
  modelId = modelId || process.env.OLLAMA_MODEL || 'deepseek';
  const useLLM = argv.includes('--llm');
  const rawArgIdx = argv.findIndex((a) => a === '--raw');
  const rawFileArgIdx = argv.findIndex((a) => a === '--raw-file');

  let raw: any = null;
  if (rawArgIdx !== -1) {
    const rawStr = argv[rawArgIdx + 1];
    if (!rawStr) {
      console.error('Missing value for --raw');
      process.exit(2);
    }
    try {
      raw = JSON.parse(rawStr);
    } catch (e) {
      console.error('Invalid JSON provided to --raw');
      process.exit(2);
    }
  }
  if (rawFileArgIdx !== -1) {
    const filePath = argv[rawFileArgIdx + 1];
    if (!filePath || !fs.existsSync(filePath)) {
      console.error('Raw file not found:', filePath);
      process.exit(2);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      raw = JSON.parse(content);
    } catch (e) {
      console.error('Invalid JSON in raw file:', filePath);
      process.exit(2);
    }
  }

  if (useLLM) {
    const narrative =
      'A melancholic story about rain and lost love in a quiet city.';
    console.log('Calling Ollama model', modelId);
    try {
      const text = await callOllama(modelId!, narrative);
      console.log(
        'Raw model output (first 600 chars):',
        text.substring(0, 600)
      );
      const parsed = extractJson(text);
      if (!parsed) {
        console.error('Failed to parse JSON from model output');
        process.exit(3);
      }
      raw = parsed;
    } catch (e: any) {
      console.error('Error calling Ollama:', (e && e.message) || e);
      process.exit(4);
    }
  }

  if (!raw) {
    // default sample raw for each model
    if ((modelId || '').toLowerCase().includes('deepseek')) {
      raw = {
        title: 'Rain Song',
        lyrics: 'A\nB\nC',
        genre: 'indie',
        mood: 'melancholic',
      };
    } else {
      raw = {
        song: { name: 'Rain Story', lyrics: ['Line1', 'Line2'] },
        genres: ['indie'],
        mood: 'reflective',
      };
    }
  }

  console.log('Raw input:', JSON.stringify(raw, null, 2));
  const normalized = mapResponseForModel(modelId!, raw);
  console.log('Normalized output:', JSON.stringify(normalized, null, 2));
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
