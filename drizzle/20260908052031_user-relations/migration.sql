CREATE TABLE `user_mutes` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`mutee_id` text NOT NULL,
	CONSTRAINT `user_mutes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `user_mutes_mutee_id_fkey` FOREIGN KEY (`mutee_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `follow_users` RENAME TO `user_follows`;--> statement-breakpoint
ALTER TABLE `user_follows` RENAME COLUMN `target_user_id` TO `followee_id`;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `public_followees` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `public_bookmarks` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_site_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_site_followed` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_site_followee_post` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_site_coauthor_added` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_push_followed` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_push_followee_post` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_push_coauthor_added` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_webhook_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_webhook_url` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_webhook_followed` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_webhook_followee_post` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notif_webhook_coauthor_added` integer DEFAULT true NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS `follow_users_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `follow_users_user_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `follow_users_target_user_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `follow_users_user_target_uidx`;--> statement-breakpoint
CREATE INDEX `user_follows_user_id_index` ON `user_follows` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_follows_followee_id_index` ON `user_follows` (`followee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_follows_user_followee_uidx` ON `user_follows` (`user_id`,`followee_id`);--> statement-breakpoint
CREATE INDEX `user_mutes_user_id_index` ON `user_mutes` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_mutes_mutee_id_index` ON `user_mutes` (`mutee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_mutes_user_mutee_uidx` ON `user_mutes` (`user_id`,`mutee_id`);