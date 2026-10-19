# CAE Backend (Model)

AI-powered backend for the Conversational Architecture Explorer using RAG (Retrieval-Augmented Generation) with Ollama.

## 🏗️ Architecture

- **Express Server**: REST API endpoints
- **RAG Pipeline**: LangChain + Ollama for intelligent responses
- **Vector Store**: In-memory vector database for semantic search
- **Data Ingestion**: Automated fetching from Jira, Confluence, Bamboo
- **Graph Generation**: Automatic architecture diagram creation

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. **Ollama** - Local LLM runtime
3. **Jira/Confluence Access** - API tokens

## 🚀 Setup

### 1. Install Ollama

**macOS:**
```bash
brew install ollama
```

Or download from: https://ollama.ai/download

**Start Ollama service:**
```bash
ollama serve
```

**Download required models:**
```bash
# LLM for chat (8B model recommended for speed)
ollama pull llama3.1:8b

# Embedding model for RAG
ollama pull nomic-embed-text
```

### 2. Install Dependencies

```bash
cd Model
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
# Jira Configuration
JIRA_BASE_URL=https://singtel-jira.atlassian.net
JIRA_EMAIL=your-email@singtel.com
JIRA_API_TOKEN=your-jira-api-token

# Confluence Configuration (optional)
CONFLUENCE_BASE_URL=https://singtel.atlassian.net/wiki
CONFLUENCE_EMAIL=your-email@singtel.com
CONFLUENCE_API_TOKEN=your-confluence-api-token

# Bamboo Configuration (optional)
BAMBOO_BASE_URL=https://bamboo.singtel.com
BAMBOO_TOKEN=your-bamboo-api-token
BAMBOO_USERNAME=your-username

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

### 4. Ingest Data

Fetch data from Jira/Confluence/Bamboo:
```bash
npm run ingest
```

This will:
- Connect to Jira and fetch architecture-related issues
- Connect to Confluence and fetch documentation (if configured)
- Connect to Bamboo and fetch build plans & deployments (if configured)
- Process and save documents to `data/ingested-documents.json`

### 5. Start Server

```bash
npm run dev
```

Server runs on http://localhost:3000

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

### Chat with AI
```bash
POST /api/chat
Content-Type: application/json

{
  "message": "What is the architecture of the Kenan system?",
  "conversationId": "optional-id"
}
```

Response:
```json
{
  "conversationId": "uuid",
  "message": "AI response based on Jira/Confluence data",
  "sources": [
    {
      "source": "jira",
      "title": "KENAN-123: Architecture Overview",
      "sourceId": "KENAN-123"
    }
  ],
  "components": ["KenanService", "BillingAPI", "CustomerDB"],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Generate Graph
```bash
POST /api/graph
Content-Type: application/json

{
  "components": ["ServiceA", "ServiceB", "DatabaseC"],
  "answer": "ServiceA depends on ServiceB which connects to DatabaseC",
  "sources": []
}
```

Response:
```json
{
  "nodes": [...],
  "edges": [...],
  "metadata": {
    "componentCount": 3,
    "relationshipCount": 2
  }
}
```

### Trigger Data Ingestion
```bash
POST /api/ingest
```

## 🗂️ Project Structure

```
Model/
├── server.js                 # Express server
├── package.json             
├── .env.example             
├── clients/                  # External API clients
│   ├── JiraClient.js        # Jira REST API
│   ├── ConfluenceClient.js  # Confluence REST API
│   └── BambooClient.js      # Bamboo CI/CD API
├── ingestion/               # Data collection
│   └── DataIngestion.js     # Fetch & process data
├── rag/                     # RAG pipeline
│   └── RAGPipeline.js       # LangChain + Ollama
├── utils/                   # Utilities
│   └── GraphGenerator.js    # Architecture graph creation
└── data/                    # Ingested data (generated)
    └── ingested-documents.json
```

## 🔧 Configuration

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `OLLAMA_BASE_URL` | Ollama API endpoint | http://localhost:11434 |
| `OLLAMA_MODEL` | LLM model name | llama3.1:8b |
| `MAX_CONTEXT_DOCS` | Max documents for RAG context | 5 |
| `CHUNK_SIZE` | Text chunk size for embeddings | 500 |
| `CHUNK_OVERLAP` | Chunk overlap | 50 |

## 🧪 Testing

Test the RAG pipeline:
```bash
npm test
```

Manual testing:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/version

# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me the Kenan architecture"}'
```

## 📝 Data Ingestion

The ingestion process:
1. **Jira Issues**: Fetches architecture-related issues (JQL: `text ~ "architecture OR microservice..."`)
2. **Confluence Documentation**: Fetches pages tagged with architecture, design, or technical content
3. **Bamboo CI/CD**:
   - Build plans for architecture-related projects (Kenan, ECOM, ESOM)
   - Recent build results and success rates
   - Deployment projects and environments
   - Deployment history and status
3. Formats issues with metadata (status, priority, links, components)
4. Saves to `data/ingested-documents.json`

Re-run ingestion anytime data changes:
```bash
npm run ingest
```

## 🤖 RAG Pipeline

How it works:
1. **User Query** → Sent to backend
2. **Semantic Search** → Find relevant documents using embeddings
3. **Context Retrieval** → Get top 5 most relevant chunks
4. **Prompt Construction** → Build prompt with context + query
5. **LLM Generation** → Ollama generates answer
6. **Component Extraction** → Parse components from response
7. **Graph Generation** → Create architecture diagram
8. **Return Response** → Send to frontend

## 🐛 Troubleshooting

**Ollama not running:**
```bash
# Start Ollama
ollama serve
```

**Model not found:**
```bash
# Pull the model
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

**No documents found:**
```bash
# Run ingestion
npm run ingest

# Check if documents were created
cat data/ingested-documents.json
```

**Jira authentication failed:**
- Verify JIRA_EMAIL and JIRA_API_TOKEN in `.env`
- Generate token at: https://id.atlassian.com/manage-profile/security/api-tokens

## 🎯 Next Steps

- [ ] Add ChromaDB for persistent vector storage
- [ ] Implement conversation history
- [ ] Add Bamboo integration
- [ ] Enhance graph generation with NLP
- [ ] Add caching layer
- [ ] Deploy to cloud (AWS/Azure)

## 📚 Resources

- [Ollama Documentation](https://ollama.ai/docs)
- [LangChain.js](https://js.langchain.com/)
- [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Confluence REST API](https://developer.atlassian.com/cloud/confluence/rest/)
