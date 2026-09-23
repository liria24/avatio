ALTER TABLE `item_reports` ADD `catalog_item_id` text REFERENCES catalog_items(id) ON UPDATE CASCADE ON DELETE CASCADE;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_item_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`reporter_id` text NOT NULL,
	`item_id` text,
	`catalog_item_id` text,
	`name_error` integer DEFAULT false NOT NULL,
	`irrelevant` integer DEFAULT false NOT NULL,
	`other` integer DEFAULT false NOT NULL,
	`comment` text,
	`is_resolved` integer DEFAULT false NOT NULL,
	`idempotency_request_id` text UNIQUE,
	CONSTRAINT `fk_item_reports_catalog_item_id_catalog_items_id_fk` FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_item_reports_idempotency_request_id_idempotency_requests_id_fk` FOREIGN KEY (`idempotency_request_id`) REFERENCES `idempotency_requests`(`id`) ON DELETE SET NULL,
	CONSTRAINT `item_reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `item_reports_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_item_reports`(`id`, `created_at`, `reporter_id`, `item_id`, `name_error`, `irrelevant`, `other`, `comment`, `is_resolved`, `idempotency_request_id`) SELECT `id`, `created_at`, `reporter_id`, `item_id`, `name_error`, `irrelevant`, `other`, `comment`, `is_resolved`, `idempotency_request_id` FROM `item_reports`;--> statement-breakpoint
DROP TABLE `item_reports`;--> statement-breakpoint
ALTER TABLE `__new_item_reports` RENAME TO `item_reports`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `item_reports_id_index` ON `item_reports` (`id`);--> statement-breakpoint
CREATE INDEX `item_reports_item_id_index` ON `item_reports` (`item_id`);--> statement-breakpoint
CREATE INDEX `item_reports_reporter_id_index` ON `item_reports` (`reporter_id`);