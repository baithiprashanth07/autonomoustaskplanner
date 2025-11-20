/**
 * Enhanced Execution Engine with streaming support
 */

import { invokeLLM } from "./_core/llm";
import { executeTool } from "./tools";
import { ExecutionPlan, PlanTask, StreamUpdate } from "@shared/types";

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
}

Guidelines:
- Create 3-7 tasks depending on goal complexity
- Use clear, actionable descriptions
- Identify realistic dependencies
- Mark tasks as optional if they can be skipped on failure`,
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
      estimatedDuration: `${Math.ceil(parsed.tasks.length * 1.5)} minutes`,
    };
  } catch (error) {
    console.error("Plan generation failed:", error);
    throw new Error(`Failed to generate plan: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Execute a single task with retry logic
 */
export async function executeTaskWithRetry(
  task: PlanTask,
  previousResults: Map<string, any>,
  streamCallback?: (update: StreamUpdate) => void,
  maxRetries: number = 2
): Promise<{ success: boolean; output?: string; error?: string }> {
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (streamCallback && attempt > 1) {
        streamCallback({
          type: "task_progress",
          executionId: 0,
          taskId: task.id,
          message: `Retry attempt ${attempt} of ${maxRetries}`,
        });
      }

      // Stream task start
      if (streamCallback && attempt === 1) {
        streamCallback({
          type: "task_start",
          executionId: 0,
          taskId: task.id,
          message: `Starting task: ${task.description}`,
        });
      }

      // Prepare context from previous results
      const context = Array.from(previousResults.entries())
        .map(([taskId, result]) => `${taskId}: ${typeof result === "string" ? result : JSON.stringify(result).substring(0, 200)}`)
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
        lastError = toolResult.error || "Tool execution failed";
        if (attempt < maxRetries) continue;
        throw new Error(lastError);
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
            content: `You are a data analyst. Summarize the tool output in a clear, concise way relevant to the task. Keep it under 500 characters.`,
          },
          {
            role: "user",
            content: `Task: ${task.description}
Tool output: ${JSON.stringify(toolResult.data)}

Provide a clear summary of the results.`,
          },
        ],
      });

      const analysisContent = analysisResponse.choices[0].message.content;
      const summary = typeof analysisContent === "string" ? analysisContent : "Task completed";

      return {
        success: true,
        output: summary,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      if (attempt === maxRetries) {
        if (streamCallback) {
          streamCallback({
            type: "task_error",
            executionId: 0,
            taskId: task.id,
            message: `Task failed after ${maxRetries} attempts: ${lastError}`,
          });
        }
        return {
          success: false,
          error: lastError,
        };
      }
    }
  }

  return {
    success: false,
    error: lastError || "Unknown error",
  };
}

/**
 * Find tasks that can run in parallel
 */
export function getReadyTasks(
  tasks: PlanTask[],
  completedTaskIds: Set<string>,
  failedTaskIds: Set<string>
): string[] {
  const ready: string[] = [];

  for (const task of tasks) {
    if (completedTaskIds.has(task.id) || failedTaskIds.has(task.id)) {
      continue;
    }

    const allDepsCompleted = task.dependencies.every((dep) => completedTaskIds.has(dep));

    if (allDepsCompleted) {
      ready.push(task.id);
    }
  }

  return ready;
}

/**
 * Execute the full plan with streaming updates
 */
export async function executePlanWithStreaming(
  executionId: number,
  plan: ExecutionPlan,
  streamCallback?: (update: StreamUpdate) => void
): Promise<{ success: boolean; results?: any; error?: string }> {
  try {
    const completedTaskIds = new Set<string>();
    const failedTaskIds = new Set<string>();
    const taskResults = new Map<string, any>();

    // Stream execution start
    if (streamCallback) {
      streamCallback({
        type: "plan",
        executionId,
        message: `Starting execution of ${plan.totalSteps} tasks. Estimated duration: ${plan.estimatedDuration}`,
        data: plan,
      });
    }

    // Main execution loop
    let iterations = 0;
    const maxIterations = plan.tasks.length * 2;

    while (completedTaskIds.size + failedTaskIds.size < plan.tasks.length && iterations < maxIterations) {
      iterations++;

      const readyTasks = getReadyTasks(plan.tasks, completedTaskIds, failedTaskIds);

      if (readyTasks.length === 0) {
        const unresolvedTasks = plan.tasks.filter(
          (t) => !completedTaskIds.has(t.id) && !failedTaskIds.has(t.id)
        );

        if (unresolvedTasks.length > 0) {
          for (const task of unresolvedTasks) {
            const hasMissingDeps = task.dependencies.some((dep) => failedTaskIds.has(dep));
            if (hasMissingDeps) {
              if (task.optional) {
                completedTaskIds.add(task.id);
                if (streamCallback) {
                  streamCallback({
                    type: "task_complete",
                    executionId,
                    taskId: task.id,
                    message: `Optional task skipped due to failed dependency`,
                  });
                }
              } else {
                failedTaskIds.add(task.id);
                if (streamCallback) {
                  streamCallback({
                    type: "task_error",
                    executionId,
                    taskId: task.id,
                    message: `Task skipped due to failed dependency`,
                  });
                }
              }
            }
          }
          continue;
        } else {
          break;
        }
      }

      // Execute ready tasks
      for (const taskId of readyTasks) {
        const task = plan.tasks.find((t) => t.id === taskId)!;

        const result = await executeTaskWithRetry(task, taskResults, (update) => {
          update.executionId = executionId;
          if (streamCallback) streamCallback(update);
        });

        if (result.success) {
          completedTaskIds.add(taskId);
          taskResults.set(taskId, result.output);

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
          content: `You are an expert analyst. Synthesize the results from multiple tasks into a comprehensive summary with key insights and actionable recommendations.`,
        },
        {
          role: "user",
          content: `Task results:
${Array.from(taskResults.entries())
  .map(([taskId, result]) => `${taskId}: ${result}`)
  .join("\n\n")}

Provide a comprehensive analysis and summary of these results with key insights.`,
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
        },
      });
    }

    return {
      success: true,
      results: {
        analysis: finalAnalysis,
        taskResults: Object.fromEntries(taskResults),
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
