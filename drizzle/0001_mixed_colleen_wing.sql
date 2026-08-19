CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorRole` enum('ADMIN','ANALYST','SYSTEM') NOT NULL,
	`action` varchar(255) NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`findingKey` varchar(32) NOT NULL,
	`severity` enum('CRITICAL','HIGH','MEDIUM','LOW') NOT NULL,
	`category` varchar(128) NOT NULL,
	`component` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL,
	`expectedBehavior` text,
	`actualBehavior` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `security_findings_id` PRIMARY KEY(`id`),
	CONSTRAINT `security_findings_findingKey_unique` UNIQUE(`findingKey`)
);
--> statement-breakpoint
CREATE TABLE `test_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runKey` varchar(32) NOT NULL,
	`risk` enum('CRITICAL','HIGH','MEDIUM','LOW') NOT NULL,
	`profile` varchar(64) NOT NULL,
	`parallel` int NOT NULL DEFAULT 1,
	`status` enum('QUEUED','RUNNING','PASSED','FAILED') NOT NULL DEFAULT 'QUEUED',
	`isolationWallet` varchar(64) NOT NULL,
	`isolationAsset` varchar(64) NOT NULL,
	`chainId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `test_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `test_runs_runKey_unique` UNIQUE(`runKey`)
);
