# RAG Pipeline Architecture and Implementation Guide

## Executive Summary

This document provides a comprehensive technical overview of the Retrieval-Augmented Generation (RAG) pipeline implemented in the Conversational Architecture Explorer (CAE) system. The RAG architecture enables the Llama 3.1-8B language model to provide contextually accurate responses by retrieving relevant information from ingested documentation sources before generating answers.

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Ingestion Pipeline](#data-ingestion-pipeline)
3. [Vector Embedding System](#vector-embedding-system)
4. [Context Retrieval Mechanism](#context-retrieval-mechanism)
5. [Response Generation Flow](#response-generation-flow)
6. [Complete Request-Response Lifecycle](#complete-request-response-lifecycle)
7. [Technical Implementation Details](#technical-implementation-details)
8. [Performance Considerations](#performance-considerations)

---

## System Overview

### Architecture Components

The RAG pipeline consists of five primary components:

1. **Data Ingestion Layer**: Collects and processes data from external sources
2. **Text Chunking Engine**: Splits documents into semantic chunks
3. **Vector Embedding System**: Converts text into numerical representations
4. **Vector Store**: Stores and enables similarity-based retrieval
5. **LLM Integration**: Combines retrieved context with user queries

### Technology Stack

- **LLM Engine**: node-llama-cpp (Llama 3.1-8B GGUF format)
- **Vector Store**: LangChain MemoryVectorStore
- **Text Processing**: RecursiveCharacterTextSplitter
- **Embedding Algorithm**: Custom TF-IDF implementation
- **Data Sources**: Jira, Confluence, Bamboo, Local JSON files

---

## Data Ingestion Pipeline

### Phase 1: Source Data Collection

The ingestion pipeline supports multiple data sources:

#### External Integration Sources

**Jira Integration**
- Connects to Atlassian Jira API
- Queries architecture-related issues using JQL
- Extracts issue keys, summaries, descriptions, and metadata
- Authentication via email and API token

**Confluence Integration**
- Retrieves documentation pages via REST API
- Supports space-based and search-based queries
- Extracts page content, titles, and hierarchy
- Maintains version information

**Bamboo Integration**
- Fetches build and deployment information
- Extracts plan keys, build statuses, and logs
- Links deployment history to services
- Provides temporal context for system changes

#### Local Data Sources

**JSON Context Files**
- Located in `Model/data/context/` directory
- Supports arbitrary structured data
- Schema-flexible design for custom metadata
- Immediate ingestion without external dependencies

**Sample Architecture Data**
- Fallback data source for development/testing
- Provides immediate functionality without credentials
- Located in `Model/data/sample-architecture.js`
- Contains representative system architecture information

### Phase 2: Document Standardization

All ingested data is normalized into a standard document format:

```javascript
{
  id: "unique-uuid-v4",
  source: "jira|confluence|bamboo|local|sample",
  sourceId: "original-identifier",
  type: "issue|page|deployment|documentation",
  title: "Human-readable title",
  content: "Full text content",
  metadata: {
    // Source-specific metadata
    created: "ISO-8601 timestamp",
    updated: "ISO-8601 timestamp",
    owner: "team-or-user",
    systems: ["system-names"]
  }
}
```

### Phase 3: Persistence

Normalized documents are serialized to JSON and stored at:
```
Model/data/ingested-documents.json
```

This file serves as the persistent data store for the RAG pipeline and is loaded during system initialization.

---

## Vector Embedding System

### TF-IDF Implementation

The system uses a custom Term Frequency-Inverse Document Frequency (TF-IDF) implementation for text vectorization, optimized for architecture documentation.

#### Vocabulary Building Phase

**Step 1: Tokenization**
- Convert text to lowercase
- Remove special characters (preserving alphanumeric and spaces)
- Split on whitespace
- Filter words shorter than 3 characters

**Step 2: Document Frequency Calculation**
- Count unique words per document
- Track how many documents contain each term
- Build comprehensive vocabulary across all documents

**Step 3: IDF Computation**
```
IDF(term) = log(total_documents / documents_containing_term)
```

This produces higher weights for rare, distinctive terms.

#### Vector Generation Process

**Term Frequency Calculation**
- Count occurrences of each term in the text
- Calculate raw frequency: TF(term) = count(term)

**TF-IDF Weighting**
```
TF-IDF(term) = TF(term) × IDF(term)
```

**Vector Normalization**
- Calculate vector magnitude: sqrt(sum of squared values)
- Normalize each component by magnitude
- Produces unit-length vectors for cosine similarity

### Embedding Properties

- **Dimensionality**: Variable (based on vocabulary size)
- **Sparsity**: High (most terms don't appear in most documents)
- **Similarity Metric**: Cosine similarity
- **Update Strategy**: Vocabulary rebuilt on initialization

---

## Context Retrieval Mechanism

### Text Chunking Strategy

Documents are split into manageable chunks to optimize retrieval relevance and LLM context window utilization.

#### Chunking Configuration

- **Chunk Size**: 500 characters (configurable via CHUNK_SIZE environment variable)
- **Chunk Overlap**: 50 characters (configurable via CHUNK_OVERLAP environment variable)
- **Splitting Strategy**: RecursiveCharacterTextSplitter
  - Attempts to split on paragraph boundaries
  - Falls back to sentence boundaries
  - Finally splits on character count if necessary

#### Metadata Preservation

Each chunk maintains full metadata from its source document:
- Source type and identifier
- Document title and type
- Creation and modification timestamps
- System associations and ownership

### Similarity Search Process

**Query Vectorization**
1. User query is tokenized using the same rules as documents
2. TF-IDF vector is computed against the established vocabulary
3. Result is a normalized vector in the same space as document chunks

**Vector Similarity Calculation**
1. Compute cosine similarity between query vector and all chunk vectors
2. Cosine similarity formula:
   ```
   similarity = dot_product(query_vector, chunk_vector)
   ```
3. Results range from 0 (completely dissimilar) to 1 (identical)

**Top-K Retrieval**
- Default: 5 most similar chunks (configurable via MAX_CONTEXT_DOCS)
- Chunks are sorted by similarity score (descending)
- Only chunks above a threshold are returned (prevents irrelevant context)

### Context Assembly

Retrieved chunks are assembled with their metadata for downstream processing:

```javascript
[
  {
    pageContent: "chunk text",
    metadata: {
      source: "jira",
      sourceId: "PROJ-123",
      title: "Issue title",
      type: "issue"
    }
  },
  // ... additional chunks
]
```

---

## Response Generation Flow

### LLM Initialization

**Model Loading**
- Load GGUF model file (Llama 3.1-8B)
- Initialize model with 4096 token context window
- Create LlamaChatSession with system prompt
- System automatically uses Metal GPU acceleration on Apple Silicon

**System Prompt**
```
You are a helpful AI assistant. Answer questions clearly and 
directly based on the provided information.
```

### Query Type Detection

The system differentiates between two query types:

**Conversational Queries**
- Greetings (hi, hello, hey)
- Status questions (how are you)
- Identity questions (who are you)
- Action: Direct LLM response without RAG context

**Technical Queries**
- Architecture questions
- System relationship queries
- Deployment and configuration questions
- Action: Full RAG pipeline with context retrieval

### Context Injection Strategy

**Without Context (Conversational)**
```
You are an expert software architecture assistant for Singtel's systems.

Question: [user query]

Please provide a thoughtful, well-structured answer. Be clear and technical.
```

**With Context (Technical)**
```
Based on the following documentation, answer this question: [user query]

Documentation:
[Document 1]
[retrieved chunk text]

[Document 2]
[retrieved chunk text]

...

Provide a clear, direct answer synthesizing the information above. 
Focus on what the user asked without repeating instructions:
```

### Token Generation

**Generation Parameters**
- **maxTokens**: 800 (limits response length)
- **temperature**: 0.7 (balances creativity and consistency)
- **topP**: 0.9 (nucleus sampling for coherent output)
- **repeatPenalty**: 1.1 (reduces repetitive text)

**Processing**
- Tokens generated incrementally
- Stop conditions: maxTokens reached or natural completion
- Response trimmed of leading/trailing whitespace

### Source Attribution

Retrieved chunks are mapped back to their source documents:
```javascript
sources: [
  {
    source: "jira",
    title: "ARCH-456: System Integration Design",
    sourceId: "ARCH-456"
  },
  // ... additional sources
]
```

This enables transparency about which documents informed the response.

---

## Complete Request-Response Lifecycle

### End-to-End Flow Diagram

```
User Query
    |
    v
[Query Type Detection]
    |
    +-- Conversational? --> [Direct LLM Response] --> Response
    |
    v
[Context Retrieval]
    |
    v
[Query Vectorization]
    |
    v
[Similarity Search]
    |
    v
[Top-K Chunks Retrieved]
    |
    v
[Context Assembly]
    |
    v
[Prompt Construction]
    |
    v
[LLM Generation]
    |
    v
[Response + Sources + Graph]
    |
    v
API Response
```

### Detailed Step-by-Step Process

#### Step 1: Request Reception
- Express server receives POST request at `/api/chat`
- Request body contains: `{ message: string, conversationId: string }`
- RAGPipeline.query() method is invoked

#### Step 2: System Initialization Check
- Verify LLM model is loaded
- Verify vector store is initialized
- Load if necessary (occurs once per server lifetime)

#### Step 3: Query Classification
- Apply regex patterns to detect query type
- Branch to appropriate processing path

#### Step 4: Context Retrieval (Technical Queries Only)
- Tokenize user query
- Generate TF-IDF vector from query text
- Compute cosine similarity against all chunks
- Sort by similarity score
- Select top 5 chunks
- Package chunks with metadata

#### Step 5: Prompt Engineering
- Combine system prompt, retrieved context, and user query
- Format according to query type template
- Ensure token count stays within context window

#### Step 6: LLM Inference
- Submit prompt to Llama model via LlamaChatSession
- Model processes prompt token-by-token
- Generation continues until stopping condition
- GPU acceleration leverages Metal framework

#### Step 7: Post-Processing
- Trim whitespace from response
- Extract source citations from retrieved chunks
- Generate architectural graph from mentioned components
- Package complete response object

#### Step 8: Response Transmission
- Serialize response to JSON
- Include: message, sources, components, graph, timestamp
- Return HTTP 200 with response body
- Frontend receives and renders response

### Performance Characteristics

**Cold Start (First Query)**
- Model loading: 10-15 seconds
- Vector store initialization: 2-3 seconds
- Total: ~15-18 seconds

**Warm Queries (Subsequent)**
- Context retrieval: 50-100ms
- LLM generation: 15-25 seconds (depending on response length)
- Total: ~15-25 seconds

---

## Technical Implementation Details

### Model Architecture

**Llama 3.1-8B Specifications**
- Parameters: 8.03 billion
- Architecture: Transformer decoder-only
- Context Window: 4096 tokens (131,072 trained, 4096 used for memory efficiency)
- Quantization: F16 (16-bit floating point)
- Model Size: 14.96 GB
- Attention Heads: 32 (8 key-value heads with GQA)
- Layers: 32 transformer blocks

**GPU Acceleration**
- Backend: Metal (Apple GPUs)
- Offloaded Layers: 33/33 (all layers on GPU)
- GPU Memory Usage: 15.3 GB
- Compute Buffer: 296 MB
- KV Cache: 512 MB

### Vector Store Implementation

**Data Structure**
- In-memory store using JavaScript Map
- Key: chunk text
- Value: { vector, metadata }

**Similarity Search Algorithm**
```javascript
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct; // Vectors already normalized
}

function searchTopK(queryVector, k) {
  const scores = [];
  for (const [text, data] of vectorStore) {
    const score = cosineSimilarity(queryVector, data.vector);
    scores.push({ text, metadata: data.metadata, score });
  }
  return scores.sort((a, b) => b.score - a.score).slice(0, k);
}
```

**Memory Footprint**
- Vocabulary: ~1000-5000 unique terms
- Chunks: Varies by document count (typically 10-100 chunks)
- Memory per chunk: ~1-5 KB (vector + metadata)

### Document Processing Pipeline

**Text Splitter Logic**
1. Attempt split on "\n\n" (paragraphs)
2. If chunk too large, split on "\n" (lines)
3. If still too large, split on ". " (sentences)
4. If still too large, split on character count
5. Preserve overlap by including last N characters of previous chunk

**Overlap Rationale**
- Prevents context loss at split boundaries
- Improves semantic coherence
- Enables better retrieval for queries spanning concepts

### Graph Generation

**Component Extraction**
- Analyzes response text for known component names
- Uses regex patterns: `\b(ECOM|Kenan|ESOM|MongoDB|Message Queue)\b`
- Checks both answer and retrieved context
- Case-insensitive matching

**Graph Construction**
- Nodes: Each detected component
- Edges: Predefined relationships from architecture knowledge
- Layout: Calculated positions using circular or grid algorithm
- Metadata: Status, owner, type, deployment info

---

## Performance Considerations

### Optimization Strategies

**1. Lazy Loading**
- Model and vector store loaded on first query
- Subsequent queries reuse loaded resources
- Reduces memory footprint when idle

**2. Context Window Management**
- Limit retrieved chunks to 5 documents
- Chunk size optimized for balance (500 chars)
- Prevents exceeding 4096 token context limit

**3. Query Type Differentiation**
- Skip RAG pipeline for conversational queries
- Reduces latency by 50-100ms
- Improves user experience for simple interactions

**4. TF-IDF vs. Neural Embeddings**
- TF-IDF chosen for speed and determinism
- No external API calls required
- Vocabulary fits in memory
- Trade-off: Less semantic understanding than transformer-based embeddings

### Scalability Considerations

**Current Limitations**
- In-memory vector store (not persistent)
- Single-threaded LLM inference
- GPU memory constrains model size
- Document count limited by available RAM

**Future Enhancements**
- Persistent vector database (Chroma, Pinecone, Weaviate)
- Batch processing for multiple queries
- Distributed inference for high-throughput scenarios
- Streaming responses for better UX

### Accuracy Tuning

**Embedding Quality**
- Vocabulary size impacts retrieval precision
- Rare technical terms weighted heavily (desirable for architecture)
- Stop word filtering prevents noise

**Chunk Size Selection**
- Smaller chunks: More precise retrieval, may lack context
- Larger chunks: More context, may include irrelevant information
- Current 500 chars: Balanced for technical documentation

**Max Retrieved Chunks**
- More chunks: Better context coverage, higher token usage
- Fewer chunks: Faster, less comprehensive
- Current 5 chunks: ~2000-2500 tokens, leaves room for response

---

## Conclusion

The RAG pipeline transforms the Llama 3.1-8B language model from a general-purpose assistant into a specialized architecture consultant. By grounding responses in retrieved documentation, the system provides factual, traceable answers while maintaining the fluency and coherence of modern LLMs.

Key advantages of this architecture:

1. **Factual Accuracy**: Responses derived from actual documentation
2. **Source Attribution**: Every answer cites its sources
3. **Extensibility**: Easy addition of new data sources
4. **Offline Capability**: No external API dependencies during inference
5. **Customization**: Tunable for specific domain knowledge

This implementation demonstrates production-ready RAG patterns suitable for enterprise knowledge management systems.

---

**Document Version**: 1.0  
**Last Updated**: March 16, 2026  
**Implementation**: CAE (Conversational Architecture Explorer)  
**Model**: Llama 3.1-8B (GGUF F16)  
**Platform**: Node.js + Metal GPU Acceleration
