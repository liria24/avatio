CREATE TABLE `allowed_booth_categories` (
	`category_id` integer PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_category_overrides` (
	`platform` text NOT NULL,
	`item_id` text NOT NULL,
	`category` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `item_category_overrides_pk` PRIMARY KEY(`platform`, `item_id`)
);
