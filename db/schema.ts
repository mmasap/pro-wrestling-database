import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable("organizations", {
	id: integer("id").primaryKey(),
	name: text("name").notNull().unique(),
});

export const wrestlers = sqliteTable("wrestlers", {
	id: integer("id").primaryKey(),
	organizationId: integer("organization_id")
		.notNull()
		.references(() => organizations.id),
	name: text("name").notNull(),
});

export const events = sqliteTable("events", {
	id: integer("id").primaryKey(),
	organizationId: integer("organization_id")
		.notNull()
		.references(() => organizations.id),
	name: text("name"),
	date: text("date"),
	prefecture: text("prefecture"),
	arena: text("arena"),
	spectators: integer("spectators"),
});

export const titles = sqliteTable("titles", {
	id: integer("id").primaryKey(),
	organizationId: integer("organization_id")
		.notNull()
		.references(() => organizations.id),
	name: text("name").notNull().unique(),
});

export const matches = sqliteTable("matches", {
	id: integer("id").primaryKey(),
	eventId: integer("event_id").references(() => events.id),
	matchNumber: integer("match_number"),
	timeSeconds: integer("time_seconds"),
	finish: text("finish"),
});

export const matchTitles = sqliteTable(
	"match_titles",
	{
		matchId: integer("match_id").references(() => matches.id),
		titleId: integer("title_id").references(() => titles.id),
	},
	(t) => [primaryKey({ columns: [t.matchId, t.titleId] })],
);

export const matchParticipants = sqliteTable(
	"match_participants",
	{
		matchId: integer("match_id").references(() => matches.id),
		wrestlerId: integer("wrestler_id").references(() => wrestlers.id),
		team: integer("team"),
		isWinner: integer("is_winner").notNull().default(0),
		isLoser: integer("is_loser").notNull().default(0),
	},
	(t) => [primaryKey({ columns: [t.matchId, t.wrestlerId] })],
);
