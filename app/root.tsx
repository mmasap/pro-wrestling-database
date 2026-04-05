import {
	isRouteErrorResponse,
	Links,
	Meta,
	NavLink,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return (
		<>
			<header className="border-b bg-background">
				<nav className="mx-auto flex max-w-7xl items-center gap-1 px-6 py-2">
					<span className="mr-4 text-sm font-bold tracking-tight">
						Pro Wrestling Database
					</span>
					<NavLink
						to="/"
						end
						className={({ isActive }) =>
							`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
								isActive
									? "bg-muted text-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground"
							}`
						}
					>
						レスラー
					</NavLink>
					<NavLink
						to="/titles"
						className={({ isActive }) =>
							`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
								isActive
									? "bg-muted text-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground"
							}`
						}
					>
						タイトル履歴
					</NavLink>
				</nav>
			</header>
			<Outlet />
		</>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404
				? "The requested page could not be found."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="pt-16 p-4 container mx-auto">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
