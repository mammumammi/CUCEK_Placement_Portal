ALTER TABLE `drives` ADD `role` text;--> statement-breakpoint
ALTER TABLE `drives` ADD `packageCategory` text DEFAULT 'GENERAL';--> statement-breakpoint
ALTER TABLE `drives` ADD `ctcLpa` real;--> statement-breakpoint
ALTER TABLE `drives` ADD `allowBacklogs` integer DEFAULT false;