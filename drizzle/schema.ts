import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Executions table - stores the overall execution state for each user goal
 */
export const executions = mysqlTable("executions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  goal: text("goal").notNull(),
  status: mysqlEnum("status", ["planning", "executing", "completed", "failed"]).default("planning").notNull(),
  plan: json("plan"), // Stores the full plan structure with tasks and dependencies
  results: json("results"), // Stores final results and analysis
  error: text("error"), // Error message if execution failed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Execution = typeof executions.$inferSelect;
export type InsertExecution = typeof executions.$inferInsert;

/**
 * Tasks table - stores individual tasks within an execution
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  executionId: int("executionId").notNull(),
  taskId: varchar("taskId", { length: 64 }).notNull(), // Unique identifier within execution
  description: text("description").notNull(),
  tools: json("tools"), // Array of tool names required for this task
  dependencies: json("dependencies"), // Array of task IDs this task depends on
  status: mysqlEnum("status", ["queued", "running", "succeeded", "failed", "skipped"]).default("queued").notNull(),
  output: text("output"), // Result/output of the task
  error: text("error"), // Error message if task failed
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Task results table - stores intermediate results and streaming updates
 */
export const taskResults = mysqlTable("taskResults", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  executionId: int("executionId").notNull(),
  message: text("message").notNull(), // Streaming message or intermediate result
  type: mysqlEnum("type", ["progress", "result", "error", "info"]).default("progress").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskResult = typeof taskResults.$inferSelect;
export type InsertTaskResult = typeof taskResults.$inferInsert;
