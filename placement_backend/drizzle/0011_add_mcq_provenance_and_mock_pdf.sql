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
