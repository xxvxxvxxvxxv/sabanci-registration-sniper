CREATE TABLE `public_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`expires` integer DEFAULT 0 NOT NULL,
	`requested` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cache_requested` ON `public_cache` (`requested`);--> statement-breakpoint
CREATE TABLE `source_gate` (
	`key` text PRIMARY KEY NOT NULL,
	`next` integer DEFAULT 0 NOT NULL,
	`blocked` integer DEFAULT 0 NOT NULL
);
