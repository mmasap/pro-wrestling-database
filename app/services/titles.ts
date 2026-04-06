import { asc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
	organizations,
	titleHolderMatches,
	titles,
} from "../../db/schema";

export async function getOrganizations() {
	return db
		.select({ id: organizations.id, name: organizations.name })
		.from(organizations)
		.orderBy(asc(organizations.name));
}

export async function getTitles(organizationId?: string) {
	return db
		.select({ id: titles.id, name: titles.name })
		.from(titles)
		.where(
			organizationId ? eq(titles.organizationId, organizationId) : undefined,
		)
		.orderBy(sql`${titles.displayOrder} IS NULL`, asc(titles.displayOrder));
}

export async function getTitleHistory(titleId: string) {
	const title = await db
		.select({ id: titles.id, name: titles.name })
		.from(titles)
		.where(eq(titles.id, titleId))
		.then((r) => r[0]);

	if (!title) return null;

	const rows = await db
		.select({
			matchId: titleHolderMatches.id,
			eraTitle: titleHolderMatches.eraTitle,
			date: titleHolderMatches.date,
			stadiumName: titleHolderMatches.stadiumName,
			finish: titleHolderMatches.finish,
			time: titleHolderMatches.time,
			opponents: titleHolderMatches.opponents,
			holderName: sql<string | null>`(
				SELECT GROUP_CONCAT(w.name, ' & ')
				FROM title_holder_wrestlers thw
				JOIN wrestlers w ON w.id = thw.wrestler_id
				WHERE thw.title_id = title_holder_matches.title_id
				  AND thw.era_title = title_holder_matches.era_title
			)`,
		})
		.from(titleHolderMatches)
		.where(eq(titleHolderMatches.titleId, titleId))
		.orderBy(asc(titleHolderMatches.date), asc(titleHolderMatches.id));

	const matches = rows.map((r) => ({
		...r,
		opponents: (() => {
			try {
				const parsed = JSON.parse(r.opponents ?? "[]");
				return Array.isArray(parsed) ? parsed.join(", ") : r.opponents;
			} catch {
				return r.opponents;
			}
		})(),
	}));

	return { title, matches };
}
