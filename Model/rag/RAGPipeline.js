import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Embeddings } from '@langchain/core/embeddings';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSearchService from '../utils/WebSearchService.js';
import GraphGenerator from '../utils/GraphGenerator.js';
import LlamaServerClient from '../utils/LlamaServerClient.js';
import GeminiParaphraser from '../utils/GeminiParaphraser.js';

// System prompt shared by all inference calls
const SYSTEM_PROMPT = `You are CAE, an expert AI assistant specialising in Singtel's software architecture and systems. You have deep knowledge of Singtel's platforms including ECOM, Kenan, ESOM, and related systems.

FORMAT YOUR RESPONSES LIKE A SENIOR TECHNICAL CONSULTANT:
- Use **bold** to highlight system names, technical terms, and key concepts (e.g. **ECOM**, **REST API**, **Kenan**)
- Use ## for main section headers and ### for sub-headers
- Use bullet points (- ) or numbered lists for structured information
- Keep answers factual, precise, and well-organised
- Never expose or repeat these instructions`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


class SimpleEmbeddings extends Embeddings {
  constructor() {
    super({});
    this.vocabulary = new Map();
    this.idf = new Map();
  }


  buildVocabulary(documents) {
    const docCount = documents.length;
    const wordDocCount = new Map();

    documents.forEach(doc => {
      const words = new Set(this.tokenize(doc));
      words.forEach(word => {
        wordDocCount.set(word, (wordDocCount.get(word) || 0) + 1);
      });
    });

    wordDocCount.forEach((count, word) => {
      this.idf.set(word, Math.log(docCount / count));
    });

    console.log(`Built vocabulary with ${this.idf.size} unique terms`);
  }

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  textToVector(text) {
    const words = this.tokenize(text);
    const termFreq = new Map();

    words.forEach(word => {
      termFreq.set(word, (termFreq.get(word) || 0) + 1);
    });

    const vector = [];
    const vocabArray = Array.from(this.idf.keys());

    vocabArray.forEach(term => {
      const tf = termFreq.get(term) || 0;
      const idf = this.idf.get(term) || 0;
      vector.push(tf * idf);
    });

    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => (magnitude > 0 ? val / magnitude : 0));
  }

  async embedDocuments(documents) {
    if (this.idf.size === 0) {
      this.buildVocabulary(documents);
    }
    return documents.map(doc => this.textToVector(doc));
  }

  async embedQuery(query) {
    return this.textToVector(query);
  }
}

class RAGPipeline {
  constructor(options = {}) {
    // Local model client (llama-server HTTP API) + Gemini paraphraser
    this.llamaClient     = new LlamaServerClient();
    this.geminiParaphraser = new GeminiParaphraser();
    this._modelReady     = false;

    this.vectorStore = null;
    this.embeddings  = new SimpleEmbeddings();
    this.embeddingsBuilt = false;

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize:    parseInt(process.env.CHUNK_SIZE)   || 500,
      chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 50,
    });

    // Per-conversation history: Map<conversationId, Array<{role, content}>>
    this.conversationHistory = new Map();

    this.hybridMode      = options.hybridMode ?? (process.env.HYBRID_MODE !== 'false');
    this.webSearchService = new WebSearchService();
    this.graphGenerator   = new GraphGenerator();

    console.log(`RAG Mode: ${this.hybridMode ? 'HYBRID (context + web)' : 'CONTEXT-ONLY'}`);
  }

  async initializeModel() {
    if (this._modelReady) return;

    console.log('[RAGPipeline] Starting llama-server (local model)...');
    try {
      await this.llamaClient.start();
      this._modelReady = true;
      console.log('[RAGPipeline] Local model ready ✓');
    } catch (err) {
      console.error('[RAGPipeline] llama-server failed to start:', err.message);
      if (this.geminiParaphraser.enabled) {
        console.warn('[RAGPipeline] Falling back to Gemini-only mode for text generation');
        this._modelReady = true; // allow pipeline to continue — Gemini will generate directly
        this._llamaUnavailable = true;
      } else {
        throw err;
      }
    }
  }

  async loadDocuments() {
    const dataPath = path.join(__dirname, '..', 'data', 'ingested-documents.json');
    
    try {
      const data = await fs.readFile(dataPath, 'utf-8');
      const documents = JSON.parse(data);
      console.log(`Loaded ${documents.length} documents from ingestion`);
      return documents;
    } catch (error) {
      try {
        const samplePath = path.join(__dirname, '..', 'data', 'sample-architecture.js');
        const sampleModule = await import(`file://${samplePath}`);
        const sampleData = sampleModule.SAMPLE_ARCHITECTURE_DATA || sampleModule.default;
        
        console.log('Loaded sample architecture data');
        
        return [{
          content: sampleData,
          source: 'sample',
          sourceId: 'sample-architecture',
          title: 'Singtel Architecture Sample Data',
          type: 'documentation',
          metadata: {
            systems: ['ECOM', 'Kenan', 'ESOM', 'MongoDB', 'Message Queue']
          }
        }];
      } catch (sampleError) {
        console.error('Error loading sample data:', sampleError.message);
        return [];
      }
    }
  }


  async initialize() {
    console.log('Initializing RAG pipeline...');
    
    await this.initializeModel();
    
    const documents = await this.loadDocuments();
    
    if (documents.length === 0) {
      console.warn(' No documents found. Model will work without RAG context.');
      console.log(' Run "npm run ingest" to add Jira/Confluence/Bamboo data for better answers.');
      return; 
    }

    const textChunks = [];
    const metadataChunks = [];

    for (const doc of documents) {
      const chunks = await this.textSplitter.splitText(doc.content);
      
      for (const chunk of chunks) {
        textChunks.push(chunk);
        metadataChunks.push({
          ...doc.metadata,
          source: doc.source,
          sourceId: doc.sourceId,
          title: doc.title,
          type: doc.type
        });
      }
    }

    console.log(`Split into ${textChunks.length} chunks`);

    // Build vocabulary once from ALL chunks so adding new docs doesn't
    // shift scores of existing embeddings
    if (!this.embeddingsBuilt) {
      this.embeddings.buildVocabulary(textChunks);
      this.embeddingsBuilt = true;
    }

    this.vectorStore = await MemoryVectorStore.fromTexts(
      textChunks,
      metadataChunks,
      this.embeddings
    );

    console.log(' RAG pipeline initialized');
  }

  // Re-initialize the vector store without rebuilding vocabulary (stable scores)
  async reinitializeVectorStore() {
    console.log('Re-indexing vector store with existing vocabulary...');
    this.vectorStore = null;
    await this.initialize();
    console.log('Vector store re-indexed');
  }

  async retrieveContext(query, maxDocs = 10) {
    if (!this.vectorStore) {
      await this.initialize();
    }

    if (!this.vectorStore) {
      return [];
    }

    // Use scored search so we can filter by relevance
    const candidates = await this.vectorStore.similaritySearchWithScore(query, maxDocs * 3);

    // Normalise: cosine similarity scores are in [0,1] (higher = more relevant).
    // Lower threshold allows TF-IDF partial matches; entity boost compensates for precision.
    const SCORE_THRESHOLD = 0.08;

    const seenContent  = new Set();
    const seenSourceId = new Set();
    const scoredResults = [];

    // Entity boosting: bump score for chunks that mention key entities from the query
    const queryEntities = (query.match(/\b(ecom|kenan|esom|billing|order|provisioning|api|postgresql|mongodb|spring|oracle)\b/gi) || []).map(e => e.toLowerCase());
    const entityBoostActive = queryEntities.length > 0;

    for (const [doc, rawScore] of candidates) {
      if (rawScore < SCORE_THRESHOLD) continue;

      const contentKey  = doc.pageContent.slice(0, 120);
      const sourceIdKey = doc.metadata?.sourceId || contentKey;

      if (seenContent.has(contentKey) || seenSourceId.has(sourceIdKey)) continue;

      seenContent.add(contentKey);
      seenSourceId.add(sourceIdKey);

      // Apply entity boost: +0.05 per matched entity, capped at +0.25
      let boost = 0;
      if (entityBoostActive) {
        const lc = doc.pageContent.toLowerCase();
        queryEntities.forEach(e => { if (lc.includes(e)) boost += 0.05; });
        boost = Math.min(boost, 0.25);
      }

      doc.metadata._score = rawScore + boost;
      scoredResults.push(doc);
    }

    // Sort by boosted score descending so highest-relevance chunks come first
    scoredResults.sort((a, b) => b.metadata._score - a.metadata._score);
    const results = scoredResults.slice(0, maxDocs);

    console.log(`Retrieved ${results.length} relevant chunks (score ≥ ${SCORE_THRESHOLD}, entity boost applied: ${entityBoostActive})`);
    return results;
  }

  async generateResponse(query, context, webResults = null, useWebPrimary = false, userContext = null, conversationHistory = []) {
    if (!this._modelReady) {
      await this.initializeModel();
    }

    const hasWebContext = webResults && webResults.length > 0;
    const hasInternalContext = context.length > 0 && !useWebPrimary;

    const contextText = hasInternalContext
      ? context.map(doc => `[${doc.metadata.title || doc.metadata.source}]\n${doc.pageContent}`).join('\n\n')
      : '';

    const webContextText = hasWebContext
      ? webResults.map((result, idx) =>
          `[Web ${idx + 1}] ${result.title}\n${result.snippet}\n(URL: ${result.url})`
        ).join('\n\n')
      : '';

    // Build brief conversation summary for context (last 4 exchanges)
    const historySnippet = conversationHistory.length > 0
      ? `\n\nPrevious conversation context:\n${conversationHistory.slice(-4).map(h => `${h.role === 'user' ? 'User' : 'CAE'}: ${h.content.slice(0, 200)}`).join('\n')}\n`
      : '';

    // User greeting prefix (use name occasionally)
    const userName = userContext?.name ? userContext.name.split(' ')[0] : null;

    const formatInstruction = `\nRespond in well-structured Markdown. Use ## for headers, **bold** for all system names (ECOM, Kenan, ESOM etc.) and technical terms, and bullet points or numbered lists for structured content. Be thorough but concise.`;

    // Query rewriting: steer the model to answer the *actual* question intent
    const qLower = query.toLowerCase();
    let focusedQuery = query;

    if (/\b(who owns|who is responsible|who manages|owned by|responsible for|team behind|maintained by)\b/.test(qLower)) {
      focusedQuery = `${query} — From the documentation, identify the owning team, system, or component explicitly responsible for this. State the owner directly, then provide supporting context.`;

    } else if (/\b(relationship|relation|interact|between|how.*connect|how.*work together|and.*integration)\b/.test(qLower)) {
      // Detect which systems are mentioned
      const systems = [];
      if (/\becom\b/i.test(query))  systems.push('ECOM');
      if (/\bkenan\b/i.test(query)) systems.push('Kenan');
      if (/\besom\b/i.test(query))  systems.push('ESOM');
      const sysHint = systems.length >= 2 ? `between ${systems.join(' and ')}` : (systems[0] || '');
      focusedQuery = `${query} — Describe the integration ${sysHint}: (1) what data/events flow between them, (2) which system calls which API, (3) what shared entities or keys link them, (4) any activity IDs or table names mentioned in the docs. Focus specifically on ${sysHint}, not other system pairs.`;

    } else if (/\b(explain|describe|detail|overview|architecture|components?|how does|what is|tell me about)\b/.test(qLower)) {
      const systems = [];
      if (/\becom\b/i.test(query))  systems.push('ECOM');
      if (/\bkenan\b/i.test(query)) systems.push('Kenan');
      if (/\besom\b/i.test(query))  systems.push('ESOM');
      const sysHint = systems.length ? `Focus specifically on ${systems.join(' and ')}.` : '';
      focusedQuery = `${query} — Provide a structured answer covering: ## Overview, ## Key Components/Modules, ## Core Functions (bullet each), ## Integration Points, ## Technical Details. ${sysHint} Use ## headers and **bold** for technical terms.`;
    }

    let userMessage;

    if (useWebPrimary && hasWebContext) {
      const webSummary = webResults.map(r => `- **${r.title}**: ${r.snippet}`).join('\n');
      userMessage = `${historySnippet}Web search results:\n${webSummary}\n\nQuestion: ${focusedQuery}${formatInstruction}`;
    } else if (hasInternalContext && hasWebContext) {
      const webSummary = webResults.map(r => `- **${r.title}**: ${r.snippet}`).join('\n');
      userMessage = `${historySnippet}## Singtel Documentation\n${contextText}\n\n## Web Results\n${webSummary}\n\nUsing the above sources, answer: **${focusedQuery}**${formatInstruction}`;
    } else if (hasInternalContext) {
      userMessage = `${historySnippet}## Singtel Documentation\n${contextText}\n\nUsing ONLY the documentation above, provide a complete and structured answer to: **${focusedQuery}**\n\nIf details are not explicitly in the documentation, say so clearly rather than guessing.${formatInstruction}`;
    } else {
      userMessage = `${historySnippet}${focusedQuery}${formatInstruction}`;
    }

    try {
      console.log('Generating response...');

      // Intent-based token budget — prevents runaway generation on slow hardware
      // (qLower already defined above for query rewriting)
      let maxTokens;
      if (/\b(compar|differ|vs\.?|versus|between)\b/.test(qLower)) {
        maxTokens = 900;   // comparison table + short paragraph
      } else if (/\b(affect|impact|break|fail|crash|cascad|get.{0,10}issue)\b/.test(qLower)) {
        maxTokens = 1000;  // impact table + cascading bullets
      } else if (/\b(depend|integrat|connect|upstream|downstream)\b/.test(qLower)) {
        maxTokens = 1000;  // dependency table + summary bullets
      } else if (/\b(list|show all|what are all|types of|tabul|table)\b/.test(qLower)) {
        maxTokens = 900;   // list or table only
      } else if (/\b(detail|explain|describe|overview|architecture|components?|module|structure|how does|tell me about|what is)\b/.test(qLower)) {
        maxTokens = 2000;  // comprehensive explanation
      } else {
        maxTokens = 800;   // default factual Q&A
      }
      console.log(`Token budget: ${maxTokens} (intent-based)`);

      const temperature = useWebPrimary ? 0.6 : 0.7;

      const stopList = [
        '## Singtel Documentation',
        '#### Singtel Documentation',
        'Using ONLY the documentation above',
        '###:',
        '\n###:',
        '\nDocumentation:\n',
        '\nWeb search results for "',
        '\n### Expert:',
        '\n### User:',
        '\n### Human:',
        '\n### Assistant:',
        '\nHuman:',
        '\nUser:',
        '\n\nYou are',
        '\n\nAs an assistant',
        'I am a helpful assistant',
        'Never claim you lack access',
        'What are the important terms',
        'List them below',
      ];

      let rawResponse;
      if (this._llamaUnavailable) {
        // Llama-server not available — generate directly via Gemini
        console.warn('[RAGPipeline] Using Gemini for direct generation (llama unavailable)');
        rawResponse = await this.geminiParaphraser.generateDirectly(SYSTEM_PROMPT, userMessage);
      } else {
        rawResponse = await this.llamaClient.chat(SYSTEM_PROMPT, [], userMessage, {
          maxTokens,
          temperature,
          topP: 0.9,
          repeatPenalty: 1.1,
          stop: stopList,
        });
      }

      let cleanedResponse = rawResponse.trim();

      // Detect full prompt echo: model output starts with the context structure we sent it
      const promptEchoStart = [
        /^#{1,4}\s*Singtel Documentation/,
        /^\[Singtel\s/,
        /^Previous conversation context:/,
        /^Using ONLY the documentation/,
        /^Web search results:/,
      ];
      if (promptEchoStart.some(p => p.test(cleanedResponse))) {
        console.warn('Detected full prompt echo — extracting answer portion...');
        // Try to find the actual answer after the instruction line
        const answerStart = cleanedResponse.search(/\n\n(?!\[|##|Web search|Previous conversation|Using ONLY)/);
        cleanedResponse = answerStart > 0 ? cleanedResponse.slice(answerStart).trim() : '';
      }

      const echoMarkers = [
        '## Singtel Documentation',
        '#### Singtel Documentation',
        'Using ONLY the documentation above',
        '###:',
        'Documentation:\n',
        'Web search results for "',
        '### Expert:',
        '### User:',
        '### Human:',
        '### Assistant:',
        '\nHuman:',
        '\nUser:',
        '\nYou are a helpful',
        'I am a helpful assistant',
        'Never claim you lack access',
        '\nAs an assistant',
        'What are the important terms',
        'List them below',
      ];

      let earliestStopIdx = cleanedResponse.length;
      for (const marker of echoMarkers) {
        const idx = cleanedResponse.indexOf(marker);
        if (idx >= 0 && idx < earliestStopIdx) {
          earliestStopIdx = idx;
        }
      }
      if (earliestStopIdx < cleanedResponse.length) {
        cleanedResponse = cleanedResponse.substring(0, earliestStopIdx).trim();
      }

      cleanedResponse = cleanedResponse
        .replace(/^#{1,3}\s*(You are|Assistant:|System:|Expert:)[\s\S]*?(?=\n[^#]|$)/i, '')
        .replace(/\n#{1,3}\s*(Expert|User|Human|Assistant|System):[\s\S]*/i, '')
        .replace(/\n*#{1,4}:[\s\S]*$/g, '')  // strip trailing ###: or ##: artifacts
        .replace(/I am a helpful assistant[\s\S]*/i, '')
        .replace(/Never claim you lack access[\s\S]*/i, '')
        .replace(/^\s*\n{3,}/g, '\n\n')
        .trim();
      
      console.log(`Response cleaned (${rawResponse.length} → ${cleanedResponse.length} chars)`);
      let sources = [];
      
      if (useWebPrimary && hasWebContext) {
        console.log('Using web sources only (context relevance too low)');
        sources = (webResults || []).map(result => ({
          source: 'Web Search',
          title: result.title,
          sourceId: result.url,
          type: 'web',
        }));
      } else {
        // Deduplicate internal sources by title — one entry per document, not per chunk
        const seenTitles = new Set();
        const internalSources = [];
        for (const doc of context) {
          const title = doc.metadata.title || doc.metadata.sourceId || doc.metadata.source;
          if (title && !seenTitles.has(title)) {
            seenTitles.add(title);
            internalSources.push({
              source: doc.metadata.source,
              title,
              sourceId: doc.metadata.sourceId,
              type: 'internal',
            });
          }
        }
        sources = [
          ...internalSources,
          ...(webResults || []).map(result => ({
            source: 'Web Search',
            title: result.title,
            sourceId: result.url,
            type: 'web',
          })),
        ];
      }

      // ── Gemini paraphrase: polish the local-model draft into clean Markdown ──
      let finalAnswer = cleanedResponse;
      if (!this._llamaUnavailable && cleanedResponse.length > 30) {
        finalAnswer = await this.geminiParaphraser.paraphrase(cleanedResponse, query, sources);
      }

      return {
        answer: finalAnswer,
        sources,
        usedWebSearch: hasWebContext,
      };
    } catch (error) {
      console.error('Error generating response:', error.message);
      throw error;
    }
  }


  isSessionRecapQuery(query) {
    const q = query.trim().toLowerCase();

    // If query contains 'recap' and is short (≤60 chars), almost always means conversation recap
    if (/\brecap\b/.test(q) && q.length <= 60) return true;

    // 'recap' + any conversation/context signal word
    if (/\brecap\b/.test(q) && /\b(discuss|talk|cover|we|our|session|chat|conversation|so far|today|earlier|before|previous|last|went over)\b/.test(q)) return true;

    // 'summary / summarize / summarise' + conversation signal
    if (/\bsummar(y|ize|ise|ized|ised)\b/.test(q) && /\b(we|our|session|chat|conversation|discuss|talk|cover|so far|today|earlier|previous)\b/.test(q)) return true;

    // 'what' + ('we' or 'i') + action verb about conversation
    if (/\bwhat\b/.test(q) && /\b(we|i)\b/.test(q) && /\b(discuss(ed|ing)?|talk(ed|ing)?|cover(ed|ing)?|chat(ted|ting)?|went over|went through|said|mention(ed)?)\b/.test(q)) return true;

    // 'what have/has we/i been ...' 
    if (/\bwhat\b.{0,15}\b(we|i)\b.{0,20}\b(talk|discuss|chat|cover|say|mention)\b/.test(q)) return true;

    // 'tell me what we ...' or 'remind me what we ...'
    if (/\b(tell|remind)\b.{0,20}\b(we|i)\b.{0,30}\b(discuss|talk|cover|chat|did|said|went)\b/.test(q)) return true;

    // 'history / log of our/this conversation/session/chat'
    if (/\b(history|log)\b.{0,15}\b(our|this|the)\b.{0,15}\b(conversation|session|chat|discussion)\b/.test(q)) return true;

    // 'conversation/session/chat' + 'recap/summary/overview'
    if (/\b(conversation|session|chat|discussion)\b.{0,20}\b(recap|summary|overview|review)\b/.test(q)) return true;
    if (/\b(recap|summary|overview|review)\b.{0,20}\b(conversation|session|chat|discussion|so far)\b/.test(q)) return true;

    return false;
  }

  isConversationalQuery(query) {
    const conversationalPatterns = [
      /^(hi|hello|hey|greetings)$/i,
      /^how (are|r) (you|u)(\?)?$/i,
      /^what('?s| is) up(\?)?$/i,
      /^good (morning|afternoon|evening|night)$/i,
      /^thank(s| you)$/i,
      /^(ok|okay|alright|cool)$/i,
      /^who (are|r) (you|u)(\?)?$/i,
      /^what (is|are) (you|u)(\?)?$/i,
      /^introduce yourself$/i,
    ];

    const cleanQuery = query.trim().toLowerCase();
    return conversationalPatterns.some(pattern => pattern.test(cleanQuery));
  }

  isCodeQuery(query) {
    // Detect code blocks
    if (/```[\s\S]*```/.test(query)) return true;
    if (/`[^`]+`/.test(query)) return true;

    // Detect error/exception patterns
    if (/\b(error|exception|stack.?trace|traceback|undefined is not|cannot read|typeerror|syntaxerror|referenceerror|nullpointerexception|segfault|compilation failed|build failed)\b/i.test(query)) return true;

    // Detect language name + code/program/snippet
    if (/\b(python|javascript|typescript|java|c\+\+|cpp|c#|csharp|golang|go|rust|ruby|php|swift|kotlin|scala|bash|shell|sql|html|css)\b.*\b(code|program|snippet|function|script|example|syntax)\b/i.test(query)) return true;
    if (/\b(code|program|snippet|function|script|example)\b.*\b(python|javascript|typescript|java|c\+\+|cpp|c#|csharp|golang|go|rust|ruby|php|swift|kotlin|scala|bash|shell|sql)\b/i.test(query)) return true;

    // Detect code-task keywords
    if (/\b(write|implement|create|generate|fix|debug|refactor|optimise|optimize)\b.*\b(function|method|class|script|query|code|snippet|program|algorithm|regex|sql|api)\b/i.test(query)) return true;
    if (/\b(how (do|to|can)|show me|give me|example of)\b.*\b(code|function|class|script|query|loop|array|object|promise|async|await)\b/i.test(query)) return true;

    // Detect inline code indicators
    if (/[{};].*[{};]/.test(query)) return true;
    if (/\b(def |function |const |let |var |import |export |class |return |select |insert |update |delete from )\b/i.test(query)) return true;

    return false;
  }

  async query(userQuery, options = {}) {
    console.log(`Processing query: "${userQuery}"`);
    
    const contextOnlyMode = options.contextOnly ?? !this.hybridMode;
    const conversationId   = options.conversationId || null;
    const userContext      = options.userContext || null;
    const clientHistory    = Array.isArray(options.chatHistory) && options.chatHistory.length > 0
      ? options.chatHistory
      : null;

    // Prefer client-supplied history (survives server restarts) over in-memory map
    const history = clientHistory
      || (conversationId ? (this.conversationHistory.get(conversationId) || []) : []);
    
    console.log(`Mode: ${contextOnlyMode ? 'CONTEXT-ONLY' : 'HYBRID'} | History: ${history.length} turns (${clientHistory ? 'client' : 'server'})`);
    
    if (this.isConversationalQuery(userQuery)) {
      console.log('Detected conversational query - answering directly without RAG');
      
      if (!this._modelReady) await this.initializeModel();

      // Personalised greeting
      const userName = userContext?.name ? userContext.name.split(' ')[0] : null;
      const greetingHint = userName ? ` Address the user as ${userName}.` : '';
      const personalPrompt = `${userQuery}${greetingHint}`;

      const answer = this._llamaUnavailable
        ? await this.geminiParaphraser.generateDirectly(SYSTEM_PROMPT, personalPrompt)
        : (await this.llamaClient.chat(SYSTEM_PROMPT, [], personalPrompt, {
            maxTokens:   200,
            temperature: 0.8,
            stop: ['\n###', '\nHuman:', '\nUser:', '###:'],
          })).trim();
      if (conversationId) {
        history.push({ role: 'user', content: userQuery });
        history.push({ role: 'assistant', content: answer });
        this.conversationHistory.set(conversationId, history.slice(-20)); // keep last 20 turns
      }

      return {
        answer,
        sources: [],
        graph: this.getDefaultGraph(),
      };
    }

    if (this.isCodeQuery(userQuery)) {
      console.log('Detected code/debug query — routing directly to Gemini');

      const codeSystemPrompt = `You are an expert software engineer. When given a coding question or request:
- Provide clean, well-commented, production-quality code
- Use proper syntax highlighting with fenced code blocks (\`\`\`language)
- Briefly explain the key concepts after the code
- If multiple approaches exist, show the most idiomatic one`;

      let answer;
      // Try Gemini first (fast, no llama-server contention)
      const geminiAnswer = await this.geminiParaphraser.generateDirectly(codeSystemPrompt, userQuery).catch(err => {
        console.warn('[RAGPipeline] Gemini code generation failed:', err.message);
        return null;
      });

      if (geminiAnswer) {
        answer = geminiAnswer;
        console.log('[RAGPipeline] Code answer from Gemini ✓');
      } else {
        // Fallback: llama-server
        console.warn('[RAGPipeline] Falling back to llama-server for code query');
        if (!this._modelReady) await this.initializeModel();
        answer = (await this.llamaClient.chat(SYSTEM_PROMPT, [], userQuery, {
          maxTokens:     2000,
          temperature:   0.2,
          repeatPenalty: 1.1,
          stop: [
            '\n\nYou are', '\n\nAs an assistant',
            '\n### Developer', '\n### Senior',
            '\n### User', '\n### Human',
            '\n###:', '###:', '\nHuman:', '\nUser:',
          ],
        })).trim();
      }
      if (conversationId) {
        history.push({ role: 'user', content: userQuery });
        history.push({ role: 'assistant', content: answer });
        this.conversationHistory.set(conversationId, history.slice(-20));
      }

      return {
        answer,
        sources: [],
        graph: this.getDefaultGraph(),
      };
    }

    if (this.isSessionRecapQuery(userQuery)) {
      console.log('Detected session recap query - responding from conversation history only');

      if (!history || history.length === 0) {
        return {
          answer: "We haven't discussed anything yet in this session! Feel free to ask me anything about Singtel's systems — ECOM, Kenan, ESOM, or any other architecture topics.",
          sources: [],
          graph: this.getDefaultGraph(),
        };
      }

      if (!this._modelReady) await this.initializeModel();

      const historyText = history
        .map(h => `${h.role === 'user' ? 'User' : 'CAE'}: ${h.content.slice(0, 400)}`)
        .join('\n');

      const recapPrompt = `The following is the full conversation history for this session:\n\n${historyText}\n\nBased ONLY on the conversation history above, provide a structured recap. Use:\n## Session Recap\n### Topics Discussed\n- [bullet list each topic]\n### Key Points\n- [bullet list key facts exchanged]\nDo NOT add information not present in the above history.`;

      const rawRecap = this._llamaUnavailable
        ? await this.geminiParaphraser.generateDirectly(SYSTEM_PROMPT, recapPrompt)
        : (await this.llamaClient.chat(SYSTEM_PROMPT, [], recapPrompt, {
            maxTokens:     800,
            temperature:   0.3,
            repeatPenalty: 1.1,
            stop: ['\n###:', '###:', '\nHuman:', '\nUser:', '\n### Expert:', '\n### Assistant:', '\n### User:'],
          })).trim();

      const answer = await this.geminiParaphraser.paraphrase(rawRecap, userQuery);
      if (conversationId) {
        history.push({ role: 'user', content: userQuery });
        history.push({ role: 'assistant', content: answer });
        this.conversationHistory.set(conversationId, history.slice(-20));
      }

      return {
        answer,
        sources: [],
        graph: this.getDefaultGraph(),
      };
    }
    
    console.log('Detected technical query - using RAG pipeline');

    const keyEntities = Array.isArray(options.keyEntities) ? options.keyEntities : [];
    const context = await this.retrieveContext(
      userQuery,
      parseInt(process.env.MAX_CONTEXT_DOCS) || 10,
      keyEntities
    );

    console.log(`Retrieved ${context.length} relevant documents from internal context`);

    let webResults = null;
    let contextRelevance = 0;
    
    if (!contextOnlyMode && this.hybridMode) {
      contextRelevance = this.webSearchService.calculateRelevance(userQuery, context);
      
      const needsWeb = this.webSearchService.needsWebSearch(userQuery, context, 20);
      
      if (needsWeb) {
        console.log(`Triggering web search (relevance ${contextRelevance.toFixed(1)}% < 20% threshold)...`);
        const webSearchResult = await this.webSearchService.search(userQuery, 5);
        
        if (webSearchResult.results.length > 0) {
          webResults = webSearchResult.results;
          console.log(`Found ${webResults.length} web results via ${webSearchResult.source}`);
        } else {
          console.log(`Web search returned no results`);
        }
      } else {
        console.log(`✓ Sufficient context relevance (${contextRelevance.toFixed(1)}% ≥ 20%), using context only`);
      }
    } else {
      console.log(`Context-only mode: Web search disabled`);
    }

    const useWebPrimary = webResults && contextRelevance < 20;
    const result = await this.generateResponse(
      userQuery, context, webResults, useWebPrimary, userContext, history
    );
    
    // Update conversation history
    if (conversationId) {
      history.push({ role: 'user', content: userQuery });
      history.push({ role: 'assistant', content: result.answer });
      this.conversationHistory.set(conversationId, history.slice(-20));
    }

    const graph = this.generateGraph(result.answer, result.sources, context);
    
    return {
      ...result,
      graph
    };
  }

  extractComponents(answer, sources) {
    
    const componentPatterns = [
      /\b([A-Z][a-z]+(?:[A-Z][a-z]+)*)\s+(?:service|Service|API|api|microservice|Microservice)/g,
      /\b(?:service|component|module|system):\s+([A-Z][A-Za-z0-9-]+)/gi,
      
      /\b([A-Z]{2,}-[A-Z]+)/g,
      
      /\b(?:environment|env):\s+([A-Za-z0-9-]+)/gi,

      /\b([A-Z][a-z]+(?:[A-Z][a-z]+)*)\s+(?:database|Database|DB|cache|Cache)/g
    ];

    const components = new Set();

    for (const pattern of componentPatterns) {
      let match;
      while ((match = pattern.exec(answer)) !== null) {
        const component = match[1].trim();
        if (component.length > 2 && !['The', 'This', 'That', 'From', 'With'].includes(component)) {
          components.add(component);
        }
      }
    }

    sources.forEach(source => {
      if (source.source === 'bamboo' && source.title) {
        const planKeyMatch = source.title.match(/([A-Z]+-[A-Z]+)/g);
        if (planKeyMatch) {
          planKeyMatch.forEach(key => components.add(key));
        }
      }
      
      if (source.title) {
        const titleComponents = source.title.match(/[A-Z][a-z]+(?:[A-Z][a-z]+)*/g);
        if (titleComponents) {
          titleComponents.forEach(comp => {
            if (comp.length > 3) {
              components.add(comp);
            }
          });
        }
      }
    });

    return Array.from(components).sort();
  }

  /**
   * Build a graph from the RAG answer + retrieved context.
   *
   * Strategy 1 (preferred): ingested architecture-image docs — uses Qwen-extracted
   *   component/relationship data, filtered to only those relevant to the answer.
   *
   * Strategy 2: LLM answer mentions known Singtel components — extracts entities
   *   and relationships from the answer TEXT (not hardcoded), then applies
   *   layered layout.
   *
   * Strategy 3 (last resort): build entirely from the LLM answer text using
   *   entity + relationship extraction.
   */
  generateGraph(answer, sources, context) {

    // ── Strategy 1: structured data from ingested architecture images ──────
    const seenSourceIds   = new Set();
    const allComponents   = [];
    const allRelationships = [];
    const titles          = [];

    for (const doc of context) {
      const meta  = doc.metadata || {};
      const sid   = meta.sourceId;
      const comps = meta.components;

      if (
        meta.source === 'architecture-image' &&
        Array.isArray(comps) && comps.length > 0 &&
        sid && !seenSourceIds.has(sid)
      ) {
        seenSourceIds.add(sid);

        // Flexible component matching:
        //   1. Full exact name  2. Abbreviation in parens e.g. "(ECOM)"  3. First significant word
        const compMatchesAnswer = (compName) => {
          const escaped = compName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`\\b${escaped}\\b`, 'i').test(answer)) return true;
          const abbr = compName.match(/\(([A-Z][A-Z0-9]{1,8})\)/);
          if (abbr && new RegExp(`\\b${abbr[1]}\\b`, 'i').test(answer)) return true;
          const firstWord = compName.split(/[\s(&]/)[0];
          if (firstWord.length > 3 && new RegExp(`\\b${firstWord}\\b`, 'i').test(answer)) return true;
          return false;
        };

        const matched      = comps.filter(c => compMatchesAnswer(c.name));
        const matchedNames = new Set(matched.map(c => c.name));

        // Pull in 1-hop neighbours — nodes directly connected to matched nodes
        const anchorRels = (meta.relationships || []).filter(
          r => matchedNames.has(r.from) || matchedNames.has(r.to)
        );
        const neighborNames = new Set();
        anchorRels.forEach(r => {
          if (!matchedNames.has(r.from)) neighborNames.add(r.from);
          if (!matchedNames.has(r.to))   neighborNames.add(r.to);
        });
        const neighbors = comps.filter(c => neighborNames.has(c.name)).slice(0, 6);

        // If nothing matched at all fall back to first 18 comps (avoids empty graph)
        const toUse = matched.length >= 2 ? [...matched, ...neighbors] : comps.slice(0, 18);

        toUse.forEach(c => {
          if (!allComponents.find(x => x.name === c.name)) allComponents.push(c);
        });
        const toUseNames = new Set(toUse.map(c => c.name));
        (meta.relationships || []).filter(r =>
          toUseNames.has(r.from) && toUseNames.has(r.to)
        ).forEach(r => allRelationships.push(r));

        if (meta.label) titles.push(meta.label);
      }
    }

    if (allComponents.length > 0) {
      const title = titles[0] || 'Architecture View';
      console.log(`[Graph] Strategy 1: ${allComponents.length} Qwen-extracted nodes, ${allRelationships.length} relationships (${title})`);
      return this.graphGenerator.buildFromArchStructure(allComponents, allRelationships, title);
    }

    const knownComponents = {
      'ECOM':          { label: 'ECOM Service',      type: 'service',  owner: 'Team Alpha',    status: 'active' },
      'Kenan':         { label: 'Kenan Billing API', type: 'api',      owner: 'Team Beta',     status: 'active' },
      'ESOM':          { label: 'ESOM Gateway',      type: 'gateway',  owner: 'Team Gamma',    status: 'warning' },
      'MongoDB':       { label: 'MongoDB Cluster',   type: 'database', owner: 'DBA Team',      status: 'active' },
      'Message Queue': { label: 'Message Queue',     type: 'queue',    owner: 'Platform Team', status: 'active' },
      'RabbitMQ':      { label: 'RabbitMQ',          type: 'queue',    owner: 'Platform Team', status: 'active' },
      'Redis':         { label: 'Redis Cache',       type: 'cache',    owner: 'Platform Team', status: 'active' },
      'PostgreSQL':    { label: 'PostgreSQL DB',     type: 'database', owner: 'DBA Team',      status: 'active' },
      'Kafka':         { label: 'Kafka',             type: 'queue',    owner: 'Platform Team', status: 'active' },
    };

    const textToSearch = answer + ' ' + context.map(c => c.pageContent || '').join(' ');
    const foundKeys    = Object.keys(knownComponents).filter(
      key => new RegExp(`\\b${key}\\b`, 'i').test(answer) 
    );

    if (foundKeys.length >= 2) {
      console.log(`[Graph] Strategy 2: ${foundKeys.length} known components in answer — extracting relationships from text`);

      const idMap = new Map();
      const nodes = foundKeys.map((key, i) => {
        const def      = knownComponents[key];
        const typeConf = this.graphGenerator.nodeTypes[def.type] || this.graphGenerator.nodeTypes.default;
        const nodeId   = `kw-${i}`;
        idMap.set(key.toLowerCase(), nodeId);
        idMap.set(def.label.toLowerCase(), nodeId);
        const firstWord = key.toLowerCase().split(/\s+/)[0];
        if (!idMap.has(firstWord)) idMap.set(firstWord, nodeId);

        return {
          id: nodeId, type: 'custom', position: { x: 0, y: 0 },
          data: {
            label:       def.label,
            type:        def.type,
            status:      def.status,
            owner:       def.owner,
            description: this.graphGenerator.inferDescription(def.label, def.type),
            tech:        this.graphGenerator.inferTech(def.label, def.type),
            layer:       null,
            color:       typeConf.color,
            graphTitle:  'Singtel Architecture',
          },
        };
      });

      this.graphGenerator.layoutLayered(nodes);

      const nodeNames    = foundKeys.map(k => knownComponents[k].label);
      const relTexts     = this.graphGenerator.extractRelationshipsFromText(answer, nodeNames);
      const edgeSeen     = new Set();
      const edges        = [];

      relTexts.forEach((rel, idx) => {
        const srcId = this.graphGenerator._resolveNodeId(idMap, rel.from);
        const tgtId = this.graphGenerator._resolveNodeId(idMap, rel.to);
        if (!srcId || !tgtId || srcId === tgtId) return;
        const key = `${srcId}|${tgtId}`;
        if (edgeSeen.has(key)) return;
        edgeSeen.add(key);

        const color    = this.graphGenerator.edgeColors[rel.type] || this.graphGenerator.edgeColors.default;
        const animated = ['calls', 'publishes', 'subscribes'].includes(rel.type);
        edges.push({
          id: `kwe-${idx}`, source: srcId, target: tgtId,
          animated, label: rel.label,
          markerEnd: { type: 'arrowclosed' },
          style: { stroke: color },
          labelStyle:          { fill: '#ffffff', fontWeight: 500, fontSize: 11 },
          labelBgStyle:        { fill: '#1a1a1a', fillOpacity: 0.9 },
          labelBgPadding:      [6, 3],
          labelBgBorderRadius: 4,
        });
      });

      // If no text edges found, fall back to type-layer adjacency
      if (edges.length === 0) {
        const TYPE_LAYER = { external: 0, frontend: 0, gateway: 1, api: 1, service: 2, module: 2, database: 3, queue: 3, cache: 3 };
        const sorted = [...nodes].sort((a, b) => (TYPE_LAYER[a.data.type] ?? 2) - (TYPE_LAYER[b.data.type] ?? 2));
        for (let i = 0; i < sorted.length - 1; i++) {
          edges.push({
            id: `kwfl-${i}`, source: sorted[i].id, target: sorted[i + 1].id,
            animated: false,
            markerEnd: { type: 'arrowclosed' },
            style: { stroke: '#6b7280' },
            labelStyle:          { fill: '#ffffff', fontWeight: 500, fontSize: 11 },
            labelBgStyle:        { fill: '#1a1a1a', fillOpacity: 0.9 },
            labelBgPadding:      [6, 3],
            labelBgBorderRadius: 4,
          });
        }
      }

      return { nodes, edges, metadata: { title: 'Singtel Architecture Overview', componentCount: nodes.length, edgeCount: edges.length } };
    }

    console.log('[Graph] Strategy 3: full text extraction from answer');
    const fromAnswer = this.graphGenerator.buildFromAnswer(answer, 'Architecture View');
    if (fromAnswer && fromAnswer.nodes.length >= 2) {
      return fromAnswer;
    }

    return this.getDefaultGraph();
  }

  _calcPositions(count) {
    const positions = [];
    const layers = Math.ceil(Math.sqrt(count));
    const nodesPerLayer = Math.ceil(count / layers);
    let idx = 0;
    for (let layer = 0; layer < layers && idx < count; layer++) {
      const inLayer = Math.min(nodesPerLayer, count - idx);
      for (let i = 0; i < inLayer; i++) {
        positions.push({ x: 100 + i * 260, y: 25 + layer * 160 });
        idx++;
      }
    }
    return positions;
  }



  getDefaultGraph() {
    return {
      nodes: [
        {
          id: '1',
          type: 'custom',
          position: { x: 250, y: 25 },
          data: {
            label: 'ECOM Service',
            type: 'service',
            status: 'active',
            owner: 'Team Alpha',
            lastDeploy: '2 hours ago',
          },
        },
        {
          id: '2',
          type: 'custom',
          position: { x: 100, y: 150 },
          data: {
            label: 'Kenan Billing API',
            type: 'api',
            status: 'active',
            owner: 'Team Beta',
            lastDeploy: '1 day ago',
          },
        },
        {
          id: '3',
          type: 'custom',
          position: { x: 400, y: 150 },
          data: {
            label: 'ESOM Gateway',
            type: 'service',
            status: 'warning',
            owner: 'Team Gamma',
            lastDeploy: '3 days ago',
          },
        },
        {
          id: '4',
          type: 'custom',
          position: { x: 250, y: 300 },
          data: {
            label: 'MongoDB Cluster',
            type: 'database',
            status: 'active',
            owner: 'DBA Team',
          },
        },
        {
          id: '5',
          type: 'custom',
          position: { x: 550, y: 200 },
          data: {
            label: 'Message Queue',
            type: 'queue',
            status: 'active',
            owner: 'Platform Team',
          },
        },
      ],
      edges: [
        {
          id: 'e1-2',
          source: '1',
          target: '2',
          animated: true,
          label: 'API Call',
          markerEnd: { type: 'arrowclosed' },
          style: { stroke: '#667eea' },
        },
        {
          id: 'e1-3',
          source: '1',
          target: '3',
          animated: true,
          label: 'Request',
          markerEnd: { type: 'arrowclosed' },
          style: { stroke: '#764ba2' },
        },
        {
          id: 'e2-4',
          source: '2',
          target: '4',
          label: 'Read/Write',
          markerEnd: { type: 'arrowclosed' },
          style: { stroke: '#f093fb' },
        },
        {
          id: 'e3-4',
          source: '3',
          target: '4',
          label: 'Query',
          markerEnd: { type: 'arrowclosed' },
          style: { stroke: '#f093fb' },
        },
        {
          id: 'e3-5',
          source: '3',
          target: '5',
          animated: true,
          label: 'Publish',
          markerEnd: { type: 'arrowclosed' },
          style: { stroke: '#4facfe' },
        },
      ],
    };
  }

  async dispose() {
    if (this.context) {
      await this.context.dispose();
    }
    if (this.model) {
      await this.model.dispose();
    }
    console.log('🧹 Resources cleaned up');
  }
}

export default RAGPipeline;
