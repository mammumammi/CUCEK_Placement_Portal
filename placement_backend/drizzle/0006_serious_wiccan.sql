CREATE TABLE `branch_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`branch` text NOT NULL,
	`semester` integer NOT NULL,
	`credits` integer DEFAULT 20 NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branch_credits_branch_sem_idx` ON `branch_credits` (`branch`,`semester`);--> statement-breakpoint
CREATE INDEX `branch_credits_branch_idx` ON `branch_credits` (`branch`);