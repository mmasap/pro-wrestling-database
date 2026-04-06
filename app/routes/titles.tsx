import { useEffect, useState } from "react";
import { useSubmit } from "react-router";
import { Combobox } from "~/components/ui/combobox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	getOrganizations,
	getTitleHistory,
	getTitles,
} from "../services/titles";
import type { Route } from "./+types/titles";

export function meta() {
	return [{ title: "タイトル王座履歴 | Pro Wrestling Database" }];
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const orgId = url.searchParams.get("orgId") ?? undefined;
	const titleIdParam = url.searchParams.get("titleId");

	const [orgList, titleList] = await Promise.all([
		getOrganizations(),
		getTitles(orgId),
	]);

	if (!titleIdParam) {
		return { orgList, orgId: orgId ?? "", titleList, history: null };
	}

	const history = await getTitleHistory(titleIdParam);
	return { orgList, orgId: orgId ?? "", titleList, history };
}

export default function Titles({ loaderData }: Route.ComponentProps) {
	const { orgList, orgId: initialOrgId, titleList, history } = loaderData;
	const submit = useSubmit();
	const [orgId, setOrgId] = useState(initialOrgId);
	const [titleId, setTitleId] = useState(history?.title?.id?.toString() ?? "");

	useEffect(() => {
		setOrgId(initialOrgId);
	}, [initialOrgId]);

	useEffect(() => {
		setTitleId(history?.title?.id?.toString() ?? "");
	}, [history?.title?.id]);

	function handleOrgSelect(val: string) {
		setOrgId(val);
		setTitleId("");
		const params = new URLSearchParams();
		if (val) params.set("orgId", val);
		submit(params, { method: "get" });
	}

	function handleSelect(val: string) {
		setTitleId(val);
		const params = new URLSearchParams();
		if (orgId) params.set("orgId", orgId);
		if (val) params.set("titleId", val);
		submit(params, { method: "get" });
	}

	// era_title ごとにグループ化
	const eras = history
		? Object.values(
				history.matches.reduce<
					Record<
						number,
						{
							eraTitle: number;
							holderName: string | null;
							matches: typeof history.matches;
						}
					>
				>((acc, m) => {
					if (!acc[m.eraTitle]) {
						acc[m.eraTitle] = {
							eraTitle: m.eraTitle,
							holderName: m.holderName,
							matches: [],
						};
					}
					acc[m.eraTitle].matches.push(m);
					return acc;
				}, {}),
			).sort((a, b) => b.eraTitle - a.eraTitle)
		: [];

	return (
		<div className="mx-auto max-w-7xl p-6">
			<h1 className="mb-6 text-2xl font-bold">タイトル王座履歴</h1>

			<div className="mb-6 flex flex-wrap gap-6">
				<div className="flex flex-col gap-1">
					<span className="text-xs font-medium text-muted-foreground">
						団体
					</span>
					<Combobox
						options={orgList.map((o) => ({ value: o.id, label: o.name }))}
						value={orgId}
						onValueChange={handleOrgSelect}
						placeholder="団体を選択"
						searchPlaceholder="団体を検索..."
					/>
				</div>
				<div className="flex flex-col gap-1">
					<span className="text-xs font-medium text-muted-foreground">
						タイトル
					</span>
					<Combobox
						options={titleList.map((t) => ({
							value: t.id.toString(),
							label: t.name,
						}))}
						value={titleId}
						onValueChange={handleSelect}
						placeholder="タイトルを選択"
						searchPlaceholder="タイトルを検索..."
						disabled={!orgId}
					/>
				</div>
			</div>

			{history && (
				<>
					<h2 className="mb-6 text-xl font-semibold">{history.title.name}</h2>
					<div className="space-y-8">
						{eras.map((era) => (
							<div key={era.eraTitle}>
								<div className="mb-2 flex items-center gap-3 border-l-4 border-red-700 pl-3 py-1">
									<span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
										第{era.eraTitle}代
									</span>
									<span className="text-lg font-bold">
										{era.holderName ?? "不明"}
									</span>
								</div>
								<Table>
									<TableHeader className="bg-muted">
										<TableRow>
											<TableHead className="w-px whitespace-nowrap">
												No
											</TableHead>
											<TableHead className="w-12 whitespace-nowrap">
												日付
											</TableHead>
											<TableHead className="hidden sm:table-cell w-36">
												会場
											</TableHead>
											<TableHead className="w-36">対戦相手</TableHead>
											<TableHead className="w-36">フィニッシュ</TableHead>
											<TableHead className="hidden sm:table-cell w-20 whitespace-nowrap">
												時間
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{era.matches.map((m, i) => (
											<TableRow
												key={m.matchId}
												className={i % 2 === 0 ? "bg-white" : "bg-muted/50"}
											>
												<TableCell className="whitespace-nowrap text-muted-foreground">
													{i + 1}
												</TableCell>
												<TableCell className="whitespace-nowrap">
													{m.date?.replaceAll("-", "/")}
												</TableCell>
												<TableCell className="hidden sm:table-cell whitespace-normal">
													{m.stadiumName}
												</TableCell>
												<TableCell className="whitespace-normal">
													{m.opponents}
												</TableCell>
												<TableCell className="whitespace-normal">
													{m.finish}
												</TableCell>
												<TableCell className="hidden sm:table-cell whitespace-normal">
													{m.time}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}
