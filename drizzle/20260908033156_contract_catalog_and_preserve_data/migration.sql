-- Atomic data contract. Schema DDL was generated with bun run db:generate.
-- The generated statements below are unchanged (SHA-256 3ec08e4cf39bada13243eec21ffb5409615847d1deea5f48eb447319008faa45).
-- Assemble backup, generated DDL, and restore in one Alchemy migration batch.
DROP TRIGGER catalog_report_transition;
--> statement-breakpoint
UPDATE item_reports SET item_id = NULL;
--> statement-breakpoint
UPDATE setup_drafts
SET content = json_set(content, '$.items', (
    SELECT json_group_array(json_set(entry.value, '$.itemId', coalesce(
        (SELECT id FROM catalog_items WHERE id = json_extract(entry.value, '$.itemId')),
        (SELECT source.item_id FROM items legacy
         JOIN item_sources source ON source.provider_key = legacy.platform AND source.external_id = legacy.id
         WHERE legacy.id = json_extract(entry.value, '$.itemId')),
        json_extract(entry.value, '$.itemId')
    )) ORDER BY CAST(entry.key AS INTEGER))
    FROM json_each(setup_drafts.content, '$.items') entry
))
WHERE json_type(content, '$.items') = 'array';
--> statement-breakpoint
CREATE TABLE _catalog_contract_check (mismatches integer NOT NULL CHECK (mismatches = 0));
--> statement-breakpoint
INSERT INTO _catalog_contract_check SELECT count(*) FROM item_reports WHERE catalog_item_id IS NULL;
--> statement-breakpoint
CREATE TABLE _contract_accounts AS SELECT id, provider_account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at FROM accounts;
--> statement-breakpoint
CREATE TABLE _contract_setup_drafts AS SELECT id, created_at, updated_at, user_id, setup_id, revision, content FROM setup_drafts;
--> statement-breakpoint
CREATE TABLE _contract_setup_draft_images AS SELECT id, setup_draft_id, object_key FROM setup_draft_images;
--> statement-breakpoint
CREATE TABLE _contract_item_reports AS SELECT id, created_at, reporter_id, catalog_item_id, name_error, irrelevant, other, comment, is_resolved, idempotency_request_id FROM item_reports;
--> statement-breakpoint
-- BEGIN GENERATED SCHEMA DDL
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_setup_drafts` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL,
	`setup_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`content` text NOT NULL,
	CONSTRAINT `setup_drafts_setup_id_fkey` FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `setup_drafts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_setup_drafts`(`id`, `created_at`, `updated_at`, `user_id`, `setup_id`, `revision`, `content`) SELECT `id`, `created_at`, `updated_at`, `user_id`, `setup_id`, `revision`, `content` FROM `setup_drafts`;--> statement-breakpoint
DROP TABLE `setup_drafts`;--> statement-breakpoint
ALTER TABLE `__new_setup_drafts` RENAME TO `setup_drafts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_item_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`reporter_id` text NOT NULL,
	`catalog_item_id` text NOT NULL,
	`name_error` integer DEFAULT false NOT NULL,
	`irrelevant` integer DEFAULT false NOT NULL,
	`other` integer DEFAULT false NOT NULL,
	`comment` text,
	`is_resolved` integer DEFAULT false NOT NULL,
	`idempotency_request_id` text UNIQUE,
	CONSTRAINT `fk_item_reports_catalog_item_id_catalog_items_id_fk` FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_item_reports_idempotency_request_id_idempotency_requests_id_fk` FOREIGN KEY (`idempotency_request_id`) REFERENCES `idempotency_requests`(`id`) ON DELETE SET NULL,
	CONSTRAINT `item_reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_item_reports`(`id`, `created_at`, `reporter_id`, `catalog_item_id`, `name_error`, `irrelevant`, `other`, `comment`, `is_resolved`, `idempotency_request_id`) SELECT `id`, `created_at`, `reporter_id`, `catalog_item_id`, `name_error`, `irrelevant`, `other`, `comment`, `is_resolved`, `idempotency_request_id` FROM `item_reports`;--> statement-breakpoint
DROP TABLE `item_reports`;--> statement-breakpoint
ALTER TABLE `__new_item_reports` RENAME TO `item_reports`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `item_reports_item_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `items_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `items_name_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `setup_item_shapekeys_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `setup_item_shapekeys_setup_item_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `setup_items_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `setup_items_setup_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `shops_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `shops_name_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `user_shop_verifications_user_id_uidx`;--> statement-breakpoint
DROP INDEX IF EXISTS `user_shops_user_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `user_shops_shop_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `user_shops_user_shop_uidx`;--> statement-breakpoint
CREATE INDEX `setup_drafts_id_index` ON `setup_drafts` (`id`);--> statement-breakpoint
CREATE INDEX `setup_drafts_setup_id_index` ON `setup_drafts` (`setup_id`);--> statement-breakpoint
CREATE INDEX `setup_drafts_user_id_index` ON `setup_drafts` (`user_id`);--> statement-breakpoint
CREATE INDEX `item_reports_id_index` ON `item_reports` (`id`);--> statement-breakpoint
CREATE INDEX `item_reports_catalog_item_id_index` ON `item_reports` (`catalog_item_id`);--> statement-breakpoint
CREATE INDEX `item_reports_reporter_id_index` ON `item_reports` (`reporter_id`);--> statement-breakpoint
DROP TABLE `catalog_migration_runs`;--> statement-breakpoint
DROP TABLE `item_category_overrides`;--> statement-breakpoint
DROP TABLE `items`;--> statement-breakpoint
DROP TABLE `setup_item_shapekeys`;--> statement-breakpoint
DROP TABLE `setup_items`;--> statement-breakpoint
DROP TABLE `shops`;--> statement-breakpoint
DROP TABLE `user_shop_verifications`;--> statement-breakpoint
DROP TABLE `user_shops`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `issuer`;
--> statement-breakpoint
-- END GENERATED SCHEMA DDL
INSERT INTO setup_draft_images (id, setup_draft_id, object_key)
SELECT id, setup_draft_id, object_key FROM _contract_setup_draft_images WHERE true
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO _catalog_contract_check SELECT count(*) FROM (SELECT id, provider_account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at FROM _contract_accounts EXCEPT SELECT id, provider_account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at FROM accounts);
--> statement-breakpoint
INSERT INTO _catalog_contract_check SELECT count(*) FROM (SELECT id, provider_account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at FROM accounts EXCEPT SELECT id, provider_account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at FROM _contract_accounts);
--> statement-breakpoint
INSERT INTO _catalog_contract_check SELECT count(*) FROM (SELECT id, created_at, updated_at, user_id, setup_id, revision, content FROM _contract_setup_drafts EXCEPT SELECT id, created_at, updated_at, user_id, setup_id, revision, content FROM setup_drafts);
--> statement-breakpoint
INSERT INTO _catalog_contract_check SELECT count(*) FROM (SELECT id, created_at, updated_at, user_id, setup_id, revision, content FROM setup_drafts EXCEPT SELECT id, created_at, updated_at, user_id, setup_id, revision, content FROM _contract_setup_drafts);
--> statement-breakpoint
INSERT INTO _catalog_contract_check SELECT count(*) FROM (SELECT id, setup_draft_id, object_key FROM _contract_setup_draft_images EXCEPT SELECT id, setup_draft_id, object_key FROM setup_draft_images);
--> statement-breakpoint
INSERT INTO _catalog_contract_check SELECT count(*) FROM (SELECT id, setup_draft_id, object_key FROM setup_draft_images EXCEPT SELECT id, setup_draft_id, object_key FROM _contract_setup_draft_images);
--> statement-breakpoint
INSERT INTO _catalog_contract_check SELECT count(*) FROM (SELECT id, created_at, reporter_id, catalog_item_id, name_error, irrelevant, other, comment, is_resolved, idempotency_request_id FROM _contract_item_reports EXCEPT SELECT id, created_at, reporter_id, catalog_item_id, name_error, irrelevant, other, comment, is_resolved, idempotency_request_id FROM item_reports);
--> statement-breakpoint
INSERT INTO _catalog_contract_check SELECT count(*) FROM (SELECT id, created_at, reporter_id, catalog_item_id, name_error, irrelevant, other, comment, is_resolved, idempotency_request_id FROM item_reports EXCEPT SELECT id, created_at, reporter_id, catalog_item_id, name_error, irrelevant, other, comment, is_resolved, idempotency_request_id FROM _contract_item_reports);
--> statement-breakpoint
INSERT INTO _catalog_contract_check SELECT count(*) FROM pragma_foreign_key_check;
--> statement-breakpoint
DROP TABLE _contract_accounts;
--> statement-breakpoint
DROP TABLE _contract_setup_drafts;
--> statement-breakpoint
DROP TABLE _contract_setup_draft_images;
--> statement-breakpoint
DROP TABLE _contract_item_reports;
--> statement-breakpoint
DROP TABLE _catalog_contract_check;
