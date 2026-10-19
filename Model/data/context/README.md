# Local Context Data

This folder contains local JSON files that will be ingested by the CAE model for training and context.

## Purpose

The `data/context/` folder allows you to manually add structured data (Confluence docs, Jira issues, Bamboo pipelines, or any custom data) in JSON format. This data will be automatically loaded during the ingestion process.

## File Format

Each JSON file should contain an array of document objects with the following structure:

```json
[
  {
    "id": "unique-id",           // Optional - will be auto-generated if missing
    "title": "Document Title",   // Required
    "content": "Document content text...",  // Required - main text for RAG
    "source": "confluence",      // Required - source type (confluence/jira/bamboo/custom)
    "sourceId": "source-doc-id", // Optional - original document ID
    "type": "documentation",     // Optional - document type
    "metadata": {                // Optional - additional metadata
      "author": "John Doe",
      "created": "2026-03-15",
      "tags": ["architecture", "api"]
    }
  }
]
```

## Required Fields

- **content**: The main text content that will be used for semantic search and answering questions
- **source**: Source type identifier (e.g., "confluence", "jira", "bamboo", "custom")
- **title**: Document title for reference in responses

## Sample Files

Three sample files are provided:
- `confluence-sample.json` - Confluence documentation examples
- `jira-sample.json` - Jira issue examples
- `bamboo-sample.json` - Bamboo CI/CD pipeline examples

## Usage

### 1. Add Your Data Files

Create JSON files in this folder:
```bash
cd Model/data/context
# Create your own JSON files
touch my-architecture-docs.json
touch my-api-specs.json
```

### 2. Run Ingestion

From the Model directory:
```bash
npm run ingest
```

This will:
- Load all JSON files from `data/context/`
- Fetch data from Jira/Confluence/Bamboo (if configured)
- Process and save to `data/ingested-documents.json`
- Build vector embeddings for semantic search

### 3. Start the Model Server

```bash
npm run dev
```

The model will now use your local context to answer questions!

## Automatic vs Manual Training

### Automatic Training
When you run `npm run ingest`, the system automatically:
1. Loads all data from context folder
2. Fetches from external APIs (if configured)
3. Processes and chunks the text
4. Creates embeddings for semantic search

### Manual Training
You can re-run ingestion anytime to update the model's knowledge:
```bash
npm run ingest
```

The model server will detect the new `ingested-documents.json` and reload it on the next query.

## Example: Adding Custom Architecture Data

```json
[
  {
    "title": "Payment Gateway Integration",
    "content": "The Payment Gateway connects to PaymentService via REST API. It handles credit card processing, refunds, and payment status callbacks. The service uses asynchronous processing with message queues for reliability. Integration points include OrderService for order confirmation and NotificationService for payment receipts.",
    "source": "custom",
    "sourceId": "custom-payment-001",
    "type": "architecture",
    "metadata": {
      "systems": ["PaymentService", "OrderService", "NotificationService"],
      "author": "Architecture Team",
      "lastUpdated": "2026-03-15"
    }
  }
]
```

## Tips

1. **Keep content focused**: Each document should cover a specific topic
2. **Use descriptive titles**: Titles appear in source citations in the UI
3. **Add metadata**: Helps with filtering and context in the future
4. **Regular updates**: Re-run ingestion when you add new files
5. **Validate JSON**: Ensure your JSON files are valid before ingestion

## Troubleshooting

**No documents ingested?**
- Check that files have `.json` extension
- Validate JSON syntax (use a JSON validator)
- Ensure `content` and `source` fields are present

**Model giving generic answers?**
- Verify ingestion ran successfully
- Check `data/ingested-documents.json` exists
- Ensure model server restarted after ingestion

**Want to clear context?**
- Delete files from `data/context/`
- Run `npm run ingest` again
- Restart model server

## Next Steps

In the future, the system will:
- Automatically fetch and update data from Confluence, Jira, and Bamboo
- Schedule automatic re-ingestion (daily/weekly)
- Support incremental updates without full re-ingestion
- Provide a UI to manage context data
