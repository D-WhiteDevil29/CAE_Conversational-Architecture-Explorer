# Quick Start: Run Llama Locally Without Ollama

## TL;DR - Automated Setup (Recommended)

```bash
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model"
./setup-local-model.sh
```

This script will:
1. Convert your safetensors to GGUF
2. Install node-llama-cpp
3. Update configuration
4. Switch backend to use local model
5. No Ollama required!

**Time:** 10-15 minutes (mostly waiting for conversion)

---

## Manual Setup (Step by Step)

If you prefer to do it manually, follow [SETUP_LOCAL_MODEL.md](SETUP_LOCAL_MODEL.md)

---

## What You Need

**Before starting:**
- Llama 3.1-8B safetensors files (you have these in `Llama-3.1-8B/`)
- Python 3 installed
- Node.js installed
- ~10GB free disk space

---

## Quick Commands

### Convert Model
```bash
cd Model
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
pip3 install -r requirements.txt
python3 convert_hf_to_gguf.py ../Llama-3.1-8B --outfile ../llama-3.1-8b.gguf --outtype f16
```

### Install Dependencies
```bash
cd ..
npm install node-llama-cpp --legacy-peer-deps
```

### Switch Implementation
```bash
cd rag
mv RAGPipeline.js RAGPipeline-ollama.js
mv RAGPipeline-llama-cpp.js RAGPipeline.js
cd ..
```

### Update .env
```env
GGUF_MODEL_PATH=./llama-3.1-8b.gguf
# OLLAMA_BASE_URL=http://localhost:11434  # commented out
# OLLAMA_MODEL=llama3.1:8b                # commented out
```

### Start Server
```bash
npm run dev
```

---

## After Setup

1. **Start backend:**
   ```bash
   cd Model
   npm run dev
   ```

2. **Start frontend (new terminal):**
   ```bash
   cd UI
   npm run dev
   ```

3. **Open browser:**
   ```
   http://localhost:3001
   ```

---

## Troubleshooting

**"Model file not found"**
- Check `.env` has correct path: `GGUF_MODEL_PATH=./llama-3.1-8b.gguf`
- Verify file exists: `ls -lh llama-3.1-8b.gguf`

**"Cannot find module node-llama-cpp"**
- Reinstall: `npm install node-llama-cpp --legacy-peer-deps --force`

**Conversion fails**
- Install torch: `pip3 install torch transformers sentencepiece`
- Use smaller format: `--outtype q8_0` instead of `f16`

**Too slow**
- Use quantized model: `--outtype q4_0` (2.5GB, much faster)
- First query always slow (30-60s warm-up)

---

## Files Created

After running setup:

```
Model/
├── llama-3.1-8b.gguf              # Converted model (8GB)
├── llama.cpp/                     # Conversion tools
├── rag/
│   ├── RAGPipeline.js              # New: uses node-llama-cpp
│   ├── RAGPipeline-ollama.js       # Backup: original Ollama version
│   └── RAGPipeline-llama-cpp.js    # Source for new implementation
└── .env                            # Updated configuration
```

---

## Documentation

- **Full guide:** [SETUP_LOCAL_MODEL.md](SETUP_LOCAL_MODEL.md)
- **Conversion details:** [CONVERT_TO_GGUF.md](CONVERT_TO_GGUF.md)
- **Technical docs:** [TECHNICAL_DOCUMENTATION.md](../TECHNICAL_DOCUMENTATION.md)

---

## Why This Approach?

| Feature | Ollama | node-llama-cpp |
|---------|--------|----------------|
| Installation | Download app | npm install |
| Dependencies | Separate app running | Pure Node.js |
| Model format | Manages internally | GGUF file |
| Setup time | 5 minutes | 15 minutes |
| Control | Less | More |
| **Works without Ollama?** |  No |  Yes! |

**For your hackathon:** If you don't want to install Ollama, this is the way!

---

## Need Help?

Run the automated script:
```bash
./setup-local-model.sh
```

It handles everything and shows progress.
