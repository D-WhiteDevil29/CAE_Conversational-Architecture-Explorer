import JiraClient from '../clients/JiraClient.js';
import ConfluenceClient from '../clients/ConfluenceClient.js';
import BambooClient from '../clients/BambooClient.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DataIngestion {
  constructor() {
    this.jiraClient = new JiraClient();
    this.confluenceClient = new ConfluenceClient();
    this.bambooClient = new BambooClient();
    this.documents = [];
  }

  async ingestLocalContext() {
    console.log('Starting local context ingestion...');
    
    const contextDir = path.join(__dirname, '..', 'data', 'context');
    
    try {
      await fs.access(contextDir);
      
      const jsonFiles = await this.findJsonFiles(contextDir);
      
      console.log(`Found ${jsonFiles.length} JSON files in context folder (including subdirectories)`);
      
      let totalDocs = 0;
      
      for (const filePath of jsonFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          
          const docs = Array.isArray(data) ? data : [data];
          
          for (const doc of docs) {
            if (!doc.content || !doc.source) {
              console.warn(`Skipping invalid document in ${path.basename(filePath)}: missing content or source`);
              continue;
            }
            
            if (!doc.id) {
              doc.id = uuidv4();
            }
            
            this.documents.push(doc);
            totalDocs++;
          }
          
          const relativePath = path.relative(contextDir, filePath);
          console.log(`  ✓ Loaded ${docs.length} documents from ${relativePath}`);
        } catch (error) {
          console.error(`  ✗ Error loading ${path.basename(filePath)}:`, error.message);
        }
      }
      
      console.log(`Ingested ${totalDocs} documents from local context`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No local context folder found (data/context)');
        console.log('Create data/context/*.json files to add local data');
      } else {
        console.error('Error ingesting local context:', error.message);
      }
    }
  }

  async findJsonFiles(dir) {
    const jsonFiles = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.findJsonFiles(fullPath);
          jsonFiles.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          jsonFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error.message);
    }
    
    return jsonFiles;
  }

  async ingestJiraData() {
    if (!this.jiraClient.isConfigured()) {
      console.log('Jira not configured, skipping...');
      return;
    }

    console.log('Starting Jira data ingestion...');
    
    try {
      const searchResults = await this.jiraClient.getArchitectureIssues(100);
      console.log(`  Found ${searchResults.issues?.length || 0} architecture-related issues`);

      if (!searchResults.issues) return;

      for (const issue of searchResults.issues) {
        const doc = {
          id: uuidv4(),
          source: 'jira',
          sourceId: issue.key,
          type: 'issue',
          title: `${issue.key}: ${issue.fields.summary}`,
          content: this.formatJiraIssue(issue),
          metadata: {
            issueKey: issue.key,
            status: issue.fields.status?.name,
            priority: issue.fields.priority?.name,
            created: issue.fields.created,
            updated: issue.fields.updated,
            labels: issue.fields.labels || [],
            components: issue.fields.components?.map(c => c.name) || []
          }
        };

        this.documents.push(doc);
      }

      console.log(`Ingested ${searchResults.issues.length} Jira issues`);
    } catch (error) {
      console.error('Error ingesting Jira data:', error.message);
    }
  }

  async ingestConfluenceData() {
    if (!this.confluenceClient.isConfigured()) {
      console.log('Confluence not configured, skipping...');
      return;
    }

    console.log('Starting Confluence data ingestion...');
    
    try {
      const pages = await this.confluenceClient.getArchitectureDocs(50);
      console.log(`Found ${pages.length} architecture documentation pages`);

      for (const page of pages) {
        const doc = {
          id: uuidv4(),
          source: 'confluence',
          sourceId: page.id,
          type: 'documentation',
          title: page.title,
          content: this.confluenceClient.extractTextFromStorage(page.body?.storage?.value),
          metadata: {
            spaceKey: page.space?.key,
            spaceName: page.space?.name,
            version: page.version?.number,
            lastModified: page.version?.when
          }
        };

        this.documents.push(doc);
      }

      console.log(` Ingested ${pages.length} Confluence pages`);
    } catch (error) {
      console.error('Error ingesting Confluence data:', error.message);
    }
  }

  async ingestBambooData() {
    if (!this.bambooClient.isConfigured()) {
      console.log('Bamboo not configured, skipping...');
      return;
    }

    console.log('Starting Bamboo data ingestion...');
    
    try {
      const architectureBuilds = await this.bambooClient.getArchitectureBuilds();
      console.log(`  Found ${architectureBuilds.length} architecture build plans`);

      for (const plan of architectureBuilds) {
        try {
          const buildResults = await this.bambooClient.getBuildResults(plan.key, 10);
          
          const doc = {
            id: uuidv4(),
            source: 'bamboo',
            sourceId: plan.key,
            type: 'build-plan',
            title: `${plan.key}: ${plan.name}`,
            content: this.formatBambooPlan(plan, buildResults),
            metadata: {
              planKey: plan.key,
              planName: plan.name,
              enabled: plan.enabled,
              buildCount: buildResults.length,
              lastBuildState: buildResults[0]?.state,
              lastBuildTime: buildResults[0]?.buildCompletedTime
            }
          };

          this.documents.push(doc);
        } catch (err) {
          console.warn(`Could not fetch build results for ${plan.key}`);
        }
      }

      try {
        const { projects, summary } = await this.bambooClient.getDeploymentStatus();
        console.log(`  Found ${projects.length} deployment projects`);

        for (const project of projects) {
          const doc = {
            id: uuidv4(),
            source: 'bamboo',
            sourceId: project.id?.toString(),
            type: 'deployment-project',
            title: `Deployment: ${project.name}`,
            content: this.formatDeploymentProject(project, summary),
            metadata: {
              projectId: project.id,
              projectName: project.name,
              planKey: project.planKey?.key
            }
          };

          this.documents.push(doc);
        }
      } catch (err) {
        console.warn('Could not fetch deployment projects:', err.message);
      }

      const totalBambooDocs = architectureBuilds.length;
      console.log(` Ingested ${totalBambooDocs} Bamboo documents`);
    } catch (error) {
      console.error('Error ingesting Bamboo data:', error.message);
    }
  }

  formatBambooPlan(plan, buildResults = []) {
    const parts = [
      `Build Plan: ${plan.key}`,
      `Name: ${plan.name}`,
      `Enabled: ${plan.enabled ? 'Yes' : 'No'}`,
      `Type: CI/CD Pipeline`
    ];

    if (buildResults.length > 0) {
      parts.push(`Recent Builds: ${buildResults.length}`);
      
      const recentBuilds = buildResults.slice(0, 5).map((build, idx) => {
        return `  Build #${build.buildNumber}: ${build.state} - ${build.buildCompletedTime || 'In Progress'}`;
      });
      
      parts.push(`Build History:\n${recentBuilds.join('\n')}`);
      
      const successfulBuilds = buildResults.filter(b => b.state === 'Successful').length;
      const successRate = ((successfulBuilds / buildResults.length) * 100).toFixed(1);
      parts.push(`Success Rate: ${successRate}% (${successfulBuilds}/${buildResults.length})`);
    }

    return parts.join('\n');
  }

  formatDeploymentProject(project, summary = {}) {
    const parts = [
      `Deployment Project: ${project.name}`,
      `Project ID: ${project.id}`,
      `Plan Key: ${project.planKey?.key || 'N/A'}`
    ];

    if (summary.recentDeployments) {
      const projectDeployments = summary.recentDeployments.filter(
        d => d.projectName === project.name
      );
      
      if (projectDeployments.length > 0) {
        parts.push(`Recent Deployments: ${projectDeployments.length}`);
        
        const deploymentInfo = projectDeployments.slice(0, 5).map(dep => {
          return `  ${dep.environmentName}: ${dep.deploymentState} - ${dep.finishedDate || 'In Progress'}`;
        });
        
        parts.push(`Deployment History:\n${deploymentInfo.join('\n')}`);
      }
    }

    return parts.join('\n');
  }

  formatJiraIssue(issue) {
    const parts = [
      `Issue: ${issue.key}`,
      `Summary: ${issue.fields.summary}`,
      `Description: ${issue.fields.description || 'No description'}`,
      `Status: ${issue.fields.status?.name}`,
      `Priority: ${issue.fields.priority?.name}`,
      `Created: ${issue.fields.created}`,
      `Updated: ${issue.fields.updated}`
    ];

    if (issue.fields.components?.length > 0) {
      parts.push(`Components: ${issue.fields.components.map(c => c.name).join(', ')}`);
    }

    if (issue.fields.labels?.length > 0) {
      parts.push(`Labels: ${issue.fields.labels.join(', ')}`);
    }

    if (issue.fields.issuelinks?.length > 0) {
      const links = issue.fields.issuelinks.map(link => {
        const linkedIssue = link.outwardIssue || link.inwardIssue;
        const linkType = link.type?.name;
        return `${linkType}: ${linkedIssue?.key}`;
      }).join(', ');
      parts.push(`Links: ${links}`);
    }

    return parts.join('\n');
  }

  async saveDocuments() {
    const dataDir = path.join(__dirname, '..', 'data');
    
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
    }

    const filePath = path.join(dataDir, 'ingested-documents.json');
    
    await fs.writeFile(
      filePath, 
      JSON.stringify(this.documents, null, 2),
      'utf-8'
    );

    console.log(`Saved ${this.documents.length} documents to ingested-documents.json`);
    return this.documents;
  }

  async run() {
    console.log('Starting data ingestion pipeline...\n');
    
    const startTime = Date.now();

    await this.ingestLocalContext();
    
    await this.ingestJiraData();
    await this.ingestConfluenceData();
    await this.ingestBambooData();
    
    await this.saveDocuments();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nIngestion complete! Duration: ${duration}s`);
    console.log(`Total documents: ${this.documents.length}`);
    
    const bySource = this.documents.reduce((acc, doc) => {
      acc[doc.source] = (acc[doc.source] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nDocuments by source:');
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`  ${source}: ${count}`);
    });
    
    return {
      totalDocuments: this.documents.length,
      sources: Object.keys(bySource),
      bySource: bySource,
      duration: parseFloat(duration),
      timestamp: new Date().toISOString(),
      newDocuments: this.documents.length,
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ingestion = new DataIngestion();
  ingestion.run()
    .then(() => {
      console.log('\nIngestion pipeline completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nIngestion failed:', error);
      process.exit(1);
    });
}

export default DataIngestion;
