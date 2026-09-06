CREATE TABLE `publisher_source_ownerships` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`publisher_source_id` text NOT NULL,
	`method` text NOT NULL,
	`verified_at` integer NOT NULL,
	CONSTRAINT `publisher_source_ownerships_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `publisher_source_ownerships_source_id_fkey` FOREIGN KEY (`publisher_source_id`) REFERENCES `publisher_sources`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `publisher_source_verification_challenges` (
	`id` text PRIMARY KEY,
	`code` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`publisher_source_id` text NOT NULL,
	`method` text NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT `publisher_verification_challenges_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `publisher_verification_challenges_source_id_fkey` FOREIGN KEY (`publisher_source_id`) REFERENCES `publisher_sources`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `setup_drafts` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS `publisher_verification_challenges_user_id_uidx`;--> statement-breakpoint
CREATE INDEX `publisher_source_ownerships_user_id_idx` ON `publisher_source_ownerships` (`user_id`);--> statement-breakpoint
CREATE INDEX `publisher_source_ownerships_source_id_idx` ON `publisher_source_ownerships` (`publisher_source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `publisher_source_ownerships_user_source_uidx` ON `publisher_source_ownerships` (`user_id`,`publisher_source_id`);--> statement-breakpoint
CREATE INDEX `publisher_verification_challenges_user_id_idx` ON `publisher_source_verification_challenges` (`user_id`);--> statement-breakpoint
CREATE INDEX `publisher_verification_challenges_source_id_idx` ON `publisher_source_verification_challenges` (`publisher_source_id`);--> statement-breakpoint
CREATE INDEX `publisher_verification_challenges_expires_at_idx` ON `publisher_source_verification_challenges` (`expires_at`);--> statement-breakpoint
DROP TABLE `publisher_verification_challenges`;