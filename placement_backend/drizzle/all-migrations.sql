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
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);CREATE TABLE `correction_requests` (
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
CREATE INDEX `correction_requests_status_idx` ON `correction_requests` (`status`);ALTER TABLE `student_profiles` ADD `firstName` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `lastName` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `dob` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `age` integer;ALTER TABLE `semester_results` ADD `totalMarks` real;--> statement-breakpoint
ALTER TABLE `semester_results` ADD `maxMarks` real;--> statement-breakpoint
ALTER TABLE `semester_results` ADD `percentage` real;--> statement-breakpoint
ALTER TABLE `semester_results` ADD `marksheetUrl` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `totalMarks` real;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `maxMarks` real;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `percentage` real;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `marksheetUrl` text;ALTER TABLE `student_profiles` ADD `isProfileComplete` integer DEFAULT false NOT NULL;ALTER TABLE `correction_requests` ADD `registrationNumber` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `registrationNumber` text;CREATE TABLE `branch_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`branch` text NOT NULL,
	`semester` integer NOT NULL,
	`credits` integer DEFAULT 20 NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branch_credits_branch_sem_idx` ON `branch_credits` (`branch`,`semester`);--> statement-breakpoint
CREATE INDEX `branch_credits_branch_idx` ON `branch_credits` (`branch`);ALTER TABLE `drives` ADD `role` text;--> statement-breakpoint
ALTER TABLE `drives` ADD `packageCategory` text DEFAULT 'GENERAL';--> statement-breakpoint
ALTER TABLE `drives` ADD `ctcLpa` real;--> statement-breakpoint
ALTER TABLE `drives` ADD `allowBacklogs` integer DEFAULT false;ALTER TABLE `drives` ADD `jdFileUrls` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `drives` ADD `companyFormat` text DEFAULT '[]';ALTER TABLE `student_profiles` ADD `s7MarksheetUrl` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `s8MarksheetUrl` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `currentSemester` integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `additionalDetails` text DEFAULT '{}';
CREATE TABLE `mock_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`driveId` text REFERENCES drives(`id`) ON DELETE CASCADE,
	`company` text NOT NULL,
	`role` text,
	`title` text NOT NULL,
	`durationMinutes` integer DEFAULT 60 NOT NULL,
	`totalQuestions` integer DEFAULT 2 NOT NULL,
	`topicDistribution` text DEFAULT '{}',
	`analyticsInsights` text DEFAULT '{}',
	`questions` text DEFAULT '[]',
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mock_assessments_drive_id_idx` ON `mock_assessments` (`driveId`);
--> statement-breakpoint
CREATE INDEX `mock_assessments_company_idx` ON `mock_assessments` (`company`);
--> statement-breakpoint
CREATE TABLE `mock_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`assessmentId` text NOT NULL REFERENCES mock_assessments(`id`) ON DELETE CASCADE,
	`studentUserId` text NOT NULL REFERENCES users(`id`) ON DELETE CASCADE,
	`driveId` text,
	`score` real DEFAULT 0 NOT NULL,
	`totalQuestions` integer DEFAULT 0 NOT NULL,
	`passedQuestions` integer DEFAULT 0 NOT NULL,
	`timeSpentSeconds` integer DEFAULT 0 NOT NULL,
	`answers` text DEFAULT '{}',
	`feedback` text DEFAULT '{}',
	`submittedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mock_submissions_assessment_id_idx` ON `mock_submissions` (`assessmentId`);
--> statement-breakpoint
CREATE INDEX `mock_submissions_student_user_id_idx` ON `mock_submissions` (`studentUserId`);
ALTER TABLE `drives` ADD COLUMN `mockTestPdfUrls` text DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `mock_assessments` ADD COLUMN `mcqQuestions` text DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `mock_assessments` ADD COLUMN `dataProvenance` text DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE `mock_assessments` ADD COLUMN `mockTestPdfUrls` text DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `mock_submissions` ADD COLUMN `mcqScore` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `mock_submissions` ADD COLUMN `mcqAnswers` text DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE `mock_submissions` ADD COLUMN `codingScore` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `mock_submissions` ADD COLUMN `totalMcqs` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `mock_submissions` ADD COLUMN `passedMcqs` integer DEFAULT 0 NOT NULL;
ALTER TABLE `student_profiles` ADD COLUMN `placementStatus` text DEFAULT 'UNPLACED' NOT NULL;
--> statement-breakpoint
ALTER TABLE `drives` ADD COLUMN `youtubeUrl` text;
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
ALTER TABLE `drives` ADD `registrationLink` text;
ALTER TABLE `drives` ADD `codingEnabled` integer DEFAULT 1;
