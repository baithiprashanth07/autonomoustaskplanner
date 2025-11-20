CREATE TABLE `executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`goal` text NOT NULL,
	`status` enum('planning','executing','completed','failed') NOT NULL DEFAULT 'planning',
	`plan` json,
	`results` json,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`executionId` int NOT NULL,
	`message` text NOT NULL,
	`type` enum('progress','result','error','info') NOT NULL DEFAULT 'progress',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` int NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`tools` json,
	`dependencies` json,
	`status` enum('queued','running','succeeded','failed','skipped') NOT NULL DEFAULT 'queued',
	`output` text,
	`error` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
