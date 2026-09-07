import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { getSitePassword } from "~/utils/site-auth.server";
import { SITE_ORIGIN } from "~/utils/seo";

export async function loader({ context }: LoaderFunctionArgs) {
	const passwordProtected = Boolean(getSitePassword(context.cloudflare.env));
	const body = passwordProtected
		? `User-agent: *
Disallow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`
		: `User-agent: *
Allow: /
Disallow: /login
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
