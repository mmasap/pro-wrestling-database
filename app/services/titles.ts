import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
	organizations,
	titleHolderMatches,
	titleHolders,
	titles,
	wrestlers,
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
			holderName: wrestlers.name,
		})
		.from(titleHolderMatches)
		.leftJoin(
			titleHolders,
			and(
				eq(titleHolders.titleId, titleHolderMatches.titleId),
				eq(titleHolders.eraTitle, titleHolderMatches.eraTitle),
			),
		)
		.leftJoin(wrestlers, eq(wrestlers.id, titleHolders.wrestlerId))
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
