/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

/**
 * Task Planner specific types
 */

export interface PlanTask {
  id: string;
  description: string;
  tools: string[];
  dependencies: string[];
  optional?: boolean;
}

export interface ExecutionPlan {
  tasks: PlanTask[];
  totalSteps: number;
  estimatedDuration?: string;
}

export interface TaskStatus {
  taskId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "skipped";
  output?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ExecutionState {
  executionId: number;
  goal: string;
  plan: ExecutionPlan;
  taskStatuses: Record<string, TaskStatus>;
  currentTask?: string;
  overallStatus: "planning" | "executing" | "completed" | "failed";
  results?: any;
  error?: string;
}

export interface StreamUpdate {
  type: "plan" | "task_start" | "task_progress" | "task_complete" | "task_error" | "execution_complete" | "execution_error";
  executionId: number;
  taskId?: string;
  message: string;
  data?: any;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}
