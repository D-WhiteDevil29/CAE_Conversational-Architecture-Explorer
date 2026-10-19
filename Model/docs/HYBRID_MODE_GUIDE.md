# Hybrid Mode & Web Search Integration

## Overview

CAE now supports **Hybrid Mode** - an intelligent fallback system that provides accurate answers while preventing hallucinations.

## How It Works

### Response Priority (Hybrid Mode):
```
User Question
    ↓
1. Search Ingested Context (Jira, Confluence, Bamboo)
    ↓ If insufficient (< 2 docs)
2. Search Web (Real-time internet data)
    ↓ If no web results
3. Use Training Knowledge (Fallback)
    ↓
✅ Response with NO hallucinations
```

### Context-Only Mode:
```
User Question
    ↓
1. Search Ingested Context ONLY
    ↓
If found: ✅ Answer
If not found: ❌ "I don't have this information"
```

## Anti-Hallucination Safeguards

### 1. Clear Prompt Instructions
The model is instructed to:
- **NEVER invent** Singtel-specific details (service names, APIs, team names)
- **Always state** when using web search or general knowledge
- **Admit uncertainty** instead of guessing
- **Distinguish** between internal docs and external sources

### 2. Source Tagging
- **Internal sources**: Blue badges (Jira, Confluence, Bamboo)
- **Web sources**: Green badges with 🌐 icon
- **Clear indicator**: "✨ Enhanced with Web Search" when web data is used

### 3. Context Priority
- Internal context is **always checked first**
- Web search only activates when:
  - Less than 2 relevant internal docs found
  - Query contains indicators like "latest", "current", "2024+"
  - General knowledge questions detected

## Setup

### 1. Get a Web Search API Key (Choose one)

#### Brave Search (Recommended)
- **Free Tier**: 2,000 queries/month
- **Best For**: LLM-optimized results, fast
- **Get Key**: https://brave.com/search/api/
```bash
BRAVE_API_KEY=your_brave_api_key_here
```

#### Serper API (Google Results)
- **Free Tier**: 2,500 queries
- **Best For**: Comprehensive Google results
- **Get Key**: https://serper.dev/
```bash
SERPER_API_KEY=your_serper_api_key_here
```

#### Tavily AI (LLM-Focused)
- **Free Tier**: 1,000 queries/month
- **Best For**: LLM-optimized, includes answers
- **Get Key**: https://tavily.com/
```bash
TAVILY_API_KEY=your_tavily_api_key_here
```

### 2. Configure Environment

In `Model/.env`:
```bash
# Enable Hybrid Mode (default: true)
HYBRID_MODE=true

# Add at least one API key
BRAVE_API_KEY=your_key_here
# OR
SERPER_API_KEY=your_key_here
# OR
TAVILY_API_KEY=your_key_here
```

### 3. Toggle Modes in Admin UI

Go to **Admin Dashboard → System Health** tab:

**Mock Mode Toggle:**
- Switch between mock responses and real AI model

**Response Mode Toggle:**
- **Context-Only**: Strict accuracy, only uses ingested docs
- **Hybrid Mode**: Broader answers with web search fallback

## Usage Examples

### Example 1: Singtel-Specific (Uses Internal Context)
```
User: "How does ECOM billing work?"
Model: 
  ✅ Uses Confluence/Jira docs
  📘 Sources: "Confluence - ECOM Architecture"
  🚫 No web search needed
```

### Example 2: General Tech Question (Uses Web Search)
```
User: "What is the latest Node.js LTS version?"
Model:
  ⚠️ No internal docs found
  🌐 Searches web via Brave API
  ✅ Returns: "Node.js 22.x (LTS) - March 2026"
  📘 Sources: 🌐 nodejs.org
```

### Example 3: Context-Only Mode
```
User: "What is REST API?"
Context-Only Mode:
  ❌ "I don't have this information in our Singtel documentation"
  
Hybrid Mode:
  ✅ Uses training knowledge
  📘 "Based on general knowledge: REST is..."
```

## Benefits

### ✅ Prevents Hallucinations
- Never invents Singtel-specific details
- Clear source attribution
- Honest about knowledge gaps

### ✅ Broader Knowledge
- Can answer general tech questions
- Access to current information (via web search)
- Falls back gracefully

### ✅ User Control
- Toggle between strict and hybrid modes
- Visual indicators show data source
- Admin can disable web search entirely

## Monitoring

### In Admin Dashboard:
1. **System Health** tab shows if web search is configured
2. **Model Mode** indicator shows current settings
3. **Response Mode** shows Context-Only vs Hybrid

### In Chat:
- Blue badges = Internal sources (your docs)
- Green badges with 🌐 = Web sources
- "✨ Enhanced with Web Search" when external data is used

## Cost Considerations

**Free Tier Limits:**
- Brave: 2,000 queries/month (~66/day)
- Serper: 2,500 queries total
- Tavily: 1,000 queries/month (~33/day)

**Smart Usage:**
- Web search only triggers when context is insufficient
- Most queries use internal context (no API cost)
- Average: ~10-20% of queries use web search

## Troubleshooting

### Web Search Not Working?
1. Check API key is set in `.env`
2. Verify key is valid (test at provider's website)
3. Check console logs for web search activation
4. Ensure `HYBRID_MODE=true` in `.env`

### Still Getting Hallucinations?
1. Enable **Context-Only Mode** for Singtel questions
2. Check if question is about internal systems
3. Review prompt engineering in RAGPipeline-ollama.js
4. Add more specific documents to context

### Too Many API Calls?
1. Increase internal document quality
2. Adjust `needsWebSearch()` logic in WebSearchService
3. Use Context-Only mode for internal questions
4. Cache web search results (future enhancement)

## Architecture

```
┌─────────────────┐
│  User Question  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  RAGPipeline (Hybrid Mode)  │
├─────────────────────────────┤
│  1. Vector Search           │
│     ↓ Query embedding       │
│     ↓ Similarity search     │
│     ↓ Top 5 docs            │
├─────────────────────────────┤
│  2. Context Check           │
│     ↓ < 2 docs?             │
│     ↓ Needs current info?   │
├─────────────────────────────┤
│  3. WebSearchService        │
│     ↓ Brave/Serper/Tavily   │
│     ↓ Top 3 results         │
├─────────────────────────────┤
│  4. LLaMA Generation        │
│     ↓ Internal Context      │
│     ↓ + Web Results         │
│     ↓ Anti-hallucination    │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Response with      │
│  Source Attribution │
└─────────────────────┘
```

## Security Notes

- API keys stored in `.env` (not committed to Git)
- Web search only for public information
- No sensitive Singtel data sent to external APIs
- Internal context always has priority
- Context-Only mode for maximum security

## Future Enhancements

- [ ] Web search result caching
- [ ] Custom confidence thresholds
- [ ] Multiple search provider ranking
- [ ] Search result quality scoring
- [ ] Admin analytics for web search usage
