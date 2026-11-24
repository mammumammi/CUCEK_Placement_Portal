ALTER TABLE `student_profiles` ADD `s7MarksheetUrl` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `s8MarksheetUrl` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `currentSemester` integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `additionalDetails` text DEFAULT '{}';
