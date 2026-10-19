# CAE - Conversational Architecture Explorer

## What is CAE?

CAE is an intelligent assistant that helps you explore and understand your company's software architecture. Think of it as a smart chatbot that knows everything about your systems - how they work, how they connect, and what they do.

Instead of searching through hundreds of documents or asking multiple people for information, you can simply ask CAE questions like:
- "How does the ECOM service work?"
- "What databases does our payment system use?"
- "Show me the dependencies of the user authentication service"

CAE will give you accurate answers based on your company's actual documentation and even draw diagrams to visualize the connections.

---

## How Does It Work?

```
You ask a question
    ↓
CAE searches your company documents
    ↓
CAE finds the most relevant information
    ↓
CAE uses AI to create a clear answer
    ↓
You get the answer + a visual diagram
```

### The Magic Behind CAE

CAE combines three powerful technologies:

1. **Smart Search**: Like Google, but for your company documents
2. **AI Understanding**: Uses a language model (LLaMA 3.1) to understand and answer questions
3. **Visual Diagrams**: Automatically creates architecture diagrams from the information

---

## System Architecture

### Main Components

```
┌──────────────────────────────────────────────────┐
│                    CAE System                     │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌────────────┐              ┌────────────┐     │
│  │  Frontend  │  ◄───────►   │  Backend   │     │
│  │  (Website) │    HTTP      │  (Server)  │     │
│  └────────────┘              └──────┬─────┘     │
│                                     │            │
│                            ┌────────┴────────┐  │
│                            │                 │   │
│                     ┌──────▼──────┐  ┌──────▼──────┐
│                     │  Document   │  │    AI       │
│                     │  Search     │  │   Model     │
│                     │  System     │  │   (LLaMA)   │
│                     └─────────────┘  └─────────────┘
│                                                   │
└──────────────────────────────────────────────────┘
```

### How Information Flows

```
Step 1: You Type a Question
    ↓
Step 2: Frontend Sends Question to Backend
    ↓
Step 3: Backend Searches Company Documents
    ↓
Step 4: AI Model Reads Relevant Documents
    ↓
Step 5: AI Model Writes a Clear Answer
    ↓
Step 6: Backend Creates a Diagram
    ↓
Step 7: Frontend Shows You the Answer and Diagram
```

---

## Backend (The Server)

### What It Does

The backend is like the brain of CAE. It:
- Stores all your company documents
- Searches for relevant information
- Runs the AI model to generate answers
- Creates visual diagrams
- Handles all the heavy processing

### Key Features

**1. Document Storage**
- Keeps all your Jira tickets, Confluence pages, and Bamboo builds
- Stores uploaded PDFs, Word docs, and JSON files
- Organizes everything for quick searching

**2. Smart Search**
- Finds the most relevant documents for your question
- Uses meaning-based search (not just keywords)
- Returns the top 5 most relevant pieces of information

**3. AI Model (LLaMA 3.1)**
- Reads the found documents
- Understands your question
- Writes a clear, accurate answer
- Runs entirely on your computer (no internet needed for basic features)

**4. Web Search (Optional)**
- If your documents don't have the answer, CAE can search the internet
- Uses Google to find current information
- Shows you both internal and web sources

**5. Diagram Generator**
- Automatically detects services, databases, and APIs in the answer
- Creates a visual graph showing how they connect
- Makes it easy to understand complex architectures

### Technology Used

- **Node.js**: The runtime environment
- **Express**: Web server framework
- **LLaMA 3.1 8B**: The AI language model (8 billion parameters)
- **LangChain**: For document search and embeddings

### API Endpoints (URLs the frontend uses)

```
Chat with AI:
POST /api/chat
Send: Your question
Get: Answer + diagram + sources

Upload Documents:
POST /api/upload
Send: PDF, DOCX, or JSON files
Get: Confirmation

View Documents:
GET /api/documents
Get: List of all stored documents

Delete Documents:
DELETE /api/documents/:id
Delete a specific document

Check Health:
GET /health
Get: System status
```

---

## Frontend (The Website)

### What It Does

The frontend is what you see and interact with. It:
- Provides a clean, modern chat interface
- Shows AI responses with sources
- Displays interactive architecture diagrams
- Lets you manage documents
- Works in both light and dark modes

### Main Parts

**1. Chat Interface**
- Text input for your questions
- Voice input option (speak instead of type)
- Chat history showing all your conversations
- Source badges showing where information came from

**2. Architecture Graph**
- Interactive diagram of services and connections
- Zoom, pan, and explore
- Download as PNG or JSON
- Color-coded by component type

**3. Admin Dashboard**
- Upload new documents
- View all stored documents
- Monitor system health
- See trending searches
- Toggle settings

**4. Settings Panel**
- Switch between light and dark themes
- Enable/disable web search
- Toggle mock mode (for testing)
- View system information

### Technology Used

- **React**: Modern JavaScript framework
- **Vite**: Super fast build tool
- **TailwindCSS**: Beautiful styling
- **ReactFlow**: Interactive graph visualization
- **Framer Motion**: Smooth animations

---

## How CAE Answers Questions

### The Process

```
Your Question: "What is the ECOM service?"
    ↓
Step 1: Search Documents
    - CAE searches through all Jira, Confluence, Bamboo documents
    - Finds 5 most relevant pieces of information
    ↓
Step 2: Check Relevance
    - Are the documents actually about ECOM?
    - Score: 85% relevant (high)
    ↓
Step 3: Build Context
    - Combine the 5 document snippets
    - Add your question
    - Create a prompt for the AI
    ↓
Step 4: AI Processing
    - AI reads the context
    - Understands what ECOM does
    - Writes a clear explanation
    ↓
Step 5: Extract Components
    - Find mentioned services: "ECOM Service", "Payment API"
    - Find connections: "ECOM calls Payment API"
    ↓
Step 6: Create Diagram
    - Draw boxes for each service
    - Draw arrows for connections
    - Add labels
    ↓
Result: Answer + Diagram + Sources
```

### Hybrid Mode: When to Use Web Search

CAE has a smart hybrid mode:

```
Your Question Arrives
    ↓
Calculate Relevance (How related are your documents?)
    ↓
If Relevance < 20%:
    ├─► "I don't have enough information in the documents"
    ├─► Search Google for the answer
    ├─► Use web search results
    └─► Show green badges (web sources)
Else:
    ├─► "I found good information in your documents"
    ├─► Use company documents
    └─► Show blue badges (internal sources)
```

**Example:**

- Question: "What is ECOM service?" → Uses company docs (90% relevant)
- Question: "What is MongoDB?" → Uses company docs if you have MongoDB info
- Question: "Today's weather in Pune?" → Uses web search (0% relevant to your docs)

---

## Setting Up CAE

### What You Need

**Computer Requirements:**
- **RAM**: 16GB minimum (32GB better)
- **Storage**: 50GB free space
- **Processor**: Any modern CPU (8+ cores recommended)
- **Optional**: GPU for faster processing

**Software:**
- Node.js (version 18 or newer)
- Web browser (Chrome, Firefox, or Safari)
- Text editor (optional, for configuration)

### Step-by-Step Setup

#### Part 1: Backend Setup

1. **Install Node.js**
   - Download from nodejs.org
   - Install and verify: Open terminal, type `node --version`

2. **Download CAE**
   - Get the code from your company repository
   - Extract to a folder like `CAE`

3. **Install Backend**
   ```bash
   cd CAE/Model
   npm install
   ```
   This downloads all required libraries (takes 5-10 minutes)

4. **Get the AI Model**
   - Download LLaMA 3.1 8B model (15GB file)
   - Place in `Model` folder as `llama-3.1-8b.gguf`
   - Link: https://huggingface.co/meta-llama/Llama-3.1-8B-GGUF

5. **Configure Settings**
   Create a file called `.env` in the `Model` folder:
   ```
   GGUF_MODEL_PATH=./llama-3.1-8b.gguf
   HYBRID_MODE=true
   SERPER_API_KEY=your_google_search_key_here
   ```

6. **Add Your Documents**
   - Place JSON files in `Model/data/context/`
   - Can include Jira exports, Confluence exports, etc.

7. **Process Documents**
   ```bash
   npm run ingest
   ```
   This reads all your documents and prepares them for searching (takes 2-5 minutes)

8. **Start Backend**
   ```bash
   npm start
   ```
   You should see: "CAE Backend running on http://localhost:3000"

#### Part 2: Frontend Setup

1. **Install Frontend**
   ```bash
   cd CAE/UI
   npm install
   ```

2. **Configure Settings**
   Create a file called `.env` in the `UI` folder:
   ```
   VITE_API_URL=http://localhost:3000
   ```

3. **Start Frontend**
   ```bash
   npm run dev
   ```
   You should see: "Local: http://localhost:3001"

4. **Open in Browser**
   - Open your web browser
   - Go to `http://localhost:3001`
   - You should see the CAE login page

### First Time Login

**Default Credentials:**
- Username: `admin@example.com`
- Password: `admin123`

After login, you can:
1. Change your password in settings
2. Upload more documents
3. Start asking questions

---

##Using CAE

### Asking Questions

**Tips for Better Answers:**

1. **Be Specific**
   - Good: "What databases does the payment service use?"
   - Better: "What databases does the ECOM payment service use and why?"

2. **Use System Names**
   - Good: "Tell me about the user service"
   - Better: "Explain the UserAuthService architecture"

3. **Ask Follow-ups**
   - CAE remembers your conversation
   - You can ask related questions without repeating context

**Question Types CAE Handles Well:**

- Architecture questions: "How does X work?"
- Component questions: "What does Y do?"
- Connection questions: "How does A connect to B?"
- Technical questions: "What technology does Z use?"
- Comparison questions: "What's the difference between X and Y?"

### Understanding Responses

**Source Badges:**
- Blue badges = Information from your company documents
- Green badges with globe = Information from web search
- Click a badge to see the original source

**Architecture Diagrams:**
- Purple boxes = Services
- Blue boxes = APIs
- Green boxes = Databases
- Yellow boxes = Message queues
- Arrows = Connections between components
- Labels on arrows = Type of connection

### Using the Admin Dashboard

**Upload Documents:**
1. Click "Admin" button (top right)
2. Go to "Documents" tab
3. Click "Upload Documents"
4. Select PDF, DOCX, or JSON files
5. Wait for processing to complete

**Manage Documents:**
- View all uploaded documents
- See when they were added
- Delete documents you no longer need
- Check how many pieces of information each document contains

**Monitor System:**
- Check if backend is running
- See response times
- View recent searches
- Toggle settings

### Exporting Architecture Diagrams

1. View a diagram in the chat
2. Click the "Export" button (top right of diagram)
3. Choose format:
   - PNG: Image file for presentations
   - JSON: Data file for developers
4. File saves to your Downloads folder

---

## Advanced Features

### Context-Only Mode

Sometimes you only want answers from your company documents, not the internet.

**How to Enable:**
1. Go to Admin Dashboard
2. Look for "RAG Mode" section
3. Click "Enable Context-Only"
4. Now CAE will only use your documents

**When to Use:**
- Sensitive information (shouldn't search web)
- Internal system documentation
- Company-specific questions
- When accuracy is critical

### Mock Mode

For testing without waiting for AI responses.

**How to Enable:**
1. Go to Admin Dashboard
2. Look for "Model Mode" section
3. Click "Enable Mock Mode"
4. Now CAE gives instant fake responses

**When to Use:**
- Testing the interface
- Demonstrating without backend
- Developing new features
- Training users

### Trending Searches

See what people are asking about.

**How to View:**
1. Go to Admin Dashboard
2. Click "Trending" tab
3. Select time range (24h, 7d, 30d)
4. See:
   - Most searched topics
   - How many times searched
   - When last searched

**Why It's Useful:**
- Discover which systems people are interested in
- Find documentation gaps
- Understand what's confusing people
- Plan documentation improvements

---

## Troubleshooting

### Common Problems

**Problem: "Cannot connect to backend"**
- Check if backend is running: Open terminal, run `npm start` in Model folder
- Check if port 3000 is in use by another program
- Verify VITE_API_URL in UI/.env matches backend URL

**Problem: "Loading model" takes forever**
- First time loading takes 15-30 seconds (normal)
- Make sure you have 16GB+ RAM
- Check that llama-3.1-8b.gguf file exists and is 15GB
- Close other memory-heavy programs

**Problem: **No documents found"**
- Run ingestion: `npm run ingest` in Model folder
- Check that data/ingested-documents.json exists
- Verify JSON files are in data/context/ folder
- Look at terminal for error messages during ingestion

**Problem: "Diagram not showing"**
- Check if the answer mentions any services or components
- Try asking a more specific architecture question
- Refresh the page
- Check browser console for error messages (F12)

**Problem: "Web search not working"**
- Verify SERPER_API_KEY in .env file
- Check internet connection
- Look for special characters in your question
- Try a simpler question first

### Getting Help

**Check the Logs:**

Backend logs (in terminal where you ran `npm start`):
- Shows what CAE is doing
- Displays any errors
- Shows search results and relevance scores

Browser console (press F12):
- Shows frontend errors
- Displays API requests
- Shows what data is being sent/received

**System Health Check:**
1. Go to Admin Dashboard
2. Look at "Health Check" section
3. All items should be green
4. If something is red, click it for more details

---

## Understanding the Technology

### What is RAG?

RAG stands for Retrieval-Augmented Generation. It's a technique that makes AI more accurate by:

1. **Retrieval**: Find relevant documents from your database
2. **Augmentation**: Add those documents to your question
3. **Generation**: Have AI read everything and write an answer

**Why RAG is Better Than Regular AI:**
- Regular AI only knows what it was trained on (might be outdated)
- RAG AI reads your specific, up-to-date documents
- More accurate for company-specific information
- Can cite sources (shows where information came from)

### How the AI Works

The AI (LLaMA 3.1 8B) is like a very smart assistant that:
- Has read billions of pages of text
- Understands language, code, and technical concepts
- Can write clear explanations
- Follows instructions precisely

**8B means:**
- 8 billion parameters (connection points in the AI)
- Like a brain with 8 billion neurons
- Smaller than GPT-4 but runs on your computer
- Good balance of speed and intelligence

### What is GGUF?

GGUF is a file format for AI models that:
- Compresses the model to use less disk space
- Makes it run faster on regular computers
- Works with Apple Silicon (M1, M2, M3 chips)
- Doesn't need internet to work

The llama-3.1-8b.gguf file is the entire AI brain in one file!

### Vector Search

Instead of searching for exact word matches, vector search:
- Converts text to numbers (embeddings)
- Finds documents with similar meanings
- Works even if different words are used
- Much more intelligent than keyword search

**Example:**
- Your question: "How does authentication work?"
- Finds documents about: "User login system", "Authorization service", "Identity management"
- Even though they use different words, the meaning is similar

---

## Best Practices

### Maintaining CAE

**Regular Tasks:**

**Weekly:**
- Upload new documents that were created
- Review trending searches to see what people need
- Check admin dashboard for any issues

**Monthly:**
- Delete outdated documents
- Re-run ingestion if you've added many documents
- Update the AI model if new version available
- Review and update configuration

**Quarterly:**
- Evaluate which documents are most useful
- Consider expanding document sources
- Review user feedback
- Plan improvements

### Security

**Keep It Secure:**
- Change default password immediately
- Only give admin access to trusted people
- Don't expose backend port to internet
- Keep sensitive documents in context-only mode
- Regularly update Node.js and dependencies

**Data Privacy:**
- Documents stay on your computer
- AI model runs locally
- Only web search goes to internet (if enabled)
- No chat history sent to external services

### Performance Tips

**For Faster Responses:**
- Close other memory-heavy applications
- Use fewer documents (keep only relevant ones)
- Enable GPU acceleration if available
- Ask more specific questions
- Use context-only mode when possible

**For Better Accuracy:**
- Keep documents up-to-date
- Add more relevant documents
- Use clear, consistent naming in documents
- Include relationship information
- Regularly review and improve documentation

---

## Future Improvements

### Planned Features

**Coming Soon:**
- Streaming responses (see answer as it's being written)
- Chat history across sessions
- Multiple AI models to choose from
- Image support in documents
- Better graph layouts
- Export chat conversations
- Mobile-friendly interface

**Under Consideration:**
- Team collaboration features
- Document version control
- Automated document fetching
- Natural language diagram updates
- Voice output (AI reads answers)
- Multiple language support

---

## Getting Support

### Resources

- **Technical Documentation**: README-TECHNICAL.md (detailed technical guide)
- **Setup Guide**: This document
- **API Documentation**: See README-TECHNICAL.md, API Specifications section
- **Troubleshooting**: See Troubleshooting section above

### Contact

For issues, questions, or suggestions:
1. Check the troubleshooting section first
2. Look at backend/frontend logs
3. Review the technical documentation
4. Try the mock mode to isolate problems
5. Check system health in admin dashboard

---

## Summary

CAE is your intelligent assistant for understanding software architecture. It:

- Searches your company documents
- Uses AI to generate clear answers
- Creates visual architecture diagrams
- Runs entirely on your computer
- Learns from your specific documentation

By combining document search, AI intelligence, and visual diagrams, CAE makes it easy to understand complex systems and find the information you need.

The system has two main parts:
1. **Backend**: Stores documents, runs AI, searches for information
2. **Frontend**: Beautiful interface for asking questions and viewing results

With proper setup and maintenance, CAE becomes an invaluable tool for developers, architects, and anyone who needs to understand your systems.

Start exploring your architecture today with CAE!
