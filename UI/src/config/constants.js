// API Configuration
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 600000, // 10 minutes for LLaMA processing
  jiraURL: import.meta.env.VITE_JIRA_BASE_URL || 'https://singtel-jira.atlassian.net',
  confluenceURL: import.meta.env.VITE_CONFLUENCE_BASE_URL || '',
  bambooURL: import.meta.env.VITE_BAMBOO_BASE_URL || '',
};

// Authentication Configuration
export const AUTH_CONFIG = {
  jiraEmail: import.meta.env.VITE_JIRA_EMAIL || '',
  jiraToken: import.meta.env.VITE_JIRA_TOKEN || '',
  confluenceEmail: import.meta.env.VITE_CONFLUENCE_EMAIL || '',
  confluenceToken: import.meta.env.VITE_CONFLUENCE_TOKEN || '',
  bambooToken: import.meta.env.VITE_BAMBOO_TOKEN || '',
};

// Feature Flags
export const FEATURES = {
  mockMode: import.meta.env.VITE_ENABLE_MOCK_MODE !== 'false', // Default to true
  graphView: import.meta.env.VITE_ENABLE_GRAPH_VIEW !== 'false',
  analytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
};

// UI Configuration
export const UI_CONFIG = {
  appTitle: import.meta.env.VITE_APP_TITLE || 'CAE - Conversational Architecture Explorer',
  chatMaxMessages: parseInt(import.meta.env.VITE_CHAT_MAX_MESSAGES) || 100,
  graphMaxNodes: parseInt(import.meta.env.VITE_GRAPH_MAX_NODES) || 500,
  theme: 'dark',
  animationDuration: 300,
};

// API Endpoints
export const ENDPOINTS = {
  chat: '/api/chat',
  search: '/api/search',
  graph: '/api/graph',
  jira: {
    sprint: '/rest/agile/1.0/sprint',
    issue: '/rest/agile/1.0/issue',
  },
  confluence: {
    search: '/rest/api/content/search',
    page: '/rest/api/content',
  },
};

// Message Types
export const MESSAGE_TYPES = {
  USER: 'user',
  AI: 'ai',
  SYSTEM: 'system',
};

// View Modes
export const VIEW_MODES = {
  CHAT: 'chat',
  GRAPH: 'graph',
  SPLIT: 'split',
  ARCHITECTURE: 'architecture',
  SQL: 'sql',
  FORMATTER: 'formatter',
  CONVERTER: 'converter'
};

// Sample suggestions for quick queries
export const QUICK_SUGGESTIONS = [
  "Who owns the ECOM billing API?",
  "Show me the deployment history of Kenan",
  "What systems depend on ESOM?",
  "Explain the architecture of our payment flow",
  "List all services using MongoDB",
  "Show recent changes in authentication service",
];

// Graph node types
export const NODE_TYPES = {
  SERVICE:  'service',
  API:      'api',
  DATABASE: 'database',
  QUEUE:    'queue',
  EXTERNAL: 'external',
  GATEWAY:  'gateway',
  FRONTEND: 'frontend',
  MODULE:   'module',
  CACHE:    'cache',
};

// Graph edge types
export const EDGE_TYPES = {
  DEPENDS_ON: 'depends_on',
  CALLS:      'calls',
  PRODUCES:   'produces',
  CONSUMES:   'consumes',
};

// Colors for different node types
export const NODE_COLORS = {
  service:  '#667eea',
  api:      '#764ba2',
  database: '#f093fb',
  queue:    '#4facfe',
  external: '#43e97b',
  gateway:  '#f59e0b',
  frontend: '#ec4899',
  module:   '#06b6d4',
  cache:    '#84cc16',
};

// Status colors
export const STATUS_COLORS = {
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};
