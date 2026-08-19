CREATE TABLE `reconciliation_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidenceKey` varchar(64) NOT NULL,
	`assetType` varchar(32) NOT NULL,
	`transactionHash` varchar(80) NOT NULL,
	`eventCount` int NOT NULL,
	`expectedLedger` text NOT NULL,
	`observedLedger` text NOT NULL,
	`aligned` int NOT NULL DEFAULT 1,
	`mismatches` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reconciliation_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `reconciliation_evidence_evidenceKey_unique` UNIQUE(`evidenceKey`)
);
