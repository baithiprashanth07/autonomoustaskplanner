# Autonomous Task Planner & Executor

A Next.js application that leverages AI to break down complex user goals into actionable steps, execute them using various tools, and provide real-time progress updates. This project demonstrates advanced AI agent orchestration, tool calling, streaming responses, and state management.

## Overview

The Autonomous Task Planner is an AI-powered system that:

1. **Plans** - Uses AI to break down natural language goals into structured task lists with dependencies
2. **Executes** - Runs tasks using appropriate tools (web search, calculations, API calls)
3. **Streams** - Provides real-time progress updates during execution
4. **Adapts** - Handles failures and adjusts plans dynamically
5. **Persists** - Maintains execution state and history

## Key Features

### 🤖 Intelligent Task Planning
- Natural language goal parsing
- Automatic task breakdown with dependencies
- Tool requirement identification
- Optional vs. required task classification

### 🛠️ Tool Integration
- **Web Search** - Online information retrieval
- **Data Processor** - Calculations, data analysis, transformations
- **API Fetcher** - Weather, currency conversion, stock data

### ⚡ Real-time Execution
- Streaming progress updates
- Parallel task execution where possible
- Dependency-aware task ordering
- Retry logic with exponential backoff

### 🔄 Error Handling & Recovery
- Automatic retries for failed tasks
- Fallback strategies
- Graceful degradation for optional tasks
- Clear error reporting

### 💾 State Persistence
- Database-backed execution history
- Survives page refreshes
- User authentication and session management
- Execution replay and analysis

### 🎨 Modern UI
- Next.js 16 with App Router
- Tailwind CSS styling
- Real-time streaming updates
- Responsive design

## Architecture

### Technology Stack

| Component | Technology | Purpose |
| --- | --- | --- |
| **Frontend** | Next.js 16, React 19 | UI and user interaction |
| **Backend** | Next.js API Routes | Server-side logic |
| **AI/LLM** | AI SDK, OpenAI | Task planning and analysis |
| **Database** | MySQL (PlanetScale/Drizzle) | Data persistence |
| **Styling** | Tailwind CSS | UI components |
| **State** | tRPC, TanStack Query | API communication |
| **Auth** | Custom OAuth | User authentication |

### Core Components

**Execution Engine** (`server/executionEngineV2.ts`)
- Plan generation from natural language goals
- Dependency graph construction
- Parallel task execution
- Streaming update callbacks

**Tool System** (`server/tools.ts`)
- Web search using DuckDuckGo API
- Data processing (calculations, conversions)
- API integration (weather, currency, stocks)

**Planning System** (`server/executionEngineV2.ts`)
- AI-powered task breakdown
- Schema-based structured output
- Dependency analysis

**Streaming System** (`server/streaming.ts`)
- Real-time execution updates
- Server-sent events
- Progress tracking

**Database Layer** (`server/db.ts`, `drizzle/schema.ts`)
- Execution state persistence
- Task results storage
- User management

## Installation

### Prerequisites
- Node.js ≥ 20.9
- TypeScript ≥ 5.1
- MySQL database (PlanetScale, AWS RDS, or local)
- OpenAI API key

### Setup
1. **Clone the repository**
   ```bash
   git clone <repository>
   cd autonomous-task-planner
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**
   Create a `.env.local` file:
   ```bash
   # Database
   DATABASE_URL=mysql://user:password@host:port/database

   # AI/LLM
   OPENAI_API_KEY=your_openai_key

   # Auth (if using OAuth)
   MANUS_CLIENT_ID=your_client_id
   MANUS_CLIENT_SECRET=your_client_secret

   # Optional: Other providers
   GROQ_API_KEY=your_groq_key
   GOOGLE_API_KEY=your_google_key
   ```

4. **Database Setup**
   ```bash
   # Generate and run migrations
   pnpm run db:push
   ```

5. **Development Server**
   ```bash
   pnpm run dev
   ```

The application will be available at `http://localhost:3000`

## Usage

### Basic Workflow

1. **Authentication** - Log in using the configured OAuth provider
2. **Enter Goal** - Describe your objective in natural language
3. **Generate Plan** - AI breaks down the goal into executable tasks
4. **Execute Plan** - Watch real-time progress as tasks run
5. **Review Results** - Analyze the final output and insights

### Example Goals

**Research & Analysis**
```
Research the top 5 AI startups funded in 2024, compare their funding amounts,
and create a summary with key insights
```

**Data Processing**
```
Find the weather in Tokyo tomorrow, convert the temperature to Fahrenheit,
and suggest 3 outdoor activities suitable for those conditions
```

**Financial Analysis**
```
Calculate the compound annual growth rate of Apple stock over the last 5 years
and compare it with Microsoft
```

### Tool Capabilities

**Web Search**
- Searches using DuckDuckGo API
- Extracts relevant results and snippets
- Handles rate limiting gracefully

**Data Processor**
- CAGR calculations
- Temperature conversions
- Percentage change analysis
- Statistical comparisons

**API Fetcher**
- Weather data (Open-Meteo)
- Currency conversion (ExchangeRate-API)
- Stock prices (placeholder for production)

## API Reference

### Core Endpoints

**Task Planning**
```typescript
POST /api/planner/createExecution
{
  "goal": "Research AI startups..."
}
```

**Execution Control**
```typescript
POST /api/planner/startExecution
{
  "executionId": 123
}
```

**Streaming Updates**
```typescript
GET /api/streaming/execution/:id
// Server-sent events for real-time updates
```

### Tool Interface

```typescript
interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}
```

## Development

### Project Structure
```
autonomous-task-planner/
├── client/                 # Frontend React app
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities
├── server/                 # Backend API
│   ├── _core/             # Core utilities
│   ├── executionEngine.ts # Task execution logic
│   ├── tools.ts           # Tool implementations
│   ├── routers.ts         # tRPC routers
│   └── db.ts              # Database operations
├── shared/                 # Shared types/utilities
├── drizzle/               # Database schema/migrations
└── package.json
```

### Key Files

- `server/executionEngineV2.ts` - Main execution logic
- `server/tools.ts` - Tool implementations
- `client/src/pages/TaskPlanner.tsx` - Main UI component
- `shared/types.ts` - TypeScript type definitions
- `drizzle/schema.ts` - Database schema

### Adding New Tools

1. **Implement Tool Function** in `server/tools.ts`:
```typescript
export async function newTool(params: any): Promise<ToolResult> {
  // Tool implementation
}
```

2. **Register Tool** in `executeTool` function:
```typescript
case "new_tool":
  return newTool(params);
```

3. **Update Planning Prompts** to include new tool

### Extending the Planner

**Custom Task Types**
- Modify prompts in `executionEngineV2.ts`
- Add new tool categories
- Update schema validation

**Additional AI Providers**
- Extend AI SDK integration
- Add provider configurations
- Update environment variables

## Deployment

### Vercel Deployment

1. **Connect Repository**
   - Import project to Vercel
   - Configure environment variables

2. **Database Setup**
   - Use PlanetScale or similar
   - Update `DATABASE_URL`

3. **Build Configuration**
   ```json
   {
     "buildCommand": "pnpm build",
     "devCommand": "pnpm dev",
     "installCommand": "pnpm install"
   }
   ```

4. **Deploy**
   ```bash
   vercel --prod
   ```

### Environment Variables

**Required**
- `DATABASE_URL` - MySQL connection string
- `OPENAI_API_KEY` - OpenAI API key

**Optional**
- `MANUS_CLIENT_ID` - OAuth client ID
- `MANUS_CLIENT_SECRET` - OAuth client secret
- `GROQ_API_KEY` - Alternative LLM provider
- `GOOGLE_API_KEY` - Google AI provider

## Configuration

### AI Model Settings

The system uses OpenAI GPT-4 by default. Configure in `server/_core/llm.ts`:

```typescript
const model = "gpt-4o"; // or other OpenAI models
```

### Execution Parameters

Modify retry logic and timeouts in `executionEngineV2.ts`:

```typescript
const maxRetries = 2;
const retryDelay = 1000; // ms
```

### Tool Timeouts

Configure tool execution timeouts in `server/tools.ts`:

```typescript
const timeout = 30000; // 30 seconds
```

## Performance Considerations

- **Task Parallelization** - Independent tasks run concurrently
- **Streaming Efficiency** - Minimal payload updates
- **Database Optimization** - Indexed queries for execution history
- **Caching Strategy** - Consider Redis for frequent API calls

## Security

- **API Key Management** - Secure environment variable storage
- **Input Validation** - Zod schemas for all inputs
- **Rate Limiting** - Built into tool implementations
- **Authentication** - OAuth-based user sessions

## Troubleshooting

### Common Issues

**Database Connection Failed**
- Verify `DATABASE_URL` format
- Check database server status
- Ensure proper permissions

**AI API Errors**
- Confirm API key validity
- Check rate limits
- Verify model availability

**Streaming Not Working**
- Check browser compatibility
- Verify server-sent events support
- Review network connectivity

**Tool Execution Failures**
- Check tool-specific API keys
- Verify network access
- Review error logs

### Debug Mode

Enable detailed logging:
```bash
DEBUG=* pnpm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

### Development Guidelines

- Use TypeScript for all new code
- Follow existing code patterns
- Add tests for new features
- Update documentation

## License

This project is open source. See LICENSE file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [OpenAI](https://openai.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Database with [Drizzle ORM](https://drizzle.team/)
