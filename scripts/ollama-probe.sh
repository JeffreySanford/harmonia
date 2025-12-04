#!/usr/bin/env bash
set -euo pipefail
URL=${OLLAMA_URL:-http://localhost:11434}
MODEL=${OLLAMA_MODEL:-deepseek}

echo "Checking Ollama at $URL"
echo "Listing models:"
curl -sS "$URL/v1/models" | jq -r '.data[].id'

echo "Probing generation on model: $MODEL"
PAYLOAD=$(jq -n --arg m "$MODEL" --arg p "Generate a JSON object {\"title\":\"...\",\"lyrics\":\"Line1\\nLine2\\nLine3\",\"genre\":\"...\",\"mood\":\"...\"} for a short melancholic song." '{model:$m, prompt:$p, max_tokens:200, temperature:0.6}')

curl -sS -X POST "$URL/v1/completions" -H "Content-Type: application/json" -d "$PAYLOAD" | jq -r '.["choices"]? // .'
echo

echo "Probe completed"
#!/usr/bin/env bash
set -e
URL=${OLLAMA_URL:-http://localhost:11434}
MODEL=${OLLAMA_MODEL:-deepseek}

echo "Checking Ollama at $URL"
echo "Listing models:"
curl -sS "$URL/v1/models" | jq -r '.data[].id'

echo "Probing generation on model: $MODEL"
curl -sS -X POST "$URL/v1/completions" -H "Content-Type: application/json" -d '{"model":"'