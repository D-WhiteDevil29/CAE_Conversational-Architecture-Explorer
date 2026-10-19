# CAE - Conversational Architecture Explorer (Technical Documentation)

**Last Updated:** April 5, 2026

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Data Flow](#data-flow)
6. [Setup and Configuration](#setup-and-configuration)
7. [API Specifications](#api-specifications)
8. [Performance and Optimization](#performance-and-optimization)
9. [Troubleshooting](#troubleshooting)
10. [Recent Changes](#recent-changes)
11. [Reference: File Structure](#reference-file-structure)

---

## System Overview

CAE is an enterprise-grade Retrieval-Augmented Generation (RAG) system designed for software architecture exploration and knowledge management at Singtel. The system combines local LLM inference via node-llama-cpp, TF-IDF-based vector search, hybrid web search fallback, Qwen2.5-VL vision-based architecture diagram analysis, and interactive ReactFlow graph visualization to provide accurate, context-aware responses about enterprise architecture.

### Core Technologies

**Core Technologies:**

**Backend Stack:**
- Node.js (v18+) - Runtime environment
- Express.js - REST API server
- node-llama-cpp - Local GGUF model inference (LlamaModel / LlamaContext / LlamaChatSession)
- LangChain MemoryVectorStore - In-memory vector store
- Custom TF-IDF Embeddings (SimpleEmbeddings) - Vocabulary-based embeddings, no external model required
- LLaMA 3.1 8B (GGUF) - Primary language model (llama-3.1-8b.gguf)
- Qwen2.5-VL 7B (GGUF) - Vision model for architecture diagram analysis
- llama-mtmd-cli - llama.cpp multimodal binary for vision inference (subprocess)
- Multer - Multipart file upload handling (50 MB limit)
- WebSearchService - Supports Brave Search, Serper (Google), and Tavily as providers
- uuid, axios, dotenv, morgan, multer

**Frontend Stack:**
- React 18.3 - UI framework
- Vite 5 - Build tool and development server
- TailwindCSS - Utility-first styling
- Framer Motion 11 - Animation library
- ReactFlow 11 - Interactive graph visualization
- Radix UI - Headless component primitives (Avatar, Dialog, DropdownMenu, ScrollArea, Tabs, Tooltip)
- Lucide React - Icon set
- html-to-image / html2canvas - Graph export to PNG
- axios - HTTP client
- date-fns - Date formatting

**Key Features:**
- Local LLM inference using node-llama-cpp with GGUF models (no external LLM API calls)
- Hybrid RAG: internal TF-IDF vector search with automatic web search fallback at 40% relevance threshold
- Vision pipeline: upload architecture PNG/JPG, extract structured component and relationship data with Qwen2.5-VL, store in RAG context
- Three-strategy graph generation: Qwen-extracted structured data, known-component keyword matching, full entity extraction from LLM answer text
- **SQL Generator**: Natural language to SQL query generation with schema context, validation, and risk assessment (new)
- Per-conversation history stored client-side in localStorage and sent on every request (survives server restarts)
- Multi-session management with 3-week expiry and automatic pruning
- localStorage-based authentication with sign-up, login, and password reset
- Admin dashboard: document upload, ingestion monitor, entity-frequency trending, architecture image management, document peer-review workflow, and document undo-ingestion (new)
- Five view modes: Chat, Split (58/42 ratio), Graph, Architecture, SQL (new)

---

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CAE System                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐                    │
│  │   Frontend   │◄───────►│   Backend    │                    │
│  │   (React)    │  HTTP   │   (Node.js)  │                    │
│  │   Port 3001  │  REST   │   Port 3000  │                    │
│  └──────────────┘         └──────┬───────┘                    │
│        │                         │                             │
│    ┌───┴────────┐        ┌─────────┴─────────┐               │
│    │            │        │                   │                │
│  SQL Tab    Chat Tab   ┌──▼──────────┐ ┌──────▼───────┐      │
│    │            │      │  RAG Engine │ │ SQL Generator│      │
│    │            │      │             │ │              │      │
│    │            │      │ • Retrieval │ │• Independent │      │
│    │            │      │ • Ranking   │ │  Model Inst. │      │
│    │            │      │ • Context   │ │• Validation  │      │
│    │            │      └──┬──────────┘ │• Risk Assess │      │
│    │            │         │            └──────┬───────┘      │
│    │            │  ┌──────▼──────────┐        │                │
│    │            │  │   Data Store    │◄──────┘                │
│    │            │  │                 │                        │
│    │            │  │ • Vector DB     │                        │
│    │            │  │ • Documents     │                        │
│    │            │  │ • Metadata      │                        │
│    │            │  └─────────────────┘                        │
│    │            │                                              │
│    │       ┌────▼─────────────────────┐                      │
│    │       │   LLaMA 3.1 8B (Chat)   │                      │
│    │       │   (GGUF Model)           │                      │
│    │       │   • Inference (0.7 temp) │                      │
│    │       │   • Standard context     │                      │
│    └──────►└────────────────────────────┘                      │
│            │                                                    │
│            │   LLaMA 3.1 8B (SQL) - Independent             │
│            │   (Separate Session, 0.2 temp)                 │
│            │                                                    │
│  Vite Proxy  ┌────────────────────────────┐                  │
│  :3001→:3000 │   Model Inference Engine   │                 │
│            │ • Token generation          │                  │
│            │ • Context window mgmt       │                  │
│            │ • Metal GPU Acceleration    │                  │
│            └────────────────────────────┘                    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
┌─────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
│  User   │────►│   UI    │────►│ Backend  │────►│   RAG   │
│ Browser │     │ React   │     │ Express  │     │ Pipeline│
└─────────┘     └─────────┘     └──────────┘     └────┬────┘
                                                        │
                      ┌─────────────────────────────────┤
                      │                                 │
                ┌─────▼──────┐                   ┌─────▼──────┐
                │  Vector    │                   │   LLaMA    │
                │  Search    │                   │   Model    │
                │ Embeddings │                   │  Inference │
                └─────┬──────┘                   └─────┬──────┘
                      │                                │
                      └─────────────┬──────────────────┘
                                    │
                              ┌─────▼──────┐
                              │  Response  │
                              │ Generator  │
                              └─────┬──────┘
                                    │
                              ┌─────▼──────┐
                              │   Graph    │
                              │ Extractor  │
                              └────────────┘
```

---

## Backend Implementation

### 1. Server Architecture (server.js)

**Express Server Configuration:**
```javascript
Port: 3000
Middleware Stack:
  - CORS (Cross-Origin Resource Sharing)
  - Morgan (HTTP request logging)
  - Express JSON (body parser with 10MB limit)
  - Express URL-encoded (form data)
```

**Endpoint Structure:**
- `/health` - Health check endpoint
- `/api/chat` - Main chat endpoint (POST)
- `/api/graph` - Dependency graph generation (POST)
- `/api/upload` - Document upload (POST, multipart/form-data)
- `/api/documents` - Document management (GET, DELETE)
- `/api/ingest` - Trigger data ingestion (POST)
- `/api/trending-searches` - Entity tracking (GET)

### 2. RAG Pipeline (rag/RAGPipeline.js)

**Core Components:**

#### a) Model Loading
```javascript
Technology: node-llama-cpp
Model Format: GGUF (GPT-Generated Unified Format)
Model: LLaMA 3.1 8B (16-bit quantization)
Context Window: 4096 tokens
GPU Acceleration: Metal (macOS) / CUDA (Linux) / Vulkan (Windows)
```

**Model Initialization:**
```
1. Load GGUF model from disk
2. Initialize llama context with parameters:
   - contextSize: 4096
   - batchSize: 2048
   - temperature: 0.7
   - topP: 0.9
   - repeatPenalty: 1.1
3. Create inference session
4. Load embeddings for vector search
```

#### b) Vector Store Implementation
```javascript
Technology: LangChain MemoryVectorStore
Embeddings: TensorFlow.js Universal Sentence Encoder
Similarity: Cosine similarity
Retrieval: Top-K ranking (K=5)
```

**Document Processing:**
```
Input Document → Text Extraction → Chunking (500 chars, 50 overlap)
→ Embedding Generation → Vector Store Insertion → Metadata Storage
```

#### c) Hybrid RAG Strategy

**Decision Flow:**
```
Query Received
    ↓
Relevance Calculation (Term Matching)
    ↓
If Relevance < 20%:
    ├─► Web Search (Serper API)
    │   ├─► 5 Google results
    │   └─► Snippet extraction
    └─► Generate response with web context
Else:
    └─► Use internal context only
```

**Relevance Algorithm:**
```javascript
1. Extract query terms (length > 2, exclude stop words)
2. Count matched terms in context
3. Calculate: (matched / total) * 100
4. Threshold: 20%
```

### 3. Web Search Integration (utils/WebSearchService.js)

**Supported Providers:**
- Serper (Google Search API) - Primary
- Brave Search API - Alternative
- Tavily AI - Alternative

**Implementation Details:**
```javascript
Method: curl subprocess (corporate proxy compatible)
Timeout: 20 seconds
Results: 5 per query
Location: India (gl: "in")
Proxy: HTTP/HTTPS with authentication
```

**Curl Command Construction:**
```bash
curl -X POST 'https://google.serper.dev/search'
  -H 'X-API-KEY: {key}'
  -H 'Content-Type: application/json'
  -d '{"q":"{escaped_query}","num":5,"gl":"in"}'
  --max-time 20
```

**Query Escaping:**
```javascript
1. Escape backslashes: \ → \\
2. Escape double quotes: " → \"
3. Escape single quotes: ' → '\''
```

### 4. Data Ingestion (ingestion/DataIngestion.js)

**Ingestion Pipeline:**

```
External Sources          File Sources
├─► Jira API             ├─► JSON files
├─► Confluence API       ├─► PDF documents  
└─► Bamboo API           └─► DOCX files
        ↓                        ↓
    ┌───────────────────────────┐
    │   Document Processor      │
    │   • Parse                 │
    │   • Clean                 │
    │   • Extract metadata      │
    └───────────┬───────────────┘
                ↓
    ┌───────────────────────────┐
    │   Text Chunker            │
    │   • 500 char chunks       │
    │   • 50 char overlap       │
    │   • Preserve context      │
    └───────────┬───────────────┘
                ↓
    ┌───────────────────────────┐
    │   Embedding Generator     │
    │   • TensorFlow.js USE     │
    │   • 512-dim vectors       │
    └───────────┬───────────────┘
                ↓
         ingested-documents.json
         (Vector Store Backup)
```

**Supported Document Formats:**
- JSON (native)
- PDF (pdf-parse)
- DOCX (mammoth)
- TXT (native)

### 5. Graph Generation (utils/GraphGenerator.js)

**Entity Extraction:**
```javascript
Patterns Detected:
- Service names (ends with "Service", "API", "Gateway")
- Database systems (MongoDB, PostgreSQL, MySQL, Redis)
- Message queues (RabbitMQ, Kafka, SQS)
- API endpoints (RESTful patterns)
```

**Graph Construction:**
```
Response Text
    ↓
Pattern Matching (Regex)
    ↓
Entity Extraction
    ↓
Relationship Inference
    ↓
ReactFlow Node/Edge Structure
    ↓
{
  nodes: [{ id, type, position, data }],
  edges: [{ id, source, target, label }]
}
```

### 6. Response Generation

**Token Limits:**
- Main responses: 1500 tokens (~1125 words)
- Conversational: 200 tokens (~150 words)

**Prompt Engineering:**
```javascript
Structure:
1. System message (role definition)
2. Context injection (RAG results or web results)
3. Singtel-specific rules
4. User query
5. Response format guidance
```

**Response Cleaning:**
```javascript
Post-processing:
1. Remove prompt echo
2. Strip marker patterns
3. Remove excess newlines
4. Trim whitespace
5. Extract answer content
```

---

## Frontend Implementation

### 1. Application Structure

**Entry Point (main.jsx):**
```javascript
React.StrictMode
  └─► App (root component)
      └─► ThemeProvider (light/dark)
          └─► AuthProvider (user context)
              └─► ToastProvider (notifications)
                  ├─► AppContent
                  └─► ToastContainer
```

**Routing Strategy:**
```javascript
View State Management (no react-router):
- 'chat' - Main chat interface
- 'admin' - Admin dashboard
- Toggle via: setCurrentView()
```

### 2. State Management

**Context API Implementation:**

**ChatContext:**
```javascript
State:
- messages: Message[]
- isLoading: boolean
- sessionId: string

Methods:
- sendMessage(text)
- clearMessages()
- loadSession(id)
```

**AuthContext:**
```javascript
State:
- user: User | null
- isLoading: boolean
- isAdmin: boolean

Methods:
- login(email, password)
- logout()
- checkAuth()
```

**ToastContext:**
```javascript
State:
- toasts: Toast[]

Methods:
- info(message, options)
- success(message, options)
- warning(message, options)
- error(message, options)
- removeToast(id)
```

### 3. Component Architecture

**Chat Interface (components/chat/):**

```
ChatInterface (container)
├─► MessageBubble (user/AI messages)
│   ├─► Source badges
│   ├─► Markdown rendering
│   └─► Copy button
├─► QuickSuggestions (preset queries)
├─► TypingIndicator (loading state)
└─► Input controls
    ├─► Text input
    ├─► Voice recognition
    └─► Send button
```

**Admin Dashboard (components/admin/):**

```
AdminDashboard (container)
├─► HealthCheck
│   ├─► Endpoint monitoring
│   ├─► Mock mode toggle
│   └─► Context mode toggle
├─► DocumentUpload
│   ├─► File picker
│   ├─► Progress tracking
│   └─► Validation
├─► DocumentList
│   ├─► Document cards
│   ├─► Delete actions
│   └─► Force-remove actions (undo ingestion)
├─► IngestionMonitor
│   ├─► Source status
│   └─► Document counts
└─► TrendingSearches
    ├─► Entity tracking
    └─► Search frequency
```

**SQL Workbench (components/sql/SQLWorkbench.jsx):**

```
SQLWorkbench (container)
├─► Left Panel (58%)
│   ├─► Database Type Selector
│   │   └─► Oracle, PostgreSQL, MySQL
│   ├─► Complexity Picker
│   │   └─► Simple, Intermediate, Complex
│   ├─► Query Description Input
│   │   └─► Textarea with placeholder examples
│   ├─► Schema Context (collapsible)
│   │   ├─► Toggle visibility
│   │   └─► Optional CREATE TABLE statements
│   ├─► Generate Button
│   │   └─► Loading state with spinner
│   └─► Query History
│       └─► 10 recent queries, clickable restore
└─► Right Panel (42%)
    ├─► [LOADING] Animated spinner
    │   └─► "Generating SQL query..." message
    ├─► [RESULT] SQL Display
    │   ├─► Copy & Download buttons
    │   └─► Formatted monospace code
    ├─► Explanation Section
    ├─► Risk Level Badge
    │   └─► Color-coded (green/yellow/orange/red)
    ├─► Validation Status
    │   └─► Issues list (if any)
    └─► Performance Warnings
        └─► Optimization suggestions
```

**Graph Visualization (components/graph/):**

```
DependencyGraph (ReactFlow)
├─► CustomNode components
│   ├─► Icon (by type)
│   ├─► Label
│   ├─► Status indicator
│   └─► Hover tooltip
├─► Background (dotted)
├─► Controls (zoom/pan)
├─► MiniMap
└─► Export functionality
    ├─► PNG (html-to-image)
    └─► JSON (graph data)
```

### 4. Theming System

**Theme Implementation (hooks/useTheme.jsx):**

```javascript
Storage: localStorage
Key: 'cae-theme'
Values: 'light' | 'dark'

CSS Variables (Tailwind):
- --background
- --foreground
- --primary
- --secondary
- --accent
- --border
- --muted

Theme Toggle:
1. Read from localStorage
2. Apply to document root
3. Update on toggle
4. Persist selection
```

**Glass Effect:**
```css
.glass-effect {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### 5. API Integration (services/)

**API Client (api.js):**
```javascript
Base URL: http://localhost:3000
Timeout: 30000ms (30 seconds)
Headers: Content-Type: application/json

Endpoints:
- GET  /health
- POST /api/chat
- POST /api/graph
- POST /api/upload
- GET  /api/documents
- DELETE /api/documents/:id
- POST /api/ingest
- GET  /api/trending-searches
```

**Chat Service (chatService.js):**
```javascript
sendMessage(message, contextOnly, mockMode):
  1. Validate input
  2. POST to /api/chat
  3. Parse response
  4. Extract: message, sources, graph
  5. Return structured data

Error Handling:
- Network errors
- Timeout errors
- Server errors (500)
- Validation errors (400)
```

### 6. Toast Notification System

**Architecture:**
```
ToastProvider (context)
  ↓
ToastContainer (portal, top-right)
  ↓
Toast Components (stacked)
  ├─► Type-based styling
  ├─► Custom icons
  ├─► Auto-dismiss timer
  ├─► Progress bar
  └─► Manual close
```

**Toast Types:**
- Info (blue) - General information
- Success (green) - Successful operations
- Warning (yellow) - Important notices
- Error (red) - Error messages

**Custom Icons:**
- 'hybrid' - Globe (web + context mode)
- 'contextOnly' - Lock (context-only mode)
- 'mock' - Sparkles (mock mode)
- 'real' - Zap (real model mode)

---

## Data Flow

### Complete Request-Response Cycle

```
User Interaction
    ↓
[UI] Input field onChange
    ↓
[UI] sendMessage() called
    ↓
[UI] POST /api/chat
    ├─► query: string
    ├─► contextOnly: boolean
    └─► mockMode: boolean
    ↓
[Backend] Express route handler
    ↓
[Backend] Entity extraction (regex)
    ↓
[Backend] RAGPipeline.query()
    ├─► Check if conversational
    ├─► Vector search (if technical)
    │   └─► Retrieve top 5 chunks
    ├─► Calculate relevance
    │   └─► If < 20%: Web search
    ├─► Build prompt with context
    ├─► LLaMA inference (1500 tokens)
    ├─► Clean response
    └─► Extract sources
    ↓
[Backend] GraphGenerator.generateFromResponse()
    ├─► Entity extraction
    ├─► Relationship mapping
    └─► ReactFlow structure
    ↓
[Backend] Return JSON
    ├─► message: string
    ├─► sources: Array
    └─► graph: Object
    ↓
[UI] Parse response
    ↓
[UI] Update chat state
    ├─► Add message to history
    ├─► Update graph visualization
    └─► Show sources
    ↓
[UI] Render
    ├─► MessageBubble component
    ├─► DependencyGraph component
    └─► Source badges
```

### Hybrid Mode Decision Tree

```
Query Received
    ↓
Calculate Relevance
    ├─► Extract query terms
    ├─► Filter stop words
    ├─► Match against context
    └─► Calculate percentage
    ↓
If Relevance >= 20%:
    ├─► Use Internal Context
    ├─► Generate from ingested docs
    └─► Return with document sources
Else:
    ├─► Trigger Web Search
    ├─► Fetch 5 Google results
    ├─► Generate from web context
    └─► Return with web sources (green badges)
```

### Document Upload Flow

```
User selects file(s)
    ↓
[UI] File validation
    ├─► Check size (< 10MB)
    ├─► Check format (JSON, PDF, DOCX)
    └─► Show preview
    ↓
[UI] POST /api/upload (multipart/form-data)
    ↓
[Backend] Multer middleware
    ├─► Save to uploads directory
    └─► Generate unique filename
    ↓
[Backend] Document processing
    ├─► Extract text
    ├─► Create chunks
    ├─► Generate embeddings
    └─► Add to vector store
    ↓
[Backend] Save metadata
    ├─► Filename
    ├─► Source ID
    ├─► Upload timestamp
    └─► Chunk count
    ↓
[Backend] Return success
    ├─► documentId
    ├─► filename
    └─► chunkCount
    ↓
[UI] Update document list
    └─► Show success toast
```

---

## Setup & Configuration

### Backend Setup

**1. Install Dependencies:**
```bash
cd Model
npm install
```

**2. Environment Configuration (.env):**
```bash
# Model Configuration
GGUF_MODEL_PATH=./llama-3.1-8b.gguf

# RAG Configuration
CONTEXT_WINDOW=4096
MAX_TOKENS=1500
TEMPERATURE=0.7

# Hybrid Mode
HYBRID_MODE=true

# Web Search
SERPER_API_KEY=your_serper_api_key_here

# Corporate Proxy (optional)
http_proxy=http://user:pass@proxy:port
https_proxy=http://user:pass@proxy:port

# Jira Configuration (optional)
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your_jira_api_token

# Confluence Configuration (optional)
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_EMAIL=your-email@company.com
CONFLUENCE_API_TOKEN=your_confluence_api_token

# Bamboo Configuration (optional)
BAMBOO_BASE_URL=https://bamboo.company.com
BAMBOO_USERNAME=your_username
BAMBOO_PASSWORD=your_password
```

**3. Download LLaMA Model:**
```bash
# Option 1: Download from Hugging Face
# Visit: https://huggingface.co/meta-llama/Llama-3.1-8B-GGUF
# Download: llama-3.1-8b.gguf (15GB)

# Option 2: Convert from PyTorch
# Follow: docs/CONVERT_TO_GGUF.md
```

**4. Ingest Initial Data:**
```bash
# Add JSON files to data/context/
# - confluence-sample.json
# - jira-sample.json
# - bamboo-sample.json

# Run ingestion
npm run ingest

# Verify: data/ingested-documents.json created
```

**5. Start Backend:**
```bash
npm start
# Or for development:
npm run dev
```

**Health Check:**
```bash
curl http://localhost:3000/health
```

### Frontend Setup

**1. Install Dependencies:**
```bash
cd UI
npm install
```

**2. Environment Configuration (.env):**
```bash
VITE_API_URL=http://localhost:3000
VITE_ENABLE_MOCK=false
```

**3. Start Development Server:**
```bash
npm run dev
```

**4. Build for Production:**
```bash
npm run build
# Output: dist/
npm run preview  # Test production build
```

### System Requirements

**Hardware:**
- CPU: 8+ cores recommended
- RAM: 16GB minimum (32GB recommended)
- GPU: Apple M1+ / NVIDIA GPU (optional, for acceleration)
- Storage: 50GB free space

**Software:**
- Node.js: v18.0.0 or higher
- npm: v9.0.0 or higher
- macOS: 12+ (for Metal GPU) / Linux / Windows 10+

---

## API Specifications

### Complete API Endpoint Reference

#### Chat and Core Functionality

**POST /api/chat**
Main chat endpoint for querying the RAG system
```
Request Body:
{
  "message": "What is ECOM service architecture?",
  "conversationId": "uuid-string" (optional),
  "wantPointwise": false,
  "contextOnly": false,
  "userContext": null,
  "chatHistory": []
}

Response:
{
  "conversationId": "uuid-string",
  "message": "The ECOM service follows a microservices architecture...",
  "sources": [...],
  "components": [...],
  "graph": {...},
  "timestamp": "2026-04-02T10:30:00.000Z",
  "pointwise": false,
  "usedWebSearch": false
}
```

**POST /api/graph**
Generate dependency graph from query
```
Request Body:
{
  "query": "What is ECOM service architecture?",
  "detailed": true
}

Response:
{
  "nodes": [...],
  "edges": [...],
  "metadata": {
    "title": "Architecture View",
    "nodeCount": 8,
    "edgeCount": 12
  }
}
```

**POST /api/format-pointwise**
Convert response text to pointwise bullet format
```
Request Body:
{
  "text": "The ECOM service is built with..."
}

Response:
{
  "formatted": "- Key point 1\n- Key point 2\n..."
}
```

#### Document Management

**POST /api/upload-document**
Upload and process documents (PDF, DOCX, JSON, TXT)
```
Request: multipart/form-data with file(s)
Limit: 50 MB per file

Response:
{
  "success": true,
  "message": "3 documents uploaded successfully",
  "filename": "archive-123456.json",
  "documentsAdded": 3,
  "documents": [
    {
      "id": "doc-id",
      "title": "Document Title",
      "type": "pdf"
    }
  ]
}
```

**GET /api/documents**
List all ingested documents with metadata
```
Response:
{
  "documents": [
    {
      "id": "upload-123",
      "filename": "architecture.pdf",
      "uploadDate": "2026-03-20T10:30:00.000Z",
      "source": "upload",
      "chunkCount": 15
    }
  ],
  "totalChunks": 150
}
```

**DELETE /api/documents/:id**
Remove document from vector store
```
Response:
{
  "success": true,
  "message": "Document deleted successfully",
  "deletedDocument": "upload-123"
}
```

**DELETE /api/documents/:id/force-remove**
Force remove document and undo ingestion (clears embeddings and resets RAG)
```
Response:
{
  "success": true,
  "message": "Document force removed successfully. RAG system reinitialized.",
  "removedDocument": "upload-123"
}
```

#### SQL Generation Endpoints

**POST /api/generate-sql**
Generate SQL queries from natural language descriptions
Uses independent LlamaModel instance with dedicated system prompt for deterministic SQL output
```
Request Body:
{
  "description": "Show me the names of students from Mumbai in 12th grade",
  "databaseType": "mysql|postgresql|oracle",
  "schemaContext": "TABLE students: id INT, first_name VARCHAR, last_name VARCHAR, city VARCHAR, grade_level INT",
  "complexity": "simple|intermediate|complex"
}

Response:
{
  "success": true,
  "data": {
    "query": "SELECT first_name, last_name\nFROM students\nWHERE city = 'Mumbai'\n  AND grade_level = 12;",
    "explanation": "This query retrieves the first and last names of all students located in Mumbai with grade level 12.",
    "validation": {
      "isValid": true,
      "issues": []
    },
    "riskLevel": "low",
    "warnings": [],
    "databaseType": "mysql",
    "complexity": "simple",
    "timestamp": "2026-04-05T10:30:00.000Z"
  }
}
```

**Parameters:**
- `description` (required): Natural language query request
- `databaseType` (optional, default: "mysql"): Target database (mysql, postgresql, oracle)
- `schemaContext` (optional): CREATE TABLE statements and schema documentation for accuracy
- `complexity` (optional, default: "simple"): Query complexity hint (simple, intermediate, complex)

#### Ingestion and Monitoring

**POST /api/ingest**
Trigger data ingestion from external sources (Jira, Confluence, Bamboo)
```
Response:
{
  "message": "Ingestion started",
  "status": "processing"
}
```

**GET /api/ingest-status**
Get current ingestion progress
```
Response:
{
  "isRunning": false,
  "completed": true,
  "error": null,
  "stats": {
    "totalDocuments": 150,
    "successfullyProcessed": 148,
    "failed": 2
  },
  "currentStage": "Embedding generation",
  "progress": {
    "processed": 148,
    "total": 150
  }
}
```

**GET /api/trending-searches**
Get trending search entities and frequencies
```
Query Parameters:
?range=24h (options: 24h, 7d, 30d)

Response:
{
  "entities": [
    {
      "name": "ECOM Service",
      "searchCount": 45,
      "lastSearched": "2026-04-02T10:30:00.000Z"
    }
  ],
  "totalSearches": 234,
  "timeRange": "24h"
}
```

**POST /api/trending-searches/process**
Process and store trending entity data
```
Request Body:
{
  "entities": ["ECOM Service", "Kenan"],
  "timestamp": "2026-04-02T10:30:00.000Z"
}

Response:
{
  "success": true,
  "processed": 2,
  "message": "Trending data processed"
}
```

#### Architecture Image Management

**POST /api/upload-architecture-image**
Upload and analyze architecture diagram (PNG, JPG)
Uses Qwen2.5-VL vision model for component extraction
```
Request: multipart/form-data with image file
Limit: 50 MB per image

Response:
{
  "success": true,
  "message": "Architecture image uploaded and analyzed",
  "imageId": "arch-uuid",
  "label": "Enterprise Architecture Overview",
  "extractedData": {
    "components": [
      {
        "name": "ECOM Service",
        "type": "service",
        "layer": 2,
        "technology": ["Java", "Spring Boot"]
      }
    ],
    "relationships": [
      {
        "from": "API Gateway",
        "to": "ECOM Service",
        "type": "routes to"
      }
    ]
  }
}
```

**GET /api/architecture-images**
List all ingested architecture diagrams
```
Response:
{
  "images": [
    {
      "id": "arch-123",
      "label": "Enterprise Architecture",
      "uploadDate": "2026-04-01T15:20:00.000Z",
      "componentCount": 12,
      "relationshipCount": 15
    }
  ],
  "totalImages": 5
}
```

**POST /api/analyze-image**
Analyze an uploaded image without storing it
```
Request: multipart/form-data with image file

Response:
{
  "success": true,
  "analysis": {
    "components": [...],
    "relationships": [...],
    "descriptiveText": "Architecture diagram showing..."
  }
}
```

**DELETE /api/architecture-images/:id**
Remove architecture diagram and update RAG context
Forces RAG re-initialization on next query
```
Response:
{
  "success": true,
  "message": "Architecture image deleted successfully",
  "imageId": "arch-123"
}
```

#### Document Review and Validation

**POST /api/validations**
Create a document review validation task
```
Request Body:
{
  "documentId": "doc-123",
  "reviewType": "accuracy|completeness|relevance",
  "assignedTo": "user-id"
}

Response:
{
  "validationId": "validation-uuid",
  "status": "pending",
  "createdAt": "2026-04-02T10:30:00.000Z"
}
```

**GET /api/validations**
List all validation tasks
```
Response:
{
  "validations": [
    {
      "id": "validation-uuid",
      "documentId": "doc-123",
      "status": "pending|in-progress|approved|rejected",
      "assignedTo": "user-id",
      "createdAt": "2026-04-02T10:30:00.000Z"
    }
  ]
}
```

**GET /api/validations/assigned**
Get validations assigned to current user
```
Response:
{
  "assignedValidations": [...]
}
```

**PUT /api/validations/:id/review**
Submit review feedback
```
Request Body:
{
  "status": "approved|rejected",
  "feedback": "This document is accurate and relevant"
}

Response:
{
  "success": true,
  "validationId": "validation-uuid",
  "updatedAt": "2026-04-02T10:35:00.000Z"
}
```

**GET /api/validations/:id/progress**
Get validation review progress
```
Response:
{
  "validationId": "validation-uuid",
  "completedReviews": 2,
  "totalReviewsRequired": 3,
  "progress": 66,
  "consensus": "pending"
}
```

#### System Health and Status

**GET /health**
System health check
```
Response:
{
  "status": "ok",
  "timestamp": "2026-04-02T10:30:00.000Z",
  "service": "CAE Backend",
  "ragInitialized": true
}
```

#### Data Formatting and Conversion

**POST /api/format-data**
Format and validate data in various formats (JSON, YAML, XML, TOML, Markdown, CSV)
```
Request Body:
{
  "rawData": "[{\"name\": \"John\", age: 30}]",
  "formatType": "json"
}

Response (Success):
{
  "success": true,
  "data": {
    "success": true,
    "formatted": "[{\n  \"name\": \"John\",\n  \"age\": 30\n}]",
    "issues": [
      {
        "line": 1,
        "column": 20,
        "message": "Unquoted key: age",
        "type": "json_syntax_error",
        "severity": "warning"
      }
    ],
    "explanation": "Found 1 issue: Unquoted keys have been fixed",
    "hasWarnings": true
  },
  "timestamp": "2026-04-05T10:30:00.000Z"
}

Error Handling:
- 400: No data provided or invalid format type
- 404: Format type not supported
- 500: Server error
```

**POST /api/convert**
Convert data between different formats (bidirectional)
```
Request Body:
{
  "rawData": "{\"users\": [{\"name\": \"John\", \"age\": 30}]}",
  "fromFormat": "json",
  "toFormat": "yaml"
}

Response (Success with JSON→YAML):
{
  "success": true,
  "data": {
    "success": true,
    "converted": "users:\n  - name: John\n    age: 30",
    "issues": [],
    "explanation": "✓ Successfully converted JSON to YAML"
  },
  "timestamp": "2026-04-05T10:30:00.000Z"
}

Supported Conversions:
- JSON ↔ YAML (primary)
- JSON ↔ XML
- JSON ↔ TOML
- JSON ↔ CSV
- Plus all other 30 possible combinations

Error Handling:
- 400: Invalid format types or missing parameters
- 404: Format not supported
- 500: Conversion failed
```

---

## Performance & Optimization

### Backend Optimizations

**1. Model Loading:**
- Lazy loading: Model loads on first request
- Context reuse: Session persists across requests
- GPU acceleration: Metal (macOS) / CUDA (Linux)

**2. Vector Search:**
- In-memory vector store for fast retrieval
- Cosine similarity (optimized)
- Top-K limiting (K=5)

**3. Response Generation:**
- Token streaming (not implemented yet)
- Context window management (4096 tokens)
- Prompt caching (session level)

**4. Web Search:**
- Parallel requests (not implemented)
- 20-second timeout
- Result caching (future enhancement)

### Frontend Optimizations

**1. Component Optimization:**
- React.memo for expensive components
- useMemo for computed values
- useCallback for stable functions

**2. Bundle Optimization:**
- Code splitting (Vite automatic)
- Tree shaking (ES modules)
- Lazy loading (React.lazy)

**3. Rendering Optimization:**
- Virtual scrolling (not implemented)
- Debounced input handlers
- Optimistic UI updates

**4. Asset Optimization:**
- Image lazy loading
- SVG icons (lucide-react)
- CSS-in-JS with Tailwind

### Performance Benchmarks

**Backend:**
- Model load time: 15-30 seconds (first request)
- Vector search: < 100ms
- LLaMA inference: 2-10 seconds (depends on response length)
- Total response time: 3-15 seconds

**Frontend:**
- Initial load: < 2 seconds
- Time to interactive: < 3 seconds
- Chat message render: < 50ms
- Graph render: < 200ms

---

## Troubleshooting

### Common Issues

**1. Model Loading Errors:**
```
Error: Could not load GGUF model
Solution: 
- Check GGUF_MODEL_PATH in .env
- Verify model file exists and is not corrupted
- Ensure sufficient RAM (16GB minimum)
```

**2. Web Search Not Working:**
```
Error: Serper search error: unexpected EOF
Solution:
- Check query for special characters (apostrophes, quotes)
- Verify SERPER_API_KEY in .env
- Check corporate proxy configuration
- Increase timeout in WebSearchService.js
```

**3. Graph Not Displaying:**
```
Issue: Empty graph or "No architecture found"
Solution:
- Check backend response includes graph object
- Verify GraphGenerator is extracting entities
- Check browser console for ReactFlow errors
- Ensure nodes have valid position coordinates
```

**4. Slow Response Times:**
```
Issue: Response takes > 30 seconds
Solution:
- Check CPU/RAM usage during inference
- Reduce MAX_TOKENS in .env
- Enable GPU acceleration if available
- Clear vector store and re-ingest
```

**5. CORS Errors:**
```
Error: blocked by CORS policy
Solution:
- Verify backend CORS configuration
- Check VITE_API_URL in frontend .env
- Ensure ports match (default: 3000 backend, 3001 frontend)
```

### Debug Mode

**Enable Debug Logging:**

Backend (.env):
```bash
DEBUG=true
LOG_LEVEL=verbose
```

Frontend (console):
```javascript
localStorage.setItem('debug', 'true')
```

### Health Check Checklist

```
Backend:
[ ] Model file exists at GGUF_MODEL_PATH
[ ] Port 3000 is available
[ ] ingested-documents.json exists
[ ] /health endpoint returns 200
[ ] Environment variables loaded

Frontend:
[ ] Port 3001 is available
[ ] Can connect to backend API
[ ] No console errors
[ ] Theme toggles work
[ ] Chat sends messages

Integration:
[ ] Messages receive responses
[ ] Sources display correctly
[ ] Graph renders
[ ] Document upload works
[ ] Admin dashboard accessible
```

---

---

## Recent Changes

### April 5, 2026 - SQL Generator and Document Management Enhancement

#### 1. SQL Generation Engine (utils/SQLGenerator.js)

**Architecture:**
- Independent LlamaModel, LlamaContext, and LlamaChatSession for SQL tasks
- Completely isolated from RAG chat session to prevent prompt conflicts
- Dedicated system prompt for deterministic SQL output
- Temperature set to 0.2 for precise SQL syntax (vs. 0.7 for creative chat)

**Key Features:**
- Supports Oracle, PostgreSQL, and MySQL dialects
- Schema context injection for database-aware query generation
- Query complexity levels: simple, intermediate, complex
- Comprehensive SQL validation with safety checks
- Risk assessment (low/medium/high/critical)
- Performance optimization warnings

**System Prompt Design:**
```
Critical Rules:
1. OUTPUT ONLY SQL CODE - Start with SELECT, INSERT, UPDATE, DELETE, CREATE, or DROP
2. No preamble, no explanation before the SQL
3. No markdown backticks or "Here's the SQL:" text
4. Generate syntactically correct SQL for the specified database type
5. Always include WHERE clauses when modifying data (UPDATE/DELETE)
6. Use proper capitalization and formatting
```

**Response Processing Pipeline:**
1. Extract SQL keywords from response
2. Remove 11+ preamble patterns (e.g., "Here's the SQL", "Sure...", "Certainly...")
3. Strip postamble explanations
4. Normalize SQL formatting (indentation, keyword alignment)
5. Validate minimum length (>10 characters)
6. Auto-append trailing semicolon

**Validation & Risk Assessment:**
- Detects DELETE/UPDATE without WHERE clauses
- Identifies DROP/TRUNCATE operations
- Assesses transaction safety
- Database-specific syntax checking
- Performance issue warnings (SELECT *, N+1 queries, missing LIMIT)

#### 2. SQL Workbench UI Component (UI/src/components/sql/SQLWorkbench.jsx)

**User Interface:**
- Professional database workbench layout
- Split-panel design: 58% input, 42% output
- Dark theme with glass morphism effects
- Animated loading spinner during query generation
- Color-coded risk level badges

**Input Panel Features:**
- Database type selector (Oracle, PostgreSQL, MySQL)
- Complexity picker (Simple, Intermediate, Complex)
- Query description textarea with placeholder examples
- Optional schema context textarea (collapsible)
- Generate button with loading state
- Query history (10 recent queries, clickable to reload)

**Output Panel Features:**
- Generated SQL display with monospace formatting
- Syntax-aware line normalization
- Copy-to-clipboard button
- Download as .sql file
- Explanation section
- Risk level indicator with color coding
- Validation issues panel
- Performance notes/warnings
- Query execution history sidebar

**Loader Animation:**
- Animated spinning icon during model inference
- "Generating SQL query..." message
- Helpful note: "This may take a moment while the model processes your request"
- Smooth opacity pulsing animation

**Integration:**
- Integrated as new "SQL" tab in MainLayout navigation
- Toast notifications for success/errors
- 120-second timeout for model inference
- Vite proxy configuration forwarding /api calls to backend:3000

#### 3. Document Management Enhancement

**Force-Remove Functionality:**
- New DELETE endpoint: /api/documents/:id/force-remove
- Removes document from ingested-documents.json
- Clears associated vector embeddings
- Resets RAG isInitialized flag
- Clears entity tracker
- Forces RAG re-initialization on next chat query

**Document List UI Update:**
- Added "Undo Ingestion" button for APPROVED documents
- Amber/yellow button styling for visibility
- Undo icon (rotating arrow)
- Double-confirmation prevents accidental removal
- Toast notification feedback (success/error)

**Workflow Improvements:**
Documents now follow complete lifecycle:
1. Uploaded → Files processed → chunks created
2. Validation → Peer review workflow → Approval/Rejection
3. APPROVED → (Optional) Force-remove to undo ingestion
4. Removal clears embeddings and resets RAG search index

#### 4. Backend API Routing (Model/server.js)

**New Imports:**
- SQLGenerator class from utils/SQLGenerator.js
- Additional fs utilities for document management

**New Endpoints:**
```javascript
POST /api/generate-sql
  - Input: description, databaseType, schemaContext, complexity
  - Output: query, explanation, validation, riskLevel, warnings
  - Timeout: 120 seconds
  - Error handling: 400 for invalid params, 500 with details

DELETE /api/documents/:id/force-remove
  - Removes document and clears RAG
  - Resets vector store
  - Clears entity tracker
  - Forces RAG re-initialization
```

**Instance Management:**
```javascript
const sqlGenerator = new SQLGenerator();
// Initializes once, reuses session for all subsequent requests
```

#### 5. Frontend Configuration (UI/vite.config.js)

**Proxy Configuration:**
```javascript
server: {
  port: 3001,
  host: true,
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      secure: false,
    },
  },
}
```

Enables frontend on port 3001 to seamlessly call backend APIs on port 3000.

#### 6. Toast Context Fix (UI/src/contexts/ToastContext.jsx)

**Hook Methods:**
- `error(message)` - Display error notification
- `success(message)` - Display success notification
- `info(message)` - Display info notification
- `warning(message)` - Display warning notification

**SQLWorkbench Integration:**
```javascript
const { error, success, info } = useToast();

const showToast = (type, message) => {
  if (type === 'error') error(message);
  else if (type === 'success') success(message);
  else if (type === 'info') info(message);
  else success(message);
};
```

#### 7. Data Formatter Engine (Model/utils/FormatValidator.js)

**Architecture:**
- Unified FormatValidator class managing 6 formatter types
- Each formatter (JSON, YAML, XML, TOML, Markdown, CSV) extends common interface
- Error recovery with `attemptPartialFix()` methods for intelligent correction
- Always returns formatted output + error list for educational UX

**Supported Formats:**
1. **JSON**: Parse → Fix single quotes/unquoted keys/trailing commas → Format
2. **YAML**: Parse → Normalize indentation (tabs→spaces) → Format
3. **XML**: Parse → Fix entity encoding/unclosed tags → Format with beautification
4. **TOML**: Parse → Add quotes to unquoted strings → Format
5. **CSV**: Validate columns → Report mismatches as warnings → Format
6. **Markdown**: Validate code blocks/brackets → Normalize spacing → Format

**Error Recovery Strategy:**
```
Step 1: Try parsing with library
  ├─► Valid? → Return formatted output ✓
  └─► Failed? → Attempt partial fix

Step 2: Apply format-specific fixes
  ├─► JSON: Fix quotes, unquoted keys, trailing commas
  ├─► YAML: Normalize indentation levels
  ├─► XML: Fix entity encoding, balance tags
  ├─► TOML: Add quotes to unquoted values
  └─► CSV: Report column mismatches as warnings

Step 3: Return formatted + issues together
  └─► "Here's your corrected output + here's what was wrong"
```

**Key Innovation:**
Users always see **corrected/formatted output** (even partial) PLUS an **error/warning list below** showing what was wrong with their input. This educational UX helps users learn proper syntax.

**Files:**
- Backend: `Model/utils/FormatValidator.js` (~800 lines)
- API Endpoint: `POST /api/format-data`

#### 8. Data Format Converter (Model/utils/FormatValidator + UI)

**Bidirectional Conversion Support:**
- JSON ↔ YAML (primary use case)
- JSON ↔ XML  
- JSON ↔ TOML
- JSON ↔ CSV
- Plus all other combinations (6 formats = 30 possible conversions)

**Conversion Pipeline:**
```
Source Format (any)
    ↓
Parse to JavaScript object
    ↓
Transform to intermediate representation
    ↓
Convert to target format
    ↓
Return formatted output + issues
```

**Format-Specific Conversions:**
```javascript
// JSON ↔ YAML (parse & dump)
JSON.parse(jsonStr) → jsyaml.dump(obj)

// JSON ↔ XML (parse & rebuild with xml2js)
JSON.parse(jsonStr) → Builder.buildObject(obj)

// JSON ↔ TOML (object conversion)
JSON.parse(jsonStr) → customJsonTotoml(obj)

// JSON ↔ CSV (array processing)
JSON.parse(arrStr) → csvBuilder(arr)
```

**Files:**
- Backend: `Model/utils/FormatValidator.js` (convert method)
- API Endpoint: `POST /api/convert`
- Frontend: `UI/src/components/formatter/FormatConverter.jsx` (~300 lines)

#### 9. Formatter and Converter UI (UI Components)

**FormatterWorkbench** (`components/formatter/FormatterWorkbench.jsx`):
- **Layout**: 58% input panel | 42% output panel (responsive)
- **Features**:
  - Format type selector (6 buttons: JSON, YAML, XML, TOML, Markdown, CSV)
  - Raw data textarea with character counter
  - Animated loading spinner with pulsing effect
  - Formatted output display (monospace, syntax-highlighted)
  - **Error Panel**: Line/column numbers, severity color-coding
  - **Explanation Panel**: User-friendly error summaries
  - Copy & Download buttons
  - Format history (recent 10)
  - Toast notifications for feedback
  - Severity levels: error (red), warning (yellow), info (blue)

**FormatConverter** (`components/formatter/FormatConverter.jsx`):
- **Layout**: Left panel (source) | Right panel (target) with swap button
- **Features**:
  - Source format selector (dropdown)
  - Target format selector (dropdown)
  - **Swap & Reverse Button**: Instantly reverse conversion by swapping panels and data
  - Raw data input (left)
  - Converted output display (right)
  - Copy & Download for converted output
  - Issue reporting with line numbers
  - Conversion history with timestamps (clickable to repeat)
  - Toast notifications

**Tab Integration** (`MainLayout.jsx`):
- **Formatter Tab**: Wrench icon - for formatting/validating single format
- **Converter Tab**: RefreshCw icon - for bidirectional format conversion
- Both tabs integrated into main tab bar with other views (Chat, Split, Graph, Architecture, SQL)
- Smooth Framer Motion animations on view transitions

#### 10. API Endpoints (Model/server.js)

**POST /api/format-data - Format & Validate**
```javascript
Request:
{
  "rawData": "[{\"name\": \"John\", age: 30}]",
  "formatType": "json"
}

Response:
{
  "success": true,
  "data": {
    "success": true,
    "formatted": "[{\n  \"name\": \"John\",\n  \"age\": 30\n}]",
    "issues": [
      {
        "line": 1,
        "column": 20,
        "message": "Unquoted key: age",
        "type": "json_syntax_error",
        "severity": "warning"
      }
    ],
    "explanation": "Found 1 issue: Unquoted keys have been fixed",
    "hasWarnings": true
  },
  "timestamp": "2026-04-05T10:30:00.000Z"
}
```

**POST /api/convert - Convert Between Formats**
```javascript
Request:
{
  "rawData": "{\"users\": [{\"name\": \"John\", \"age\": 30}]}",
  "fromFormat": "json",
  "toFormat": "yaml"
}

Response:
{
  "success": true,
  "data": {
    "success": true,
    "converted": "users:\n  - name: John\n    age: 30",
    "issues": [],
    "explanation": "✓ Successfully converted JSON to YAML"
  },
  "timestamp": "2026-04-05T10:30:00.000Z"
}
```

**Performance:**
- Average formatting time: 5-20ms per request
- Conversion time: 10-50ms depending on data size
- Timeout: 30 seconds per request
- Error handling: 400 for invalid params, 500 for server errors

### April 2, 2026 - Vision Pipeline Enhancement and UI Improvements

#### 1. Vision Extraction Pipeline (utils/QwenVisionClient.js)

**Issue Resolution:**
The `llama-mtmd-cli` invocation with `--log-disable` flag was suppressing model token output, causing JSON parsing failures. Issue resolved by:
- Removed `--log-disable` flag to allow model tokens on stdout
- Increased `maxTokens` from 1200 to 3000 (prevents JSON truncation)
- Increased `timeoutMs` from 180000 to 240000 ms (handles complex diagrams)
- Implemented `_repairTruncatedJSON()` method for partial response recovery

**New Capability:**
Vision model can now reliably extract complex architecture diagrams with 30+ components.

#### 2. Architecture Image Management (Admin UI)

**New Delete Functionality:**
- Per-image delete button in ArchitectureImageUpload component
- DELETE /api/architecture-images/:id endpoint
- Automatic RAG re-initialization after deletion
- Loading state indicator during deletion

**Detail Panel Enhancement:**
- Eye toggle button for each architecture image
- Inline panel showing: extracted layers, components, relationships
- Framer Motion animations for expand/collapse
- Detail persistence across interactions

#### 3. Image Preview in Chat (ChatContext.jsx, MessageBubble.jsx)

**User Message Enhancement:**
- Uploaded architecture images display as thumbnails in chat
- Base64 data URL storage in message objects
- Responsive image sizing (max-height 12rem, rounded corners)
- Object-fit contain for aspect ratio preservation

#### 4. Layout and Responsiveness

**SessionSidebar Redesign:**
- Width reduced from 320px to 256px for better desktop space utilization
- Framer Motion animations updated for new dimensions
- Mobile responsiveness maintained

**MainLayout Improvements:**
- Inline horizontal tab bar for view switching (Chat | Split | Graph)
- Removed floating pill view-switcher (eliminated overlap issues)
- Split-view grid ratio adjusted to 58% chat / 42% graph
- Reduced padding and gaps for compact 14-inch displays

#### 5. GraphGenerator Engine (utils/GraphGenerator.js)

**Node Type Expansion:**
Added four new node types with distinct colors:
- gateway (amber) - API gateway and traffic routers
- frontend (pink) - Browser-facing web applications
- module (cyan) - Application sub-modules
- cache (lime) - In-memory cache systems

**Entity Extraction Algorithm:**
```
Three-pass component discovery:
Pass 1: Bold markdown **Name** patterns
Pass 2: Known Singtel system names (ECOM, Kenan, ESOM, etc.)
Pass 3: Capitalized noun phrases (Service/API/DB/Gateway/Queue/Cache)
Pass 4: Uppercase abbreviations (3-6 chars, filtered against noise list)
```

**Relationship Extraction:**
Sentence-by-sentence parsing for directional verb patterns:
- Verbs: calls, uses, stores in, publishes to, subscribes to, depends on, connects to, sends to, routes to, manages
- Output: Array of {from, to, type, label} relationship objects

**Layered Layout Algorithm:**
Automatic tier calculation and horizontal positioning:
```
Tier 0 (y=40):    External, Frontend (web-facing)
Tier 1 (y=220):   Gateway, API (routing layer)
Tier 2 (y=400):   Service, Module (business logic)
Tier 3 (y=580):   Database, Queue, Cache (data layer)

Horizontal spacing: 260px between nodes in same tier
```

**Deduplication:**
- Removes substrings of longer names
- Caps output at 14 nodes for readability

#### 6. Three-Strategy Graph Generation (rag/RAGPipeline.js)

**Strategy 1 - Qwen-Extracted Architecture (Priority)**
- Matches LLM answer text against extracted components
- Three-level name matching: full name, abbreviation, first word
- Expands to include 1-hop neighbors (up to 6 additional)
- Falls back to first 18 components if no matches

**Strategy 2 - Known Component Keyword Detection**
- Scans for Singtel keywords: ECOM, Kenan, ESOM, MongoDB, RabbitMQ, Redis, PostgreSQL, Kafka
- Requires 2+ keywords for graph generation
- Includes pre-defined type and owner metadata
- Dynamic relationship extraction from answer text
- Layer-adjacency fallback if no text relationships found

**Strategy 3 - Full Text Extraction**
- Last resort: full entity and relationship extraction
- Operates only if 2+ nodes are produced
- Falls back to static sample graph if all strategies fail

#### 7. CustomNode Redesign (components/graph/CustomNode.jsx)

**Visual Hierarchy:**
- Colored top stripe (node type color)
- Icon + label + status indicator
- Layer badge (when available)
- Description (2 lines max)
- Technology chips (3 visible, +N overflow indicator)
- Type label + owner footer

**Node Width:** 210px (optimized for graph readability)

**Icon Set:**
- Globe (gateway)
- Layout (frontend)
- Package (module)
- Zap (cache)
- Plus existing database, queue, service, api, external icons

**Status Indicators:**
- Green dot: active
- Amber dot: warning
- Grey dot: inactive

#### 8. DependencyGraph Interactivity (components/graph/DependencyGraph.jsx)

**Dynamic Title:**
Graph header reads `metadata.title` from generator (architecture image label or strategy name)

**Programmatic View Fit:**
- On graph data change, calls `fitView({ padding: 0.25, duration: 400 })`
- 80ms setTimeout ensures DOM updates before fitting
- Guarantees all nodes visible on update

**Edge Routing:**
- All edges use `type: 'smoothstep'` for better readability
- Avoids straight lines through unrelated nodes

**Zoom Configuration:**
- minZoom: 0.15 (supports 40+ node graphs)
- maxZoom: 2

**Detail Panel:**
Clicking a node displays: type badge, status, layer, description, full tech stack, owner

#### 9. Conversation History Management (contexts/ChatContext.jsx, server.js)

**Client-Side Storage:**
- Conversation history stored in localStorage per sessionId
- Survives server restarts
- Sent with every API request as `chatHistory` parameter

**Server-Side Processing:**
- chatHistory parameter processed for conversation context
- Used in RAG pipeline for contextual awareness
- Supports multi-turn queries with memory

#### 10. Entity Tracking System (server.js)

**Dynamic Entity Extraction:**
Extracts searchable entities from queries using 20+ regex patterns:
- Service patterns (ServiceName, NameAPI, NameGateway, etc.)
- Architecture terms (microservice, monolith, docker, kubernetes)
- Technology stacks (React, Java, Python, AWS, Azure)
- Communication patterns (REST, GraphQL, gRPC, OAuth, JWT)
- Database systems (MongoDB, PostgreSQL, Redis, Kafka)

**Frequency Tracking:**
- Maps entity name to search frequency
- Max 1000 unique entities tracked (FIFO rotation)
- Queryable via GET /api/trending-searches

#### 11. Authentication and Session Management

**Frontend (contexts/AuthContext.jsx):**
- localStorage-based user authentication
- Sign-up, login, password reset workflow
- User profile storage and retrieval
- Session persistence across browser restarts

**Session Context (contexts/SessionContext.jsx):**
- Multi-session management
- Session timestamps and metadata
- 3-week expiry with automatic pruning
- Session switching/restoration

#### 12. Favorites System (contexts/FavoritesContext.jsx)

**User Favorites:**
- Save frequently asked questions
- Store favorite responses
- Quick access favorites list
- localStorage persistence

#### 13. Validation Context (contexts/ValidationContext.jsx)

**Document Review Workflow:**
- Document peer-review tasks
- Assignment and tracking
- Feedback collection
- Consensus determination

---

## Key Implementation Details

### Backend RAG Pipeline Configuration

#### Model Initialization Parameters
```javascript
Context Window: 4096 tokens
Batch Size: 2048
Temperature: 0.7
Top-P: 0.9
Repeat Penalty: 1.1
Max Response Tokens: 1500
GPU Backend: Metal (macOS) / CUDA (Linux) / Vulkan (Windows)
```

#### Vector Store Settings
```javascript
Chunk Size: 500 characters
Chunk Overlap: 50 characters
Top-K Retrieval: 5 chunks
Similarity Metric: Cosine distance
Deduplication: Substring removal
```

#### Hybrid Mode Thresholds
```javascript
Relevance Threshold: 20%
Web Search Trigger: Relevance < 20%
Web Search Results: 5 per query
Web Search Timeout: 20 seconds
Location: India (gl: "in")
```

### Data Ingestion Configuration

#### Chunk Processing
```
Document Size Limit: 50 MB
Chunk Size: 500 characters
Chunk Overlap: 50 characters
Maximum Chunks per Document: 1000
Text Extraction: pdf-parse, mammoth, native
```

#### Metadata Management
```
Source Types: upload, jira, confluence, bamboo, architecture-image
Metadata Fields: source, timestamp, title, author, component-count
Storage Format: JSON
Persistence: data/ingested-documents.json
```

### Frontend State Management

#### Context-based State
```javascript
ChatContext:
  - messages: Array<Message>
  - sessionId: string
  - isLoading: boolean
  - currentView: 'chat' | 'split' | 'graph' | 'admin'

AuthContext:
  - currentUser: User | null
  - isAdmin: boolean
  - authToken: string

SessionContext:
  - sessions: Array<Session>
  - activeSession: string
  - expiryDuration: 3 weeks
```

#### localStorage Keys
```javascript
cae-user: Current user profile
cae-sessions: Array of sessions
cae-favorites: Saved queries/responses
cae-theme: 'light' | 'dark'
cae-[sessionId]-history: Conversation history
```

### Network Configuration

#### Timeout Settings
```javascript
API Requests: 30 seconds
Web Search: 20 seconds
File Upload: 5 minutes
Model Inference: 60 seconds (typical 10-15 seconds)
```

#### Error Handling
```
Network Errors: Automatic retry (3 attempts)
Timeout: User notification + fallback
Server Errors (500): Detailed error message
Validation Errors (400): Field-level feedback
CORS: Automatic preflight handling
```

### Performance Metrics

#### Backend Performance
```
Model Load Time:     15-30 seconds (first request)
Model Load Cache:    Subsequent requests < 100ms
Vector Search:       20-100ms (depends on database size)
Entity Extraction:   50-200ms
LLaMA Inference:     2-10 seconds (response length dependent)
Web Search:          3-8 seconds
Total Response:      3-20 seconds (typical 5-10 seconds)
```

#### Frontend Performance
```
Initial Bundle Size: ~450KB (minified)
Initial Load Time:   < 2 seconds
Time to Interactive: < 3 seconds
Chat Message Render: < 50ms
Graph Render:        < 200ms
Theme Toggle:        < 100ms
Component Rerender:  < 150ms
```

### API Rate Limiting

#### Current Implementation
```
No explicit rate limiting (future enhancement)
Web Search: 1 request per query
Image Upload: 50 MB limit per image
Document Upload: 50 MB limit per file
Batch Operations: Single query per request
```

---

## System Requirements and Specifications

### Minimum Hardware Requirements
```
CPU:       Quad-core 2.4 GHz minimum
RAM:       16 GB minimum
Storage:   50 GB free (40 GB for model)
Network:   10 Mbps minimum (for web search)
GPU:       Optional (improves inference speed)
```

### Recommended Hardware Requirements
```
CPU:       8-core 3.0+ GHz processor
RAM:       32 GB
Storage:   100 GB SSD
Network:   100 Mbps
GPU:       NVIDIA RTX 3060+ or Apple M1+
```

### Software Requirements
```
Node.js:   v18.0.0 or higher
npm:       v9.0.0 or higher
Python:    v3.8+ (for model conversion only)
macOS:     12+ (for Metal GPU support)
Linux:     Any modern distribution
Windows:   10 Pro or higher (WSL2 recommended)
```

### Browser Compatibility
```
Chrome:    v90+
Firefox:   v88+
Safari:    v14+
Edge:      v90+
Mobile:    iOS 14+, Android 10+
```

### Optional Dependencies
```
Docker:    For containerized deployment
Kubernetes: For production scaling
Redis:     For distributed caching
PostgreSQL: For persistent data storage (future)
```

---

## Complete Troubleshooting Guide

### Model and Inference Issues

#### Issue 1: GGUF Model Not Found
```
Error: [LlamaModel] Failed to load model from file
Symptoms: Server crashes or fails to initialize

Solutions:
1. Verify GGUF_MODEL_PATH environment variable
2. Check file exists: ls -lh ./llama-3.1-8b.gguf
3. Verify file format: file ./llama-3.1-8b.gguf
4. Check file permissions: chmod 644 ./llama-3.1-8b.gguf
5. Ensure sufficient disk space
6. Download model from: https://huggingface.co/meta-llama/
```

#### Issue 2: Slow Model Inference
```
Symptoms: Responses take > 20 seconds

Solutions:
1. Check system resources:
   - Memory usage: top or Activity Monitor
   - Disk I/O: iostat
   - CPU utilization: 100% expected during inference
2. Reduce MAX_TOKENS in .env (try 600)
3. Enable GPU acceleration:
   - macOS: Check Metal (automatic)
   - Linux: Set CUDA_VISIBLE_DEVICES
   - Windows: Check NVIDIA driver
4. Close other applications
5. Clear vector store and re-ingest
6. Check network latency for web search
```

#### Issue 3: Out of Memory Errors
```
Error: Unable to allocate memory
Symptoms: Process crashes, system swaps

Solutions:
1. Increase available RAM (needs 16GB minimum)
2. Reduce context window: CONTEXT_WINDOW=2048
3. Reduce batch size in RAGPipeline.js
4. Disable GPU if available (reduces overhead)
5. Monitor swap usage: vmstat 1
6. Restart system before running
```

### Vector Store and Data Issues

#### Issue 4: Empty Vector Store
```
Error: No documents found in context
Symptoms: All queries return "No relevant documents"

Solutions:
1. Run ingestion: npm run ingest
2. Verify data files:
   - ls -l data/ingested-documents.json
3. Check JSON format:
   - jq . data/ingested-documents.json
4. Re-ingest documents:
   - Delete data/ingested-documents.json
   - Run: npm run ingest
5. Check for file permission errors
```

#### Issue 5: Stale Documents in Context
```
Symptoms: Outdated information in responses
Solutions:
1. Delete document via API:
   - DELETE /api/documents/:id
2. Force RAG re-initialization:
   - Delete data/ingested-documents.json
   - Restart backend: npm start
3. Check document freshness:
   - Review data/ingested-documents.json timestamps
4. Re-upload updated documents
```

### Web Search Issues

#### Issue 6: Web Search Not Working
```
Error: Serper search error or timeout
Symptoms: Web search always fails, falls back to context only

Solutions:
1. Verify API key:
   - Check SERPER_API_KEY in .env
   - Test: curl -H "X-API-KEY: $SERPER_API_KEY" https://google.serper.dev/search
2. Check query format:
   - Remove special characters
   - Test simple queries first
3. Check network and proxy:
   - ping google.com
   - Test curl with proxy settings
4. Increase timeout:
   - Edit Model/utils/WebSearchService.js
   - Increase --max-time 20 to 30
5. Try alternative provider:
   - Set SEARCH_PROVIDER=brave or tavily
6. Check API rate limits:
   - Verify account not blocked
   - Check usage dashboard
```

#### Issue 7: Special Characters in Query
```
Error: Unexpected EOF or malformed JSON
Symptoms: Queries with quotes or apostrophes fail

Solutions:
1. Query escaping in WebSearchService.js:
   - Apostrophes: convert to space
   - Quotes: remove or escape
   - Backticks: remove
2. Test with simple queries first
3. Check char encoding in submission
```

### Frontend and UI Issues

#### Issue 8: Graph Not Rendering
```
Symptoms: Empty graph area, "No architecture found"
White canvas, no errors in console

Solutions:
1. Check browser console:
   - Open DevTools (F12)
   - Check for ReactFlow errors
2. Verify graph data:
   - Check API response includes graph object
   - Monitor Network tab in DevTools
3. Try a different query
4. Clear browser cache:
   - Ctrl+Shift+Delete (or Cmd+Shift+Delete)
5. Check ReactFlow installation:
   - npm ls reactflow
6. Restart frontend:
   - npm run dev
```

#### Issue 9: Chat Messages Not Sending
```
Symptoms: Send button doesn't work, no response

Solutions:
1. Check backend connection:
   - curl http://localhost:3000/health
2. Verify API URL:
   - Check VITE_API_URL in .env
3. Check browser console for errors
4. Verify network connectivity
5. Check message content:
   - Try shorter messages
   - Avoid special characters
6. Check backend logs:
   - npm run dev in Model directory
```

#### Issue 10: CORS Errors in Browser
```
Error: blocked by CORS policy
Symptoms: API calls fail with CORS error

Solutions:
1. Verify backend CORS config:
   - Check server.js has cors() middleware
2. Check API URL matches:
   - Backend: http://localhost:3000
   - Frontend: http://localhost:3001
   - VITE_API_URL must match
3. Browser dev tools:
   - Check Origin header
   - Check Access-Control headers
4. Try different port:
   - Change VITE_API_URL if port conflicts
5. Disable browser extensions (temporarily)
```

### Vision and Architecture Issues

#### Issue 11: Vision Model Extraction Fails
```
Error: "Model did not return parseable JSON"
Symptoms: Architecture image upload fails, no components extracted

Solutions:
1. Check image quality:
   - Ensure clear, readable diagram
   - Try with simpler architecture first
2. Verify image size:
   - Must be < 50 MB
   - Check file format (PNG or JPG)
3. Increase timeout:
   - Edit Model/utils/QwenVisionClient.js
   - Increase timeoutMs from 240000 to 300000
4. Check Qwen model file:
   - Verify existence of Qwen2.5-VL-7B model
5. Review server logs for details
6. Try analyzing with /api/analyze-image first
```

#### Issue 12: Architecture Graph Empty
```
Symptoms: Graph shows but no nodes/relationships
Solutions:
1. Verify extraction worked:
   - Check API response for components
2. Upload different image:
   - May be issue with specific diagram
3. Check image contrast:
   - Ensure clear black text on light background
4. Try smaller architecture diagram
5. Check extraction logs:
   - Look for component count in response
```

### Session and Authentication Issues

#### Issue 13: Session Expires Unexpectedly
```
Symptoms: Logged out, history cleared, redirected to login
Solutions:
1. Check expiry settings:
   - Default: 3 weeks
   - Adjust in SessionContext.jsx if needed
2. Verify localStorage:
   - Check Application tab in DevTools
   - Look for cae-sessions key
3. Clear old sessions:
   - Open DevTools Console
   - localStorage.removeItem('cae-sessions')
4. Check system time:
   - Ensure system clock is correct
5. Clear cookies if using authentication
```

#### Issue 14: Cannot Login
```
Symptoms: Login always fails, credentials rejected
Solutions:
1. Check credentials:
   - Verify email format
   - Ensure password is correct
2. Check localStorage:
   - May have corrupted user data
   - Clear: localStorage.clear() (caution: loses data)
3. Try signup with new account
4. Check browser dev tools:
   - Look for errors in console
   - Check Network tab for auth requests
5. Verify AuthContext saving data correctly
```

### Performance Issues

#### Issue 15: Very Slow Response Times
```
Symptoms: Response takes > 30 seconds consistently
Solutions:
1. Check system resources:
   - Memory available: 16GB minimum
   - CPU: 8-core recommended
   - Check for other processes using resources
2. Profile inference time:
   - Check model load time
   - Check vector search time
   - Check LLM generation time
3. Reduce context:
   - Limit retrievals (change K=5)
   - Clear embedding cache
4. Optimize queries:
   - Use simpler, shorter queries
   - Avoid very general questions
5. Enable GPU acceleration:
   - Verify GPU detection
   - Check driver updates
6. Scale infrastructure:
   - Use more powerful CPU
   - Add more RAM
```

### Deployment Issues

#### Issue 16: Port Already in Use
```
Error: listen EADDRINUSE: address already in use
Solutions:
1. Find process using port:
   - Linux/Mac: lsof -i :3000
   - Windows: netstat -ano | findstr :3000
2. Kill process:
   - Linux/Mac: kill -9 <PID>
   - Windows: taskkill /PID <PID> /F
3. Use different port:
   - Set PORT=3001 in .env
4. Wait for process to finish
5. Restart system if needed
```

### Debugging Tools and Commands

#### Backend Debugging
```bash
# Enable verbose logging
DEBUG=* npm run dev

# Monitor model loading
npm run dev 2>&1 | grep -i "model\|load\|initialize"

# Test health endpoint
curl -i http://localhost:3000/health

# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'

# Check ingested documents
node -e "console.log(require('./data/ingested-documents.json').length)"

# Monitor file changes
watchman watch-del-all && watchman watch-project .
```

#### Frontend Debugging
```javascript
// Enable debug logging
localStorage.setItem('debug', 'true')

// Check API calls
fetch('http://localhost:3000/health')
  .then(r => r.json())
  .then(console.log)

// Inspect chat context
console.log(useChatContext())

// Clear cached data
localStorage.clear()
sessionStorage.clear()

// Check theme
console.log(localStorage.getItem('cae-theme'))
```

---

## References and Resources

### Core Implementation Files
```
Backend Architecture:      Model/server.js
RAG Pipeline:              Model/rag/RAGPipeline.js
Graph Generation:          Model/utils/GraphGenerator.js
Vision Client:             Model/utils/QwenVisionClient.js
Web Search Service:        Model/utils/WebSearchService.js
Data Ingestion:            Model/ingestion/DataIngestion.js
File Conversion:           Model/utils/FileConverter.js

Frontend Root:             UI/src/main.jsx
Chat Context:              UI/src/contexts/ChatContext.jsx
Auth Context:              UI/src/contexts/AuthContext.jsx
Chat Interface:            UI/src/components/chat/
Graph Component:           UI/src/components/graph/
Admin Dashboard:           UI/src/components/admin/
Services Layer:            UI/src/services/
```

### Configuration Files
```
Backend Environment:       Model/.env
Frontend Environment:      UI/.env
Backend Dependencies:      Model/package.json
Frontend Dependencies:     UI/package.json
TailwindCSS Config:        UI/tailwind.config.js
Vite Config:               UI/vite.config.js
PostCSS Config:            UI/postcss.config.js
```

### Documentation Files
```
Backend Overview:          Model/README.md
Frontend Overview:         UI/README.md
Model Setup Guide:         Model/docs/SETUP_LOCAL_MODEL.md
Hybrid Mode Guide:         Model/docs/HYBRID_MODE_GUIDE.md
Model Conversion:          Model/docs/CONVERT_TO_GGUF.md
Installation Guide:        Model/docs/INSTALL_OLLAMA.md
Quickstart:                Model/docs/QUICKSTART_LOCAL_MODEL.md
```

### External Documentation
```
node-llama-cpp:            https://github.com/withcatai/node-llama-cpp
LangChain JS:              https://js.langchain.com/
ReactFlow:                 https://reactflow.dev/
LLaMA 3.1 Model:           https://meta.com/research/llama-3-1/
Qwen2.5-VL Model:          https://github.com/QwenLM/Qwen2.5-VL
TailwindCSS:               https://tailwindcss.com/
Vite:                      https://vitejs.dev/
Framer Motion:             https://www.framer.com/motion/
Radix UI:                  https://www.radix-ui.com/
```

### Development Tools
```
Node.js:                   https://nodejs.org/
npm:                       https://www.npmjs.com/
VS Code:                   https://code.visualstudio.com/
Git:                       https://git-scm.com/
Postman:                   https://www.postman.com/
Docker:                    https://www.docker.com/
```

---

## Conclusion

The CAE (Conversational Architecture Explorer) system represents a comprehensive solution for enterprise architecture exploration and knowledge management. Key achievements include:

1. **Local Intelligence:** Complete RAG implementation using offline LLaMA models
2. **Visual Intelligence:** Vision-based architecture extraction from diagrams
3. **Hybrid Search:** Intelligent fallback to web search for unknown topics
4. **Scalability:** Modular architecture supporting future enhancements
5. **User Experience:** Interactive graph visualization with multi-view support
6. **Security:** localStorage-based authentication with session management
7. **Data Management:** Complete ingestion pipeline from multiple sources
8. **Extensibility:** Clear patterns for adding new components and integrations

For simplified documentation, refer to README-SIMPLIFIED.md. For specific implementation details, consult the relevant source files noted in the References section.

---

## Version History

**April 2, 2026** (Current)
- Vision pipeline bug fixes
- Architecture image management enhancement
- Layout and responsiveness improvements
- GraphGenerator engine expansion
- Three-strategy graph generation
- CustomNode redesign
- DependencyGraph interactivity improvements

**Initial Release (March 2026)**
- Core RAG system
- Basic graph generation
- Document upload and ingestion
- Admin dashboard
- Chat interface with source attribution

---

## License and Attribution

CAE is developed for enterprise architecture management. All components are properly documented and follow Node.js and React best practices.

For questions, issues, or contributions, please refer to the project repository and development team guidelines.

---

