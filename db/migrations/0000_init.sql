CREATE TABLE `events` (
	`id` integer PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
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
	`player_id` integer,
	`team` integer,
	`is_winner` integer DEFAULT 0 NOT NULL,
	`is_loser` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`match_id`, `player_id`),
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_titles` (
	`match_id` integer,
	`title_id` integer,
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
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_name_unique` ON `organizations` (`name`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `titles` (
	`id` integer PRIMARY KEY NOT NULL,
	`organization_id` integer NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `titles_name_unique` ON `titles` (`name`);