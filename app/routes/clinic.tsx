import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";

/**
 * Legacy /clinic → /admin redirects (bookmarks and old magic links).
 * /clinic/admin maps to /admin/settings.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const rest = url.pathname.replace(/^\/clinic\/?/, "");
	let dest = rest ? `/admin/${rest}` : "/admin";
	if (dest === "/admin/admin") dest = "/admin/settings";
	throw redirect(`${dest}${url.search}`);
}
