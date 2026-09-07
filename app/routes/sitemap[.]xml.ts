import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { getPublicPaths, SITE_ORIGIN } from "~/utils/seo";
import { getSitePassword } from "~/utils/site-auth.server";

export async function loader({ context }: LoaderFunctionArgs) {
	// While the site password gate is on, still publish a sitemap so Search Console
	// can be prepared — but robots.txt disallows crawling until the gate is removed.
	void getSitePassword(context.cloudflare.env);

	const lastmod = new Date().toISOString().slice(0, 10);
	const urls = getPublicPaths()
		.map((path) => {
			const loc = path === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`;
			const priority = path === "/" ? "1.0" : path === "/book" ? "0.9" : "0.8";
			return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
		})
		.join("\n");

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
