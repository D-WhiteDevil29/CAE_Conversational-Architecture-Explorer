import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

class WebSearchService {
  constructor() {
    // Brave Search API (recommended - free tier, LLM-optimized)
    this.braveApiKey = process.env.BRAVE_API_KEY || null;
    this.braveEndpoint = 'https://api.search.brave.com/res/v1/web/search';
    
    // Serper API (Google results)
    this.serperApiKey = process.env.SERPER_API_KEY || null;
    this.serperEndpoint = 'https://google.serper.dev/search';
    
    // Tavily AI (LLM-focused)
    this.tavilyApiKey = process.env.TAVILY_API_KEY || null;
    this.tavilyEndpoint = 'https://api.tavily.com/search';
    
    this.proxyConfig = this.getProxyConfig();
    
    this.enabled = !!(this.braveApiKey || this.serperApiKey || this.tavilyApiKey);
    
    if (!this.enabled) {
      console.log('Web search disabled - no API keys configured');
      console.log('To enable: Set BRAVE_API_KEY, SERPER_API_KEY, or TAVILY_API_KEY in .env');
    } else {
      const providers = [];
      if (this.braveApiKey) providers.push('Brave');
      if (this.serperApiKey) providers.push('Serper');
      if (this.tavilyApiKey) providers.push('Tavily');
      console.log(`Web search enabled with: ${providers.join(', ')}`);
    }
  }

  getProxyConfig() {
    const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || 
                     process.env.http_proxy || process.env.HTTP_PROXY;
    
    if (!proxyUrl) return null;

    try {
      const url = new URL(proxyUrl);
      
      const agent = new HttpsProxyAgent(proxyUrl, {
        rejectUnauthorized: false 
      });
      
      console.log(`Proxy: ${url.hostname}:${url.port} (SSL verification disabled)`);
      
      return {
        agent,
        axiosProxy: {
          protocol: 'http',
          host: url.hostname,
          port: parseInt(url.port) || 80,
          auth: url.username && url.password ? {
            username: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password)
          } : undefined
        }
      };
    } catch (error) {
      console.error('Failed to parse proxy URL:', error.message);
      return null;
    }
  }

  async searchWithBrave(query, maxResults = 5) {
    if (!this.braveApiKey) return null;

    try {
      const requestConfig = {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.braveApiKey,
        },
        params: {
          q: query,
          count: maxResults,
          text_decorations: false,
          search_lang: 'en',
        },
        timeout: 20000,
      };
      
      if (this.proxyConfig) {
        requestConfig.httpsAgent = this.proxyConfig.agent;
      }
      
      const response = await axios.get(this.braveEndpoint, requestConfig);

      if (response.data.web?.results) {
        return response.data.web.results.map(result => ({
          title: result.title,
          snippet: result.description,
          url: result.url,
          source: 'brave',
        }));
      }

      return [];
    } catch (error) {
      console.error('Brave search error:', error.message);
      return null;
    }
  }


  async searchWithSerper(query, maxResults = 5) {
    if (!this.serperApiKey) return null;

    try {
      // Properly escape query for JSON and shell
      // 1. Escape backslashes first
      // 2. Escape double quotes for JSON
      // 3. Escape single quotes for shell
      const escapedQuery = query
        .replace(/\\/g, '\\\\')      // Escape backslashes
        .replace(/"/g, '\\"')         // Escape double quotes for JSON
        .replace(/'/g, "'\\''");      // Escape single quotes for shell
      
      // Add proxy configuration if available
      const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || 
                       process.env.http_proxy || process.env.HTTP_PROXY;
      const proxyFlag = proxyUrl ? `-x '${proxyUrl}' -k ` : '';
      
      const curlCommand = `curl ${proxyFlag}-X POST 'https://google.serper.dev/search' \\
        -H 'X-API-KEY: ${this.serperApiKey}' \\
        -H 'Content-Type: application/json' \\
        -d '{"q":"${escapedQuery}","num":${maxResults},"gl":"in"}' \\
        --max-time 30 \\
        -s 2>&1`;

      const { stdout, stderr } = await execPromise(curlCommand);
      
      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      const response = JSON.parse(stdout);

      if (response.organic) {
        return response.organic.map(result => ({
          title: result.title,
          snippet: result.snippet,
          url: result.link,
          source: 'google',
        }));
      }

      return [];
    } catch (error) {
      console.error('Serper search error:', error.message);
      return null;
    }
  }

  async searchWithTavily(query, maxResults = 5) {
    if (!this.tavilyApiKey) return null;

    try {
      const requestConfig = {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      };
      
      if (this.proxyConfig) {
        requestConfig.httpsAgent = this.proxyConfig.agent;
      }
      
      const response = await axios.post(
        this.tavilyEndpoint,
        {
          api_key: this.tavilyApiKey,
          query: query,
          max_results: maxResults,
          search_depth: 'basic',
          include_answer: false,
        },
        requestConfig
      );

      if (response.data.results) {
        return response.data.results.map(result => ({
          title: result.title,
          snippet: result.content,
          url: result.url,
          source: 'tavily',
        }));
      }

      return [];
    } catch (error) {
      console.error('Tavily search error:', error.message);
      return null;
    }
  }

  async search(query, maxResults = 5) {
    if (!this.enabled) {
      return { results: [], source: 'none' };
    }

    console.log(`Searching web for: "${query}"`);

    let results = null;
    let usedProvider = null;

    if (this.braveApiKey && !results) {
      results = await this.searchWithBrave(query, maxResults);
      if (results && results.length > 0) usedProvider = 'brave';
    }

    if (this.serperApiKey && !results) {
      results = await this.searchWithSerper(query, maxResults);
      if (results && results.length > 0) usedProvider = 'serper';
    }

    if (this.tavilyApiKey && !results) {
      results = await this.searchWithTavily(query, maxResults);
      if (results && results.length > 0) usedProvider = 'tavily';
    }

    if (!results || results.length === 0) {
      console.log('No web search results found');
      return { results: [], source: 'none' };
    }

    console.log(`Found ${results.length} web results via ${usedProvider}`);
    return { results, source: usedProvider };
  }

  formatForRAG(searchResults) {
    if (!searchResults || searchResults.length === 0) {
      return '';
    }

    const formatted = searchResults.map((result, idx) => 
      `[Web Source ${idx + 1}] ${result.title}\n${result.snippet}\n(URL: ${result.url})`
    ).join('\n\n');

    return `\n\n=== Additional Context from Web Search ===\n${formatted}\n`;
  }

  calculateRelevance(query, contextResults = []) {
    if (!contextResults || contextResults.length === 0) {
      return 0;
    }

    const contextText = contextResults
      .map(doc => doc.pageContent || '')
      .join(' ')
      .toLowerCase();

    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 
      'where', 'who', 'which', 'can', 'could', 'should', 'would', 'do', 'does',
      'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'about', 'by', 'as'
    ]);

    const queryTerms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopWords.has(term));

    if (queryTerms.length === 0) {
      return contextResults.length > 0 ? 100 : 0;
    }

    const matchedTerms = queryTerms.filter(term => contextText.includes(term));
    const relevanceScore = (matchedTerms.length / queryTerms.length) * 100;

    console.log(`Relevance: ${relevanceScore.toFixed(1)}% (${matchedTerms.length}/${queryTerms.length} terms matched)`);
    console.log(`   Query terms: [${queryTerms.join(', ')}]`);
    console.log(`   Matched: [${matchedTerms.join(', ')}]`);

    return relevanceScore;
  }

  needsWebSearch(query, contextResults = [], relevanceThreshold = 20) {
    const relevance = this.calculateRelevance(query, contextResults);
    if (relevance < relevanceThreshold) {
      console.log(`Relevance ${relevance.toFixed(1)}% < ${relevanceThreshold}% threshold → WEB SEARCH NEEDED`);
      return true;
    }

    const timeIndicators = [
      /latest|current|recent|today|now|2024|2025|2026/i,
      /price|cost|weather|news|stock/i,
    ];

    const needsCurrentInfo = timeIndicators.some(pattern => pattern.test(query));
    if (needsCurrentInfo) {
      console.log(`Query needs current information → WEB SEARCH NEEDED`);
      return true;
    }

    console.log(`✓ Relevance ${relevance.toFixed(1)}% ≥ ${relevanceThreshold}% threshold → USING CONTEXT ONLY`);
    return false;
  }
}

export default WebSearchService;
