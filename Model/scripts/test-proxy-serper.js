import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';

dotenv.config();

async function testWithProxyAgent() {
  const apiKey = process.env.SERPER_API_KEY || '0a8976dcf8b89ae86261233d65f7bf71e651beae';
  const proxyUrl = process.env.https_proxy || process.env.http_proxy;
  
  console.log('Testing Serper API with HttpsProxyAgent');
  console.log(`   Proxy: ${proxyUrl ? proxyUrl.replace(/:[^:]*@/, ':***@') : 'NONE'}`);
  console.log(`   API Key: ${apiKey.substring(0, 10)}...`);
  console.log('');

  try {
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
    
    const response = await axios.post(
      'https://google.serper.dev/search',
      {
        q: 'dhurandhar 2025 hindi movie cast',
        num: 5,
      },
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        httpsAgent: agent,
        timeout: 15000,
      }
    );

    console.log('SUCCESS!\n');
    console.log(`Found ${response.data.organic?.length || 0} results:`);
    
    response.data.organic?.slice(0, 3).forEach((result, idx) => {
      console.log(`\n${idx + 1}. ${result.title}`);
      console.log(`   ${result.snippet.substring(0, 100)}...`);
    });
    
    console.log(`\nCredits used: ${response.data.credits}`);
    
  } catch (error) {
    console.error('\nFAILED:', error.message);
    if (error.code) console.error(`   Error code: ${error.code}`);
    if (error.response) {
      console.error(`   HTTP Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data)}`);
    }
  }
}

testWithProxyAgent();
