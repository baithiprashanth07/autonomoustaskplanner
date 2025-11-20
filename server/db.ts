import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, executions, tasks, taskResults, Execution, Task, TaskResult } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Execution helpers
export async function createExecution(userId: number, goal: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(executions).values({
    userId,
    goal,
    status: "planning",
  });

  return result;
}

export async function getExecution(executionId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(executions).where(eq(executions.id, executionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateExecutionStatus(executionId: number, status: string, updates?: { plan?: any; results?: any; error?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { status };
  if (updates?.plan) updateData.plan = updates.plan;
  if (updates?.results) updateData.results = updates.results;
  if (updates?.error) updateData.error = updates.error;

  await db.update(executions).set(updateData).where(eq(executions.id, executionId));
}

export async function getUserExecutions(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select().from(executions).where(eq(executions.userId, userId)).orderBy(executions.createdAt).limit(limit);
  return result;
}

// Task helpers
export async function createTask(executionId: number, taskId: string, description: string, tools: string[], dependencies: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tasks).values({
    executionId,
    taskId,
    description,
    tools,
    dependencies,
    status: "queued",
  });

  return result;
}

export async function getExecutionTasks(executionId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select().from(tasks).where(eq(tasks.executionId, executionId));
  return result;
}

export async function updateTaskStatus(taskId: number, status: string, output?: string, error?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { status };
  if (output) updateData.output = output;
  if (error) updateData.error = error;
  if (status === "running" && !updateData.startedAt) updateData.startedAt = new Date();
  if (status === "succeeded" || status === "failed" || status === "skipped") updateData.completedAt = new Date();

  await db.update(tasks).set(updateData).where(eq(tasks.id, taskId));
}

// Task results helpers
export async function addTaskResult(taskId: number, executionId: number, message: string, type: "progress" | "result" | "error" | "info" = "progress") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(taskResults).values({
    taskId,
    executionId,
    message,
    type,
  });

  return result;
}

export async function getTaskResults(taskId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select().from(taskResults).where(eq(taskResults.taskId, taskId));
  return result;
}
