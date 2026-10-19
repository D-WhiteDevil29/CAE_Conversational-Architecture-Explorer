# Converting Llama 3.1-8B to GGUF (No Ollama Required)

This guide will help you convert your safetensors model to GGUF format and run it with Node.js.

## What You Have

```
Llama-3.1-8B/
├── model-00001-of-00004.safetensors (4.6 GB)
├── model-00002-of-00004.safetensors (4.7 GB)
├── model-00003-of-00004.safetensors (4.6 GB)
├── model-00004-of-00004.safetensors (1.1 GB)
├── config.json
├── tokenizer.json
└── ... (other config files)

Total: ~15 GB
```

## Step 1: Install Python Dependencies

You need Python to run the conversion script.

```bash
# Check if you have Python
python3 --version

# Install if needed (macOS)
# Python usually comes pre-installed on macOS
```

## Step 2: Clone llama.cpp

```bash
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model"

# Clone the repo
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Install Python requirements
pip3 install -r requirements.txt
```

## Step 3: Convert Safetensors to GGUF

```bash
# From inside llama.cpp directory
python3 convert_hf_to_gguf.py ../Llama-3.1-8B --outfile ../llama-3.1-8b.gguf --outtype f16
```

**Options:**
- `--outtype f16`: Full precision (8GB output) - RECOMMENDED
- `--outtype q8_0`: Quantized (5GB output) - if RAM is limited
- `--outtype q4_0`: Highly quantized (2.5GB) - fastest but lower quality

**Expected output:** `llama-3.1-8b.gguf` in your Model directory (~8GB for f16)

**Time:** 5-10 minutes depending on your Mac's CPU

## Step 4: Verify Conversion

```bash
cd ..
ls -lh llama-3.1-8b.gguf

# Should show something like:
# -rw-r--r--  1 P4016534  staff   7.9G Mar 13 10:30 llama-3.1-8b.gguf
```

## Step 5: Test with llama.cpp (Optional)

Before integrating with Node.js, test it works:

```bash
cd llama.cpp
make

# Run a quick test
./llama-cli -m ../llama-3.1-8b.gguf -p "Hello, what is software architecture?" -n 50
```

## Step 6: Install Node.js Library

```bash
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model"
npm install node-llama-cpp --legacy-peer-deps
```

## What Gets Updated in Your Code

I'll update these files automatically:

1. **package.json**: Add `node-llama-cpp`
2. **RAGPipeline.js**: Replace Ollama with node-llama-cpp
3. **DataIngestion.js**: Use local embeddings (no Ollama)
4. **.env**: Remove OLLAMA_BASE_URL, add GGUF_MODEL_PATH

## Troubleshooting

### Python not found

```bash
# Install Python 3
brew install python3
```

### pip3 not found

```bash
python3 -m ensurepip
```

### Conversion script errors

```bash
# Make sure all dependencies are installed
pip3 install torch transformers sentencepiece
```

### Not enough RAM during conversion

Use quantized version:
```bash
python3 convert_hf_to_gguf.py ../Llama-3.1-8B --outfile ../llama-3.1-8b-q8.gguf --outtype q8_0
```

### node-llama-cpp installation fails

```bash
# Try with legacy peer deps
npm install node-llama-cpp --legacy-peer-deps --force
```

## Full Conversion Command (Copy-Paste Ready)

```bash
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model" && \
git clone https://github.com/ggerganov/llama.cpp && \
cd llama.cpp && \
pip3 install -r requirements.txt && \
python3 convert_hf_to_gguf.py ../Llama-3.1-8B --outfile ../llama-3.1-8b.gguf --outtype f16 && \
cd .. && \
ls -lh llama-3.1-8b.gguf && \
echo " Conversion complete! Now run: npm install node-llama-cpp --legacy-peer-deps"
```

## Next Steps

After conversion completes:
1.  You'll have `llama-3.1-8b.gguf` file
2.  I'll update the backend code to use it
3.  No Ollama required!
4.  Everything runs locally in Node.js
