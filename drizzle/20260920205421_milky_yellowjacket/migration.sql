CREATE TABLE `catalog_item_classifications` (
	`item_id` text PRIMARY KEY,
	`source_id` text NOT NULL,
	`source_updated_at` integer NOT NULL,
	`input_hash` text NOT NULL,
	`classifier_version` text NOT NULL,
	`requested_model` text NOT NULL,
	`response_model` text,
	`status` text DEFAULT 'processing' NOT NULL,
	`category` text,
	`confidence` real,
	`probabilities` text,
	`error_kind` text,
	`retry_at` integer,
	`lease_token` text,
	`lease_until` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `catalog_item_classifications_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `catalog_item_classifications_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `item_sources`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `catalog_item_classifications_source_id_idx` ON `catalog_item_classifications` (`source_id`);