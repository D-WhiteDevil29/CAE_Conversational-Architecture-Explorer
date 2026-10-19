#!/usr/bin/env node

/**
 * Quick test script for local context ingestion
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testIngestion() {
  console.log('Testing local context ingestion...\n');
  
  const contextDir = path.join(__dirname, 'data', 'context');
  
  try {
    await fs.access(contextDir);
    console.log('Context directory exists');
    
    // Read JSON files
    const files = await fs.readdir(contextDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} JSON files:`);
    
    let totalDocs = 0;
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(contextDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        const docs = Array.isArray(data) ? data : [data];
        totalDocs += docs.length;
        
        console.log(`  ✓ ${file}: ${docs.length} documents`);
        
        for (const doc of docs) {
          if (!doc.content || !doc.source) {
            console.warn(` Invalid document in ${file}: missing content or source`);
          }
        }
      } catch (error) {
        console.error(`  ✗ Error loading ${file}:`, error.message);
      }
    }
    
    console.log(`\nTotal: ${totalDocs} documents ready for ingestion`);
    console.log('\nRun "npm run ingest" to load these into the system');
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('Context directory not found');
      console.log('Create Model/data/context/ folder and add JSON files');
    } else {
      console.error('Error:', error.message);
    }
  }
}

testIngestion();
