#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  CAE Local Model Setup (No Ollama Required)           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Change to Model directory
cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check prerequisites
echo -e "${BLUE}➤ Checking prerequisites...${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python3 not found. Please install Python 3.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install Node.js.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Python3 found: $(python3 --version)${NC}"
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"
echo ""

# Check if safetensors directory exists
if [ ! -d "Llama-3.1-8B" ]; then
    echo -e "${RED}✗ Llama-3.1-8B directory not found${NC}"
    echo "Please ensure your model files are in: $(pwd)/Llama-3.1-8B"
    exit 1
fi

echo -e "${GREEN}✓ Model directory found${NC}"
echo ""

# Check if GGUF already exists
if [ -f "llama-3.1-8b.gguf" ]; then
    echo -e "${YELLOW}⚠ GGUF model already exists: llama-3.1-8b.gguf${NC}"
    read -p "Do you want to skip conversion? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        SKIP_CONVERSION=true
    else
        SKIP_CONVERSION=false
    fi
else
    SKIP_CONVERSION=false
fi

# Step 1: Clone llama.cpp if needed
if [ "$SKIP_CONVERSION" = false ]; then
    echo -e "${BLUE}➤ Step 1: Setting up llama.cpp...${NC}"
    
    if [ ! -d "llama.cpp" ]; then
        echo "Cloning llama.cpp repository..."
        git clone https://github.com/ggerganov/llama.cpp
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗ Failed to clone llama.cpp${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ llama.cpp already exists${NC}"
    fi
    
    echo "Installing Python requirements..."
    pip3 install -r llama.cpp/requirements.txt > /dev/null 2>&1
    echo -e "${GREEN}✓ Python dependencies installed${NC}"
    echo ""
    
    # Step 2: Convert model
    echo -e "${BLUE}➤ Step 2: Converting model to GGUF format...${NC}"
    echo "This will take 5-10 minutes. Please wait..."
    echo ""
    
    # Ask user for quantization level
    echo "Choose output format:"
    echo "  1) f16 (8GB, best quality) - RECOMMENDED"
    echo "  2) q8_0 (5GB, very good quality)"
    echo "  3) q4_0 (2.5GB, good quality, faster)"
    read -p "Enter choice (1-3): " -n 1 -r
    echo
    
    case $REPLY in
        1) OUTTYPE="f16"; SUFFIX="";;
        2) OUTTYPE="q8_0"; SUFFIX="-q8";;
        3) OUTTYPE="q4_0"; SUFFIX="-q4";;
        *) OUTTYPE="f16"; SUFFIX="";;
    esac
    
    OUTPUT_FILE="llama-3.1-8b${SUFFIX}.gguf"
    
    python3 llama.cpp/convert_hf_to_gguf.py Llama-3.1-8B \
        --outfile "$OUTPUT_FILE" \
        --outtype "$OUTTYPE"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Conversion failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Model converted successfully: $OUTPUT_FILE${NC}"
    echo ""
    
    # Show file size
    ls -lh "$OUTPUT_FILE"
    echo ""
else
    OUTPUT_FILE="llama-3.1-8b.gguf"
    echo -e "${GREEN}✓ Using existing GGUF model${NC}"
    echo ""
fi

# Step 3: Install node-llama-cpp
echo -e "${BLUE}➤ Step 3: Installing node-llama-cpp...${NC}"
echo "This may take 2-3 minutes..."

npm install node-llama-cpp --legacy-peer-deps > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠ First attempt failed, trying with --force...${NC}"
    npm install node-llama-cpp --legacy-peer-deps --force > /dev/null 2>&1
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ node-llama-cpp installed${NC}"
else
    echo -e "${RED}✗ Installation failed. Try manually:${NC}"
    echo "  npm install node-llama-cpp --legacy-peer-deps"
    exit 1
fi
echo ""

# Step 4: Update .env
echo -e "${BLUE}➤ Step 4: Updating configuration...${NC}"

if [ ! -f ".env" ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
fi

# Add or update GGUF_MODEL_PATH
if grep -q "GGUF_MODEL_PATH" .env; then
    sed -i.bak "s|GGUF_MODEL_PATH=.*|GGUF_MODEL_PATH=./$OUTPUT_FILE|" .env
else
    echo "" >> .env
    echo "# Local GGUF Model" >> .env
    echo "GGUF_MODEL_PATH=./$OUTPUT_FILE" >> .env
fi

# Comment out Ollama config if present
sed -i.bak 's/^OLLAMA_BASE_URL/# OLLAMA_BASE_URL/' .env
sed -i.bak 's/^OLLAMA_MODEL/# OLLAMA_MODEL/' .env

echo -e "${GREEN}✓ Configuration updated${NC}"
echo ""

# Step 5: Switch RAG implementation
echo -e "${BLUE}➤ Step 5: Switching to local model implementation...${NC}"

cd rag

if [ ! -f "RAGPipeline-ollama.js" ]; then
    mv RAGPipeline.js RAGPipeline-ollama.js
    echo -e "${GREEN}✓ Backed up original RAGPipeline.js${NC}"
fi

if [ -f "RAGPipeline-llama-cpp.js" ]; then
    cp RAGPipeline-llama-cpp.js RAGPipeline.js
    echo -e "${GREEN}✓ Switched to llama-cpp implementation${NC}"
else
    echo -e "${RED}✗ RAGPipeline-llama-cpp.js not found${NC}"
    exit 1
fi

cd ..
echo ""

# Done!
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Setup Complete!                                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo -e "  1. Start the backend:"
echo -e "     ${YELLOW}npm run dev${NC}"
echo ""
echo -e "  2. In another terminal, start the frontend:"
echo -e "     ${YELLOW}cd ../UI && npm run dev${NC}"
echo ""
echo -e "  3. Open your browser:"
echo -e "     ${YELLOW}http://localhost:3001${NC}"
echo ""
echo -e "${BLUE}Test the backend:${NC}"
echo -e "  ${YELLOW}curl -X POST http://localhost:3000/api/chat \\${NC}"
echo -e "    ${YELLOW}-H 'Content-Type: application/json' \\${NC}"
echo -e "    ${YELLOW}-d '{\"message\": \"Hello!\"}'${NC}"
echo ""
echo -e "${BLUE}Model file:${NC} $OUTPUT_FILE"
echo -e "${BLUE}No Ollama required!${NC} Everything runs locally in Node.js"
echo ""
