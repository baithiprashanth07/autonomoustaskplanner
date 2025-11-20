import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { generatePlan, executePlanWithStreaming } from "./executionEngineV2";
import { createExecution, getExecution, getUserExecutions, updateExecutionStatus, getExecutionTasks } from "./db";
import { TRPCError } from "@trpc/server";
import { Response } from "express";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Task Planner routes with streaming support
  planner: router({
    /**
     * Create a new execution and generate a plan
     */
    createExecution: protectedProcedure
      .input(z.object({ goal: z.string().min(10) }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Create execution record
          const result = await createExecution(ctx.user.id, input.goal);
          const executionId = (result as any).insertId;

          // Generate plan
          const plan = await generatePlan(input.goal);

          // Update execution with plan
          await updateExecutionStatus(executionId, "planning", { plan });

          return {
            executionId,
            goal: input.goal,
            plan,
          };
        } catch (error) {
          console.error("Failed to create execution:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to create execution",
          });
        }
      }),

    /**
     * Start execution of a plan (with streaming)
     * Note: For true streaming, this should be called via a separate endpoint
     */
    startExecution: protectedProcedure
      .input(z.object({ executionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const execution = await getExecution(input.executionId);

          if (!execution) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Execution not found",
            });
          }

          if (execution.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You do not have permission to execute this plan",
            });
          }

          // Update status to executing
          await updateExecutionStatus(input.executionId, "executing");

          // Execute the plan
          const plan = execution.plan as any;
          const result = await executePlanWithStreaming(input.executionId, plan);

          if (result.success) {
            await updateExecutionStatus(input.executionId, "completed", { results: result.results });
          } else {
            await updateExecutionStatus(input.executionId, "failed", { error: result.error });
          }

          return {
            success: result.success,
            results: result.results,
            error: result.error,
          };
        } catch (error) {
          console.error("Failed to execute plan:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to execute plan",
          });
        }
      }),

    /**
     * Get execution details
     */
    getExecution: protectedProcedure
      .input(z.object({ executionId: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          const execution = await getExecution(input.executionId);

          if (!execution) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Execution not found",
            });
          }

          if (execution.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You do not have permission to view this execution",
            });
          }

          const tasks = await getExecutionTasks(input.executionId);

          return {
            ...execution,
            tasks,
          };
        } catch (error) {
          console.error("Failed to get execution:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get execution",
          });
        }
      }),

    /**
     * Get user's execution history
     */
    getExecutionHistory: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input, ctx }) => {
        try {
          const executions = await getUserExecutions(ctx.user.id, input.limit);
          return executions;
        } catch (error) {
          console.error("Failed to get execution history:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to get execution history",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

/**
 * Export a streaming execution handler for direct use
 */
export async function handleStreamingExecution(
  executionId: number,
  userId: number,
  res: Response
) {
  try {
    const execution = await getExecution(executionId);

    if (!execution) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }

    if (execution.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Initialize streaming response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Update status to executing
    await updateExecutionStatus(executionId, "executing");

    // Create streaming callback
    const streamCallback = (update: any) => {
      try {
        const data = JSON.stringify(update);
        res.write(`data: ${data}\n\n`);
      } catch (error) {
        console.error("Error sending stream update:", error);
      }
    };

    // Execute the plan
    const plan = execution.plan as any;
    const result = await executePlanWithStreaming(executionId, plan, streamCallback);

    if (result.success) {
      await updateExecutionStatus(executionId, "completed", { results: result.results });
    } else {
      await updateExecutionStatus(executionId, "failed", { error: result.error });
    }

    res.end();
  } catch (error) {
    console.error("Streaming execution error:", error);
    res.status(500).json({ error: "Execution failed" });
  }
}
