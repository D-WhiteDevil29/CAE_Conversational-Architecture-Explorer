import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class ConfluenceClient {
  constructor() {
    this.baseURL = process.env.CONFLUENCE_BASE_URL;
    this.email = process.env.CONFLUENCE_EMAIL;
    this.apiToken = process.env.CONFLUENCE_API_TOKEN;
    
    if (this.baseURL && this.email && this.apiToken) {
      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.email}:${this.apiToken}`).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    }
  }

  isConfigured() {
    return !!(this.baseURL && this.email && this.apiToken);
  }

  async searchPages(cql, limit = 25) {
    if (!this.isConfigured()) {
      console.warn('Confluence not configured');
      return [];
    }

    try {
      const response = await this.client.get('/rest/api/content/search', {
        params: {
          cql,
          limit,
          expand: 'body.storage,version,space'
        }
      });
      return response.data.results;
    } catch (error) {
      console.error('Error searching Confluence pages:', error.message);
      throw error;
    }
  }

  async getPage(pageId) {
    if (!this.isConfigured()) {
      throw new Error('Confluence not configured');
    }

    try {
      const response = await this.client.get(`/rest/api/content/${pageId}`, {
        params: {
          expand: 'body.storage,version,space,ancestors'
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching page ${pageId}:`, error.message);
      throw error;
    }
  }

  async getArchitectureDocs(limit = 50) {
    const cql = `type=page AND (title ~ "architecture" OR title ~ "design" OR title ~ "technical" OR text ~ "microservice")`;
    return this.searchPages(cql, limit);
  }

  extractTextFromStorage(storageValue) {
    if (!storageValue) return '';
    
    return storageValue
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async getSpacePages(spaceKey, limit = 25) {
    if (!this.isConfigured()) {
      console.warn('Confluence not configured');
      return [];
    }

    try {
      const response = await this.client.get('/rest/api/content', {
        params: {
          spaceKey,
          limit,
          expand: 'body.storage,version'
        }
      });
      return response.data.results;
    } catch (error) {
      console.error(`Error fetching pages from space ${spaceKey}:`, error.message);
      throw error;
    }
  }
}

export default ConfluenceClient;
