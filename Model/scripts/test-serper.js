import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testSerperSearch() {
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey) {
    console.error('SERPER_API_KEY not found in .env file');
    return;
  }

  console.log('Testing Serper API with query: "dhurandhar hindi movie"\n');

  try {
    const response = await axios.post(
      'https://google.serper.dev/search',
      {
        q: 'dhurandhar hindi movie',
        num: 5,
      },
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log('Serper API Response:\n');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\nParsed Results:');
    if (response.data.organic) {
      response.data.organic.forEach((result, idx) => {
        console.log(`\n${idx + 1}. ${result.title}`);
        console.log(`   URL: ${result.link}`);
        console.log(`   Snippet: ${result.snippet}`);
      });
    }
    
    console.log(`\nCredits used: ${response.data.credits || 1}`);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSerperSearch();
