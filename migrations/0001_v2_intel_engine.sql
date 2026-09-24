CREATE TABLE `lookup_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`report` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lookup_cache_expires_idx` ON `lookup_cache` (`expires_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_common_scams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`content_type` text NOT NULL,
	`category` text NOT NULL,
	`is_known_scam` integer DEFAULT 1,
	`source` text,
	`created_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_common_scams`("id", "content", "content_type", "category", "is_known_scam", "source", "created_at") SELECT "id", "content", "content_type", "category", "is_known_scam", "source", "created_at" FROM `common_scams`;--> statement-breakpoint
DROP TABLE `common_scams`;--> statement-breakpoint
ALTER TABLE `__new_common_scams` RENAME TO `common_scams`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DELETE FROM `common_scams` WHERE `id` NOT IN (SELECT MIN(`id`) FROM `common_scams` GROUP BY `content_type`, `content`);--> statement-breakpoint
UPDATE `common_scams` SET `created_at` = CAST(strftime('%s', `created_at`) AS INTEGER) * 1000 WHERE typeof(`created_at`) = 'text';--> statement-breakpoint
CREATE UNIQUE INDEX `common_scams_content_uidx` ON `common_scams` (`content_type`,`content`);--> statement-breakpoint
CREATE TABLE `__new_scam_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_type` text NOT NULL,
	`content` text NOT NULL,
	`report_type` text NOT NULL,
	`description` text,
	`risk_score` real DEFAULT 0,
	`report_count` integer DEFAULT 1,
	`verified` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer,
	`tags` text,
	`metadata` text
);
--> statement-breakpoint
INSERT INTO `__new_scam_reports`("id", "content_type", "content", "report_type", "description", "risk_score", "report_count", "verified", "created_at", "updated_at", "tags", "metadata") SELECT "id", "content_type", "content", "report_type", "description", "risk_score", "report_count", "verified", "created_at", "updated_at", "tags", "metadata" FROM `scam_reports`;--> statement-breakpoint
DROP TABLE `scam_reports`;--> statement-breakpoint
ALTER TABLE `__new_scam_reports` RENAME TO `scam_reports`;--> statement-breakpoint
CREATE INDEX `scam_reports_lookup_idx` ON `scam_reports` (`content_type`,`content`);--> statement-breakpoint
UPDATE `scam_reports` SET `created_at` = CAST(strftime('%s', `created_at`) AS INTEGER) * 1000 WHERE typeof(`created_at`) = 'text';--> statement-breakpoint
UPDATE `scam_reports` SET `updated_at` = CAST(strftime('%s', `updated_at`) AS INTEGER) * 1000 WHERE typeof(`updated_at`) = 'text';--> statement-breakpoint
CREATE TABLE `__new_statistics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`metric` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_statistics`("id", "metric", "value", "updated_at") SELECT "id", "metric", "value", "updated_at" FROM `statistics`;--> statement-breakpoint
DROP TABLE `statistics`;--> statement-breakpoint
ALTER TABLE `__new_statistics` RENAME TO `statistics`;--> statement-breakpoint
CREATE UNIQUE INDEX `statistics_metric_unique` ON `statistics` (`metric`);--> statement-breakpoint
CREATE INDEX `metric_idx` ON `statistics` (`metric`);--> statement-breakpoint
UPDATE `statistics` SET `updated_at` = CAST(strftime('%s', `updated_at`) AS INTEGER) * 1000 WHERE typeof(`updated_at`) = 'text';--> statement-breakpoint
CREATE TABLE `report_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`reporter_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `scam_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `report_events_report_idx` ON `report_events` (`report_id`);--> statement-breakpoint
CREATE INDEX `report_events_created_idx` ON `report_events` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `report_events_reporter_uidx` ON `report_events` (`report_id`,`reporter_hash`);
