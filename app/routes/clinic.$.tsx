import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";

/** Catch-all legacy redirect: /clinic/* → /admin/* */
export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const rest = url.pathname.replace(/^\/clinic\/?/, "");
	let dest = rest ? `/admin/${rest}` : "/admin";
	if (dest === "/admin/admin") dest = "/admin/settings";
	throw redirect(`${dest}${url.search}`);
}
