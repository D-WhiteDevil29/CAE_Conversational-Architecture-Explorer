import DataIngestion from './ingestion/DataIngestion.js';

console.log('Starting ingestion test...\n');

const ingestion = new DataIngestion();

try {
  await ingestion.run();
  console.log('\nSuccess!');
} catch (error) {
  console.error('\nError:', error);
  console.error(error.stack);
}

process.exit(0);
