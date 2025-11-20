/**
 * Execution Engine - Core logic for task planning and execution
 */

import { invokeLLM } from "./_core/llm";
import { executeTool } from "./tools";
import { ExecutionPlan, PlanTask, StreamUpdate, ToolResult } from "@shared/types";
import { createTask, updateTaskStatus, addTaskResult, getExecutionTasks, updateExecutionStatus } from "./db";

/**
 * Generate an execution plan from a user goal using the LLM
 */
export async function generatePlan(goal: string): Promise<ExecutionPlan> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert task planner. Break down complex goals into actionable steps.
For each task, identify the tools needed (web_search, data_processor, api_fetcher) and dependencies.
Return a JSON plan with the following structure:
{
  "tasks": [
    {
      "id": "task_1",
      "description": "Task description",
      "tools": ["tool_name"],
      "dependencies": ["task_id_if_any"],
      "optional": false
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Create a detailed execution plan for: ${goal}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "execution_plan",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    description: { type: "string" },
                    tools: { type: "array", items: { type: "string" } },
                    dependencies: { type: "array", items: { type: "string" } },
                    optional: { type: "boolean" },
                  },
                  required: ["id", "description", "tools", "dependencies"],
                },
              },
            },
            required: ["tasks"],
            additionalProperties: false,
          },
        },
      },
    });

    const responseContent = response.choices[0].message.content;
    const content = typeof responseContent === "string" ? responseContent : "{}";
    const parsed = JSON.parse(content);

    return {
      tasks: parsed.tasks,
      totalSteps: parsed.tasks.length,
      estimatedDuration: `${parsed.tasks.length * 2} minutes`,
    };
  } catch (error) {
    console.error("Plan generation failed:", error);
    throw new Error(`Failed to generate plan: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Build a dependency graph to determine task execution order
 */
export function buildDependencyGraph(tasks: PlanTask[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  // Initialize all tasks
  for (const task of tasks) {
    graph.set(task.id, new Set());
  }

  // Add dependencies
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (graph.has(dep)) {
        graph.get(dep)!.add(task.id);
      }
    }
  }

  return graph;
}

/**
 * Find tasks that can run in parallel (no dependencies or all dependencies completed)
 */
export function getReadyTasks(
  tasks: PlanTask[],
  completedTaskIds: Set<string>,
  failedTaskIds: Set<string>
): string[] {
  const ready: string[] = [];

  for (const task of tasks) {
    // Skip already completed or failed tasks
    if (completedTaskIds.has(task.id) || failedTaskIds.has(task.id)) {
      continue;
    }

    // Check if all dependencies are completed
    const allDepsCompleted = task.dependencies.every((dep) => completedTaskIds.has(dep));

    if (allDepsCompleted) {
      ready.push(task.id);
    }
  }

  return ready;
}

/**
 * Execute a single task
 */
export async function executeTask(
  task: PlanTask,
  previousResults: Map<string, any>,
  streamCallback?: (update: StreamUpdate) => void
): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    // Stream task start
    if (streamCallback) {
      streamCallback({
        type: "task_start",
        executionId: 0, // Will be set by caller
        taskId: task.id,
        message: `Starting task: ${task.description}`,
      });
    }

    // Prepare context from previous results
    const context = Array.from(previousResults.entries())
      .map(([taskId, result]) => `${taskId}: ${JSON.stringify(result)}`)
      .join("\n");

    // Use LLM to determine which tool to use and how
    const toolSelectionResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a task executor. Based on the task description and available tools, determine which tool to use and what parameters to provide.
Available tools: web_search, data_processor, api_fetcher
Return a JSON response with the tool name and parameters.`,
        },
        {
          role: "user",
          content: `Task: ${task.description}
Tools needed: ${task.tools.join(", ")}
Previous results:
${context || "None"}

Determine which tool to use and provide parameters as JSON.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tool_execution",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tool: { type: "string" },
              params: { type: "object" },
              reasoning: { type: "string" },
            },
            required: ["tool", "params"],
            additionalProperties: false,
          },
        },
      },
    });

    const toolContent = toolSelectionResponse.choices[0].message.content;
    const toolSelection = JSON.parse(typeof toolContent === "string" ? toolContent : "{}");

    if (streamCallback) {
      streamCallback({
        type: "task_progress",
        executionId: 0,
        taskId: task.id,
        message: `Using tool: ${toolSelection.tool}. Reasoning: ${toolSelection.reasoning}`,
      });
    }

    // Execute the tool
    const toolResult = await executeTool(toolSelection.tool, toolSelection.params);

    if (!toolResult.success) {
      throw new Error(toolResult.error || "Tool execution failed");
    }

    if (streamCallback) {
      streamCallback({
        type: "task_progress",
        executionId: 0,
        taskId: task.id,
        message: `Tool executed successfully`,
        data: toolResult.data,
      });
    }

    // Use LLM to analyze and summarize the result
    const analysisResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a data analyst. Summarize the tool output in a clear, concise way relevant to the task.`,
        },
        {
          role: "user",
          content: `Task: ${task.description}
Tool output: ${JSON.stringify(toolResult.data)}

Provide a clear summary of the results.`,
        },
      ],
    });

    const content = analysisResponse.choices[0].message.content;
    const summary = typeof content === "string" ? content : "Task completed";

    return {
      success: true,
      output: summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (streamCallback) {
      streamCallback({
        type: "task_error",
        executionId: 0,
        taskId: task.id,
        message: `Task failed: ${errorMessage}`,
      });
    }
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Execute the full plan with streaming updates
 */
export async function executePlan(
  executionId: number,
  plan: ExecutionPlan,
  streamCallback?: (update: StreamUpdate) => void
): Promise<{ success: boolean; results?: any; error?: string }> {
  try {
    const completedTaskIds = new Set<string>();
    const failedTaskIds = new Set<string>();
    const taskResults = new Map<string, any>();
    const taskStatuses = new Map<string, any>();

    // Stream execution start
    if (streamCallback) {
      streamCallback({
        type: "plan",
        executionId,
        message: `Starting execution of ${plan.totalSteps} tasks`,
        data: plan,
      });
    }

    // Main execution loop
    while (completedTaskIds.size + failedTaskIds.size < plan.tasks.length) {
      // Find tasks that are ready to execute
      const readyTasks = getReadyTasks(plan.tasks, completedTaskIds, failedTaskIds);

      if (readyTasks.length === 0) {
        // Check if there are unresolved dependencies
        const unresolvedTasks = plan.tasks.filter(
          (t) => !completedTaskIds.has(t.id) && !failedTaskIds.has(t.id)
        );

        if (unresolvedTasks.length > 0) {
          // Some tasks have failed dependencies - skip them
          for (const task of unresolvedTasks) {
            const hasMissingDeps = task.dependencies.some((dep) => failedTaskIds.has(dep));
            if (hasMissingDeps && !task.optional) {
              failedTaskIds.add(task.id);
              if (streamCallback) {
                streamCallback({
                  type: "task_error",
                  executionId,
                  taskId: task.id,
                  message: `Task skipped due to failed dependency`,
                });
              }
            } else if (hasMissingDeps && task.optional) {
              completedTaskIds.add(task.id);
              if (streamCallback) {
                streamCallback({
                  type: "task_complete",
                  executionId,
                  taskId: task.id,
                  message: `Optional task skipped due to failed dependency`,
                });
              }
            }
          }
          continue;
        } else {
          break;
        }
      }

      // Execute ready tasks in parallel (for simplicity, we'll execute sequentially)
      for (const taskId of readyTasks) {
        const task = plan.tasks.find((t) => t.id === taskId)!;

        const result = await executeTask(task, taskResults, (update) => {
          update.executionId = executionId;
          if (streamCallback) streamCallback(update);
        });

        if (result.success) {
          completedTaskIds.add(taskId);
          taskResults.set(taskId, result.output);
          taskStatuses.set(taskId, { status: "succeeded", output: result.output });

          if (streamCallback) {
            streamCallback({
              type: "task_complete",
              executionId,
              taskId,
              message: `Task completed: ${task.description}`,
              data: result.output,
            });
          }
        } else {
          failedTaskIds.add(taskId);
          taskStatuses.set(taskId, { status: "failed", error: result.error });

          if (streamCallback) {
            streamCallback({
              type: "task_error",
              executionId,
              taskId,
              message: `Task failed: ${result.error}`,
            });
          }
        }
      }
    }

    // Generate final analysis using LLM
    const finalAnalysisResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert analyst. Synthesize the results from multiple tasks into a comprehensive summary with key insights.`,
        },
        {
          role: "user",
          content: `Task results:
${Array.from(taskResults.entries())
  .map(([taskId, result]) => `${taskId}: ${result}`)
  .join("\n")}

Provide a comprehensive analysis and summary of these results.`,
        },
      ],
    });

    const finalContent = finalAnalysisResponse.choices[0].message.content;
    const finalAnalysis = typeof finalContent === "string" ? finalContent : "Analysis completed";

    if (streamCallback) {
      streamCallback({
        type: "execution_complete",
        executionId,
        message: "Execution completed successfully",
        data: {
          analysis: finalAnalysis,
          taskResults: Object.fromEntries(taskResults),
          taskStatuses: Object.fromEntries(taskStatuses),
        },
      });
    }

    return {
      success: true,
      results: {
        analysis: finalAnalysis,
        taskResults: Object.fromEntries(taskResults),
        taskStatuses: Object.fromEntries(taskStatuses),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (streamCallback) {
      streamCallback({
        type: "execution_error",
        executionId,
        message: `Execution failed: ${errorMessage}`,
      });
    }
    return {
      success: false,
      error: errorMessage,
    };
  }
}
