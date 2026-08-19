ALTER TABLE `test_runs` MODIFY COLUMN `status` enum('QUEUED','RUNNING','PASSED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED';--> statement-breakpoint
ALTER TABLE `test_runs` ADD `currentStage` varchar(32) DEFAULT 'QUEUED' NOT NULL;--> statement-breakpoint
ALTER TABLE `test_runs` ADD `attempt` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `test_runs` ADD `cancelRequested` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `test_runs` ADD `resumeFromStage` varchar(32);--> statement-breakpoint
ALTER TABLE `test_runs` ADD `parentRunKey` varchar(32);--> statement-breakpoint
ALTER TABLE `test_runs` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;