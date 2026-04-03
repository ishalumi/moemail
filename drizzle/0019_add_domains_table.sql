CREATE TABLE `domain` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'native' NOT NULL,
	`parent_domain` text,
	`cf_zone_id` text,
	`cf_route_enabled` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domain_name_unique` ON `domain` (`name`);
--> statement-breakpoint
CREATE INDEX `domain_name_idx` ON `domain` (`name`);
--> statement-breakpoint
CREATE INDEX `domain_type_idx` ON `domain` (`type`);
--> statement-breakpoint
-- 默认域名（部署后根据实际 KV 中 EMAIL_DOMAINS 的值调整）
INSERT INTO `domain` (`id`, `name`, `type`, `enabled`, `created_at`)
VALUES (lower(hex(randomblob(16))), 'moemail.app', 'native', 1, unixepoch() * 1000);
