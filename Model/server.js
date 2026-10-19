import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import RAGPipeline from './rag/RAGPipeline.js';
import GraphGenerator from './utils/GraphGenerator.js';
import FileConverter from './utils/FileConverter.js';
import QwenVisionClient from './utils/QwenVisionClient.js';
import SQLGenerator from './utils/SQLGenerator.js';
import FormatValidator from './utils/FormatValidator.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const ragPipeline = new RAGPipeline();
const graphGenerator = new GraphGenerator();
const fileConverter = new FileConverter();
const qwenVision = new QwenVisionClient();
const sqlGenerator = new SQLGenerator();
const formatValidator = new FormatValidator();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

let ingestionStatus = {
  isRunning: false,
  completed: false,
  error: null,
  stats: null,
  currentStage: '',
  progress: { processed: 0, total: 0 },
};

let isInitialized = false;
const initializeRAG = async () => {
  if (!isInitialized) {
    try {
      console.log('Initializing RAG pipeline...');
      await ragPipeline.initialize();
      isInitialized = true;
      console.log(' RAG pipeline ready');
    } catch (error) {
      console.error('RAG initialization failed:', error.message);
      console.log(' Make sure to run "npm run ingest" first and that Ollama is running');
    }
  }
};

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for large documents
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'CAE Backend',
    ragInitialized: isInitialized
  });
});


app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationId, wantPointwise = false, contextOnly = false, userContext = null, chatHistory = [] } = req.body;
    console.log(`chatHistory received: ${chatHistory.length} turns`);
    if (chatHistory.length) console.log('  last entry:', chatHistory[chatHistory.length - 1]?.role, '-', chatHistory[chatHistory.length - 1]?.content?.slice(0, 60));
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const entities = extractEntities(message);
    console.log('Extracted entities from query:', entities);
    entities.forEach(entity => {
      if (entityTracker.has(entity)) {
        const tracker = entityTracker.get(entity);
        tracker.count++;
        tracker.lastSearched = new Date().toISOString();
        console.log(`Updated entity "${entity}" - count: ${tracker.count}`);
      } else {
        entityTracker.set(entity, {
          count: 1,
          lastSearched: new Date().toISOString(),
        });
        console.log(`New entity tracked: "${entity}"`);
        
        // Limit tracking size
        if (entityTracker.size > MAX_ENTITY_TRACKING) {
          const firstKey = entityTracker.keys().next().value;
          entityTracker.delete(firstKey);
          console.log(`Removed oldest entity: "${firstKey}"`);
        }
      }
    });
    console.log(`Total entities tracked: ${entityTracker.size}`);

    await initializeRAG();

    if (!isInitialized) {
      console.log('Attempting direct query without RAG...');
      try {
        const result = await ragPipeline.query(message);
        return res.json({
          conversationId: conversationId || uuidv4(),
          message: result.answer,
          sources: result.sources || [],
          components: [],
          graph: result.graph || null,
          timestamp: new Date().toISOString(),
          warning: 'Running without RAG context. Run "npm run ingest" for better answers.'
        });
      } catch (error) {
        return res.status(503).json({ 
          error: 'Model not available. Please check logs.',
          details: error.message
        });
      }
    }

    const result = await ragPipeline.query(message, { contextOnly, conversationId, userContext, chatHistory, keyEntities: entities });

    const components = ragPipeline.extractComponents(result.answer, result.sources);

    let finalAnswer = result.answer;
    if (wantPointwise) {
      finalAnswer = formatAsPointwise(result.answer);
    }

    const response = {
      conversationId: conversationId || uuidv4(),
      message: finalAnswer,
      sources: result.sources,
      components: components,
      graph: result.graph || null,
      timestamp: new Date().toISOString(),
      pointwise: wantPointwise,
      usedWebSearch: result.usedWebSearch || false,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ 
      error: 'Error processing your request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/api/graph', async (req, res) => {
  try {
    const { query, components, answer, sources } = req.body;
    
    let graph;
    
    if (components && components.length > 0) {
      graph = graphGenerator.generateGraph(components, answer || '', sources || []);
    } else if (sources && sources.length > 0) {
      graph = graphGenerator.generateGraphFromSources(sources);
    } else {
      return res.status(400).json({ error: 'Either components or sources are required' });
    }

    res.json(graph);

  } catch (error) {
    console.error('Graph error:', error);
    res.status(500).json({ 
      error: 'Error generating graph',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/api/upload-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, mimetype, buffer, size } = req.file;
    
    console.log(`Received file: ${originalname} (${(size / 1024).toFixed(2)} KB)`);

    const documents = await fileConverter.convertToJSON(buffer, {
      originalname,
      mimetype,
      size,
    });

    const saveResult = await fileConverter.saveToContext(documents, originalname);

    res.json({
      success: true,
      message: 'File uploaded and converted successfully',
      filename: saveResult.filename,
      documentsAdded: saveResult.documentCount,
      documents: documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
      })),
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process uploaded file',
      details: error.message 
    });
  }
});

app.post('/api/ingest', async (req, res) => {
  try {
    if (ingestionStatus.isRunning) {
      return res.status(409).json({ error: 'Ingestion is already running' });
    }

    ingestionStatus = {
      isRunning: true,
      completed: false,
      error: null,
      stats: null,
      currentStage: 'Initializing...',
      progress: { processed: 0, total: 0 },
    };

    res.json({ message: 'Ingestion started', status: 'processing' });

    (async () => {
      try {
        const DataIngestion = (await import('./ingestion/DataIngestion.js')).default;
        const ingestion = new DataIngestion();
        
        ingestionStatus.currentStage = 'Reading documents...';
        
        const result = await ingestion.run();
        
        ingestionStatus.isRunning = false;
        ingestionStatus.completed = true;
        ingestionStatus.stats = result || {
          totalDocuments: 0,
          sources: [],
        };
        ingestionStatus.currentStage = 'Completed';
        
        console.log('Background ingestion completed');
        isInitialized = false; // Force RAG re-initialization
        
      } catch (err) {
        console.error('Background ingestion failed:', err);
        ingestionStatus.isRunning = false;
        ingestionStatus.error = err.message;
      }
    })();

  } catch (error) {
    console.error('Ingest error:', error);
    ingestionStatus.isRunning = false;
    ingestionStatus.error = error.message;
    res.status(500).json({ error: 'Error starting ingestion' });
  }
});

app.get('/api/ingest-status', (req, res) => {
  res.json(ingestionStatus);
});


const entityTracker = new Map(); // entity -> { count, lastSearched }
const MAX_ENTITY_TRACKING = 200;


function extractEntities(query) {
  const text = query.toLowerCase();
  const entities = new Set();
  
  const specificTerms = [
    // Core Singtel platforms
    'kenan', 'ecom', 'esom', 'singtel',
    // Kenan modules
    'billing', 'invoice', 'payment', 'inventory', 'erp', 'financial', 'ledger',
    'purchase', 'purchase history', 'account', 'subscription',
    // ECOM modules
    'order', 'cart', 'checkout', 'order tracker', 'order management',
    'catalog', 'product', 'price', 'promotion', 'fulfilment', 'fulfillment',
    'provisioning', 'service order', 'store', 'ecommerce', 'e-commerce',
    // ESOM modules
    'support', 'ticket', 'case', 'incident', 'service request',
    'tracking', 'resolution', 'escalation', 'sla', 'technical support',
    // Customer & user
    'customer', 'user', 'account', 'profile', 'authentication', 'login', 'session',
    'crm', 'csm', 'oss', 'bss',
    // Integrations & infra
    'api', 'gateway', 'rest', 'webhook', 'event', 'integration',
    'queue', 'kafka', 'rabbitmq', 'messaging', 'notification', 'email', 'sms',
    'database', 'mongodb', 'postgres', 'mysql', 'redis', 'cache', 'nosql',
    'microservice', 'monolith', 'docker', 'kubernetes', 'k8s', 'aws', 'cloud',
    'pipeline', 'cicd', 'jenkins', 'gitlab', 'github', 'bamboo', 'bitbucket',
    'jira', 'confluence',
    // Ops & reliability
    'deploy', 'release', 'rollback', 'monitor', 'alert', 'downtime',
    'crash', 'failure', 'outage', 'incident', 'peak', 'load', 'traffic',
    'performance', 'latency', 'timeout', 'retry', 'failover',
    // Analytics & reporting
    'report', 'analytics', 'dashboard', 'metrics', 'log', 'audit',
    // Security
    'authorization', 'oauth', 'jwt', 'security', 'access', 'permission', 'role',
    // DevOps / testing
    'test', 'regression', 'sprint', 'epic', 'story', 'bug', 'task', 'feature',
  ];
  
  specificTerms.forEach(term => {
    if (text.includes(term)) {
      entities.add(term);
    }
  });
  
  const patterns = [
    /\b([\w-]+service)\b/gi,
    /\b([\w-]+api)\b/gi,
    /\b([\w-]+gateway)\b/gi,
    /\b([\w-]+backend)\b/gi,
    /\b([\w-]+frontend)\b/gi,
    /\b([\w-]+database)\b/gi,
    /\b([\w-]+server)\b/gi,
    /\b([\w-]+engine)\b/gi,
    /\b([\w-]+system)\b/gi,
    /\b([\w-]+platform)\b/gi,
    
    // Architecture terms
    /\b(microservice|monolith|architecture|deployment|pipeline|docker|kubernetes|k8s)\b/gi,
    /\b(rest|graphql|grpc|api|endpoint|interface)\b/gi,
    /\b(authentication|authorization|oauth|jwt|security|auth)\b/gi,
    /\b(database|sql|nosql|mongodb|postgres|mysql|redis|cache)\b/gi,
    /\b(queue|kafka|rabbitmq|messaging|event|stream)\b/gi,
    
    // Technologies
    /\b(react|angular|vue|node|java|python|go|rust|javascript)\b/gi,
    /\b(aws|azure|gcp|cloud|serverless|lambda)\b/gi,
    /\b(jenkins|gitlab|github|devops|cicd)\b/gi,
    
    // Common verbs/actions
    /\b(deploy|build|test|release|rollback|scale|monitor)\b/gi,
    
    // Jira/Confluence specific
    /\b([A-Z]+-\d+)\b/g, // Jira ticket format
    /\b(sprint|epic|story|bug|task|feature)\b/gi,
  ];
  
  patterns.forEach(pattern => {
    const matches = query.match(pattern) || [];
    matches.forEach(match => {
      if (match.length >= 3) { 
        entities.add(match.toLowerCase());
      }
    });
  });
  
  const quotedTerms = query.match(/"([^"]+)"|'([^']+)'/g);
  if (quotedTerms) {
    quotedTerms.forEach(term => {
      const cleaned = term.replace(/['"]/g, '').trim();
      if (cleaned.length >= 3) {
        entities.add(cleaned.toLowerCase());
      }
    });
  }
  
  return Array.from(entities);
}

function formatAsPointwise(text) {
  const paragraphs = text.split(/\n\n+/);
  const points = [];
  
  paragraphs.forEach(para => {
    const trimmed = para.trim();
    if (!trimmed) return;
    
    if (trimmed.match(/^[-•*]\s/)) {
      points.push(trimmed);
      return;
    }
    
    if (trimmed.length < 100 && !trimmed.endsWith('.') && !trimmed.endsWith(':')) {
      points.push(`**${trimmed}**`);
      return;
    }
    
    const sentences = trimmed.split(/\. +/);
    
    sentences.forEach((sentence, idx) => {
      const cleaned = sentence.trim();
      if (cleaned.length < 10) return;
      
      const formatted = (idx < sentences.length - 1 && !cleaned.endsWith('.')) 
        ? cleaned + '.' 
        : cleaned;
      
      points.push(`• ${formatted}`);
    });
  });
  
  return points.join('\n\n');
}

app.get('/api/documents', async (req, res) => {
  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(__dirname, 'data', 'ingested-documents.json');
    
    try {
      const content = await fs.readFile(dataPath, 'utf-8');
      const documents = JSON.parse(content);
      
      res.json({
        success: true,
        documents: Array.isArray(documents) ? documents : [],
        total: Array.isArray(documents) ? documents.length : 0,
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.json({ success: true, documents: [], total: 0 });
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Error loading documents:', error);
    res.status(500).json({ error: 'Failed to load documents' });
  }
});


app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fs = await import('fs/promises');
    const dataPath = path.join(__dirname, 'data', 'ingested-documents.json');
    
    const content = await fs.readFile(dataPath, 'utf-8');
    let documents = JSON.parse(content);
    
    if (!Array.isArray(documents)) {
      return res.status(400).json({ error: 'Invalid document format' });
    }
    
    const docToDelete = documents.find(doc => doc.id === id);
    
    if (!docToDelete) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (docToDelete.source === 'uploaded' && docToDelete.sourceId && docToDelete.metadata?.filename) {
      try {
        const timestamp = docToDelete.sourceId.replace('upload-', '');
        const baseName = path.basename(docToDelete.metadata.filename, path.extname(docToDelete.metadata.filename));
        const filename = `uploaded-${baseName}-${timestamp}.json`;
        const filePath = path.join(__dirname, 'data', 'context', 'extra-docs', filename);
        
        await fs.unlink(filePath);
        console.log(`Deleted physical file: ${filename}`);
      } catch (fileError) {
        console.warn(`Could not delete physical file for document ${id}:`, fileError.message);
      }
    }
    
    documents = documents.filter(doc => doc.id !== id);
    await fs.writeFile(dataPath, JSON.stringify(documents, null, 2), 'utf-8');
    
    console.log(`Deleted document: ${id}`);
    
    isInitialized = false;
    
    res.json({
      success: true,
      message: 'Document deleted successfully',
      remaining: documents.length,
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

app.post('/api/trending-searches/process', async (req, res) => {
  try {
    const { sessions } = req.body;
    
    if (!Array.isArray(sessions)) {
      return res.status(400).json({ error: 'Sessions array is required' });
    }
    
    entityTracker.clear();
    
    sessions.forEach(session => {
      if (!session.messages || !Array.isArray(session.messages)) return;
      
      session.messages.forEach(msg => {
        if (msg.type === 'user' && msg.content) {
          const entities = extractEntities(msg.content);
          const timestamp = msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString();
          
          entities.forEach(entity => {
            if (entityTracker.has(entity)) {
              const tracker = entityTracker.get(entity);
              tracker.count++;
              if (!tracker.lastSearched || new Date(timestamp) > new Date(tracker.lastSearched)) {
                tracker.lastSearched = timestamp;
              }
            } else {
              entityTracker.set(entity, {
                count: 1,
                lastSearched: timestamp,
              });
              
              if (entityTracker.size > MAX_ENTITY_TRACKING) {
                const firstKey = entityTracker.keys().next().value;
                entityTracker.delete(firstKey);
              }
            }
          });
        }
      });
    });
    
    console.log(`Processed ${sessions.length} sessions, found ${entityTracker.size} unique entities`);
    
    res.json({
      success: true,
      totalEntities: entityTracker.size,
      totalSessions: sessions.length,
    });
  } catch (error) {
    console.error('Error processing sessions:', error);
    res.status(500).json({ error: 'Failed to process sessions' });
  }
});

app.get('/api/trending-searches', async (req, res) => {
  try {
    const { range = '24h' } = req.query;
    const now = Date.now();
    
    const ranges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      'all': Infinity,
    };
    
    const timeLimit = ranges[range] || ranges['24h'];

    const trending = Array.from(entityTracker.entries())
      .filter(([entity, data]) => {
        if (range === 'all') return true;
        return now - new Date(data.lastSearched).getTime() < timeLimit;
      })
      .map(([entity, data]) => ({
        query: entity,
        entity: entity,
        count: data.count,
        lastSearched: data.lastSearched,
        cached: false,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50); // Top 50
    
    res.json({
      success: true,
      searches: trending,
      range,
      privacyNote: 'Showing trending entities and terms, not individual user queries',
    });
  } catch (error) {
    console.error('Error getting trending searches:', error);
    res.status(500).json({ error: 'Failed to get trending searches' });
  }
});

app.post('/api/format-pointwise', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const paragraphs = text.split(/\n\n+/);
    const points = [];
    
    paragraphs.forEach(para => {
      const trimmed = para.trim();
      if (!trimmed) return;
      
      if (trimmed.match(/^[-•*]\s/)) {
        points.push(trimmed);
        return;
      }
      
      if (trimmed.length < 100 && !trimmed.endsWith('.') && !trimmed.endsWith(':')) {
        points.push(`**${trimmed}**`);
        return;
      }
      
      const sentences = trimmed.split(/\. +/);
      
      sentences.forEach((sentence, idx) => {
        const cleaned = sentence.trim();
        if (cleaned.length < 10) return; 
        
        const formatted = (idx < sentences.length - 1 && !cleaned.endsWith('.')) 
          ? cleaned + '.' 
          : cleaned;
        
        points.push(`• ${formatted}`);
      });
    });
    
    const formatted = points.join('\n\n');
    
    res.json({
      success: true,
      original: text,
      formatted: formatted,
    });
  } catch (error) {
    console.error('Error formatting response:', error);
    res.status(500).json({ error: 'Failed to format response' });
  }
});

// ─── Architecture Image Endpoints ────────────────────────────────────────────

// GET  /api/architecture-images — list all ingested architecture diagrams
app.get('/api/architecture-images', async (req, res) => {
  try {
    const fs = await import('fs/promises');
    const archPath = path.join(__dirname, 'data', 'architecture-graphs.json');
    try {
      const content = await fs.readFile(archPath, 'utf-8');
      const graphs = JSON.parse(content);
      res.json({ success: true, images: Array.isArray(graphs) ? graphs : [], total: graphs.length });
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.json({ success: true, images: [], total: 0 });
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Error loading architecture images:', error);
    res.status(500).json({ error: 'Failed to load architecture images' });
  }
});

// POST /api/upload-architecture-image — admin: ingest a labeled architecture diagram
app.post('/api/upload-architecture-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { originalname, mimetype, buffer, size } = req.file;
    const label = (req.body.label || originalname).trim();

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(mimetype)) {
      return res.status(400).json({ error: 'Only PNG and JPG images are supported.' });
    }

    console.log(`[ArchImage] Received: ${originalname} (${(size / 1024).toFixed(1)} KB) — label: ${label}`);
    console.log(`[ArchImage] Sending to Qwen2.5-VL for structure extraction...`);

    let extracted;
    try {
      extracted = await qwenVision.extractArchitectureStructure(buffer);
    } catch (visionError) {
      console.error('[ArchImage] Vision extraction failed:', visionError.message);
      return res.status(500).json({
        error: 'Architecture extraction failed',
        details: visionError.message,
        hint: 'Ensure llama.cpp is built: cd Model/llama.cpp && cmake -B build && cmake --build build --config Release -j4'
      });
    }

    const id = `arch-${Date.now()}`;
    const fs = await import('fs/promises');

    // --- Save to architecture-graphs.json ---
    const archPath = path.join(__dirname, 'data', 'architecture-graphs.json');
    let graphs = [];
    try {
      const existing = await fs.readFile(archPath, 'utf-8');
      graphs = JSON.parse(existing);
      if (!Array.isArray(graphs)) graphs = [];
    } catch { graphs = []; }

    const graphEntry = {
      id,
      label,
      filename: originalname,
      uploadedAt: new Date().toISOString(),
      description: extracted.description || '',
      components: extracted.components || [],
      relationships: extracted.relationships || [],
      layers: extracted.layers || [],
    };
    graphs.push(graphEntry);
    await fs.writeFile(archPath, JSON.stringify(graphs, null, 2), 'utf-8');

    // --- Save to ingested-documents.json so RAG can search it ---
    const docsPath = path.join(__dirname, 'data', 'ingested-documents.json');
    let docs = [];
    try {
      const existingDocs = await fs.readFile(docsPath, 'utf-8');
      docs = JSON.parse(existingDocs);
      if (!Array.isArray(docs)) docs = [];
    } catch { docs = []; }

    const componentLines = (extracted.components || [])
      .map(c => `  - ${c.name} (${c.type})${c.layer ? ` [${c.layer}]` : ''}`)
      .join('\n');
    const relationshipLines = (extracted.relationships || [])
      .map(r => `  - ${r.from} ${r.type} ${r.to}${r.label ? `: ${r.label}` : ''}`)
      .join('\n');

    const docContent =
      `Architecture Diagram: ${label}\n\n` +
      (extracted.description ? `Summary: ${extracted.description}\n\n` : '') +
      (componentLines ? `Components:\n${componentLines}\n\n` : '') +
      (relationshipLines ? `Relationships:\n${relationshipLines}\n\n` : '') +
      (extracted.layers?.length ? `Layers: ${extracted.layers.join(', ')}` : '');

    docs.push({
      id,
      source: 'architecture-image',
      sourceId: id,
      title: `Architecture: ${label}`,
      content: docContent,
      type: 'architecture',
      metadata: {
        filename: originalname,
        label,
        components: extracted.components || [],
        relationships: extracted.relationships || [],
      },
    });
    await fs.writeFile(docsPath, JSON.stringify(docs, null, 2), 'utf-8');

    // Force RAG re-initialization to pick up new document
    isInitialized = false;

    console.log(`[ArchImage] Ingested: ${extracted.components?.length || 0} components, ${extracted.relationships?.length || 0} relationships`);

    res.json({
      success: true,
      id,
      label,
      description: extracted.description || '',
      components: extracted.components || [],
      relationships: extracted.relationships || [],
      layers: extracted.layers || [],
    });
  } catch (error) {
    console.error('[ArchImage] Upload error:', error);
    res.status(500).json({ error: 'Failed to process architecture image', details: error.message });
  }
});

// DELETE /api/architecture-images/:id — admin: remove an ingested architecture diagram
app.delete('/api/architecture-images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fs = await import('fs/promises');

    // Remove from architecture-graphs.json
    const archPath = path.join(__dirname, 'data', 'architecture-graphs.json');
    let graphs = [];
    try {
      const content = await fs.readFile(archPath, 'utf-8');
      graphs = JSON.parse(content);
      if (!Array.isArray(graphs)) graphs = [];
    } catch { graphs = []; }

    if (!graphs.find(g => g.id === id)) {
      return res.status(404).json({ error: 'Architecture image not found' });
    }
    graphs = graphs.filter(g => g.id !== id);
    await fs.writeFile(archPath, JSON.stringify(graphs, null, 2), 'utf-8');

    // Also remove from ingested-documents.json
    const docsPath = path.join(__dirname, 'data', 'ingested-documents.json');
    try {
      const docsContent = await fs.readFile(docsPath, 'utf-8');
      let docs = JSON.parse(docsContent);
      if (Array.isArray(docs)) {
        docs = docs.filter(d => d.id !== id);
        await fs.writeFile(docsPath, JSON.stringify(docs, null, 2), 'utf-8');
      }
    } catch { /* best-effort */ }

    isInitialized = false;
    console.log(`[ArchImage] Deleted: ${id}`);
    res.json({ success: true, message: 'Architecture image deleted', remaining: graphs.length });
  } catch (error) {
    console.error('[ArchImage] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete architecture image' });
  }
});

// POST /api/analyze-image — user: one-shot image analysis with a prompt
app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { mimetype, buffer } = req.file;
    const prompt = (req.body.prompt || 'Describe this architecture diagram in detail, covering all components, their roles, and how they connect.').trim();

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(mimetype)) {
      return res.status(400).json({ error: 'Only PNG and JPG images are supported.' });
    }

    console.log(`[AnalyzeImage] User prompt: "${prompt.slice(0, 100)}"`);

    let answer;
    try {
      answer = await qwenVision.analyzeImage(buffer, prompt, { maxTokens: 1500, temperature: 0.2 });
    } catch (visionError) {
      console.error('[AnalyzeImage] Vision error:', visionError.message);
      return res.status(500).json({
        error: 'Image analysis failed',
        details: visionError.message,
        hint: 'Ensure llama.cpp is built: cd Model/llama.cpp && cmake -B build && cmake --build build --config Release -j4'
      });
    }

    res.json({
      success: true,
      answer: answer.trim(),
      sources: [{ source: 'Qwen2.5-VL', title: 'Image Analysis', type: 'vision' }],
    });
  } catch (error) {
    console.error('[AnalyzeImage] Error:', error);
    res.status(500).json({ error: 'Failed to analyze image', details: error.message });
  }
});

// ─── Document Validation Endpoints ────────────────────────────────────────────

// Submit a document for validation (admin only)
app.post('/api/validations', (req, res) => {
  try {
    const { documentId, documentName, content, userId } = req.body;
    
    if (!documentId || !documentName || !content) {
      return res.status(400).json({ error: 'documentId, documentName, and content are required' });
    }

    const validationId = uuidv4();
    const validation = {
      id: validationId,
      documentId,
      documentName,
      content: content.substring(0, 1000), // Store first 1000 chars for preview
      status: 'PENDING',
      submittedBy: userId,
      submittedAt: new Date().toISOString(),
      reviewers: {},
      reviews: [],
      feedback: {}
    };

    console.log(`[Validation] New validation created: ${validationId}`);
    res.json({
      success: true,
      validation: validation
    });
  } catch (error) {
    console.error('[Validation] Submit error:', error);
    res.status(500).json({ error: 'Failed to submit document for validation', details: error.message });
  }
});

// Get all validations (admin only)
app.get('/api/validations', (req, res) => {
  try {
    const { status } = req.query;
    
    // This would normally query a database, but we'll return a success message
    // The actual data is stored in localStorage on the frontend
    res.json({
      success: true,
      message: 'Validation data is stored client-side in localStorage',
      note: 'To persist across sessions, add MongoDB integration'
    });
  } catch (error) {
    console.error('[Validation] Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch validations', details: error.message });
  }
});

// Get validations assigned to current user (reviewer endpoint)
app.get('/api/validations/assigned', (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // This would normally query a database for reviews assigned to this user
    res.json({
      success: true,
      message: 'Assigned validations data is stored client-side in localStorage',
      note: 'Review data is persisted per user in localStorage'
    });
  } catch (error) {
    console.error('[Validation] Assigned fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch assigned validations', details: error.message });
  }
});

// Submit a review for a document (reviewer endpoint)
app.put('/api/validations/:id/review', (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerId, reviewerRole, decision, feedback, checklist } = req.body;
    
    if (!reviewerId || !decision) {
      return res.status(400).json({ error: 'reviewerId and decision are required' });
    }

    const validDecisions = ['APPROVED', 'REJECTED'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
    }

    const review = {
      id: uuidv4(),
      validationId: id,
      reviewerId,
      reviewerRole,
      decision,
      feedback: feedback || '',
      checklist: checklist || {},
      submittedAt: new Date().toISOString()
    };

    console.log(`[Validation] Review submitted for validation ${id}: ${decision}`);
    res.json({
      success: true,
      review: review,
      message: `Review ${decision === 'APPROVED' ? 'approved' : 'rejected'}`
    });
  } catch (error) {
    console.error('[Validation] Review submit error:', error);
    res.status(500).json({ error: 'Failed to submit review', details: error.message });
  }
});

// Get validation progress (tracking endpoint)
app.get('/api/validations/:id/progress', (req, res) => {
  try {
    const { id } = req.params;

    // This would normally query a database
    res.json({
      success: true,
      message: `Validation progress for ${id} is tracked client-side`,
      note: 'Status updates are real-time in localStorage'
    });
  } catch (error) {
    console.error('[Validation] Progress fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch validation progress', details: error.message });
  }
});

// ─── SQL GENERATION ENDPOINTS ──────────────────────────────────────────────────

// POST /api/generate-sql
// Generate SQL queries from natural language descriptions
app.post('/api/generate-sql', async (req, res) => {
  try {
    const { description, databaseType = 'oracle', schemaContext = '', complexity = 'simple' } = req.body;

    if (!description || description.trim().length === 0) {
      return res.status(400).json({ error: 'Description is required' });
    }

    if (!['oracle', 'postgresql', 'mysql'].includes(databaseType)) {
      return res.status(400).json({ error: 'Invalid database type. Use: oracle, postgresql, or mysql' });
    }

    if (!['simple', 'intermediate', 'complex'].includes(complexity)) {
      return res.status(400).json({ error: 'Invalid complexity. Use: simple, intermediate, or complex' });
    }

    console.log(`Generating ${complexity} SQL query for database: ${databaseType}`);

    const result = await sqlGenerator.generateSQL(description, databaseType, schemaContext, complexity);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('SQL generation error:', error.message);
    res.status(500).json({
      error: 'Failed to generate SQL query',
      details: error.message,
      hint: 'Ensure model is initialized and try a simpler query description',
    });
  }
});

// ─── DOCUMENT MANAGEMENT ENDPOINTS ────────────────────────────────────────────

// DELETE /api/documents/:id/force-remove
// Removes document and undoes ingestion (clears embeddings)
app.delete('/api/documents/:id/force-remove', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Force removing document: ${id}`);

    // 1. Load and filter ingested documents
    const docsPath = path.join(__dirname, 'data', 'ingested-documents.json');
    let documents = [];
    
    try {
      const data = await fs.readFile(docsPath, 'utf-8');
      documents = JSON.parse(data);
    } catch (error) {
      console.log('No ingested documents found');
    }

    const beforeCount = documents.length;
    const filtered = documents.filter(d => d.id !== id && d.sourceId !== id);
    const afterCount = filtered.length;
    const removedCount = beforeCount - afterCount;

    if (removedCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // 2. Write back filtered documents
    await fs.writeFile(docsPath, JSON.stringify(filtered, null, 2));
    console.log(`Removed ${removedCount} document(s) from ingested-documents.json`);

    // 3. Clear vector store and force re-initialization
    ragPipeline.vectorStore = null;
    isInitialized = false;
    console.log('Vector store cleared, RAG will reinitialize on next query');

    // 4. Clear entity tracker
    entityTracker.clear();
    console.log('Entity tracker cleared');

    res.json({
      success: true,
      documentId: id,
      removed: removedCount,
      message: `Document deleted and ingestion undone. ${removedCount} document(s) removed. RAG will reinitialize on next query.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Force remove error:', error);
    res.status(500).json({
      error: 'Failed to remove document',
      details: error.message,
    });
  }
});

// ─── DATA FORMATTER ENDPOINTS ──────────────────────────────────────────────────

// POST /api/format-data
// Validate and format data (JSON, YAML, XML, TOML, Markdown, CSV)
app.post('/api/format-data', async (req, res) => {
  try {
    const { rawData, formatType } = req.body;

    if (!rawData || rawData.trim().length === 0) {
      return res.status(400).json({
        error: 'No data provided',
        message: 'Please provide data to format',
      });
    }

    if (!['json', 'yaml', 'xml', 'toml', 'markdown', 'csv'].includes(formatType)) {
      return res.status(400).json({
        error: 'Invalid format type',
        supported: ['json', 'yaml', 'xml', 'toml', 'markdown', 'csv'],
      });
    }

    console.log(`Formatting ${formatType.toUpperCase()}: ${rawData.substring(0, 50)}...`);

    const result = await formatValidator.validateAndFormat(rawData, formatType);

    res.json({
      success: result.success !== false,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Format data error:', error);
    res.status(500).json({
      error: 'Failed to format data',
      details: error.message,
    });
  }
});

// POST /api/convert - Convert data between formats
app.post('/api/convert', async (req, res) => {
  try {
    const { rawData, fromFormat, toFormat } = req.body;

    if (!rawData) {
      return res.status(400).json({
        error: 'No data provided',
        message: 'Please provide data to convert',
      });
    }

    if (!fromFormat || !toFormat) {
      return res.status(400).json({
        error: 'Missing format parameters',
        message: 'Both fromFormat and toFormat are required',
      });
    }

    const validFormats = ['json', 'yaml', 'xml', 'toml', 'markdown', 'csv'];
    if (!validFormats.includes(fromFormat)) {
      return res.status(400).json({
        error: 'Invalid source format',
        supported: validFormats,
      });
    }

    if (!validFormats.includes(toFormat)) {
      return res.status(400).json({
        error: 'Invalid target format',
        supported: validFormats,
      });
    }

    if (fromFormat === toFormat) {
      return res.json({
        success: true,
        data: {
          success: true,
          converted: rawData,
          issues: [],
          explanation: 'Source and target formats are the same',
        },
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`Converting ${fromFormat.toUpperCase()} to ${toFormat.toUpperCase()}`);

    const result = await formatValidator.convert(rawData, fromFormat, toFormat);

    res.json({
      success: result.success !== false,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Convert data error:', error);
    res.status(500).json({
      error: 'Failed to convert data',
      details: error.message,
    });
  }
});

// ─── Error Handler ────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});


app.listen(PORT, () => {
  console.log(` CAE Backend running on http://localhost:${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
  console.log(` Chat endpoint: http://localhost:${PORT}/api/chat`);
  console.log(` Graph endpoint: http://localhost:${PORT}/api/graph`);
});
