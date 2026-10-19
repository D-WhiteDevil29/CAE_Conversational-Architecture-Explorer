# Complete Setup Guide: Using Local Llama Without Ollama

This guide will walk you through converting your Llama 3.1-8B model and running it with Node.js.

## Overview

**What you're doing:**
1. Converting `.safetensors` → `.gguf` format
2. Installing `node-llama-cpp` package
3. Switching backend to use the GGUF model
4. Running everything locally without Ollama

**Time required:** ~30-45 minutes (mostly waiting for conversion)

---

## Prerequisites Check

```bash
# Check Python (needed for conversion)
python3 --version
# Should show: Python 3.x.x

# Check Node.js
node --version
# Should show: v18.x.x or higher

# Check your model files
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model/Llama-3.1-8B"
ls -lh model-*.safetensors
# Should show all 4 parts (~15GB total)
```

---

## Step 1: Convert Model to GGUF (One-Time Setup)

### Quick Method (Copy-Paste)

```bash
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model"

# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp

# Install Python dependencies
cd llama.cpp
pip3 install -r requirements.txt

# Convert the model (this takes 5-10 minutes)
python3 convert_hf_to_gguf.py ../Llama-3.1-8B --outfile ../llama-3.1-8b.gguf --outtype f16

# Go back to Model directory
cd ..

# Verify it worked
ls -lh llama-3.1-8b.gguf
# Should show: ~8GB file
```

### What Each Command Does

- `--outfile ../llama-3.1-8b.gguf`: Where to save the converted model
- `--outtype f16`: Full precision (best quality, 8GB)
  - Use `q8_0` for 5GB (slightly lower quality)
  - Use `q4_0` for 2.5GB (fastest, lower quality)

### If Conversion Fails

**Error: "No module named 'torch'"**
```bash
pip3 install torch transformers sentencepiece
```

**Error: "out of memory"**
```bash
# Use quantized version (smaller output)
python3 convert_hf_to_gguf.py ../Llama-3.1-8B --outfile ../llama-3.1-8b-q8.gguf --outtype q8_0
```

---

## Step 2: Install Node.js Dependencies

```bash
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model"

# Install node-llama-cpp
npm install node-llama-cpp --legacy-peer-deps

# This may take 2-3 minutes as it downloads native binaries
```

### If Installation Fails

```bash
# Try with force flag
npm install node-llama-cpp --legacy-peer-deps --force

# Or clear cache first
npm cache clean --force
npm install node-llama-cpp --legacy-peer-deps
```

---

## Step 3: Update Configuration

### Create/Update `.env` File

```bash
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model"

# Copy example if you don't have .env yet
cp .env.example .env

# Edit .env file
nano .env
```

Add this line:
```env
GGUF_MODEL_PATH=/Users/P4016534/My Workspace/VS Workspace/CAE/Model/llama-3.1-8b.gguf
```

Or use relative path:
```env
GGUF_MODEL_PATH=./llama-3.1-8b.gguf
```

**Important:** Comment out or remove Ollama config:
```env
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=llama3.1:8b
```

---

## Step 4: Switch to New RAG Pipeline

You have 2 options:

### Option A: Rename Files (Recommended)

```bash
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model/rag"

# Backup old version
mv RAGPipeline.js RAGPipeline-ollama.js

# Use new version
mv RAGPipeline-llama-cpp.js RAGPipeline.js
```

### Option B: Update Server Manually

Edit `server.js` and change the import:
```javascript
// Old:
// import RAGPipeline from './rag/RAGPipeline.js';

// New:
import RAGPipeline from './rag/RAGPipeline-llama-cpp.js';
```

---

## Step 5: Test the Setup

### Test 1: Verify Model Loading

```bash
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model"

# Start the server
npm run dev
```

Look for these messages:
```
 Loading Llama model from: /path/to/llama-3.1-8b.gguf
 Llama model loaded successfully
 Initializing RAG pipeline...
 RAG pipeline initialized
```

### Test 2: Send a Query

Open a new terminal:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, what can you help me with?"}'
```

Expected response:
```json
{
  "answer": "I'm an expert software architecture assistant...",
  "sources": [...]
}
```

---

## Complete Working Example

Here's the full process in one script:

```bash
#!/bin/bash
# save as: setup-local-model.sh

cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model"

echo "Step 1: Converting model to GGUF..."
if [ ! -d "llama.cpp" ]; then
  git clone https://github.com/ggerganov/llama.cpp
fi

cd llama.cpp
pip3 install -r requirements.txt
python3 convert_hf_to_gguf.py ../Llama-3.1-8B --outfile ../llama-3.1-8b.gguf --outtype f16
cd ..

echo "Step 2: Installing node-llama-cpp..."
npm install node-llama-cpp --legacy-peer-deps

echo "Step 3: Updating configuration..."
echo "GGUF_MODEL_PATH=./llama-3.1-8b.gguf" >> .env

echo "Step 4: Switching RAG pipeline..."
cd rag
mv RAGPipeline.js RAGPipeline-ollama.js
mv RAGPipeline-llama-cpp.js RAGPipeline.js
cd ..

echo " Setup complete!"
echo ""
echo "To start the server:"
echo "  npm run dev"
echo ""
echo "To test:"
echo "  curl -X POST http://localhost:3000/api/chat -H 'Content-Type: application/json' -d '{\"message\": \"Hello\"}'"
```

---

## Troubleshooting

### Error: "Model file not found"

```bash
# Check if GGUF file exists
ls -lh /Users/P4016534/My\ Workspace/VS\ Workspace/CAE/Model/llama-3.1-8b.gguf

# If not found, check path in .env
cat .env | grep GGUF_MODEL_PATH
```

### Error: "Cannot find module 'node-llama-cpp'"

```bash
# Reinstall
npm install node-llama-cpp --legacy-peer-deps --force
```

### Model loading is slow

This is normal! Loading an 8GB model takes 30-60 seconds on first start.

### Out of memory errors

Your GGUF file might be too large. Try quantized version:
```bash
python3 llama.cpp/convert_hf_to_gguf.py Llama-3.1-8B --outfile llama-3.1-8b-q4.gguf --outtype q4_0

# Update .env
GGUF_MODEL_PATH=./llama-3.1-8b-q4.gguf
```

### Responses are slow

- **First query:** Always slow (model warm-up) ~10-30 seconds
- **Subsequent queries:** Should be faster ~3-5 seconds
- **To speed up:** Use quantized model (q4_0 or q8_0)

---

## Performance Comparison

| Format | Size | Loading Time | Speed | Quality |
|--------|------|--------------|-------|---------|
| f16 (full) | 8 GB | 60s | Slower | Best |
| q8_0 | 5 GB | 40s | Medium | Very Good |
| q4_0 | 2.5 GB | 20s | Faster | Good |

**For hackathon:** Use q8_0 (good balance)

---

## Architecture Diagram

```
┌─────────────────┐
│   User Query    │
└────────┬────────┘
         │
         v
┌─────────────────────┐
│  Express Server     │
│  (server.js)        │
└─────────┬───────────┘
          │
          v
┌──────────────────────────┐
│  RAGPipeline-llama-cpp.js│
│  ┌────────────────────┐  │
│  │ 1. Load GGUF model │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ 2. Retrieve context│  │
│  │    (TF-IDF search) │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ 3. Generate answer │  │
│  │    (LlamaChatSession)│
│  └────────────────────┘  │
└──────────┬───────────────┘
           │
           v
┌──────────────────────┐
│  llama-3.1-8b.gguf   │
│  (Local model file)  │
└──────────────────────┘
```

---

## Switching Back to Ollama

If you want to go back:

```bash
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model/rag"

# Restore original
mv RAGPipeline.js RAGPipeline-llama-cpp.js
mv RAGPipeline-ollama.js RAGPipeline.js

# Update .env
nano .env
# Uncomment: OLLAMA_BASE_URL and OLLAMA_MODEL
# Comment out: GGUF_MODEL_PATH
```

---

## Next Steps

After successful setup:

1. Run data ingestion: `npm run ingest`
2. Start backend: `npm run dev`
3. Start frontend: `cd ../UI && npm run dev`
4. Open: http://localhost:3001
5. Test chat functionality

---

## Quick Reference Commands

```bash
# Convert model
python3 llama.cpp/convert_hf_to_gguf.py Llama-3.1-8B --outfile llama-3.1-8b.gguf --outtype f16

# Install dependencies
npm install node-llama-cpp --legacy-peer-deps

# Switch implementation
mv rag/RAGPipeline.js rag/RAGPipeline-ollama.js
mv rag/RAGPipeline-llama-cpp.js rag/RAGPipeline.js

# Start server
npm run dev

# Test
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"message": "test"}'
```

---

## Questions?

- Model conversion issues? → See [CONVERT_TO_GGUF.md](CONVERT_TO_GGUF.md)
- Installation problems? → Check node-llama-cpp docs: https://www.npmjs.com/package/node-llama-cpp
- Performance concerns? → Try quantized models (q8_0 or q4_0)
