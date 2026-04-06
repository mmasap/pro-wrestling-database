CREATE TABLE `events` (
	`id` integer PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text,
	`date` text,
	`prefecture` text,
	`arena` text,
	`spectators` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_participants` (
	`match_id` integer,
	`wrestler_id` integer,
	`team` integer,
	`is_winner` integer DEFAULT 0 NOT NULL,
	`is_loser` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`match_id`, `wrestler_id`),
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wrestler_id`) REFERENCES `wrestlers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_titles` (
	`match_id` integer,
	`title_id` text,
	PRIMARY KEY(`match_id`, `title_id`),
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY NOT NULL,
	`event_id` integer,
	`match_number` integer,
	`time_seconds` integer,
	`finish` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_name_unique` ON `organizations` (`name`);--> statement-breakpoint
CREATE TABLE `title_holder_matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title_id` text NOT NULL,
	`era_title` integer NOT NULL,
	`finish` text,
	`time` text,
	`date` text,
	`stadium_name` text,
	`result_url` text,
	`opponents` text
);
--> statement-breakpoint
CREATE TABLE `title_holders` (
	`title_id` text NOT NULL,
	`era_title` integer NOT NULL,
	`wrestler_id` integer,
	PRIMARY KEY(`title_id`, `era_title`),
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wrestler_id`) REFERENCES `wrestlers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `titles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`display_order` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `titles_name_unique` ON `titles` (`name`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wrestler_units` (
	`wrestler_id` integer NOT NULL,
	`unit_id` text NOT NULL,
	PRIMARY KEY(`wrestler_id`, `unit_id`),
	FOREIGN KEY (`wrestler_id`) REFERENCES `wrestlers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wrestlers` (
	`id` integer PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`name_kana` text NOT NULL,
	`birthday` text,
	`birthplace` text,
	`debut` text,
	`height` integer,
	`weight` integer,
	`theme_music` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
