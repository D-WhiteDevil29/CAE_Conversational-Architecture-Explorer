import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class BambooClient {
  constructor() {
    this.baseURL = process.env.BAMBOO_BASE_URL;
    this.token = process.env.BAMBOO_TOKEN;
    this.username = process.env.BAMBOO_USERNAME;
    
    if (this.baseURL && (this.token || this.username)) {
      const authConfig = this.token 
        ? { 'Authorization': `Bearer ${this.token}` }
        : { 'Authorization': `Basic ${Buffer.from(`${this.username}:${this.token}`).toString('base64')}` };
      
      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          ...authConfig,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    }
  }

  isConfigured() {
    return !!(this.baseURL && this.token);
  }

  /**
   * Get all deployment projects
   */
  async getDeploymentProjects(maxResults = 50) {
    if (!this.isConfigured()) {
      console.warn(' Bamboo not configured');
      return [];
    }

    try {
      const response = await this.client.get('/rest/api/latest/deploy/project/all', {
        params: { max: maxResults }
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching deployment projects:', error.message);
      throw error;
    }
  }

  async getEnvironments(projectId) {
    if (!this.isConfigured()) {
      throw new Error('Bamboo not configured');
    }

    try {
      const response = await this.client.get(`/rest/api/latest/deploy/project/${projectId}`);
      return response.data.environments || [];
    } catch (error) {
      console.error(`Error fetching environments for project ${projectId}:`, error.message);
      throw error;
    }
  }

  async getDeploymentResults(environmentId, maxResults = 25) {
    if (!this.isConfigured()) {
      throw new Error('Bamboo not configured');
    }

    try {
      const response = await this.client.get(`/rest/api/latest/deploy/environment/${environmentId}/results`, {
        params: { max: maxResults, expand: 'results' }
      });
      return response.data.results || [];
    } catch (error) {
      console.error(`Error fetching deployment results for environment ${environmentId}:`, error.message);
      throw error;
    }
  }

  async getBuildPlans(maxResults = 100) {
    if (!this.isConfigured()) {
      console.warn(' Bamboo not configured');
      return [];
    }

    try {
      const response = await this.client.get('/rest/api/latest/plan', {
        params: { 
          'max-results': maxResults,
          expand: 'plans.plan'
        }
      });
      return response.data.plans?.plan || [];
    } catch (error) {
      console.error('Error fetching build plans:', error.message);
      throw error;
    }
  }

  async getBuildResults(planKey, maxResults = 25) {
    if (!this.isConfigured()) {
      throw new Error('Bamboo not configured');
    }

    try {
      const response = await this.client.get(`/rest/api/latest/result/${planKey}`, {
        params: { 
          'max-results': maxResults,
          expand: 'results.result'
        }
      });
      return response.data.results?.result || [];
    } catch (error) {
      console.error(`Error fetching build results for ${planKey}:`, error.message);
      throw error;
    }
  }

  async getPlanDetails(planKey) {
    if (!this.isConfigured()) {
      throw new Error('Bamboo not configured');
    }

    try {
      const response = await this.client.get(`/rest/api/latest/plan/${planKey}`, {
        params: {
          expand: 'stages.stage.plans.plan,branches,variableContext'
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching plan ${planKey}:`, error.message);
      throw error;
    }
  }

  async getArchitectureBuilds(keywords = ['kenan', 'ecom', 'esom', 'api', 'service'], maxResults = 50) {
    if (!this.isConfigured()) {
      console.warn(' Bamboo not configured');
      return [];
    }

    try {
      const plans = await this.getBuildPlans(maxResults);
      
      const architecturePlans = plans.filter(plan => {
        const planName = (plan.name || '').toLowerCase();
        const planKey = (plan.key || '').toLowerCase();
        
        return keywords.some(keyword => 
          planName.includes(keyword.toLowerCase()) || 
          planKey.includes(keyword.toLowerCase())
        );
      });

      console.log(`  Found ${architecturePlans.length} architecture-related build plans`);
      return architecturePlans;
    } catch (error) {
      console.error('Error searching architecture builds:', error.message);
      return [];
    }
  }

  async getDeploymentStatus() {
    if (!this.isConfigured()) {
      console.warn(' Bamboo not configured');
      return { projects: [], summary: {} };
    }

    try {
      const projects = await this.getDeploymentProjects(25);
      const summary = {
        totalProjects: projects.length,
        environments: [],
        recentDeployments: []
      };

      for (const project of projects.slice(0, 5)) { 
        try {
          const environments = await this.getEnvironments(project.id);
          summary.environments.push(...environments);

          for (const env of environments.slice(0, 2)) {
            try {
              const deployments = await this.getDeploymentResults(env.id, 5);
              summary.recentDeployments.push(...deployments.map(d => ({
                ...d,
                projectName: project.name,
                environmentName: env.name
              })));
            } catch (err) {
              console.warn(`  Could not fetch deployments for env ${env.id}`);
            }
          }
        } catch (err) {
          console.warn(`  Could not fetch environments for project ${project.id}`);
        }
      }

      return { projects, summary };
    } catch (error) {
      console.error('Error getting deployment status:', error.message);
      return { projects: [], summary: {} };
    }
  }
}

export default BambooClient;
