CREATE TABLE `application_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`applicationId` text NOT NULL,
	`roundNumber` integer NOT NULL,
	`result` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_rounds_app_round_idx` ON `application_rounds` (`applicationId`,`roundNumber`);--> statement-breakpoint
CREATE INDEX `application_rounds_app_id_idx` ON `application_rounds` (`applicationId`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`driveId` text NOT NULL,
	`studentUserId` text NOT NULL,
	`extraData` text,
	`verified` integer DEFAULT false NOT NULL,
	`verifiedBy` text,
	`placed` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`driveId`) REFERENCES `drives`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`studentUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verifiedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_drive_student_idx` ON `applications` (`driveId`,`studentUserId`);--> statement-breakpoint
CREATE INDEX `applications_drive_id_idx` ON `applications` (`driveId`);--> statement-breakpoint
CREATE INDEX `applications_student_user_id_idx` ON `applications` (`studentUserId`);--> statement-breakpoint
CREATE INDEX `applications_verified_by_idx` ON `applications` (`verifiedBy`);--> statement-breakpoint
CREATE TABLE `drives` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`description` text,
	`jdFileUrl` text,
	`deadline` text NOT NULL,
	`eligibleBranches` text NOT NULL,
	`minCgpa` real DEFAULT 0 NOT NULL,
	`maxActiveBacklogs` integer DEFAULT 0 NOT NULL,
	`extraFields` text DEFAULT '[]',
	`totalRounds` integer DEFAULT 1 NOT NULL,
	`createdBy` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `drives_created_by_idx` ON `drives` (`createdBy`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actorId` text NOT NULL,
	`studentUserId` text,
	`field` text NOT NULL,
	`oldValue` text,
	`newValue` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`studentUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_logs_actor_id_idx` ON `audit_logs` (`actorId`);--> statement-breakpoint
CREATE INDEX `audit_logs_student_user_id_idx` ON `audit_logs` (`studentUserId`);--> statement-breakpoint
CREATE TABLE `semester_results` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`semester` integer NOT NULL,
	`credits` integer DEFAULT 0 NOT NULL,
	`sgpa` real DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `semester_results_user_semester_idx` ON `semester_results` (`userId`,`semester`);--> statement-breakpoint
CREATE INDEX `semester_results_user_id_idx` ON `semester_results` (`userId`);--> statement-breakpoint
CREATE TABLE `student_profiles` (
	`userId` text PRIMARY KEY NOT NULL,
	`studentId` text NOT NULL,
	`name` text,
	`branch` text,
	`batch` text,
	`email` text,
	`phone` text,
	`activeBacklogs` integer DEFAULT 0 NOT NULL,
	`cgpa` real DEFAULT 0 NOT NULL,
	`resumeUrl` text,
	`s1MarksheetUrl` text,
	`s2MarksheetUrl` text,
	`s3MarksheetUrl` text,
	`s4MarksheetUrl` text,
	`s5MarksheetUrl` text,
	`s6MarksheetUrl` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_profiles_studentId_unique` ON `student_profiles` (`studentId`);--> statement-breakpoint
CREATE INDEX `student_profiles_user_id_idx` ON `student_profiles` (`userId`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`passwordHash` text NOT NULL,
	`role` text DEFAULT 'STUDENT' NOT NULL,
	`branch` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);