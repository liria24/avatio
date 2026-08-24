CREATE TABLE `catalog_items` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`display_name_override` text,
	`category_override` text,
	`category_override_origin` text
);
--> statement-breakpoint
CREATE TABLE `item_sources` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`item_id` text NOT NULL,
	`publisher_source_id` text,
	`provider_key` text NOT NULL,
	`external_id` text NOT NULL,
	`canonical_url` text NOT NULL,
	`primary` integer DEFAULT false NOT NULL,
	`availability` text DEFAULT 'unknown' NOT NULL,
	`sync_state` text DEFAULT 'stale' NOT NULL,
	`provider_category_key` text,
	`provider_category_label` text,
	`mapped_category` text,
	`display_name` text NOT NULL,
	`image` text,
	`price` text,
	`popularity_count` integer,
	`nsfw` integer DEFAULT false NOT NULL,
	`metadata` text,
	`last_checked_at` integer,
	`last_successful_sync_at` integer,
	`next_check_at` integer,
	`sync_lease_until` integer,
	`sync_lease_token` text,
	`last_error_kind` text,
	`last_error_at` integer,
	CONSTRAINT `item_sources_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `item_sources_publisher_source_id_fkey` FOREIGN KEY (`publisher_source_id`) REFERENCES `publisher_sources`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `publisher_sources` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`publisher_id` text NOT NULL,
	`provider_key` text NOT NULL,
	`external_id` text NOT NULL,
	`canonical_url` text NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`provider_verified` integer DEFAULT false NOT NULL,
	`metadata` text,
	CONSTRAINT `publisher_sources_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `publishers`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `publisher_verification_challenges` (
	`id` text PRIMARY KEY,
	`code` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `publisher_verification_challenges_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `publishers` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`display_name_override` text,
	`image_override` text
);
--> statement-breakpoint
CREATE TABLE `setup_entries` (
	`id` text PRIMARY KEY,
	`item_id` text NOT NULL,
	`setup_id` text NOT NULL,
	`category_override` text,
	`unsupported` integer DEFAULT false NOT NULL,
	`note` text,
	CONSTRAINT `setup_entries_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `setup_entries_setup_id_fkey` FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `setup_entry_shapekeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`setup_entry_id` text NOT NULL,
	`name` text NOT NULL,
	`value` real NOT NULL,
	CONSTRAINT `setup_entry_shapekeys_entry_id_fkey` FOREIGN KEY (`setup_entry_id`) REFERENCES `setup_entries`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_publishers` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`publisher_id` text NOT NULL,
	CONSTRAINT `user_publishers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `user_publishers_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `publishers`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `catalog_items_display_name_override_idx` ON `catalog_items` (`display_name_override`);--> statement-breakpoint
CREATE INDEX `item_sources_item_id_idx` ON `item_sources` (`item_id`);--> statement-breakpoint
CREATE INDEX `item_sources_publisher_source_id_idx` ON `item_sources` (`publisher_source_id`);--> statement-breakpoint
CREATE INDEX `item_sources_due_lease_idx` ON `item_sources` (`next_check_at`,`sync_lease_until`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_sources_provider_external_uidx` ON `item_sources` (`provider_key`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_sources_primary_item_uidx` ON `item_sources` (`item_id`) WHERE "item_sources"."primary" = 1;--> statement-breakpoint
CREATE INDEX `publisher_sources_publisher_id_idx` ON `publisher_sources` (`publisher_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `publisher_sources_provider_external_uidx` ON `publisher_sources` (`provider_key`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `publisher_verification_challenges_user_id_uidx` ON `publisher_verification_challenges` (`user_id`);--> statement-breakpoint
CREATE INDEX `publishers_display_name_override_idx` ON `publishers` (`display_name_override`);--> statement-breakpoint
CREATE INDEX `setup_entries_setup_id_idx` ON `setup_entries` (`setup_id`);--> statement-breakpoint
CREATE INDEX `setup_entries_item_id_idx` ON `setup_entries` (`item_id`);--> statement-breakpoint
CREATE INDEX `setup_entry_shapekeys_entry_id_idx` ON `setup_entry_shapekeys` (`setup_entry_id`);--> statement-breakpoint
CREATE INDEX `user_publishers_user_id_idx` ON `user_publishers` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_publishers_publisher_id_idx` ON `user_publishers` (`publisher_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_publishers_user_publisher_uidx` ON `user_publishers` (`user_id`,`publisher_id`);