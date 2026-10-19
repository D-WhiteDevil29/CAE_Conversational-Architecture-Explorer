import api from './api';
import { ENDPOINTS, FEATURES } from '@/config/constants';
import { generateId } from '@/utils/helpers';

// Helper to check if mock mode is enabled (from localStorage or config)
function isMockModeEnabled() {
  const storedMode = window.localStorage.getItem('cae_mock_mode');
  if (storedMode !== null) {
    return storedMode === 'true';
  }
  return FEATURES.mockMode;
}

const greetingPatterns = /^(hi|hello|hey|hola|greetings|good morning|good afternoon|good evening|howdy|what's up|whats up|sup)\b/i;

const simplePatterns = {
  how: /^(how are you|how r u|how's it going|hows it going)/i,
  thanks: /^(thank you|thanks|thx|ty|appreciate it)/i,
  help: /^(help|what can you do|what do you do|capabilities)/i,
};

const greetingResponses = [
  {
    content: "Hello! 👋 I'm **CAE**, your Conversational Architecture Explorer for Singtel's tech stack.\n\nI can help you with:\n- Architecture queries about **Kenan**, **ECOM**, and **ESOM**\n- Service dependencies and relationships\n- Deployment history and status\n- API ownership and documentation\n\nFeel free to ask me anything about the architecture!",
    sources: ['CAE System'],
    confidence: 1.0,
  },
  {
    content: "Hi there! Great to see you using CAE!\n\nI'm here to help you navigate Singtel's complex architecture. I have access to:\n- **Confluence** documentation\n- **Jira** tickets and ownership\n- **Bamboo** deployment logs\n- **Git** commit history\n\nJust ask me about any service, API, or dependency!",
    sources: ['CAE System'],
    confidence: 1.0,
  },
];

const howAreYouResponses = [
  {
    content: "I'm doing great, thanks for asking! ⚡\n\nI've been busy analyzing the Singtel architecture and I'm ready to help you explore:\n- Service dependencies\n- API endpoints\n- Deployment statuses\n- System owners\n\nWhat would you like to know about?",
    sources: ['CAE System'],
    confidence: 1.0,
  },
];

const thanksResponses = [
  {
    content: "You're very welcome! 😊\n\nI'm always here to help you understand and navigate the Singtel architecture. Feel free to ask more questions anytime!",
    sources: ['CAE System'],
    confidence: 1.0,
  },
];

const helpResponses = [
  {
    content: "I'm **CAE** - your AI-powered architecture assistant! 🤖\n\n**What I can do:**\n\n1. **Answer Architecture Questions**\n   - Service dependencies and relationships\n   - API ownership and endpoints\n   - System topologies\n\n2. **Deployment Information**\n   - Deployment history from Bamboo\n   - Current system status\n   - Recent changes and updates\n\n3. **Documentation Lookup**\n   - Search Confluence pages\n   - Find Jira tickets\n   - Trace Git commits\n\n**Example questions:**\n- \"Who owns the ECOM billing API?\"\n- \"Show me dependencies for Kenan\"\n- \"What's the deployment status of ESOM?\"\n- \"Explain the payment flow architecture\"\n\nTry asking me something!",
    sources: ['CAE System'],
    confidence: 1.0,
  },
];


const mockResponses = [
  {
    content: "The ECOM billing API is owned by **Team Alpha**. It's a critical service that handles all billing operations for the ECOM platform.\n\nKey details:\n- **Last deployment**: 2 hours ago\n- **Status**: Active\n- **Dependencies**: Kenan API Gateway, MongoDB Cluster\n- **Recent changes**: Fixed rate calculation bug (JIRA-1234)",
    sources: ['Confluence', 'Jira'],
    confidence: 0.95,
  },
  {
    content: "Based on the architecture documentation, ECOM calls the **Kenan Billing API** for all billing-related operations.\n\nThis API provides:\n- Rate calculation\n- Invoice generation\n- Payment processing\n- Billing history\n\nThe last deployment was **1 day ago** with version 2.3.1.",
    sources: ['Bamboo', 'Git'],
    confidence: 0.92,
  },
  {
    content: "The ESOM Gateway has **3 downstream dependencies**:\n\n1. **MongoDB Cluster** - Primary data store\n2. **Message Queue** - Event processing\n3. **Authentication Service** - User validation\n\nAll connections are active and healthy.",
    sources: ['System Logs', 'Confluence'],
    confidence: 0.89,
  },
  {
    content: "The **Kenan** system architecture consists of multiple microservices:\n\n**Core Services:**\n- Billing Engine (Team Beta)\n- Customer Management (Team Alpha)\n- Product Catalog (Team Gamma)\n\n**Supporting Services:**\n- API Gateway\n- Authentication Service\n- Notification Service\n\nAll services are containerized and deployed on AWS EKS.",
    sources: ['Confluence', 'Architecture Docs'],
    confidence: 0.93,
  },
  {
    content: "Based on recent **Bamboo** builds:\n\n**ECOM Services:**\n- ecom-frontend: Build #342 (Success) - 3 hours ago\n- ecom-backend: Build #567 (Success) - 5 hours ago\n- ecom-billing: Build #234 (Success) - 2 days ago\n\nAll deployments are stable with no critical issues reported.",
    sources: ['Bamboo', 'CI/CD'],
    confidence: 0.88,
  },
];


export async function sendChatMessage(message, wantPointwise = false, conversationId = null, userContext = null, chatHistory = []) {
  if (isMockModeEnabled()) {
    try {
      const isGreeting = greetingPatterns.test(message.trim());
      const delay = isGreeting ? 800 : 1500;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      let responsePool = mockResponses;
      
      if (greetingPatterns.test(message.trim())) {
        responsePool = greetingResponses;
      }
      else if (simplePatterns.how && simplePatterns.how.test(message.trim())) {
        responsePool = howAreYouResponses;
      }
      else if (simplePatterns.thanks && simplePatterns.thanks.test(message.trim())) {
        responsePool = thanksResponses;
      }
      else if (simplePatterns.help && simplePatterns.help.test(message.trim())) {
        responsePool = helpResponses;
      }
      
      const randomResponse = responsePool[Math.floor(Math.random() * responsePool.length)];
      
      return {
        id: generateId(),
        type: 'ai',
        content: randomResponse.content,
        timestamp: new Date(),
        metadata: {
          sources: randomResponse.sources,
          confidence: randomResponse.confidence,
        },
      };
    } catch (error) {
      console.error('Mock response error:', error);
      return {
        id: generateId(),
        type: 'ai',
        content: 'Hello! I\'m CAE, your architecture assistant. How can I help you today?',
        timestamp: new Date(),
        metadata: {
          sources: ['CAE System'],
          confidence: 1.0,
        },
      };
    }
  }

  try {
    // Check if context-only mode is enabled
    const contextOnly = window.localStorage.getItem('cae_context_only_mode') === 'true';
    
    const response = await api.post(ENDPOINTS.chat, {
      message,
      conversationId,
      wantPointwise,
      contextOnly,
      userContext,
      chatHistory,
    });

    return {
      id: generateId(),
      type: 'ai',
      content: response.data.message, 
      timestamp: new Date(response.data.timestamp),
      metadata: {
        sources: response.data.sources || [],
        components: response.data.components || [],
        conversationId: response.data.conversationId,
        graph: response.data.graph || null,
        usedWebSearch: response.data.usedWebSearch || false,
      },
    };
  } catch (error) {
    console.error('Error sending chat message:', error);
    
    if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      return {
        id: generateId(),
        type: 'ai',
        content: ' **Backend not available**\n\nPlease ensure:\n1. Backend server is running (`cd Model && npm run dev`)\n2. Ollama is running (`ollama serve`)\n3. Data has been ingested (`npm run ingest`)\n\nOr enable mock mode in Settings.',
        timestamp: new Date(),
        metadata: {
          sources: ['System'],
          error: true,
        },
      };
    }
    
    throw error;
  }
}

export async function searchArchitecture(query) {
  try {
    if (isMockModeEnabled()) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        results: [
          { id: 1, title: 'ECOM Service', type: 'service' },
          { id: 2, title: 'Kenan API', type: 'api' },
        ],
      };
    }

    const response = await api.get(ENDPOINTS.search, {
      params: { q: query },
    });

    return response.data;
  } catch (error) {
    console.error('Error searching:', error);
    throw error;
  }
}

export async function getDependencyGraph(query, components = [], answer = '', sources = []) {
  try {
    if (isMockModeEnabled()) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return {
        nodes: [],
        edges: [],
      };
    }

    const response = await api.post(ENDPOINTS.graph, {
      query,
      components,
      answer,
      sources,
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching graph:', error);
    throw error;
  }
}

export async function getChatHistory() {
  try {
    const response = await api.get('/api/chat/history');
    return response.data;
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
}

/**
 * Send an image file with an optional prompt to Qwen2.5-VL for analysis.
 * This bypasses the regular RAG pipeline and goes directly to the vision model.
 */
export async function analyzeImageMessage(prompt, imageFile) {
  if (isMockModeEnabled()) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      id: generateId(),
      type: 'ai',
      content:
        '**Mock Image Analysis**\n\n' +
        'This is a mock response. In production the Qwen2.5-VL model reads the uploaded diagram and explains:\n\n' +
        '- All visible components and their roles\n' +
        '- Data flow and communication paths\n' +
        '- Layer groupings (Web, Server, Data)\n\n' +
        'Disable mock mode and ensure llama.cpp is built to see real analysis.',
      timestamp: new Date(),
      metadata: {
        sources: [{ source: 'Qwen2.5-VL', title: 'Image Analysis (mock)', type: 'vision' }],
      },
    };
  }

  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append(
      'prompt',
      prompt?.trim() || 'Describe this architecture diagram in detail, covering all components, their roles, and how they connect.'
    );

    const response = await api.post('/api/analyze-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });

    return {
      id: generateId(),
      type: 'ai',
      content: response.data.answer,
      timestamp: new Date(),
      metadata: {
        sources: response.data.sources || [],
      },
    };
  } catch (error) {
    console.error('Error analyzing image:', error);

    if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      return {
        id: generateId(),
        type: 'ai',
        content:
          '**Backend not available**\n\nPlease ensure the backend server is running (`cd Model && npm run dev`).',
        timestamp: new Date(),
        metadata: { sources: ['System'], error: true },
      };
    }

    const detail = error.response?.data?.details || error.response?.data?.error || error.message;
    return {
      id: generateId(),
      type: 'ai',
      content: `**Image analysis failed**\n\n${detail}\n\nEnsure llama.cpp is built: \`cd Model/llama.cpp && cmake -B build && cmake --build build --config Release -j4\``,
      timestamp: new Date(),
      metadata: { sources: ['System'], error: true },
    };
  }
}
