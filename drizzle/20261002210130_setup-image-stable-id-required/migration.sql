PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_setup_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`stable_id` text NOT NULL UNIQUE,
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
INSERT INTO `__new_setup_images`(`id`, `stable_id`, `setup_id`, `position`, `object_key`, `width`, `height`, `theme_colors`, `content_type`, `size`, `etag`, `created_at`) SELECT `id`, `stable_id`, `setup_id`, `position`, `object_key`, `width`, `height`, `theme_colors`, `content_type`, `size`, `etag`, `created_at` FROM `setup_images`;--> statement-breakpoint
DROP TABLE `setup_images`;--> statement-breakpoint
ALTER TABLE `__new_setup_images` RENAME TO `setup_images`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `setup_images_id_index` ON `setup_images` (`id`);--> statement-breakpoint
CREATE INDEX `setup_images_setup_id_index` ON `setup_images` (`setup_id`);