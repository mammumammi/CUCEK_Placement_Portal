CREATE TABLE IF NOT EXISTS `student_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`studentUserId` text NOT NULL,
	`driveId` text,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`roundLabel` text,
	`read` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`studentUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`driveId`) REFERENCES `drives`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `student_notifications_user_idx` ON `student_notifications` (`studentUserId`);
