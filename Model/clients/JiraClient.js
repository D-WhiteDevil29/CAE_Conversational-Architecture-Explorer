import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class JiraClient {
  constructor() {
    this.baseURL = process.env.JIRA_BASE_URL;
    this.email = process.env.JIRA_EMAIL;
    this.apiToken = process.env.JIRA_API_TOKEN;
    
    if (this.isConfigured()) {
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

  async getProjects(maxResults = 50) {
    try {
      const response = await this.client.get('/rest/api/3/project', {
        params: { maxResults }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching projects:', error.message);
      throw error;
    }
  }

  async searchIssues(jql, maxResults = 100, fields = ['summary', 'description', 'status', 'assignee', 'reporter', 'created', 'updated', 'priority', 'issuelinks']) {
    try {
      const response = await this.client.post('/rest/api/3/search', {
        jql,
        maxResults,
        fields
      });
      return response.data;
    } catch (error) {
      console.error('Error searching issues:', error.message);
      throw error;
    }
  }

  async getIssue(issueKey) {
    try {
      const response = await this.client.get(`/rest/api/3/issue/${issueKey}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching issue ${issueKey}:`, error.message);
      throw error;
    }
  }

  async getIssueLinks(issueKey) {
    try {
      const issue = await this.getIssue(issueKey);
      return issue.fields.issuelinks || [];
    } catch (error) {
      console.error(`Error fetching links for ${issueKey}:`, error.message);
      throw error;
    }
  }

  async getProjectIssues(projectKey, maxResults = 100) {
    const jql = `project = ${projectKey} ORDER BY created DESC`;
    return this.searchIssues(jql, maxResults);
  }

  async getProjectComponents(projectKey) {
    try {
      const response = await this.client.get(`/rest/api/3/project/${projectKey}/components`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching components for ${projectKey}:`, error.message);
      throw error;
    }
  }

  async getArchitectureIssues(maxResults = 100) {
    const jql = `text ~ "architecture OR microservice OR service OR API OR integration OR dependency" ORDER BY updated DESC`;
    return this.searchIssues(jql, maxResults);
  }
}

export default JiraClient;
