CREATE TABLE `analysis_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_hash` text NOT NULL,
	`content_type` text NOT NULL,
	`content` text NOT NULL,
	`risk_score` real NOT NULL,
	`risk_level` text NOT NULL,
	`analysis` text NOT NULL,
	`reasoning` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`expires_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_cache_content_hash_unique` ON `analysis_cache` (`content_hash`);--> statement-breakpoint
CREATE INDEX `content_hash_idx` ON `analysis_cache` (`content_hash`);--> statement-breakpoint
CREATE TABLE `common_scams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`content_type` text NOT NULL,
	`category` text NOT NULL,
	`is_known_scam` integer DEFAULT 1,
	`source` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `scam_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_type` text NOT NULL,
	`content` text NOT NULL,
	`report_type` text NOT NULL,
	`description` text,
	`risk_score` real DEFAULT 0,
	`report_count` integer DEFAULT 1,
	`verified` integer DEFAULT 0,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	`tags` text,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `statistics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`metric` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statistics_metric_unique` ON `statistics` (`metric`);--> statement-breakpoint
CREATE INDEX `metric_idx` ON `statistics` (`metric`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`email` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);