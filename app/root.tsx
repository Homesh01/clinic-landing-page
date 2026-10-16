import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLocation,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { Footer } from "~/components/Footer";
import { Header } from "~/components/Header";
import { requireSiteAccess } from "~/utils/site-auth.server";

import "./tailwind.css";

export const links: LinksFunction = () => [
	{ rel: "icon", href: "/logo-mark.png", type: "image/png" },
	{ rel: "apple-touch-icon", href: "/logo-mark.png" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
	await requireSiteAccess(request, context.cloudflare.env);
	return json(null);
}

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en-GB">
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
	const location = useLocation();
	const isLogin = location.pathname === "/login";

	if (isLogin) {
		return <Outlet />;
	}

	return (
		<div className="flex min-h-screen flex-col">
			<Header />
			<main className="flex-1">{<Outlet />}</main>
			<Footer />
		</div>
	);
}
