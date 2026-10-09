CREATE TABLE `provider_admission_options` (
	`provider_key` text NOT NULL,
	`facet_key` text NOT NULL,
	`value_key` text NOT NULL,
	`label` text NOT NULL,
	`first_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `provider_admission_options_pk` PRIMARY KEY(`provider_key`, `facet_key`, `value_key`)
);
--> statement-breakpoint
CREATE TABLE `provider_admission_rules` (
	`provider_key` text NOT NULL,
	`facet_key` text NOT NULL,
	`value_key` text NOT NULL,
	`decision` text NOT NULL,
	CONSTRAINT `provider_admission_rules_pk` PRIMARY KEY(`provider_key`, `facet_key`, `value_key`),
	CONSTRAINT `provider_admission_rules_option_fkey` FOREIGN KEY (`provider_key`,`facet_key`,`value_key`) REFERENCES `provider_admission_options`(`provider_key`,`facet_key`,`value_key`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `provider_admission_options_provider_facet_idx` ON `provider_admission_options` (`provider_key`,`facet_key`);