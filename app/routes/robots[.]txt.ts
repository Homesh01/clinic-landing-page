import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { getSitePasswordGateState } from "~/utils/clinic-settings.server";
import {
	getSitePassword,
	isLocalDevRequest,
} from "~/utils/site-auth.server";
import { SITE_ORIGIN } from "~/utils/seo";

export async function loader({ request, context }: LoaderFunctionArgs) {
	const env = context.cloudflare.env;
	const passwordConfigured = Boolean(getSitePassword(env));
	const gate = await getSitePasswordGateState(env, {
		isLocal: isLocalDevRequest(request),
	});
	const passwordProtected = passwordConfigured && gate.enabled;
	const body = passwordProtected
		? `User-agent: *
Disallow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`
		: `User-agent: *
Allow: /
Disallow: /login
Disallow: /admin
Disallow: /clinic
Disallow: /manage-booking
Disallow: /api/

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;

	return new Response(body, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
