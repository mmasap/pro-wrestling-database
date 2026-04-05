import { useEffect, useState } from "react";
import { useSubmit } from "react-router";
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
	const [titleId, setTitleId] = useState(history?.title?.id?.toString() ?? "");

	useEffect(() => {
		setTitleId(history?.title?.id?.toString() ?? "");
	}, [history?.title?.id]);

	function handleSelect(val: string) {
		setTitleId(val);
		const params = new URLSearchParams();
		if (val) params.set("titleId", val);
		submit(params, { method: "get" });
	}

	return (
		<div className="mx-auto max-w-7xl p-6">
			<h1 className="mb-6 text-2xl font-bold">タイトル王座履歴</h1>

			<div className="mb-6">
				<Select value={titleId} onValueChange={handleSelect}>
					<SelectTrigger className="w-72">
						<SelectValue placeholder="タイトルを選択" />
					</SelectTrigger>
					<SelectContent>
						{titleList.map((t) => (
							<SelectItem key={t.id} value={t.id.toString()}>
								{t.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{history && (
				<>
					<h2 className="mb-4 text-xl font-semibold">{history.title.name}</h2>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>日付</TableHead>
								<TableHead>大会</TableHead>
								<TableHead className="text-red-700">勝者</TableHead>
								<TableHead className="text-blue-700">敗者</TableHead>
								<TableHead>フィニッシュ</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{history.matches.map((m) => (
								<TableRow key={m.matchId}>
									<TableCell className="max-w-48 whitespace-nowrap">{m.date}</TableCell>
									<TableCell className="whitespace-normal">{m.eventName}</TableCell>
									<TableCell className="font-semibold text-red-700">
										{m.winners.join(" & ")}
									</TableCell>
									<TableCell className="text-blue-700">
										{m.losers.join(" & ")}
									</TableCell>
									<TableCell>{m.finish}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</>
			)}
		</div>
	);
}
