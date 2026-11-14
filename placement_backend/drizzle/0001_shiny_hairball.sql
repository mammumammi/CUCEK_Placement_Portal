CREATE TABLE `correction_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`studentUserId` text NOT NULL,
	`studentId` text NOT NULL,
	`studentName` text,
	`branch` text NOT NULL,
	`requestedChanges` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`reviewedBy` text,
	`reviewerRemarks` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`studentUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `correction_requests_student_user_id_idx` ON `correction_requests` (`studentUserId`);--> statement-breakpoint
CREATE INDEX `correction_requests_branch_idx` ON `correction_requests` (`branch`);--> statement-breakpoint
CREATE INDEX `correction_requests_status_idx` ON `correction_requests` (`status`);