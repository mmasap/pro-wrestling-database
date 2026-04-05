import { useEffect, useState } from "react";
import { Form, useSubmit } from "react-router";
import { getTitleHistory, getTitles } from "../services/titles";
import type { Route } from "./+types/titles";

export function meta() {
	return [{ title: "タイトル王座履歴 | Pro Wrestling Database" }];
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const titleIdParam = url.searchParams.get("titleId");

	const titleList = await getTitles();

	if (!titleIdParam) {
		return { titleList, history: null };
	}

	const titleId = Number(titleIdParam);
	const history = await getTitleHistory(titleId);
	return { titleList, history };
}

export default function Titles({ loaderData }: Route.ComponentProps) {
	const { titleList, history } = loaderData;
	const submit = useSubmit();
	const [titleId, setTitleId] = useState(
		history?.title?.id?.toString() ?? "",
	);

	useEffect(() => {
		setTitleId(history?.title?.id?.toString() ?? "");
	}, [history?.title?.id]);

	function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
		const form = e.currentTarget.form;
		if (form) submit(form);
	}

	return (
		<div className="mx-auto max-w-7xl p-6">
			<h1 className="mb-6 text-2xl font-bold">タイトル王座履歴</h1>

			<Form method="get" className="mb-6">
				<select
					name="titleId"
					value={titleId}
					onChange={(e) => {
						setTitleId(e.target.value);
						handleChange(e);
					}}
					className="rounded border px-3 py-2"
				>
					<option value="">タイトルを選択</option>
					{titleList.map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
				</select>
			</Form>

			{history && (
				<>
					<h2 className="mb-4 text-xl font-semibold">{history.title.name}</h2>
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr className="border-b bg-gray-100 text-left text-gray-700">
								<th className="px-3 py-2">日付</th>
								<th className="px-3 py-2">大会</th>
								<th className="px-3 py-2 text-red-700">勝者</th>
								<th className="px-3 py-2 text-blue-700">敗者</th>
								<th className="px-3 py-2">フィニッシュ</th>
							</tr>
						</thead>
						<tbody>
							{history.matches.map((m) => (
								<tr key={m.matchId} className="border-b text-gray-900">
									<td className="whitespace-nowrap px-3 py-2">{m.date}</td>
									<td className="px-3 py-2">{m.eventName}</td>
									<td className="px-3 py-2 font-semibold text-red-700">
										{m.winners.join(" & ")}
									</td>
									<td className="px-3 py-2 text-blue-700">
										{m.losers.join(" & ")}
									</td>
									<td className="px-3 py-2">{m.finish}</td>
								</tr>
							))}
						</tbody>
					</table>
				</>
			)}
		</div>
	);
}
