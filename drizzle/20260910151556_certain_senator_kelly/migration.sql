CREATE TABLE `setup_image_points` (
	`id` text PRIMARY KEY,
	`setup_id` text NOT NULL,
	`image_id` text NOT NULL,
	`setup_entry_id` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	CONSTRAINT `setup_image_points_setup_id_fkey` FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `setup_image_points_entry_id_fkey` FOREIGN KEY (`setup_entry_id`) REFERENCES `setup_entries`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `setup_entries` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `setup_images` ADD `stable_id` text;--> statement-breakpoint
ALTER TABLE `setup_images` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_setup_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`stable_id` text UNIQUE,
	`setup_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`object_key` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`theme_colors` text,
	`content_type` text,
	`size` integer,
	`etag` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `setup_images_setup_id_fkey` FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_setup_images`(`id`, `setup_id`, `object_key`, `width`, `height`, `theme_colors`, `content_type`, `size`, `etag`, `created_at`) SELECT `id`, `setup_id`, `object_key`, `width`, `height`, `theme_colors`, `content_type`, `size`, `etag`, `created_at` FROM `setup_images`;--> statement-breakpoint
DROP TABLE `setup_images`;--> statement-breakpoint
ALTER TABLE `__new_setup_images` RENAME TO `setup_images`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `setup_images_id_index` ON `setup_images` (`id`);--> statement-breakpoint
CREATE INDEX `setup_images_setup_id_index` ON `setup_images` (`setup_id`);--> statement-breakpoint
CREATE INDEX `setup_image_points_setup_id_idx` ON `setup_image_points` (`setup_id`);--> statement-breakpoint
CREATE INDEX `setup_image_points_image_id_idx` ON `setup_image_points` (`image_id`);--> statement-breakpoint
CREATE INDEX `setup_image_points_entry_id_idx` ON `setup_image_points` (`setup_entry_id`);