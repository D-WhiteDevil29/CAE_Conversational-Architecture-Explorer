# Using Your Local Llama 3.1 8B Model

You have successfully downloaded the complete Llama 3.1 8B model. Here's how to use it with CAE.

## Prerequisites

**⚠️ You need Ollama installed first!**

If `ollama serve` gave you "command not found", see: [INSTALL_OLLAMA.md](INSTALL_OLLAMA.md)

## Model Files Found

```
Llama-3.1-8B/
├── model-00001-of-00004.safetensors (4.6 GB)
├── model-00002-of-00004.safetensors (4.7 GB)
├── model-00003-of-00004.safetensors (4.6 GB)
├── model-00004-of-00004.safetensors (1.1 GB)
├── config.json
├── tokenizer.json
├── tokenizer_config.json
├── generation_config.json
└── special_tokens_map.json

Total: ~15 GB
```

## Import Steps

### Step 1: Ensure Ollama is Running

Open a terminal and start Ollama:

```bash
ollama serve
```

Keep this terminal open.

### Step 2: Import Model (New Terminal)

```bash
cd Model
./import-model.sh
```

This will:
- Verify all model files are present
- Create an Ollama model named `llama3.1-local`
- Take 5-10 minutes to import

### Step 3: Test the Model

After import completes:

```bash
ollama list
# Should show: llama3.1-local

ollama run llama3.1-local "Hello, introduce yourself"
```

### Step 4: Update Configuration

Edit `Model/.env`:

```env
# Change from:
OLLAMA_MODEL=llama3.1:8b

# To:
OLLAMA_MODEL=llama3.1-local
```

### Step 5: Restart Backend

```bash
cd Model
npm run dev
```

## Quick Import (One Command)

If Ollama is already running:

```bash
cd Model
./import-model.sh && echo "OLLAMA_MODEL=llama3.1-local" >> .env
```

## Verification

Test the RAG pipeline with your local model:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, what can you help me with?"}'
```

## Troubleshooting

### Error: "Ollama is not running"

```bash
# Start Ollama in a new terminal
ollama serve
```

### Error: "model not found"

```bash
# Re-run import
cd Model
./import-model.sh
```

### Model too slow

The local model (15GB) requires significant RAM. If performance is poor:

**Option 1: Use quantized version**
```bash
# Download smaller quantized version
ollama pull llama3.1:8b-instruct-q4_0
```

**Option 2: Keep using Ollama's built-in**
```bash
# Revert .env
OLLAMA_MODEL=llama3.1:8b
```

## Comparison

| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| Ollama llama3.1:8b | ~4.7 GB | Fast | Optimized |
| Your llama3.1-local | ~15 GB | Slower | Full precision |

**Recommendation:** Try both and see which works better for your hackathon!

## Next Steps

After successful import:

1. Run data ingestion: `npm run ingest`
2. Start backend: `npm run dev`
3. Start frontend: `cd ../UI && npm run dev`
4. Test chat: http://localhost:3001
