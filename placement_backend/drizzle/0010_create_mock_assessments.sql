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
