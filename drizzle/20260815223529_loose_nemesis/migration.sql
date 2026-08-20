CREATE TABLE `accounts` (
	`id` text PRIMARY KEY,
	`issuer` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`details` text,
	CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`setup_id` text NOT NULL,
	CONSTRAINT `bookmarks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `bookmarks_setup_id_fkey` FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `changelog_authors` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`changelog_slug` text NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `changelog_authors_changelog_slug_fkey` FOREIGN KEY (`changelog_slug`) REFERENCES `changelogs`(`slug`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `changelog_authors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `changelog_i18ns` (
	`id` text PRIMARY KEY,
	`changelog_slug` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`markdown` text NOT NULL,
	`html` text,
	`ai_generated` integer DEFAULT false NOT NULL,
	CONSTRAINT `changelog_i18ns_changelog_slug_fkey` FOREIGN KEY (`changelog_slug`) REFERENCES `changelogs`(`slug`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `changelogs` (
	`slug` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`title` text NOT NULL,
	`markdown` text NOT NULL,
	`html` text,
	`idempotency_request_id` text UNIQUE,
	CONSTRAINT `fk_changelogs_idempotency_request_id_idempotency_requests_id_fk` FOREIGN KEY (`idempotency_request_id`) REFERENCES `idempotency_requests`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`message_id` text NOT NULL,
	`subject` text,
	`from_address` text NOT NULL,
	`from_name` text,
	`to_address` text NOT NULL,
	`snippet` text,
	`text_body` text,
	`html_body` text,
	`attachments` text DEFAULT '[]' NOT NULL,
	`raw_size` integer,
	`is_read` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`received_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feedbacks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`fingerprint` text NOT NULL,
	`comment` text NOT NULL,
	`context_path` text,
	`is_closed` integer DEFAULT false NOT NULL,
	`idempotency_request_id` text UNIQUE,
	CONSTRAINT `fk_feedbacks_idempotency_request_id_idempotency_requests_id_fk` FOREIGN KEY (`idempotency_request_id`) REFERENCES `idempotency_requests`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `follow_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`target_user_id` text NOT NULL,
	CONSTRAINT `follow_users_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `follow_users_target_user_id_fkey` FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `idempotency_requests` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`scope` text NOT NULL,
	`route` text NOT NULL,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`resource_id` text,
	`response` text,
	`status_code` integer,
	`lease_expires_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`reporter_id` text NOT NULL,
	`item_id` text NOT NULL,
	`name_error` integer DEFAULT false NOT NULL,
	`irrelevant` integer DEFAULT false NOT NULL,
	`other` integer DEFAULT false NOT NULL,
	`comment` text,
	`is_resolved` integer DEFAULT false NOT NULL,
	`idempotency_request_id` text UNIQUE,
	CONSTRAINT `fk_item_reports_idempotency_request_id_idempotency_requests_id_fk` FOREIGN KEY (`idempotency_request_id`) REFERENCES `idempotency_requests`(`id`) ON DELETE SET NULL,
	CONSTRAINT `item_reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `item_reports_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`platform` text NOT NULL,
	`outdated` integer DEFAULT false NOT NULL,
	`shop_id` text,
	`name` text NOT NULL,
	`nice_name` text,
	`category` text NOT NULL,
	`image` text,
	`price` text,
	`likes` integer,
	`nsfw` integer DEFAULT false NOT NULL,
	CONSTRAINT `items_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`read_at` integer,
	`payload` text NOT NULL,
	`action_url` text,
	`banner` integer DEFAULT false NOT NULL,
	`dedupe_key` text,
	CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL UNIQUE,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	CONSTRAINT `session_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `setup_coauthors` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`setup_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text,
	CONSTRAINT `setup_coauthors_setup_id_fkey` FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `setup_coauthors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `setup_draft_images` (
	`id` text PRIMARY KEY,
	`setup_draft_id` text NOT NULL,
	`object_key` text NOT NULL,
	CONSTRAINT `setup_draft_images_setup_draft_id_fkey` FOREIGN KEY (`setup_draft_id`) REFERENCES `setup_drafts`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `setup_drafts` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`setup_id` text,
	`content` text NOT NULL,
	`idempotency_request_id` text UNIQUE,
	CONSTRAINT `fk_setup_drafts_idempotency_request_id_idempotency_requests_id_fk` FOREIGN KEY (`idempotency_request_id`) REFERENCES `idempotency_requests`(`id`) ON DELETE SET NULL,
	CONSTRAINT `setup_drafts_setup_id_fkey` FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `setup_drafts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `setup_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`setup_id` text NOT NULL,
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
CREATE TABLE `setup_item_shapekeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`setup_item_id` text NOT NULL,
	`name` text NOT NULL,
	`value` real NOT NULL,
	CONSTRAINT `setup_item_shapekeys_setup_item_id_fkey` FOREIGN KEY (`setup_item_id`) REFERENCES `setup_items`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `setup_items` (
	`id` text PRIMARY KEY,
	`item_id` text NOT NULL,
	`setup_id` text NOT NULL,
	`category` text,
	`unsupported` integer DEFAULT false NOT NULL,
	`note` text,
	CONSTRAINT `setup_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `setup_items_setup_id_fkey` FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `setup_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`reporter_id` text NOT NULL,
	`setup_id` text NOT NULL,
	`spam` integer DEFAULT false NOT NULL,
	`hate` integer DEFAULT false NOT NULL,
	`infringe` integer DEFAULT false NOT NULL,
	`bad_image` integer DEFAULT false NOT NULL,
	`other` integer DEFAULT false NOT NULL,
	`comment` text,
	`is_resolved` integer DEFAULT false NOT NULL,
	`idempotency_request_id` text UNIQUE,
	CONSTRAINT `fk_setup_reports_idempotency_request_id_idempotency_requests_id_fk` FOREIGN KEY (`idempotency_request_id`) REFERENCES `idempotency_requests`(`id`) ON DELETE SET NULL,
	CONSTRAINT `setup_reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `setup_reports_setup_id_fkey` FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `setup_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`setup_id` text NOT NULL,
	`tag` text NOT NULL,
	CONSTRAINT `setup_tags_setup_id_fkey` FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `setups` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`public` integer DEFAULT true NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`hid_at` integer,
	`hid_reason` text,
	`idempotency_request_id` text UNIQUE,
	CONSTRAINT `fk_setups_idempotency_request_id_idempotency_requests_id_fk` FOREIGN KEY (`idempotency_request_id`) REFERENCES `idempotency_requests`(`id`) ON DELETE SET NULL,
	CONSTRAINT `setups_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`platform` text NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`verified` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`badge` text NOT NULL,
	CONSTRAINT `user_badges_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`reporter_id` text NOT NULL,
	`reportee_id` text NOT NULL,
	`spam` integer DEFAULT false NOT NULL,
	`hate` integer DEFAULT false NOT NULL,
	`infringe` integer DEFAULT false NOT NULL,
	`bad_image` integer DEFAULT false NOT NULL,
	`other` integer DEFAULT false NOT NULL,
	`comment` text,
	`is_resolved` integer DEFAULT false NOT NULL,
	`idempotency_request_id` text UNIQUE,
	CONSTRAINT `fk_user_reports_idempotency_request_id_idempotency_requests_id_fk` FOREIGN KEY (`idempotency_request_id`) REFERENCES `idempotency_requests`(`id`) ON DELETE SET NULL,
	CONSTRAINT `user_reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `user_reports_reportee_id_fkey` FOREIGN KEY (`reportee_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`show_private_setups` integer DEFAULT true NOT NULL,
	`show_nsfw` integer DEFAULT false NOT NULL,
	CONSTRAINT `user_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_shop_verifications` (
	`id` text PRIMARY KEY,
	`code` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `user_shop_verifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_shops` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`shop_id` text NOT NULL,
	CONSTRAINT `user_shops_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `user_shops_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`username` text NOT NULL UNIQUE,
	`display_username` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`role` text,
	`banned` integer,
	`ban_reason` text,
	`ban_expires` integer,
	`bio` text,
	`links` text,
	`last_agreed_to_terms` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_user_id_index` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_issuer_providerAccountId_uidx` ON `accounts` (`issuer`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_index` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_user_id_index` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_index` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_target_type_index` ON `audit_logs` (`target_type`);--> statement-breakpoint
CREATE INDEX `audit_logs_target_id_index` ON `audit_logs` (`target_id`);--> statement-breakpoint
CREATE INDEX `bookmarks_id_index` ON `bookmarks` (`id`);--> statement-breakpoint
CREATE INDEX `bookmarks_user_id_index` ON `bookmarks` (`user_id`);--> statement-breakpoint
CREATE INDEX `bookmarks_setup_id_index` ON `bookmarks` (`setup_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookmarks_user_setup_uidx` ON `bookmarks` (`user_id`,`setup_id`);--> statement-breakpoint
CREATE INDEX `changelog_authors_changelog_slug_index` ON `changelog_authors` (`changelog_slug`);--> statement-breakpoint
CREATE INDEX `changelog_authors_user_id_index` ON `changelog_authors` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `changelog_authors_slug_user_uidx` ON `changelog_authors` (`changelog_slug`,`user_id`);--> statement-breakpoint
CREATE INDEX `changelog_i18ns_changelog_slug_index` ON `changelog_i18ns` (`changelog_slug`);--> statement-breakpoint
CREATE INDEX `changelog_i18ns_locale_index` ON `changelog_i18ns` (`locale`);--> statement-breakpoint
CREATE UNIQUE INDEX `changelog_i18ns_slug_locale_uidx` ON `changelog_i18ns` (`changelog_slug`,`locale`);--> statement-breakpoint
CREATE INDEX `changelogs_slug_index` ON `changelogs` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `emails_message_id_idx` ON `emails` (`message_id`);--> statement-breakpoint
CREATE INDEX `emails_received_at_idx` ON `emails` (`received_at`);--> statement-breakpoint
CREATE INDEX `emails_status_idx` ON `emails` (`is_read`,`is_archived`);--> statement-breakpoint
CREATE INDEX `feedbacks_id_index` ON `feedbacks` (`id`);--> statement-breakpoint
CREATE INDEX `feedbacks_fingerprint_index` ON `feedbacks` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `follow_users_id_index` ON `follow_users` (`id`);--> statement-breakpoint
CREATE INDEX `follow_users_user_id_index` ON `follow_users` (`user_id`);--> statement-breakpoint
CREATE INDEX `follow_users_target_user_id_index` ON `follow_users` (`target_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `follow_users_user_target_uidx` ON `follow_users` (`user_id`,`target_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_requests_scope_route_key_uidx` ON `idempotency_requests` (`scope`,`route`,`key`);--> statement-breakpoint
CREATE INDEX `idempotency_requests_expires_at_idx` ON `idempotency_requests` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idempotency_requests_status_lease_idx` ON `idempotency_requests` (`status`,`lease_expires_at`);--> statement-breakpoint
CREATE INDEX `item_reports_id_index` ON `item_reports` (`id`);--> statement-breakpoint
CREATE INDEX `item_reports_item_id_index` ON `item_reports` (`item_id`);--> statement-breakpoint
CREATE INDEX `item_reports_reporter_id_index` ON `item_reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `items_id_index` ON `items` (`id`);--> statement-breakpoint
CREATE INDEX `items_name_index` ON `items` (`name`);--> statement-breakpoint
CREATE INDEX `notifications_user_id_index` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_type_index` ON `notifications` (`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_user_dedupe_uidx` ON `notifications` (`user_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `setup_coauthors_id_index` ON `setup_coauthors` (`id`);--> statement-breakpoint
CREATE INDEX `setup_coauthors_setup_id_index` ON `setup_coauthors` (`setup_id`);--> statement-breakpoint
CREATE INDEX `setup_coauthors_user_id_index` ON `setup_coauthors` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `setup_coauthors_setup_user_uidx` ON `setup_coauthors` (`setup_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `setup_draft_images_id_index` ON `setup_draft_images` (`id`);--> statement-breakpoint
CREATE INDEX `setup_draft_images_setup_draft_id_index` ON `setup_draft_images` (`setup_draft_id`);--> statement-breakpoint
CREATE INDEX `setup_draft_images_object_key_index` ON `setup_draft_images` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `setup_draft_images_draft_object_uidx` ON `setup_draft_images` (`setup_draft_id`,`object_key`);--> statement-breakpoint
CREATE INDEX `setup_drafts_id_index` ON `setup_drafts` (`id`);--> statement-breakpoint
CREATE INDEX `setup_drafts_setup_id_index` ON `setup_drafts` (`setup_id`);--> statement-breakpoint
CREATE INDEX `setup_drafts_user_id_index` ON `setup_drafts` (`user_id`);--> statement-breakpoint
CREATE INDEX `setup_images_id_index` ON `setup_images` (`id`);--> statement-breakpoint
CREATE INDEX `setup_images_setup_id_index` ON `setup_images` (`setup_id`);--> statement-breakpoint
CREATE INDEX `setup_item_shapekeys_id_index` ON `setup_item_shapekeys` (`id`);--> statement-breakpoint
CREATE INDEX `setup_item_shapekeys_setup_item_id_index` ON `setup_item_shapekeys` (`setup_item_id`);--> statement-breakpoint
CREATE INDEX `setup_items_id_index` ON `setup_items` (`id`);--> statement-breakpoint
CREATE INDEX `setup_items_setup_id_index` ON `setup_items` (`setup_id`);--> statement-breakpoint
CREATE INDEX `setup_reports_id_index` ON `setup_reports` (`id`);--> statement-breakpoint
CREATE INDEX `setup_reports_setup_id_index` ON `setup_reports` (`setup_id`);--> statement-breakpoint
CREATE INDEX `setup_reports_reporter_id_index` ON `setup_reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `setup_tags_id_index` ON `setup_tags` (`id`);--> statement-breakpoint
CREATE INDEX `setup_tags_setup_id_index` ON `setup_tags` (`setup_id`);--> statement-breakpoint
CREATE INDEX `setup_tags_tag_index` ON `setup_tags` (`tag`);--> statement-breakpoint
CREATE UNIQUE INDEX `setup_tags_setup_tag_uidx` ON `setup_tags` (`setup_id`,`tag`);--> statement-breakpoint
CREATE INDEX `setups_id_index` ON `setups` (`id`);--> statement-breakpoint
CREATE INDEX `setups_user_id_index` ON `setups` (`user_id`);--> statement-breakpoint
CREATE INDEX `setups_name_index` ON `setups` (`name`);--> statement-breakpoint
CREATE INDEX `shops_id_index` ON `shops` (`id`);--> statement-breakpoint
CREATE INDEX `shops_name_index` ON `shops` (`name`);--> statement-breakpoint
CREATE INDEX `user_badges_user_id_index` ON `user_badges` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_badges_user_badge_uidx` ON `user_badges` (`user_id`,`badge`);--> statement-breakpoint
CREATE INDEX `user_reports_id_index` ON `user_reports` (`id`);--> statement-breakpoint
CREATE INDEX `user_reports_reporter_id_index` ON `user_reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `user_reports_reportee_id_index` ON `user_reports` (`reportee_id`);--> statement-breakpoint
CREATE INDEX `user_settings_user_id_index` ON `user_settings` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_shop_verifications_user_id_uidx` ON `user_shop_verifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_shops_user_id_index` ON `user_shops` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_shops_shop_id_index` ON `user_shops` (`shop_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_shops_user_shop_uidx` ON `user_shops` (`user_id`,`shop_id`);--> statement-breakpoint
CREATE INDEX `user_email_index` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verifications` (`identifier`);