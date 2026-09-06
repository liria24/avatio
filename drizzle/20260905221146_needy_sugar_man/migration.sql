CREATE TABLE `catalog_migration_runs` (
	`id` text PRIMARY KEY,
	`stage` text NOT NULL,
	`cursor` text,
	`processed` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	`last_error` text,
	`lease_token` text,
	`lease_until` integer,
	`verification` text,
	`verified_at` integer
);
--> statement-breakpoint
CREATE TABLE `legal_acceptances` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`document` text NOT NULL,
	`version` text NOT NULL,
	`source_revision` text NOT NULL,
	`source_commit` text,
	`source_locale` text NOT NULL,
	`accepted_at` integer NOT NULL,
	CONSTRAINT `fk_legal_acceptances_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legal_acceptances_user_document_version_uidx` ON `legal_acceptances` (`user_id`,`document`,`version`);