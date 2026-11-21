DROP INDEX IF EXISTS `user_settings_user_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `user_email_index`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_user_id_unique` ON `user_settings` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `users` (`email`);