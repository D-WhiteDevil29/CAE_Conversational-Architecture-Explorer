import axios from 'axios';

const data = JSON.stringify({
  "q": "dhurandhar 2025 hindi movie cast",
  "gl": "in"
});

const config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://google.serper.dev/search',
  headers: { 
    'X-API-KEY': '0a8976dcf8b89ae86261233d65f7bf71e651beae', 
    'Content-Type': 'application/json'
  },
  data: data
};

async function makeRequest() {
  try {
    console.log('🔍 Testing Serper API...');
    const response = await axios.request(config);
    console.log('\n✅ SUCCESS! Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n📊 Results summary:');
    console.log(`   Found ${response.data.organic?.length || 0} results`);
    console.log(`   Credits used: ${response.data.credits}`);
  }
  catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

makeRequest();
