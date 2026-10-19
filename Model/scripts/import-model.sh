#!/bin/bash

# Import Llama 3.1 8B model into Ollama
# This script imports the local safetensors model

echo "========================================="
echo "Importing Llama 3.1 8B into Ollama"
echo "========================================="
echo ""

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
    echo "ERROR: Ollama is not running!"
    echo "Please start Ollama first: ollama serve"
    exit 1
fi

echo "Ollama is running..."
echo ""

# Navigate to Model directory
cd "$(dirname "$0")"

# Check if Llama-3.1-8B directory exists
if [ ! -d "Llama-3.1-8B" ]; then
    echo "ERROR: Llama-3.1-8B directory not found!"
    exit 1
fi

# Check if all model parts exist
echo "Checking model files..."
for i in 1 2 3 4; do
    file="Llama-3.1-8B/model-0000${i}-of-00004.safetensors"
    if [ ! -f "$file" ]; then
        echo "ERROR: Missing $file"
        exit 1
    fi
    echo "  Found: model-0000${i}-of-00004.safetensors"
done
echo ""

# Check config files
echo "Checking config files..."
for file in config.json tokenizer.json tokenizer_config.json; do
    if [ ! -f "Llama-3.1-8B/$file" ]; then
        echo "ERROR: Missing Llama-3.1-8B/$file"
        exit 1
    fi
    echo "  Found: $file"
done
echo ""

# Import model into Ollama
echo "Importing model into Ollama..."
echo "This may take several minutes..."
echo ""

ollama create llama3.1-local -f Modelfile

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "SUCCESS! Model imported as: llama3.1-local"
    echo "========================================="
    echo ""
    echo "Next steps:"
    echo "1. Update Model/.env:"
    echo "   OLLAMA_MODEL=llama3.1-local"
    echo ""
    echo "2. Test the model:"
    echo "   ollama run llama3.1-local 'Hello, how are you?'"
    echo ""
    echo "3. Restart your backend server:"
    echo "   cd Model && npm run dev"
    echo ""
else
    echo ""
    echo "ERROR: Failed to import model"
    echo "Check logs above for details"
    exit 1
fi
