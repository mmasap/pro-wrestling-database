CREATE TABLE `title_holder_wrestlers` (
	`title_id` text NOT NULL,
	`era_title` integer NOT NULL,
	`wrestler_id` integer NOT NULL,
	PRIMARY KEY(`title_id`, `era_title`, `wrestler_id`),
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wrestler_id`) REFERENCES `wrestlers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `title_holder_wrestlers` (`title_id`, `era_title`, `wrestler_id`)
SELECT `title_id`, `era_title`, `wrestler_id`
FROM `title_holders`
WHERE `wrestler_id` IS NOT NULL;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `title_holders_new` (
	`title_id` text NOT NULL,
	`era_title` integer NOT NULL,
	PRIMARY KEY(`title_id`, `era_title`),
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `title_holders_new` (`title_id`, `era_title`)
SELECT `title_id`, `era_title` FROM `title_holders`;
--> statement-breakpoint
DROP TABLE `title_holders`;
--> statement-breakpoint
ALTER TABLE `title_holders_new` RENAME TO `title_holders`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
