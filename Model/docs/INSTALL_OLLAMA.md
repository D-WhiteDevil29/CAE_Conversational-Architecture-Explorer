# Installing Ollama on macOS

You need to install Ollama before you can use your local Llama model.

## Quick Install (Recommended)

### Method 1: Download from Website (Easiest)

1. Go to: https://ollama.com/download
2. Click "Download for macOS"
3. Open the downloaded file (Ollama-darwin.zip)
4. Drag Ollama to Applications folder
5. Open Ollama from Applications (it will run in menu bar)

**That's it!** Ollama will now be running.

### Method 2: Using Homebrew

If you have Homebrew installed:

```bash
brew install ollama
```

Then start it:

```bash
ollama serve
```

## Verify Installation

After installing, open a new terminal and run:

```bash
ollama --version
```

You should see something like: `ollama version is 0.1.x`

## Next Steps After Installing

### 1. Start Ollama (if not already running)

Check if running:
```bash
curl http://localhost:11434/api/version
```

If you get an error, start it:
```bash
ollama serve
```

Keep that terminal open.

### 2. Import Your Local Model

In a **new terminal**:

```bash
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model"
./import-model.sh
```

## Alternative: Use Pre-built Ollama Model

If you want to skip the local model import and just get started quickly:

```bash
# After Ollama is installed
ollama pull llama3.1:8b

# Then in Model/.env, use:
OLLAMA_MODEL=llama3.1:8b
```

This will download a 4.7GB optimized model (much faster than your 15GB local model).

## Troubleshooting

### "Command not found: ollama"

**After downloading from website:**
- Ollama runs in the menu bar (top right of screen)
- The `ollama` command should work in terminal automatically
- If not, try restarting your terminal or computer

**After brew install:**
- Make sure installation completed without errors
- Try: `which ollama` to see if it's in your PATH

### Can't find Ollama app

Check these locations:
```bash
ls -la /Applications/Ollama.app
ls -la ~/Applications/Ollama.app
```

### Port 11434 already in use

```bash
# Kill existing Ollama process
pkill ollama

# Start again
ollama serve
```

## What Ollama Does

- **Runs AI models locally** on your Mac
- **No cloud/API needed** - completely offline
- **Simple CLI** - easy to use
- **Model management** - pull, create, list, remove models

## Quick Start After Install

```bash
# List available models
ollama list

# Run a model interactively
ollama run llama3.1:8b

# Type exit to quit the chat

# Use with CAE backend
cd "/Users/P4016534/My Workspace/VS Workspace/CAE/Model"
npm run dev
```

## Need Help?

Official docs: https://github.com/ollama/ollama
