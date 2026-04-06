import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../db";
import {
	events,
	matchParticipants,
	matchTitles,
	matches,
	titles,
	wrestlers,
} from "../../db/schema";

export type MatchType = "all" | "singles" | "title";

async function getSinglesMatchIds(): Promise<number[]> {
	const rows = await db
		.select({ matchId: matchParticipants.matchId })
		.from(matchParticipants)
		.groupBy(matchParticipants.matchId)
		.having(eq(count(matchParticipants.wrestlerId), 2));
	return rows.map((r) => r.matchId as number);
}

async function getTitleMatchIds(): Promise<number[]> {
	const rows = await db
		.select({ matchId: matchTitles.matchId })
		.from(matchTitles)
		.groupBy(matchTitles.matchId);
	return rows.map((r) => r.matchId as number);
}

export async function getWrestlers() {
	return db
		.select({ id: wrestlers.id, name: wrestlers.name })
		.from(wrestlers)
		.orderBy(wrestlers.name);
}

async function resolveMatchIds(matchType: MatchType): Promise<number[] | null> {
	if (matchType === "all") return null;
	if (matchType === "singles") return getSinglesMatchIds();
	return getTitleMatchIds();
}

export async function getWrestlerRecord(
	wrestlerId: number,
	matchType: MatchType = "all",
) {
	const ids = await resolveMatchIds(matchType);
	const matchTypeFilter = ids
		? inArray(matchParticipants.matchId, ids.length > 0 ? ids : [-1])
		: undefined;

	const rows = await db
		.select({
			matchId: matches.id,
			eventName: events.name,
			date: events.date,
			matchNumber: matches.matchNumber,
			finish: matches.finish,
			timeSeconds: matches.timeSeconds,
			isWinner: matchParticipants.isWinner,
			isLoser: matchParticipants.isLoser,
			myTeam: matchParticipants.team,
		})
		.from(matchParticipants)
		.innerJoin(matches, eq(matches.id, matchParticipants.matchId))
		.innerJoin(events, eq(events.id, matches.eventId))
		.where(and(eq(matchParticipants.wrestlerId, wrestlerId), matchTypeFilter))
		.orderBy(events.date, matches.matchNumber);

	const matchIds = rows.map((r) => r.matchId as number);

	const [wrestler, matchTitleRows, allParticipants] = await Promise.all([
		db
			.select({ id: wrestlers.id, name: wrestlers.name })
			.from(wrestlers)
			.where(eq(wrestlers.id, wrestlerId))
			.then((r) => r[0]),
		matchIds.length > 0
			? db
					.select({ matchId: matchTitles.matchId, titleName: titles.name })
					.from(matchTitles)
					.innerJoin(titles, eq(titles.id, matchTitles.titleId))
					.where(inArray(matchTitles.matchId, matchIds))
			: Promise.resolve([]),
		matchIds.length > 0
			? db
					.select({
						matchId: matchParticipants.matchId,
						wrestlerName: wrestlers.name,
						team: matchParticipants.team,
						isWinner: matchParticipants.isWinner,
						isLoser: matchParticipants.isLoser,
					})
					.from(matchParticipants)
					.innerJoin(wrestlers, eq(wrestlers.id, matchParticipants.wrestlerId))
					.where(
						and(
							inArray(matchParticipants.matchId, matchIds),
							ne(matchParticipants.wrestlerId, wrestlerId),
						),
					)
			: Promise.resolve([]),
	]);

	const titleMap = new Map<number, string[]>();
	for (const t of matchTitleRows) {
		const id = t.matchId as number;
		if (!titleMap.has(id)) titleMap.set(id, []);
		titleMap.get(id)?.push(t.titleName as string);
	}

	type MatchEntry = {
		myTeam: number | null;
		partners: string[];
		opponentTeams: Map<number, string[]>;
		teamWon: boolean;
		teamLost: boolean;
		fallWinner: string | null;
		fallLoser: string | null;
	};

	const participantMap = new Map<number, MatchEntry>();
	for (const row of rows) {
		participantMap.set(row.matchId as number, {
			myTeam: row.myTeam as number | null,
			partners: [],
			opponentTeams: new Map(),
			teamWon: !!row.isWinner,
			teamLost: !!row.isLoser,
			fallWinner: row.isWinner ? (wrestler?.name ?? null) : null,
			fallLoser: row.isLoser ? (wrestler?.name ?? null) : null,
		});
	}

	for (const p of allParticipants) {
		const matchId = p.matchId as number;
		const map = participantMap.get(matchId);
		if (!map) continue;
		const team = p.team as number;
		if (map.myTeam !== null && p.team === map.myTeam) {
			map.partners.push(p.wrestlerName as string);
			if (p.isWinner) {
				map.teamWon = true;
				map.fallWinner = p.wrestlerName as string;
			}
			if (p.isLoser) {
				map.teamLost = true;
				map.fallLoser = p.wrestlerName as string;
			}
		} else {
			if (!map.opponentTeams.has(team)) map.opponentTeams.set(team, []);
			map.opponentTeams.get(team)?.push(p.wrestlerName as string);
			if (p.isWinner) map.fallWinner = p.wrestlerName as string;
			if (p.isLoser) map.fallLoser = p.wrestlerName as string;
		}
	}

	const matchesWithOpponents = rows.map((r) => {
		const entry = participantMap.get(r.matchId as number);
		return {
			...r,
			partners: entry?.partners ?? [],
			opponentTeams: entry ? [...entry.opponentTeams.values()] : [],
			isWinner: entry?.teamWon ? 1 : 0,
			isLoser: entry?.teamLost ? 1 : 0,
			fallWinner: entry?.fallWinner ?? null,
			fallLoser: entry?.fallLoser ?? null,
			titleNames: titleMap.get(r.matchId as number) ?? [],
		};
	});

	const wins = matchesWithOpponents.filter((r) => r.isWinner).length;
	const losses = matchesWithOpponents.filter((r) => r.isLoser).length;

	return { wrestler, wins, losses, matches: matchesWithOpponents };
}
