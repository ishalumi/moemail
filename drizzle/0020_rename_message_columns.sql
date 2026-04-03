ALTER TABLE `message` RENAME COLUMN `from_address` TO `sender`;
--> statement-breakpoint
ALTER TABLE `message` RENAME COLUMN `to_address` TO `recipient`;
--> statement-breakpoint
ALTER TABLE `message` RENAME COLUMN `content` TO `text`;
