# CAE (Conversational AI Engine) - Project Overview

## Screenshots

### Home Page
![Home Page](https://github.com/user-attachments/assets/348d28b4-3676-4b23-8a4e-c965f5c75f9b)

### Graph View
![Graph view](https://github.com/user-attachments/assets/f535a43a-98e3-4386-a193-1f42d29b9f2e)

### System Architecture
![System Architecture](https://github.com/user-attachments/assets/2d64f4f3-0cb4-4f3e-9487-c1a54f129d9e)

### Chat Window
![Chat window-1](https://github.com/user-attachments/assets/d9e27225-8760-4548-85a6-827289ed6013)

![Chat window-2](https://github.com/user-attachments/assets/78a1220e-0a2f-474e-b75a-785301961f30)

### Admin Pages
![Users tab - admin page](https://github.com/user-attachments/assets/7dac61b2-ee6b-4957-a2fa-5e3fcf5be5fb)

![Architecture images upload - admin page](https://github.com/user-attachments/assets/f0d0e261-ad28-457f-893d-dd0c5ba94c50)

![Documentation validation page - admin](https://github.com/user-attachments/assets/f66d55d3-7d6d-453f-b733-d6851cbd9bd3)

---

## Documentation

For detailed information about CAE, please refer to:

- **README-SIMPLIFIED.md** - Easy-to-understand guide for all users
  - Non-technical explanations
  - Step-by-step setup instructions
  - Usage examples and best practices
  - Troubleshooting guide

- **README-TECHNICAL.md** - Comprehensive technical documentation
  - Detailed architecture diagrams
  - Complete API specifications
  - Implementation details for backend and frontend
  - Performance optimization guide
  - Advanced troubleshooting

## Quick Start

### Choose Your Guide:

**For End Users / Non-Technical:**
See [README-SIMPLIFIED.md](README-SIMPLIFIED.md) for:
- What CAE does and how it helps you
- Simple setup steps
- How to ask questions and get answers
- Understanding responses and diagrams

**For Developers / Technical Staff:**
See [README-TECHNICAL.md](README-TECHNICAL.md) for:
- System architecture and data flow
- Backend implementation (RAG, LLM, Vector Store)
- Frontend implementation (React, Components, State)
- API specifications and endpoints
- Performance tuning and optimization

## Architecture Overview

This CAE project consists of two main components:
1. **UI** - React-based frontend for user interaction
2. **Model** - Node.js backend with RAG (Retrieval-Augmented Generation) pipeline

## Current Workflow

```
User Input (UI) 
    ↓
Backend API (Model/server.js)
    ↓
RAG Pipeline (loads context from data/ingested-documents.json)
    ↓
LLaMA Model Processing (with context)
    ↓
Response Generation (answer + graph)
    ↓
UI Display (chat + dependency graph)
```

## Data Flow

### 1. **Data Ingestion**
```bash
cd Model
npm run ingest
```

This command:
- Loads JSON files from `data/context/*.json` (your local data)
- Fetches from Jira/Confluence/Bamboo APIs (if configured)
- Processes and chunks the text
- Saves to `data/ingested-documents.json`
- Creates vector embeddings for semantic search

### 2. **Model Training (Automatic)**
The model is "trained" (loaded with context) when:
- You run `npm run ingest` - creates the knowledge base
- The backend starts - loads the ingested documents into vector store
- Each query - retrieves relevant context from vector store

### 3. **Query Processing**
When a user asks a question:
1. UI sends query to `/api/chat` endpoint
2. Backend performs semantic search on ingested documents
3. Retrieves top 5 most relevant chunks
4. Sends query + context to LLaMA model
5. LLaMA generates response based on context
6. Backend extracts components and generates graph
7. Returns: `{ message, sources, graph }`
8. UI displays chat response and dependency graph

## Project Structure

```
CAE/
├── Model/                          # Backend
│   ├── server.js                   # Express API server
│   ├── rag/
│   │   └── RAGPipeline.js         # RAG implementation
│   ├── utils/
│   │   └── GraphGenerator.js      # Graph generation
│   ├── ingestion/
│   │   └── DataIngestion.js       # Data loading & processing
│   ├── clients/                    # Jira/Confluence/Bamboo clients
│   ├── data/
│   │   ├── context/               # 📁 Your local JSON data goes here
│   │   │   ├── confluence-sample.json
│   │   │   ├── jira-sample.json
│   │   │   └── bamboo-sample.json
│   │   └── ingested-documents.json # Processed data after ingestion
│   └── llama-3.1-8b.gguf          # LLaMA model file
│
└── UI/                             # Frontend
    ├── src/
    │   ├── components/
    │   │   ├── chat/              # Chat interface
    │   │   └── graph/             # Dependency graph
    │   ├── services/
    │   │   ├── api.js             # API client
    │   │   └── chatService.js     # Chat logic
    │   └── hooks/
    │       └── useChat.jsx         # Chat state management
    └── .env                        # UI configuration
```

## Setup Instructions

### 1. Install Dependencies

**Backend:**
```bash
cd Model
npm install
```

**Frontend:**
```bash
cd UI
npm install
```

### 2. Configure Environment Variables

**Model/.env:**
```env
PORT=3000
GGUF_MODEL_PATH=./llama-3.1-8b.gguf
CHUNK_SIZE=500
CHUNK_OVERLAP=50
MAX_CONTEXT_DOCS=5
```

**UI/.env:**
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_MOCK_MODE=false
VITE_APP_TITLE=CAE - Conversational AI Engine
```

### 3. Add Your Data

Create JSON files in `Model/data/context/`:

**Example: custom-architecture.json**
```json
[
  {
    "title": "API Gateway Architecture",
    "content": "The API Gateway routes requests to microservices. It connects to AuthService for authentication, OrderService for orders, and PaymentService for payments. The gateway uses Redis for caching and rate limiting.",
    "source": "custom",
    "sourceId": "custom-001",
    "type": "architecture",
    "metadata": {
      "systems": ["APIGateway", "AuthService", "OrderService", "PaymentService", "Redis"],
      "author": "Architecture Team",
      "date": "2026-03-15"
    }
  }
]
```

### 4. Run Data Ingestion

```bash
cd Model
npm run ingest
```

Expected output:
```
🚀 Starting data ingestion pipeline...

📂 Starting local context ingestion...
  Found 3 JSON files in context folder
  ✓ Loaded 3 documents from confluence-sample.json
  ✓ Loaded 3 documents from jira-sample.json
  ✓ Loaded 3 documents from bamboo-sample.json
✅ Ingested 9 documents from local context

✅ Ingestion complete! Duration: 2.34s
📊 Total documents: 9

Documents by source:
  confluence: 3
  jira: 3
  bamboo: 3
```

### 5. Start the Backend

```bash
cd Model
npm run dev
```

The server should start on `http://localhost:3000`

### 6. Start the Frontend

```bash
cd UI
npm run dev
```

The UI should open at `http://localhost:3001`

## Usage

### Asking Questions

The model can answer questions about:
- **Architecture**: "How does ECOM connect to Kenan?"
- **Components**: "What services are part of the ESOM system?"
- **Integrations**: "Describe the integration between Payment and Order services"
- **Build Status**: "What's the status of ECOM-BUILD pipeline?"
- **Issues**: "What Jira issues are related to PaymentService?"

### Graph Visualization

The UI displays a **dependency graph** that shows:
- **Nodes**: Services, APIs, databases, queues
- **Edges**: Relationships and data flow
- **Colors**: Different types (service, api, database, etc.)
- **Animation**: Active connections

### Managing Context

**Add new data:**
1. Create/edit JSON files in `Model/data/context/`
2. Run `npm run ingest`
3. Restart the backend (or it reloads automatically)

**Update existing data:**
1. Edit JSON files in `Model/data/context/`
2. Run `npm run ingest`
3. Backend automatically uses new data

**Clear context:**
```bash
cd Model/data
rm ingested-documents.json
cd context
rm *.json  # or delete specific files
cd ../..
npm run ingest
```

## Future Enhancements

### Phase 1 (Current)
- ✅ Local JSON data ingestion
- ✅ Manual ingestion via `npm run ingest`
- ✅ RAG-based question answering
- ✅ Graph visualization
- ✅ Source citations

### Phase 2 (Planned)
- 🔄 Automatic data fetching from Confluence/Jira/Bamboo
- 🔄 Scheduled auto-ingestion (daily/weekly)
- 🔄 Real-time model training
- 🔄 Incremental updates (no full re-ingestion)
- 🔄 UI for data management

### Phase 3 (Future)
- 📅 Fine-tuning LLaMA on company-specific data
- 📅 Multi-modal support (images, diagrams)
- 📅 Conversation history and context
- 📅 Export chat and graphs
- 📅 User authentication and personalization

## Troubleshooting

### Error: "Model file not found"
- Ensure `llama-3.1-8b.gguf` exists in the Model folder
- Check `GGUF_MODEL_PATH` in `.env`
- See `docs/CONVERT_TO_GGUF.md` for conversion instructions

### Error: "No documents found"
- Check that JSON files exist in `Model/data/context/`
- Run `npm run ingest` to process the data
- Verify `ingested-documents.json` was created

### Error: "Backend not available"
- Ensure backend is running on port 3000
- Check `VITE_API_BASE_URL` in UI/.env
- Enable mock mode: set `VITE_MOCK_MODE=true` in UI/.env

### Graph Not Updating
- Check console for errors
- Verify backend returns `graph` in response
- Try switching view modes (Split/Graph view)

### React Error: "Objects are not valid as a React child"
- This was fixed - ensure MessageBubble.jsx handles sources correctly
- Check that sources are objects with `{title, source, sourceId}` structure

## API Reference

### POST /api/chat
Send a chat message and get a response.

**Request:**
```json
{
  "message": "How does ECOM connect to Kenan?",
  "conversationId": "uuid-123"
}
```

**Response:**
```json
{
  "conversationId": "uuid-123",
  "message": "ECOM connects to Kenan via REST API calls...",
  "sources": [
    {
      "source": "confluence",
      "title": "ECOM Architecture",
      "sourceId": "conf-001"
    }
  ],
  "components": ["ECOM", "Kenan", "APIGateway"],
  "graph": {
    "nodes": [...],
    "edges": [...],
    "metadata": {...}
  },
  "timestamp": "2026-03-15T10:30:00Z"
}
```

### GET /health
Check backend health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-15T10:30:00Z",
  "service": "CAE Backend",
  "ragInitialized": true
}
```

## Quick Start (TL;DR)

```bash
# Backend
cd Model
npm install
npm run ingest
npm run dev

# Frontend (in another terminal)
cd UI
npm install
npm run dev

# Open http://localhost:3001 and start chatting!
```