import { useEffect, useState } from "react";
import { Form, useSubmit } from "react-router";
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

	function handleChange(
		e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>,
	) {
		const form = e.currentTarget.form;
		if (form) submit(form);
	}

	return (
		<div className="mx-auto max-w-7xl p-6">
			<h1 className="mb-6 text-2xl font-bold">Pro Wrestling Database</h1>

			<Form method="get" className="mb-6 flex flex-wrap gap-4">
				<select
					name="wrestlerId"
					value={wrestlerId}
					onChange={(e) => {
						setWrestlerId(e.target.value);
						handleChange(e);
					}}
					className="rounded border px-3 py-2"
				>
					<option value="">レスラーを選択</option>
					{wrestlerList.map((w) => (
						<option key={w.id} value={w.id}>
							{w.name}
						</option>
					))}
				</select>

				<div className="flex gap-2">
					{MATCH_TYPES.map((t) => (
						<label key={t.value} className="flex items-center gap-1">
							<input
								type="radio"
								name="matchType"
								value={t.value}
								defaultChecked={matchType === t.value}
								onChange={handleChange}
							/>
							{t.label}
						</label>
					))}
				</div>
			</Form>

			{record && (
				<>
					<div className="mb-4">
						<h2 className="text-xl font-semibold">{record.wrestler?.name}</h2>
						<p className="text-gray-600">
							{record.wins}勝 {record.losses}敗
						</p>
					</div>

					<table className="w-full border-collapse text-sm ">
						<thead>
							<tr className="border-b bg-gray-100 text-left text-gray-700">
								<th className="px-3 py-2">日付</th>
								<th className="px-3 py-2">大会</th>
								<th className="px-3 py-2 whitespace-nowrap text-center">勝敗</th>
								<th className="px-3 py-2">対戦カード</th>
								<th className="px-3 py-2">フィニッシュ</th>
							</tr>
						</thead>
						<tbody>
							{record.matches.map((m) => {
								const myTeamNames = [record.wrestler?.name ?? "", ...m.partners];
								const opponentTeams = m.opponentTeams;
								const resultLabel = m.isWinner ? "勝" : m.isLoser ? "負" : "-";

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
											{i > 0 && <span className="text-gray-500"> & </span>}
											{renderName(name)}
										</span>
									));
								}
								const rowBg = m.isWinner
									? "bg-red-50"
									: m.isLoser
										? "bg-blue-50"
										: "bg-white";
								const badgeClass = m.isWinner
									? "bg-red-600 text-white"
									: m.isLoser
										? "bg-blue-600 text-white"
										: "bg-gray-400 text-white";
								return (
									<tr key={m.matchId} className={`border-b text-gray-900 ${rowBg}`}>
										<td className="px-3 py-2 whitespace-nowrap">{m.date}</td>
										<td className="max-w-64 px-3 py-2">{m.eventName}</td>
										<td className="px-3 py-2 text-center">
											<span className={`inline-block w-6 rounded py-0.5 text-center text-xs font-bold ${badgeClass}`}>
												{resultLabel}
											</span>
										</td>
										<td className="px-3 py-2">
											{m.titleNames.length > 0 && (
												<div className="mb-1 flex flex-wrap gap-1">
													{m.titleNames.map((t) => (
														<span key={t} className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-semibold text-yellow-800">
															{t}
														</span>
													))}
												</div>
											)}
											<div>{renderTeam(myTeamNames)}</div>
											{opponentTeams.map((team) => (
												<div key={team.join(",")}>
													<div className="my-0.5 text-xs text-gray-400">vs</div>
													<div>{renderTeam(team)}</div>
												</div>
											))}
										</td>
										<td className="px-3 py-2">{m.finish}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</>
			)}
		</div>
	);
}
