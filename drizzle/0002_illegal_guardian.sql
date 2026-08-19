CREATE TABLE `dashboard_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metricKey` varchar(64) NOT NULL,
	`value` varchar(64) NOT NULL,
	`delta` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dashboard_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_metrics_metricKey_unique` UNIQUE(`metricKey`)
);
--> statement-breakpoint
CREATE TABLE `suite_configurations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`suiteName` varchar(128) NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`profile` varchar(64) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suite_configurations_id` PRIMARY KEY(`id`)
);
