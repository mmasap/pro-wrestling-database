import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
	events,
	matchParticipants,
	matchTitles,
	matches,
	titles,
	wrestlers,
} from "../../db/schema";

export async function getTitles() {
	return db
		.select({ id: titles.id, name: titles.name })
		.from(titles)
		.orderBy(titles.name);
}

export async function getTitleHistory(titleId: number) {
	const title = await db
		.select({ id: titles.id, name: titles.name })
		.from(titles)
		.where(eq(titles.id, titleId))
		.then((r) => r[0]);

	if (!title) return null;

	const titleMatchRows = await db
		.select({
			matchId: matchTitles.matchId,
			eventName: events.name,
			date: events.date,
			matchNumber: matches.matchNumber,
			finish: matches.finish,
		})
		.from(matchTitles)
		.innerJoin(matches, eq(matches.id, matchTitles.matchId))
		.innerJoin(events, eq(events.id, matches.eventId))
		.where(eq(matchTitles.titleId, titleId))
		.orderBy(events.date, matches.matchNumber);

	const matchIds = titleMatchRows.map((r) => r.matchId as number);
	if (matchIds.length === 0) return { title, matches: [] };

	const allParticipants = await db
		.select({
			matchId: matchParticipants.matchId,
			wrestlerName: wrestlers.name,
			team: matchParticipants.team,
			isWinner: matchParticipants.isWinner,
			isLoser: matchParticipants.isLoser,
		})
		.from(matchParticipants)
		.innerJoin(wrestlers, eq(wrestlers.id, matchParticipants.wrestlerId))
		.where(inArray(matchParticipants.matchId, matchIds));

	type TeamEntry = { names: string[]; isWinner: boolean; isLoser: boolean };

	const matchMap = new Map<number, Map<number, TeamEntry>>();
	for (const p of allParticipants) {
		const matchId = p.matchId as number;
		if (!matchMap.has(matchId)) matchMap.set(matchId, new Map());
		const teamMap = matchMap.get(matchId)!;
		const team = p.team as number;
		if (!teamMap.has(team))
			teamMap.set(team, { names: [], isWinner: false, isLoser: false });
		const entry = teamMap.get(team)!;
		entry.names.push(p.wrestlerName as string);
		if (p.isWinner) entry.isWinner = true;
		if (p.isLoser) entry.isLoser = true;
	}

	const history = titleMatchRows.map((r) => {
		const teamMap = matchMap.get(r.matchId as number);
		const teams = teamMap ? [...teamMap.values()] : [];
		const winners = teams
			.filter((t) => t.isWinner)
			.flatMap((t) => t.names);
		const losers = teams
			.filter((t) => t.isLoser)
			.flatMap((t) => t.names);
		return {
			matchId: r.matchId as number,
			date: r.date,
			eventName: r.eventName,
			finish: r.finish,
			winners,
			losers,
		};
	});

	return { title, matches: history };
}
