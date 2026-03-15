# Aegis Intelligence Platform

A production-grade OSINT (Open Source Intelligence) platform with advanced AI-powered research capabilities, multi-engine search, social media scraping, and comprehensive intelligence reporting. Features a sophisticated multi-agent Swarm Intelligence system inspired by OpenAI Deep Research and Google Deep Research, with Perplexity-style inline citations and real-time streaming.

## 🚀 Features

### Core Capabilities

#### Multi-Mode Search
- **Text Search**: Enhanced preliminary search with rich profile previews and persona differentiation
  - **Rich Profile Previews**: Avatar images, bio snippets, follower/following stats, and recent post previews
  - **Multi-Platform Discovery**: Cross-platform username checking with instant preview data
  - **Smart Profile Selection**: Select specific profiles for focused deep analysis
  - **Persona Classification**: AI-powered persona detection (developer, musician, artist, business, academic)
  - **Query Analysis**: Intelligent search strategy based on entity type and profession hints
- **Image Search**: Reverse image search with OCR capabilities and visual analysis
- **Deep Research**: AI-powered comprehensive research with iterative quality improvement
- **Username Checking**: Cross-platform username availability checker (Instagram, Twitter/X, LinkedIn, TikTok, GitHub, Reddit) with rich preview data extraction

#### Enhanced Swarm Intelligence Research System

The platform features a sophisticated multi-agent system that works collaboratively to produce high-quality research:

**Core Agents:**
- **The Architect**: Strategic planning, query decomposition, and research roadmap creation
- **The Scout**: Exhaustive information retrieval with source credibility filtering and advanced search operators
- **The Quant**: Financial domain expertise with market analysis, technical indicators, and statistical analysis
- **The Logician**: Fact validation, contradiction detection, fallacy identification, and logical reasoning chains
- **The Thinker**: Final report synthesis with structured narratives, executive summaries, and visualizations

**Specialized Agents:**
- **Rapid Analyst**: Generates quick initial responses (Perplexity-style) while deep research continues in background
- **The Critic**: Reviews research quality, identifies weaknesses, and suggests improvements
- **Hypothesis Agent**: Generates testable hypotheses and identifies research gaps
- **Vision Agent**: Multi-modal analysis of images, charts, and infographics with OCR and data extraction
- **Citation Agent**: Extracts and verifies inline citations with source reliability scoring
- **Predictor Agent**: Generates predictions based on historical data and trends
- **Research Planner**: Advanced planning for complex multi-step research tasks
- **Research Detective**: Deep analysis and pattern detection in research findings
- **Fact Checker**: Dedicated fact verification and source triangulation

**Research Tools Available to Agents:**
- **Web Search**: Multi-engine web search via SearXNG
- **Academic Search**: Search academic databases (arXiv, PubMed, Google Scholar)
- **News Tool**: Real-time news aggregation and analysis
- **Finance Tool**: Stock data, market analysis, financial metrics
- **Wikipedia Tool**: Structured knowledge retrieval
- **Document Tool**: PDF, DOCX, XLSX document parsing
- **PDF Extractor**: Deep PDF parsing with structure extraction
- **Image Analysis**: OCR, chart data extraction, object detection
- **Calculator Tool**: Mathematical computations and statistical analysis
- **Sentiment Tool**: Sentiment analysis of text and news
- **Statistics Tool**: Statistical analysis and data processing

**Advanced Research Features:**
- **Iterative Research Loop**: Automatically refines research based on quality and completeness scores (up to 15 iterations)
- **Real-time Streaming**: WebSocket-based streaming of research progress, citations, and partial results
- **Inline Citations**: Perplexity-style citations with hover previews and source reliability indicators
- **Follow-up Questions**: AI-generated contextual follow-up questions for deeper exploration
- **Rapid Response System**: Two-stage model providing quick initial answers while background research continues
- **Quality Scoring**: Automatic quality and completeness scoring with threshold-based iteration control
- **Multi-modal Analysis**: Processing of images, charts, and infographics alongside text
- **Source Credibility Filtering**: Automatic source reliability assessment (high/medium/low)
- **Contradiction Detection**: Identifies conflicting information and provides resolution strategies
- **Fallacy Detection**: Identifies logical fallacies in arguments and reasoning

#### Social Media Intelligence

- **Platform Support**: Instagram, Facebook, Twitter/X, LinkedIn, TikTok, GitHub, Reddit
- **Authenticated Scraping**: Cookie-based authentication for private profiles
- **Enhanced Profile Previews**: 
  - **Avatar Images**: Profile pictures extracted and displayed prominently
  - **Bio Extraction**: Full bio text with location, profession, and interest detection
  - **Statistics**: Follower/following counts, post counts, repository counts
  - **Recent Post Previews**: Latest post images and captions for quick context
  - **Language Detection**: Automatic language identification from bio content
  - **Hashtag Extraction**: Interest detection from hashtags and keywords
- **Username Availability**: Cross-platform username checking with instant preview data
- **Profile Selection**: Select specific profiles from preliminary search for focused deep analysis
- **Relationship Mapping**: Social network analysis and relationship detection
- **Face Recognition**: AI-powered face detection and cross-referencing (Clarifai integration)
- **Activity Patterns**: Temporal analysis of posting patterns and engagement

#### OSINT Deep Search with Research Agents

The OSINT module now integrates the full research agent system for enhanced accuracy and professional reporting:

- **Research Agent Integration**: 
  - **The Architect**: Creates OSINT-specific research plans with social media deep dive strategies
  - **The Scout**: Enhanced information gathering with OSINT-specific methods:
    - Social media profile searches across multiple platforms
    - Public records and official document searches
    - News and media coverage searches with time ranges
    - Cross-reference analysis for pattern detection
  - **The Logician**: Validates OSINT findings, detects contradictions, and identifies logical fallacies
  - **Fact Checker**: Verifies key claims against multiple sources with confidence scoring
  - **The Critic**: Reviews research quality and identifies gaps for improvement
  - **Hypothesis Agent**: Generates testable hypotheses to fill research gaps
  - **Research Detective**: Finds hidden connections and correlations across platforms

- **Profile Verification**:
  - **ProfileVerificationAgent**: Dedicated agent for profile authenticity checking
  - Cross-platform consistency verification
  - Bot and impersonation detection
  - Red flag identification (inconsistent bio, suspicious activity, low engagement, etc.)
  - Authenticity scoring (0-100) with confidence levels

- **Accuracy Scoring**:
  - **AccuracyScorerService**: Multi-agent consensus-based accuracy calculation
  - Combines results from LogicianAgent, FactCheckerAgent, and CriticAgent
  - Factors include:
    - Multi-agent consensus (35% weight)
    - Source reliability (25% weight)
    - Cross-platform verification (15% weight)
    - Contradiction detection (15% weight)
    - Profile verification (10% weight)
  - Overall accuracy score (0-100) with confidence levels (high/medium/low)

- **Iterative Quality Improvement**:
  - Automatic quality refinement loop (max 3 iterations for OSINT)
  - Quality threshold-based iteration control
  - Gap identification and hypothesis testing
  - Additional research based on quality scores

- **Real-Time Streaming**:
  - WebSocket-based streaming of OSINT progress
  - Live agent progress updates
  - Real-time validation results
  - Quality score updates
  - Citation discovery as sources are found
  - Agent thinking process transparency

- **Professional OSINT Reporting**:
  - **Export Formats**: Professional PDF and Markdown reports
  - **Report Structure**:
    - Executive summary with key findings
    - Profile verification section with validation results
    - Cross-platform analysis
    - Risk assessment with Critic review
    - Timeline of activities
    - Relationship mapping
    - Source citations grouped by reliability
    - Research agent validation results
    - Accuracy scores and breakdown
    - Appendices with metadata
  - **OSINT-Specific Styling**: Intelligence-style formatting with professional typography
  - **Export Endpoints**: `GET /api/search/:id/export/pdf` and `/export/md`

- **Enhanced Agent Validation**:
  - **PersonaClassifierAgent**: Enhanced with LogicianAgent and CriticAgent validation
    - Adjusts confidence scores based on validation quality
    - Detects contradictions in persona classifications
  - **RelationshipAgent**: Enhanced with ScoutAgent and ResearchDetectiveAgent
    - Uses ScoutAgent to gather additional relationship data
    - Uses ResearchDetectiveAgent to find hidden connections and correlations

#### Reverse Lookup System

A comprehensive reverse lookup system (similar to ClarityCheck) that leverages AI agents and multi-source intelligence gathering to identify people, vehicles, properties, and locations from various identifiers.

**Supported Lookup Types:**

- **Phone Number Lookup**:
  - Person identification (name, age, location, profession)
  - Social media profiles associated with the number
  - Public records and data breach information
  - Web activity and digital footprint
  - Relationship mapping and connections
  - Location history and geolocation data

- **Email Address Lookup**:
  - Owner identification and profile information
  - Social media account discovery across platforms
  - Data breach detection and exposure history
  - Web activity and online presence
  - Persona classification (developer, business, academic, etc.)
  - Associated usernames and aliases

- **Image Reverse Lookup**:
  - Person identification from photos
  - Face recognition and matching (Clarifai integration)
  - Reverse image search across multiple engines
  - Visual content analysis (Vision Agent):
    - Text extraction (OCR)
    - Object detection
    - Context understanding
    - Chart and infographic analysis
  - Social media profile discovery
  - Relationship mapping from identified persons
  - Cross-referencing with other data sources

- **VIN (Vehicle Identification Number) Lookup**:
  - Vehicle information (make, model, year, trim)
  - Owner history and registration records
  - Accident and damage history
  - Theft and recovery records
  - Market value and specifications
  - Associated addresses and locations

- **Address Lookup**:
  - Current and past residents
  - Neighbor identification
  - Property information (ownership, value, history)
  - Public records and permits
  - Geographic analysis and mapping
  - Associated phone numbers and emails

**Advanced Features:**

- **LLM-Based Data Extraction**:
  - Replaced regex pattern matching with sophisticated LLM-based extraction
  - Uses ThinkerAgent for structured data extraction from search results
  - Handles unstructured and noisy data sources
  - Improved accuracy and flexibility over traditional parsing

- **Multi-Agent Intelligence**:
  - **ScoutAgent**: Enhanced information gathering with expanded search queries (10 per lookup type)
  - **ThinkerAgent**: Structured data extraction and synthesis
  - **LogicianAgent**: Fact validation and cross-referencing
  - **VisionAgent**: Image analysis and visual content understanding
  - **PersonaClassifierAgent**: Profile classification and persona detection
  - **RelationshipAgent**: Connection mapping and relationship detection
  - **ResearchDetectiveAgent**: Pattern detection and correlation analysis

- **Result Aggregation & Validation**:
  - **LookupAggregatorService**: Combines results from multiple sources
  - Deduplication and cross-validation
  - Confidence scoring based on source reliability
  - Relationship graph building
  - Timeline generation from collected data
  - Person identity consolidation

- **Resilience & Error Handling**:
  - Graceful degradation when external APIs fail
  - Rate limit handling (returns placeholders, continues processing)
  - Fallback mechanisms at multiple levels:
    - LLM extraction → Regex extraction
    - Primary search → Alternative search methods
    - Vision API → Basic image analysis
    - Face detection → Manual identification
  - Partial result return (never fails completely)
  - Comprehensive error logging with stack traces

- **Real-Time Streaming**:
  - WebSocket-based progress updates
  - Live agent progress notifications
  - Step-by-step lookup process visibility
  - Real-time result discovery

- **Professional Reporting**:
  - Export lookup results as PDF or Markdown
  - Structured reports with:
    - Executive summary
    - Identified persons with confidence scores
    - Relationship mapping
    - Timeline of events
    - Source citations
    - Validation results
  - Professional intelligence-style formatting

**Frontend Features:**

- **Unified Lookup Interface**: Single page for all lookup types
- **Tabbed Results Display**: Organized view of different data categories
- **Person Info Cards**: Rich display of identified individuals
- **Relationship Visualization**: Connection graphs and relationship mapping
- **Empty State Handling**: Informative messages when no results found
- **Error Recovery**: Retry functionality and clear error messages
- **Loading States**: Real-time progress indicators
- **Result Confidence**: Visual indicators for data reliability

**Technical Implementation:**

- **Service Architecture**: Modular services for each lookup type
- **Agent Integration**: Full integration with research agent system
- **Database Schema**: `ReverseLookupSession` and `PersonIdentity` models
- **API Endpoints**: RESTful endpoints for each lookup type
- **Authentication**: JWT-based authentication for all endpoints
- **Rate Limiting**: Throttling to prevent abuse
- **Image Upload**: Secure authenticated image upload with MinIO storage
- **Base64 Conversion**: Automatic conversion of localhost images for vision APIs

#### Document Processing

- **Supported Formats**: PDF, DOCX, XLSX
- **OCR Capabilities**: Text extraction from image-based documents
- **Full-text Extraction**: Complete document content extraction
- **Structure Analysis**: Document structure and metadata extraction
- **Deep PDF Parsing**: Advanced PDF analysis with table and chart extraction

#### Intelligence Dossiers

Comprehensive intelligence reports with advanced analysis:

- **Executive Summaries**: High-level overview of findings
- **Timeline Generation**: Chronological event mapping
- **Psychological Profiling**: Big Five personality traits, behavioral indicators, risk assessment
- **Pattern Analysis**: Behavioral pattern detection and correlation
- **Risk Assessment**: Multi-factor risk analysis with severity scoring
- **Geographic Analysis**: Location extraction and geolocation mapping
- **Text Analysis**: Deep linguistic and sentiment analysis
- **Relationship Mapping**: Social network visualization
- **Image Analysis**: Visual content analysis and face recognition
- **Export Options**: 
  - **Professional PDF Reports**: Intelligence-style reports with:
    - Professional header with report metadata
    - Table of contents for long reports
    - Executive summary section
    - Structured findings with numbered sections
    - Formatted tables for financial data and metadata
    - Source grouping by reliability (High/Medium/Low)
    - Appendices with agent versions
    - Professional typography and styling
    - Print-optimized layout with page numbers
  - **Professional Markdown Reports**: Well-structured markdown with:
    - Professional report headers
    - Metadata tables
    - Formatted sections and subsections
    - Source citations with reliability indicators
    - Table of contents
    - Report type detection (Deep Research, Image Research, OSINT)
- **Dossier Management**: 
  - **Delete Functionality**: Remove dossiers with confirmation dialogs
  - **Analytics Dashboard**: View statistics and risk distribution
  - **Enhanced UI**: Improved Recent Activity Feed and Platform Distribution styling

#### Financial Analysis & Visualization

- **Stock Data**: Real-time and historical stock prices
- **Market Analysis**: Market cap, P/E ratios, dividend yields, revenue, profit
- **Technical Analysis**: Trend indicators, support/resistance levels
- **Fundamental Analysis**: Business health, growth prospects, risk factors
- **Statistical Analysis**: CAGR, volatility, Sharpe ratio, max drawdown, correlation
- **Sentiment Analysis**: News sentiment tracking over time
- **Predictions**: Short-term, medium-term, and long-term price predictions
- **Interactive Charts**: Line, area, bar, candlestick, pie, and radar charts
- **Comparison Tools**: Multi-stock comparison with correlation analysis

### Technical Features

- **Local Search Engine**: SearXNG integration for privacy-focused searches
- **Multi-LLM Support**: 
  - OpenRouter (free and paid models)
  - Local llama.cpp integration
  - Model selection per user preference
- **Real-time Updates**: WebSocket-based progress tracking and streaming
- **Rate Limiting**: Built-in throttling for API protection (configurable per endpoint)
- **Source Tracking**: Comprehensive source attribution and verification
- **Redis Caching**: Fast session and data management
- **Elasticsearch**: Full-text search and indexing
- **PostgreSQL with pgvector**: Vector database for embeddings
- **MinIO**: S3-compatible object storage
- **JSON Repair Utility**: Robust parsing of LLM responses with:
  - Unicode normalization (handles special characters, dashes, quotes, math symbols)
  - Balanced JSON extraction using brace/bracket matching
  - Missing comma insertion (arrays and objects)
  - Unescaped quote fixing
  - Unclosed string detection and repair
  - Truncated JSON handling
  - Multiple fallback strategies for array extraction
  - Safe parsing with graceful degradation
- **Session Management**: Persistent research sessions with state recovery
- **Error Handling**: Comprehensive error logging and fallback mechanisms

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- Docker and Docker Compose
- PostgreSQL 14+ (with pgvector extension)
- Redis 7+
- Elasticsearch 8+
- MinIO (S3-compatible storage)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd aegis-intel
```

### 2. Environment Setup

Create `.env` files for backend and frontend:

**Backend `.env`:**
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aegis_intel"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=aegis-intel

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# OpenRouter (optional)
OPENROUTER_API_KEY=your-api-key

# SearXNG
SEARXNG_ENDPOINT=http://localhost:8080

# Application
PORT=3000
NODE_ENV=development
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:3000
```

### 3. Start Services with Docker Compose

```bash
# Start all services (PostgreSQL, Redis, Elasticsearch, MinIO, SearXNG)
sudo docker-compose up -d

# Verify services are running
sudo docker ps
```

### 4. Database Setup

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
```

### 5. Install Dependencies

```bash
# Install root dependencies
npm install

# Install workspace dependencies
npm install --workspaces
```

### 6. Start Development Servers

```bash
# Terminal 1: Backend
npm run start:dev

# Terminal 2: Frontend
npm run start:frontend
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- SearXNG: http://localhost:8080

## 📁 Project Structure

```
aegis-intel/
├── backend/                 # NestJS backend
│   ├── src/
│   │   ├── ai/            # AI agents and services
│   │   ├── research/      # Deep research system
│   │   │   ├── agents/    # Swarm Intelligence agents
│   │   │   │   ├── architect.agent.ts
│   │   │   │   ├── scout.agent.ts
│   │   │   │   ├── quant.agent.ts
│   │   │   │   ├── logician.agent.ts
│   │   │   │   ├── thinker.agent.ts
│   │   │   │   ├── rapid-analyst.agent.ts
│   │   │   │   ├── critic.agent.ts
│   │   │   │   ├── hypothesis.agent.ts
│   │   │   │   ├── vision.agent.ts
│   │   │   │   └── citation.agent.ts
│   │   │   ├── tools/     # Research tools
│   │   │   │   ├── web-search.tool.ts
│   │   │   │   ├── academic.tool.ts
│   │   │   │   ├── news.tool.ts
│   │   │   │   ├── finance.tool.ts
│   │   │   │   ├── image-analysis.tool.ts
│   │   │   │   └── ...
│   │   │   ├── streaming/ # Real-time streaming
│   │   │   └── types/     # Type definitions
│   │   ├── search/        # Search services
│   │   │   ├── agents/    # OSINT-specific agents
│   │   │   │   └── profile-verification.agent.ts
│   │   │   └── services/  # OSINT services
│   │   │       └── accuracy-scorer.service.ts
│   │   ├── reverse-lookup/ # Reverse lookup system
│   │   │   ├── services/  # Lookup services
│   │   │   │   ├── phone-lookup.service.ts
│   │   │   │   ├── email-lookup.service.ts
│   │   │   │   ├── image-lookup.service.ts
│   │   │   │   ├── vin-lookup.service.ts
│   │   │   │   ├── address-lookup.service.ts
│   │   │   │   └── lookup-aggregator.service.ts
│   │   │   └── types/     # Lookup type definitions
│   │   ├── scraper/       # Social media scrapers
│   │   ├── dossier/       # Intelligence dossiers
│   │   └── user/          # User management
│   └── prisma/            # Database schema
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── research/  # Research UI components
│   │   │   │   ├── StreamingAnswer.tsx
│   │   │   │   ├── FollowUpQuestions.tsx
│   │   │   │   ├── CitationPopover.tsx
│   │   │   │   └── charts/ # Chart components
│   │   │   ├── search/    # OSINT UI components
│   │   │   │   └── OSINTReportViewer.tsx
│   │   │   ├── reverse-lookup/ # Reverse lookup UI components
│   │   │   │   ├── ReverseLookupPanel.tsx
│   │   │   │   ├── LookupResultsView.tsx
│   │   │   │   └── PersonInfoCard.tsx
│   │   ├── pages/         # Page components
│   │   └── services/      # API services
├── docker-compose.yml     # Docker services configuration
└── searxng/              # SearXNG configuration
```

## 🔧 Configuration

### SearXNG Setup

SearXNG is configured to run locally on port 8080. The configuration files are in the `searxng/` directory:

- `searxng/settings.yml`: Main configuration
- `searxng/limiter.toml`: Rate limiting and bot detection

### Model Selection

Users can configure their preferred research model in Settings:
- **Local**: llama.cpp (requires local server)
- **Free**: OpenRouter free models (e.g., `google/gemma-3-27b-it:free`)
- **Paid**: OpenRouter paid models (e.g., `google/gemma-3-27b-it`)

### Per-Agent Model Configuration

Advanced users can configure specific models for each research agent to optimize performance:

- **Agent-Specific Models**: Each agent (Architect, Scout, Quant, Logician, Thinker, etc.) can use a different model
- **Model Recommendations**: Built-in recommendations for each agent type:
  - **Quant**: Models good at mathematical calculations and financial analysis
  - **Logician**: Models with strong logical reasoning and fact-checking abilities
  - **Vision Agent**: Multimodal vision models (supports images)
  - **Thinker**: Models with excellent synthesis and narrative writing capabilities
  - And more...
- **Dynamic Model List**: Automatically fetches all available models from OpenRouter API
  - Real-time model discovery without manual updates
  - Cached for 1 hour to reduce API calls
  - Falls back to cached list if API is unavailable
- **Search & Filter**: 
  - Real-time search across model names, providers, and descriptions
  - Filter by provider (Google, OpenAI, DeepSeek, etc.)
  - Filter by tier (Free/Paid)
  - Search result highlighting
  - Result count display
- **Provider Support**: 
  - OpenRouter (free and paid models)
  - Local llama.cpp models
- **Fallback Behavior**: If no agent-specific model is configured, agents use the global research model

### Research Configuration

- **Max Iterations**: Default 15 iterations for quality improvement
- **Quality Threshold**: Default 80% quality score threshold
- **Timeout Settings**: Configurable timeouts per agent (default 90-120 seconds)
- **Per-Agent Models**: Configure specific models for each agent in Settings
- **Model Discovery**: Automatic fetching of OpenRouter models (cached 1 hour)

## 🎯 Usage

### Preliminary Search

1. Navigate to the Search page
2. Enter a query (name, username, entity, etc.)
3. Review preliminary results with rich profile previews:
   - **Avatar Images**: See profile pictures at a glance
   - **Bio Snippets**: Quick overview of profile descriptions
   - **Statistics**: Follower/following counts and activity metrics
   - **Recent Posts**: Preview of latest content (images and text)
   - **Persona Badges**: Visual indicators for profession type
   - **Location Tags**: Geographic information when available
4. Select a specific candidate card for focused deep research
5. The selected profile's data is automatically used for targeted analysis
6. View cross-platform username availability with instant previews

### OSINT Deep Search

1. **Start Deep Search**: Select a candidate from preliminary search results
2. **Research Agent Workflow**:
   - **The Architect**: Creates OSINT-specific research plan
   - **The Scout**: Executes enhanced searches using OSINT-specific methods
   - **The Logician**: Validates findings and detects contradictions
   - **Fact Checker**: Verifies key claims against multiple sources
   - **The Critic**: Reviews quality and identifies gaps
   - **Hypothesis Agent**: Generates hypotheses to fill research gaps
   - **Iterative Refinement**: Automatic quality improvement (up to 3 iterations)
3. **Real-Time Monitoring**:
   - View live streaming updates in DeepSearchTracker
   - See agent progress and validation results
   - Monitor quality scores and completeness metrics
   - Track citations as they're discovered
4. **Profile Verification**:
   - Automatic authenticity checking
   - Bot and impersonation detection
   - Cross-platform consistency verification
   - Red flag identification
5. **Results & Export**:
   - View comprehensive OSINT report with accuracy scores
   - Export as professional PDF or Markdown
   - Review validation results and fact-checking outcomes
   - Access profile verification details

### Deep Research

1. Switch to "Deep Research" mode
2. Enter your research query
3. Click "Start Deep Research"
4. Monitor real-time progress:
   - **Rapid Response**: Quick initial answer appears first
   - **The Architect**: Strategic planning phase
   - **The Scout**: Data retrieval with source filtering
   - **The Quant**: Financial analysis (if applicable)
   - **The Logician**: Fact validation and contradiction detection
   - **The Critic**: Quality review and improvement suggestions
   - **Hypothesis Agent**: Gap identification and hypothesis generation
   - **The Thinker**: Report synthesis
   - **Iterative Refinement**: Automatic quality improvement loops
5. View streaming results with inline citations
6. Explore follow-up questions for deeper research
7. Download the final report (PDF or Markdown)

### Image Search

1. Upload an image or provide an image URL
2. The system performs reverse image search
3. OCR extracts text from the image
4. Vision Agent analyzes visual content (charts, infographics)
5. Results include matching images, extracted text, and visual analysis

### Reverse Lookup

1. Navigate to the Reverse Lookup page
2. **Select Lookup Type**:
   - **Phone**: Enter phone number (with or without formatting)
   - **Email**: Enter email address
   - **Image**: Upload an image file or provide image URL
   - **VIN**: Enter vehicle identification number
   - **Address**: Enter street address, city, state, ZIP
3. **Initiate Lookup**: Click "Search" button
4. **Monitor Progress**:
   - Real-time streaming updates via WebSocket
   - Agent progress notifications
   - Step-by-step process visibility
5. **View Results**:
   - **Person Information**: Identified individuals with confidence scores
   - **Social Profiles**: Discovered social media accounts
   - **Relationships**: Connection mapping and relationship graphs
   - **Timeline**: Chronological events and activities
   - **Web Activity**: Online presence and digital footprint
   - **Location History**: Geographic data and location tracking
   - **Source Citations**: All sources grouped by reliability
6. **Export Results**:
   - Export as professional PDF report
   - Export as Markdown document
   - Includes all identified persons, relationships, and sources

**Lookup Features:**
- **LLM-Based Extraction**: Advanced AI extraction from unstructured data
- **Multi-Source Aggregation**: Combines results from multiple sources
- **Validation**: Cross-referencing and fact-checking via LogicianAgent
- **Resilience**: Continues working even when some APIs fail or hit rate limits
- **Partial Results**: Returns available data even if lookup is incomplete

### Intelligence Dossiers

1. Complete a preliminary or deep search
2. Navigate to Dossiers section
3. View comprehensive intelligence reports including:
   - Executive summary
   - Timeline of events
   - Psychological profile
   - Risk assessment
   - Relationship mapping
   - Geographic analysis
4. **Manage Dossiers**:
   - View all dossiers in a clean table layout
   - Delete unwanted dossiers with confirmation
   - View analytics and risk distribution
5. Export dossier as PDF or Markdown

### Financial Analysis

1. Enter a stock symbol or financial query in Deep Research
2. The Quant Agent automatically activates for financial queries
3. View interactive charts:
   - Price history
   - Comparison charts
   - Sentiment analysis
   - Predictions
4. Review statistical analysis and technical indicators

### Dashboard & Analytics

1. Navigate to the Dashboard to view intelligence overview
2. **Overview Metrics**:
   - Total Investigations count
   - Platforms Indexed
   - High Risk Level alerts
   - Security Score percentage
3. **Recent Activity Feed**:
   - View latest dossier activities with timestamps
   - See risk levels (HIGH, MEDIUM, LOW) with color-coded badges
   - Click activities to view full dossier details
   - Custom scrollbar styling for better UX
4. **Platform Distribution**:
   - Visual breakdown of platforms used in investigations
   - Progress bars showing relative distribution
   - Empty state handling when data is insufficient
5. **Dossier Management**:
   - View all dossiers in organized table
   - Delete unwanted dossiers with confirmation
   - Export dossiers as PDF

### Agent Model Configuration

1. Navigate to Settings → Agent Model Configuration
2. **Configure Individual Agents**:
   - Expand any agent card to configure its model
   - View model recommendations via info icon (ℹ️)
   - Select provider (OpenRouter or Local llama.cpp)
   - Choose tier (Free or Paid) for OpenRouter
   - **Search Models**: Use the search bar to quickly find models by:
     - Model name
     - Provider name
     - Description text
     - Model ID
   - **Filter by Provider**: Click provider buttons to filter models
   - See result count ("Showing X of Y models")
   - Search results highlight matching text
3. **Model Recommendations**:
   - Each agent has specific recommendations based on its role
   - Recommendations differ for free, paid, and local models
   - Hover over the info icon to see recommendations
4. **Dynamic Model Discovery**:
   - Models are automatically fetched from OpenRouter API
   - No need to manually update model lists
   - Always see the latest available models
   - Cached for performance (1 hour)

## 🔐 Authentication

The platform uses JWT-based authentication with refresh tokens. Users must:
1. Register an account
2. Log in to access features
3. Configure API keys in Settings for third-party services (OpenRouter, Clarifai, etc.)
4. Select preferred research model and tier

## 📊 API Documentation

API endpoints are available at `/api`:

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token

### Search & Research
- `POST /api/search` - Start preliminary search
- `POST /api/research` - Start deep research
- `GET /api/research/:id` - Get research status
- `GET /api/research/:id/export/pdf` - Export professional PDF report
- `GET /api/research/:id/export/md` - Export professional Markdown report
- `GET /api/search/:id/export/pdf` - Export OSINT report as PDF
- `GET /api/search/:id/export/md` - Export OSINT report as Markdown

### Reverse Lookup
- `POST /api/reverse-lookup/phone` - Reverse phone number lookup
- `POST /api/reverse-lookup/email` - Reverse email address lookup
- `POST /api/reverse-lookup/image` - Reverse image lookup
- `POST /api/reverse-lookup/vin` - VIN number lookup
- `POST /api/reverse-lookup/address` - Address reverse lookup
- `GET /api/reverse-lookup/:sessionId` - Get lookup results
- `GET /api/reverse-lookup/:sessionId/export/pdf` - Export lookup report as PDF
- `GET /api/reverse-lookup/:sessionId/export/md` - Export lookup report as Markdown
- `POST /api/search/upload` - Upload image for reverse lookup (authenticated)

### Model Configuration
- `GET /api/models/openrouter` - Get available models from OpenRouter (cached 1 hour)
- `GET /api/users/settings/agent-models` - Get agent model configurations
- `PUT /api/users/settings/agent-models` - Update agent model configuration

### Dossiers
- `GET /api/dossiers` - List all dossiers (with pagination)
- `GET /api/dossiers/analytics` - Get dossier analytics and statistics
- `GET /api/dossiers/:id` - Get dossier details
- `GET /api/dossiers/:id/export/pdf` - Export dossier as PDF
- `DELETE /api/dossiers/:id` - Delete a dossier (requires ownership)

### WebSocket Events

Real-time events via Socket.IO:

**Deep Research Events:**
- `research:stream_chunk` - Streaming text chunks
- `research:citation_added` - New citation added
- `research:thinking` - Agent thinking process
- `research:tool_executing` - Tool execution updates
- `research:rapid_response` - Quick initial response
- `research:follow_ups` - Follow-up questions generated
- `research:iteration_start` - New iteration started
- `research:quality_update` - Quality score updates

**OSINT Deep Search Events:**
- `research:stream_chunk` - Streaming OSINT intelligence chunks
- `research:citation_added` - New source discovered
- `research:thinking` - Agent reasoning process
- `research:tool_executing` - Tool execution updates
- `research:agent_progress` - Agent-specific progress updates
- `research:validation_update` - Validation results from LogicianAgent
- `research:quality_update` - Quality and completeness score updates
- `progress` - General progress updates

**Reverse Lookup Events:**
- `reverse_lookup:stream_chunk` - Streaming lookup progress updates
- `reverse_lookup:thinking` - Agent reasoning process
- `reverse_lookup:progress` - General progress updates
- `reverse_lookup:result` - Partial result discovered
- `reverse_lookup:complete` - Lookup completed

## 🐳 Docker Services

The platform uses Docker Compose for service orchestration:

- **PostgreSQL**: Database with pgvector extension for vector similarity search
- **Redis**: Session and cache management, job queues
- **Elasticsearch**: Full-text search and indexing
- **MinIO**: Object storage for files and images
- **SearXNG**: Local metasearch engine aggregating multiple search engines
- **Caddy**: Reverse proxy for SearXNG

## 🧪 Development

### Running Tests

```bash
# Backend tests
cd backend
npm run test

# Frontend tests
cd frontend
npm run test
```

### Code Quality

```bash
# Linting
npm run lint

# Formatting
npm run format
```

### Type Checking

```bash
# Backend type checking
cd backend
npx tsc --noEmit

# Frontend type checking
cd frontend
npx tsc --noEmit
```

## 🎉 Recent Updates

### Reverse Lookup System (Latest)

- **Comprehensive Reverse Lookup Module**: New ClarityCheck-like system for reverse lookups
  - **Phone Number Lookup**: Person identification, social profiles, public records, web activity
  - **Email Address Lookup**: Owner identification, social media discovery, data breach detection
  - **Image Reverse Lookup**: Person identification, face recognition, reverse image search, visual analysis
  - **VIN Lookup**: Vehicle information, owner history, accident records, market value
  - **Address Lookup**: Residents, neighbors, property information, public records

- **LLM-Based Data Extraction**:
  - Replaced regex pattern matching with sophisticated LLM-based extraction
  - Uses ThinkerAgent for structured data extraction from unstructured search results
  - Improved accuracy and flexibility over traditional parsing methods
  - Handles noisy and incomplete data sources gracefully

- **Multi-Agent Intelligence Integration**:
  - **ScoutAgent**: Enhanced information gathering with expanded search queries (10 per lookup type)
  - **ThinkerAgent**: Structured data extraction and synthesis
  - **LogicianAgent**: Fact validation and cross-referencing
  - **VisionAgent**: Image analysis and visual content understanding
  - **PersonaClassifierAgent**: Profile classification and persona detection
  - **RelationshipAgent**: Connection mapping and relationship detection
  - **ResearchDetectiveAgent**: Pattern detection and correlation analysis

- **Result Aggregation & Validation**:
  - **LookupAggregatorService**: Combines results from multiple sources
  - Deduplication and cross-validation
  - Confidence scoring based on source reliability
  - Relationship graph building
  - Timeline generation from collected data
  - Person identity consolidation

- **Resilience & Error Handling**:
  - Graceful degradation when external APIs fail
  - Rate limit handling (returns placeholders, continues processing)
  - Multiple fallback mechanisms:
    - LLM extraction → Regex extraction
    - Primary search → Alternative search methods
    - Vision API → Basic image analysis
    - Face detection → Manual identification
  - Partial result return (never fails completely)
  - Comprehensive error logging

- **Real-Time Streaming**:
  - WebSocket-based progress updates
  - Live agent progress notifications
  - Step-by-step lookup process visibility
  - Real-time result discovery

- **Professional Reporting**:
  - Export lookup results as PDF or Markdown
  - Structured reports with executive summary, identified persons, relationships, timeline, sources
  - Professional intelligence-style formatting

- **Frontend Enhancements**:
  - Unified lookup interface for all lookup types
  - Tabbed results display
  - Person info cards with rich data
  - Relationship visualization
  - Empty state handling
  - Error recovery with retry functionality
  - Loading states and progress indicators

- **Technical Improvements**:
  - Fixed 401 authentication error for image uploads
  - Added explicit user validation
  - Base64 conversion for localhost images (vision API compatibility)
  - Database schema: `ReverseLookupSession` and `PersonIdentity` models
  - RESTful API endpoints for each lookup type
  - Secure authenticated image upload with MinIO storage

### OSINT Module Enhancement with Research Agents

- **Research Agent Integration**:
  - Full integration of research agent system into OSINT deep search workflow
  - OSINT-specific research plan creation via ArchitectAgent.createOSINTPlan()
  - Enhanced ScoutAgent with OSINT-specific search methods:
    - searchSocialMediaProfiles() for cross-platform discovery
    - searchPublicRecords() for official records
    - searchNewsAndMedia() for news coverage
    - crossReferenceFindings() for pattern detection
  - Multi-agent validation with LogicianAgent and FactCheckerAgent
  - Quality review with CriticAgent
  - Iterative quality improvement loop (max 3 iterations)

- **Profile Verification**:
  - New ProfileVerificationAgent for authenticity checking
  - Cross-platform consistency verification
  - Bot and impersonation detection
  - Red flag identification (inconsistent bio, suspicious activity, low engagement, etc.)
  - Authenticity scoring (0-100) with confidence levels

- **Accuracy Scoring**:
  - New AccuracyScorerService for multi-agent consensus scoring
  - Combines results from LogicianAgent, FactCheckerAgent, and CriticAgent
  - Weighted scoring system (multi-agent consensus, source reliability, cross-platform verification, contradiction detection, profile verification)
  - Overall accuracy score (0-100) with confidence levels

- **Professional OSINT Reporting**:
  - New exportOSINTMarkdown() and exportOSINTPdf() methods
  - OSINT-specific report structure with:
    - Executive summary
    - Profile verification section
    - Cross-platform analysis
    - Risk assessment
    - Timeline of activities
    - Relationship mapping
    - Source citations grouped by reliability
    - Research agent validation results
    - Accuracy scores and breakdown
  - Export endpoints: GET /api/search/:id/export/pdf and /export/md

- **Real-Time Streaming**:
  - WebSocket-based streaming for OSINT progress
  - Live agent progress updates
  - Real-time validation results
  - Quality score updates
  - Citation discovery

- **Agent Enhancements**:
  - PersonaClassifierAgent enhanced with LogicianAgent and CriticAgent validation
  - RelationshipAgent enhanced with ScoutAgent and ResearchDetectiveAgent integration

- **Frontend Updates**:
  - Enhanced DeepSearchTracker with real-time streaming display
  - Added export buttons for PDF and Markdown
  - New OSINTReportViewer component for viewing professional reports
  - Quality scores and validation results display

### Professional Report Styling & Agent Configuration

- **Professional OSINT Report Styling**:
  - **Intelligence-Style Reports**: Professional formatting for both PDF and Markdown exports
  - **Report Structure**:
    - Professional headers with report type detection (Deep Research, Image Research, OSINT)
    - Metadata tables with formatted fields
    - Table of contents for long reports
    - Executive summary sections
    - Structured findings with numbered subsections
    - Formatted tables for financial data and quality metrics
    - Source grouping by reliability (High/Medium/Low)
    - Appendices with agent versions and metadata
  - **PDF Styling**:
    - Professional typography (serif body, sans-serif headers)
    - Dark blue/black color scheme for headers
    - Print-optimized layout with proper page breaks
    - Page numbering in footer
    - Table styling with alternating rows
    - Source citation formatting
  - **Markdown Styling**:
    - Well-structured markdown with proper hierarchy
    - Formatted metadata tables
    - Source citations with reliability indicators
    - Professional section separators
  - **Report Types**: Automatic detection and customized styling for:
    - Deep Research reports (full multi-agent research)
    - Image Research reports (visual analysis focus)
    - OSINT Intelligence reports (preliminary intelligence gathering)

- **Per-Agent Model Configuration**:
  - **Individual Agent Models**: Configure specific models for each research agent
  - **Model Recommendations**: Built-in recommendations for optimal model selection:
    - Quant: Math-focused models
    - Logician: Logic/reasoning models
    - Vision: Multimodal vision models
    - Thinker: Synthesis/writing models
    - And recommendations for all 10 agents
  - **Dynamic Model Discovery**: 
    - Automatically fetches all available models from OpenRouter API
    - Real-time model list updates without manual configuration
    - 1-hour caching for performance
    - Graceful fallback to cached list if API unavailable
  - **Search & Filter Interface**:
    - Real-time search across model names, providers, descriptions, and IDs
    - Provider filter buttons (All + unique providers)
    - Tier filter (Free/Paid)
    - Search result highlighting
    - Result count display
    - Empty state messaging
    - Clear filters functionality
  - **Provider Support**: OpenRouter (free/paid) and Local llama.cpp

- **Enhanced JSON Repair**:
  - Improved array extraction for follow-up questions
  - Better handling of malformed JSON responses
  - Multiple fallback strategies for question extraction
  - Direct question text extraction as last resort

### Enhanced OSINT Module

- **Rich Profile Previews**: Enhanced preliminary search with comprehensive profile data
  - Avatar images extracted and displayed prominently
  - Bio snippets with location and profession detection
  - Statistics (followers, following, posts, repositories)
  - Recent post previews (images and captions)
  - Language and hashtag extraction
- **ProfilePreview Interface**: Type-safe profile data structure with all preview fields
- **Enhanced Candidate Cards**: Beautiful UI displaying all preview information
  - Prominent avatar display with fallback placeholders
  - Persona badges (Developer, Musician, Artist, Business, Academic)
  - Location and profession tags
  - Interest/hashtag chips
  - Statistics display
  - Recent post previews with images
- **Selected Profile Support**: Choose specific profiles for focused deep search
  - Selected profile data automatically passed to deep search
  - Persona context included for better analysis
  - Platform-specific username handling
- **Dossier Management**: 
  - Delete functionality with confirmation dialogs
  - Enhanced analytics dashboard
  - Improved Recent Activity Feed styling with custom scrollbars
  - Enhanced Platform Distribution visualization
  - Better visual hierarchy and spacing
- **Bug Fixes**:
  - Fixed URL construction for non-standard platforms (X/Twitter)
  - Added error handling for image loading failures
  - Fixed useEffect dependency issues
  - Improved error recovery and fallback mechanisms

### Enhanced Deep Research System

- **Multi-Agent Swarm Intelligence**: Expanded from 5 to 10+ specialized agents
- **Rapid Response System**: Perplexity-style quick answers with streaming
- **Inline Citations**: Real-time citation extraction with hover previews
- **Follow-up Questions**: AI-generated contextual questions for deeper exploration
- **Iterative Research Loop**: Automatic quality improvement with up to 15 iterations
- **Multi-modal Analysis**: Vision agent for images, charts, and infographics
- **Academic & News Tools**: Specialized tools for scholarly and news research
- **Enhanced Financial Analysis**: Advanced charts, statistics, and predictions
- **JSON Repair Utility**: Robust parsing of LLM responses with Unicode normalization
- **Streaming Infrastructure**: Real-time WebSocket streaming of research progress
- **Quality Scoring**: Automatic quality and completeness assessment
- **Source Credibility**: Automatic reliability scoring (high/medium/low)
- **Export Improvements**: Fixed PDF and Markdown export with proper formatting

### Previous Updates

- Implemented 5-agent Swarm Intelligence system for deep research
- Enhanced source credibility filtering
- Added financial domain expertise (The Quant)
- Improved fact validation with triangulation and fallacy detection
- Structured report generation with executive summaries
- Fixed export functionality for PDF and Markdown reports

## 🔒 Security Features

- JWT-based authentication with refresh tokens
- Rate limiting on all API endpoints
- Input validation and sanitization
- Secure session management with Redis
- Environment-based configuration
- API key encryption in database

## 📈 Performance Optimizations

- Redis caching for frequent queries
- Elasticsearch for fast full-text search
- Connection pooling for database
- WebSocket for real-time updates
- Background job processing with BullMQ
- Optimized prompt sizes for LLM calls
- Timeout management for long-running operations

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the Apache License 2.0 with the Commons Clause restriction - see the [LICENSE](LICENSE) file for details.

## 📧 Support

[Support Information]

---

**Built with ❤️ for the OSINT community**
