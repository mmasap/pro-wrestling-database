import { useEffect, useState } from "react";
import { Form, useSubmit } from "react-router";
import { Badge } from "~/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	getWrestlerRecord,
	getWrestlers,
	type MatchType,
} from "../services/wrestlers";
import type { Route } from "./+types/home";

export function meta() {
	return [{ title: "Pro Wrestling Database" }];
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const wrestlerIdParam = url.searchParams.get("wrestlerId");
	const matchType = (url.searchParams.get("matchType") ?? "all") as MatchType;

	const wrestlerList = await getWrestlers();

	if (!wrestlerIdParam) {
		return { wrestlerList, record: null, matchType };
	}

	const wrestlerId = Number(wrestlerIdParam);
	const record = await getWrestlerRecord(wrestlerId, matchType);
	return { wrestlerList, record, matchType };
}

const MATCH_TYPES: { value: MatchType; label: string }[] = [
	{ value: "all", label: "全試合" },
	{ value: "singles", label: "シングル" },
	{ value: "title", label: "タイトルマッチ" },
];

export default function Home({ loaderData }: Route.ComponentProps) {
	const { wrestlerList, record, matchType } = loaderData;
	const submit = useSubmit();
	const [wrestlerId, setWrestlerId] = useState(
		record?.wrestler?.id?.toString() ?? "",
	);

	useEffect(() => {
		setWrestlerId(record?.wrestler?.id?.toString() ?? "");
	}, [record?.wrestler?.id]);

	function submitForm(newWrestlerId: string, newMatchType: string) {
		const params = new URLSearchParams();
		if (newWrestlerId) params.set("wrestlerId", newWrestlerId);
		params.set("matchType", newMatchType);
		submit(params, { method: "get" });
	}

	return (
		<div className="mx-auto max-w-7xl p-6">
			<h1 className="mb-6 text-2xl font-bold">レスラー成績</h1>

			<Form method="get" className="mb-6 flex flex-wrap items-center gap-4">
				<Select
					value={wrestlerId}
					onValueChange={(val) => {
						setWrestlerId(val);
						submitForm(val, matchType);
					}}
				>
					<SelectTrigger className="w-48">
						<SelectValue placeholder="レスラーを選択" />
					</SelectTrigger>
					<SelectContent>
						{wrestlerList.map((w) => (
							<SelectItem key={w.id} value={w.id.toString()}>
								{w.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="flex gap-1 rounded-lg border p-1">
					{MATCH_TYPES.map((t) => (
						<button
							key={t.value}
							type="button"
							onClick={() => submitForm(wrestlerId, t.value)}
							className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
								matchType === t.value
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							{t.label}
						</button>
					))}
				</div>
			</Form>

			{record && (
				<>
					<div className="mb-4">
						<h2 className="text-xl font-semibold">{record.wrestler?.name}</h2>
						<p className="text-muted-foreground text-sm">
							{record.wins}勝 {record.losses}敗
						</p>
					</div>

					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>日付</TableHead>
								<TableHead>大会</TableHead>
								<TableHead className="text-center">勝敗</TableHead>
								<TableHead>対戦カード</TableHead>
								<TableHead>フィニッシュ</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{record.matches.map((m) => {
								const myTeamNames = [
									record.wrestler?.name ?? "",
									...m.partners,
								];
								const resultLabel = m.isWinner ? "勝" : m.isLoser ? "負" : "-";
								const badgeVariant = m.isWinner
									? "default"
									: m.isLoser
										? "secondary"
										: "outline";

								function renderName(name: string) {
									const isWinner = name === m.fallWinner;
									const isLoser = name === m.fallLoser;
									return (
										<span
											key={name}
											className={
												isWinner
													? "font-bold text-red-700"
													: isLoser
														? "font-bold text-blue-700"
														: ""
											}
										>
											{name}
										</span>
									);
								}

								function renderTeam(names: string[]) {
									return names.map((name, i) => (
										<span key={name}>
											{i > 0 && (
												<span className="text-muted-foreground"> & </span>
											)}
											{renderName(name)}
										</span>
									));
								}

								return (
									<TableRow key={m.matchId}>
										<TableCell className="whitespace-nowrap">
											{m.date}
										</TableCell>
										<TableCell className="max-w-48 whitespace-normal">
											{m.eventName}
										</TableCell>
										<TableCell className="text-center">
											<Badge
												variant={badgeVariant}
												className={
													m.isWinner
														? "bg-red-600 text-white hover:bg-red-600"
														: m.isLoser
															? "bg-blue-600 text-white hover:bg-blue-600"
															: ""
												}
											>
												{resultLabel}
											</Badge>
										</TableCell>
										<TableCell>
											{m.titleNames.length > 0 && (
												<div className="mb-1 flex flex-wrap gap-1">
													{m.titleNames.map((t) => (
														<Badge
															key={t}
															variant="outline"
															className="border-yellow-400 bg-yellow-50 text-yellow-800"
														>
															{t}
														</Badge>
													))}
												</div>
											)}
											<div>{renderTeam(myTeamNames)}</div>
											{m.opponentTeams.map((team) => (
												<div key={team.join(",")}>
													<div className="text-muted-foreground my-0.5 text-xs">
														vs
													</div>
													<div>{renderTeam(team)}</div>
												</div>
											))}
										</TableCell>
										<TableCell>{m.finish}</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</>
			)}
		</div>
	);
}
