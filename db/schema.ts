import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable("organizations", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
});

export const wrestlers = sqliteTable("wrestlers", {
	id: integer("id").primaryKey(),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organizations.id),
	name: text("name").notNull(),
	nameKana: text("name_kana").notNull(),
	birthday: text("birthday"),
	birthplace: text("birthplace"),
	debut: text("debut"),
	height: integer("height"),
	weight: integer("weight"),
	themeMusic: text("theme_music"),
});

export const events = sqliteTable("events", {
	id: integer("id").primaryKey(),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organizations.id),
	name: text("name"),
	date: text("date"),
	prefecture: text("prefecture"),
	arena: text("arena"),
	spectators: integer("spectators"),
});

export const titles = sqliteTable("titles", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organizations.id),
	name: text("name").notNull().unique(),
	displayOrder: integer("display_order"),
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
		titleId: text("title_id").references(() => titles.id),
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

export const units = sqliteTable("units", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id"),
	name: text("name").notNull(),
});

export const wrestlerUnits = sqliteTable(
	"wrestler_units",
	{
		wrestlerId: integer("wrestler_id")
			.notNull()
			.references(() => wrestlers.id),
		unitId: text("unit_id")
			.notNull()
			.references(() => units.id),
	},
	(t) => [primaryKey({ columns: [t.wrestlerId, t.unitId] })],
);

export const titleHolders = sqliteTable(
	"title_holders",
	{
		titleId: text("title_id")
			.notNull()
			.references(() => titles.id),
		eraTitle: integer("era_title").notNull(),
		wrestlerId: integer("wrestler_id").references(() => wrestlers.id),
	},
	(t) => [primaryKey({ columns: [t.titleId, t.eraTitle] })],
);

export const titleHolderMatches = sqliteTable("title_holder_matches", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	titleId: text("title_id").notNull(),
	eraTitle: integer("era_title").notNull(),
	finish: text("finish"),
	time: text("time"),
	date: text("date"),
	stadiumName: text("stadium_name"),
	resultUrl: text("result_url"),
	opponents: text("opponents"),
});
