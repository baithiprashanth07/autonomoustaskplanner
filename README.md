# Autonomous Task Planner & Executor

An AI-powered agent system that breaks down complex user goals into actionable steps, executes them using various tools, and provides real-time progress updates. Built with Next.js, TypeScript, and the Vercel AI SDK.

## Overview

The Autonomous Task Planner & Executor is a full-stack application that demonstrates advanced AI agent orchestration, tool integration, and real-time streaming capabilities. Users input high-level goals, and the system automatically:

1. **Plans** - Breaks down goals into a step-by-step execution plan with task dependencies
2. **Executes** - Runs tasks in the correct order, leveraging multiple tools and handling failures gracefully
3. **Streams** - Provides real-time progress updates as tasks execute
4. **Analyzes** - Synthesizes results into comprehensive summaries with key insights

## Key Features

### AI-Powered Planning
The system uses an LLM to parse natural language goals and generate structured execution plans with clear task descriptions, required tools, and dependencies.

### Intelligent Tool Integration
Three core tool types are implemented:
- **Web Search** - Retrieve information from the internet
- **Data Processing** - Perform calculations, unit conversions, and data analysis
- **API Integration** - Fetch data from external services (weather, currency conversion, etc.)

### Execution Engine
The execution engine manages the complete task lifecycle:
- Respects task dependencies and executes tasks in the correct order
- Runs independent tasks in parallel when possible
- Handles both successes and failures gracefully
- Implements retry logic with exponential backoff
- Skips optional tasks when dependencies fail

### Real-Time Streaming
Progress updates stream to the UI as tasks execute, providing immediate feedback on:
- Task status changes (queued, running, succeeded, failed, skipped)
- Tool execution and results
- Errors and recovery attempts
- Final analysis and recommendations

### State Persistence
All execution state is persisted to the database, allowing users to:
- Resume interrupted executions
- Review past execution history
- Track execution status across page refreshes

## Architecture

### Technology Stack

| Component | Technology | Purpose |
| --- | --- | --- |
| **Frontend** | React 19, Tailwind CSS 4 | User interface and real-time updates |
| **Backend** | Express.js, tRPC 11 | API and business logic |
| **Database** | MySQL/TiDB with Drizzle ORM | State persistence |
| **AI/LLM** | Vercel AI SDK | Planning and reasoning |
| **Authentication** | Manus OAuth | User authentication |

### System Components

**Client Layer** (`client/src/`)
- `pages/Home.tsx` - Landing page with feature overview
- `pages/TaskPlanner.tsx` - Main planner UI with plan visualization and execution monitoring
- `hooks/useStreamingExecution.ts` - Custom hook for handling streaming updates

**Server Layer** (`server/`)
- `routers.ts` - tRPC API procedures for planning and execution
- `executionEngineV2.ts` - Core execution engine with streaming support
- `tools.ts` - Tool implementations (web search, data processing, API fetching)
- `db.ts` - Database query helpers
- `streaming.ts` - Streaming utilities

**Database** (`drizzle/`)
- `schema.ts` - Database tables for executions, tasks, and results

## Usage

### Getting Started

1. **Clone and Install**
   ```bash
   git clone <repository>
   cd autonomous-task-planner
   pnpm install
   ```

2. **Set Up Environment**
   The application uses pre-configured environment variables from the Manus platform:
   - `VITE_APP_TITLE` - Application title
   - `VITE_OAUTH_PORTAL_URL` - OAuth login URL
   - `BUILT_IN_FORGE_API_KEY` - LLM API key (server-side)
   - `DATABASE_URL` - Database connection string

3. **Run Development Server**
   ```bash
   pnpm dev
   ```
   The application will be available at `http://localhost:3000`

4. **Database Migrations**
   ```bash
   pnpm db:push
   ```

### Using the Application

1. **Sign In** - Click "Sign In" to authenticate with Manus OAuth
2. **Create a Goal** - Enter a high-level goal in the text area
3. **Review Plan** - The system generates a plan with all identified tasks
4. **Execute** - Click "Start Execution" to begin task execution
5. **Monitor Progress** - Watch real-time updates as tasks execute
6. **Review Results** - View the final analysis and task results

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

## API Reference

### tRPC Procedures

#### `planner.createExecution`
Creates a new execution and generates a plan for a goal.

**Input:**
```typescript
{
  goal: string  // Minimum 10 characters
}
```

**Output:**
```typescript
{
  executionId: number
  goal: string
  plan: ExecutionPlan
}
```

#### `planner.startExecution`
Starts the execution of a plan.

**Input:**
```typescript
{
  executionId: number
}
```

**Output:**
```typescript
{
  success: boolean
  results?: {
    analysis: string
    taskResults: Record<string, any>
  }
  error?: string
}
```

#### `planner.getExecution`
Retrieves execution details.

**Input:**
```typescript
{
  executionId: number
}
```

**Output:**
```typescript
{
  id: number
  userId: number
  goal: string
  status: "planning" | "executing" | "completed" | "failed"
  plan: ExecutionPlan
  results?: any
  error?: string
  tasks: Task[]
}
```

#### `planner.getExecutionHistory`
Retrieves user's execution history.

**Input:**
```typescript
{
  limit?: number  // Default: 20
}
```

**Output:**
```typescript
Execution[]
```

## Tool Implementations

### Web Search Tool
Searches the internet for information using DuckDuckGo API.

**Parameters:**
```typescript
{
  query: string
}
```

**Returns:**
```typescript
{
  query: string
  results: Array<{
    title: string
    url: string
    snippet: string
  }>
  relatedTopics: Array<{
    topic: string
    description: string
  }>
}
```

### Data Processor Tool
Performs calculations and data analysis.

**Supported Operations:**
- `calculate_cagr` - Compound Annual Growth Rate
- `convert_temperature` - Temperature unit conversion
- `calculate_percentage_change` - Percentage change calculation
- `compare_values` - Statistical comparison of values

**Example:**
```typescript
{
  operation: "calculate_cagr",
  data: {
    initialValue: 100,
    finalValue: 200,
    years: 5
  }
}
```

### API Fetcher Tool
Fetches data from external APIs.

**Supported APIs:**
- `weather` - Current weather data (Open-Meteo)
- `currency_conversion` - Currency exchange rates
- `stock_price` - Stock price data (placeholder)

**Example:**
```typescript
{
  apiType: "weather",
  params: {
    city: "Tokyo"
  }
}
```

## Error Handling & Recovery

The system implements robust error handling:

1. **Retry Logic** - Failed tasks are retried up to 2 times with exponential backoff
2. **Dependency Management** - Tasks with failed dependencies are skipped or marked as failed
3. **Optional Tasks** - Optional tasks are skipped if dependencies fail
4. **Error Messages** - Clear error messages are provided to users
5. **Graceful Degradation** - The system continues executing other tasks even when one fails

## Streaming Architecture

The system uses Server-Sent Events (SSE) for real-time streaming:

1. **Client** - Establishes an EventSource connection to the streaming endpoint
2. **Server** - Sends JSON-formatted updates as tasks execute
3. **Updates** - Include task status, progress messages, and results
4. **Termination** - Connection closes when execution completes

**Stream Update Format:**
```typescript
{
  type: "plan" | "task_start" | "task_progress" | "task_complete" | "task_error" | "execution_complete" | "execution_error"
  executionId: number
  taskId?: string
  message: string
  data?: any
}
```

## Database Schema

### Executions Table
Stores the overall execution state for each user goal.

| Column | Type | Description |
| --- | --- | --- |
| id | int | Primary key |
| userId | int | User who created the execution |
| goal | text | Original user goal |
| status | enum | Current status |
| plan | json | Full execution plan |
| results | json | Final results and analysis |
| error | text | Error message if failed |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

### Tasks Table
Stores individual tasks within an execution.

| Column | Type | Description |
| --- | --- | --- |
| id | int | Primary key |
| executionId | int | Parent execution |
| taskId | varchar | Unique ID within execution |
| description | text | Task description |
| tools | json | Required tools |
| dependencies | json | Task dependencies |
| status | enum | Current status |
| output | text | Task result |
| error | text | Error message if failed |
| startedAt | timestamp | When task started |
| completedAt | timestamp | When task completed |

### Task Results Table
Stores intermediate results and streaming updates.

| Column | Type | Description |
| --- | --- | --- |
| id | int | Primary key |
| taskId | int | Parent task |
| executionId | int | Parent execution |
| message | text | Update message |
| type | enum | Message type |
| createdAt | timestamp | Creation time |

## Development

### Project Structure

```
autonomous-task-planner/
├── client/                    # Frontend (React)
│   ├── src/
│   │   ├── pages/            # Page components
│   │   ├── components/       # Reusable components
│   │   ├── hooks/            # Custom hooks
│   │   ├── lib/              # Utilities
│   │   └── App.tsx           # Main app component
│   └── public/               # Static assets
├── server/                    # Backend (Express/tRPC)
│   ├── routers.ts            # tRPC procedures
│   ├── executionEngineV2.ts  # Execution engine
│   ├── tools.ts              # Tool implementations
│   ├── db.ts                 # Database helpers
│   └── streaming.ts          # Streaming utilities
├── drizzle/                   # Database
│   ├── schema.ts             # Table definitions
│   └── migrations/           # Migration files
├── shared/                    # Shared code
│   └── types.ts              # Shared types
└── README.md                 # This file
```

### Adding New Tools

To add a new tool:

1. **Implement the tool function** in `server/tools.ts`:
   ```typescript
   export async function myTool(params: any): Promise<ToolResult> {
     // Implementation
   }
   ```

2. **Register in `executeTool`** function:
   ```typescript
   case "my_tool":
     return myTool(params);
   ```

3. **Update LLM prompts** to include the new tool in available options

### Adding New Operations

To add new data processing operations:

1. **Add case in `dataProcessor`** function:
   ```typescript
   case "my_operation":
     // Implementation
     break;
   ```

2. **Update tool documentation** with the new operation

## Performance Considerations

- **Parallel Execution** - Independent tasks run concurrently
- **Caching** - LLM responses are not cached (can be added for repeated goals)
- **Database Indexing** - Ensure indexes on userId and executionId
- **Streaming** - SSE is used for real-time updates without polling
- **Tool Timeouts** - Implement timeouts for external API calls

## Security Considerations

- **Authentication** - All endpoints require Manus OAuth authentication
- **Authorization** - Users can only access their own executions
- **Input Validation** - All user inputs are validated and sanitized
- **API Keys** - LLM and external API keys are stored server-side only
- **CORS** - Streaming endpoints have appropriate CORS headers

## Future Enhancements

- **Tool Marketplace** - Allow users to add custom tools
- **Execution Templates** - Pre-built goal templates
- **Collaborative Execution** - Share executions with other users
- **Advanced Scheduling** - Schedule goals to run at specific times
- **Webhook Integration** - Trigger executions from external systems
- **Custom LLM Models** - Support for different LLM providers
- **Execution Analytics** - Track success rates and performance metrics
- **Tool Caching** - Cache tool results to improve performance

## Troubleshooting

### Common Issues

**"Plan generation failed"**
- Ensure the goal is at least 10 characters long
- Check that the LLM API key is configured correctly
- Verify network connectivity

**"Task execution failed"**
- Check tool-specific error messages
- Verify external API availability (weather, currency, etc.)
- Review task dependencies for circular references

**"Streaming updates not appearing"**
- Ensure EventSource is supported in your browser
- Check browser console for connection errors
- Verify server is sending proper SSE headers

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is part of the AI Engineer Take-Home Assignment.

## Support

For issues or questions, please refer to the GitHub repository or contact the development team.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Vercel AI SDK](https://sdk.vercel.ai/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Database with [Drizzle ORM](https://orm.drizzle.team/)
