import { createRequestHandler, type ServerBuild } from "@remix-run/cloudflare";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore This file won’t exist if it hasn’t yet been built
import * as build from "./build/server"; // eslint-disable-line import/no-unresolved
import { getLoadContext } from "./load-context";
import { logServerError } from "./app/utils/safe-log.server";
import { applySecurityHeaders } from "./app/utils/security-headers.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleRemixRequest = createRequestHandler(build as any as ServerBuild);

export default {
	async fetch(request, env, ctx) {
		try {
			const loadContext = getLoadContext({
				request,
				context: {
					cloudflare: {
						// This object matches the return value from Wrangler's
						// `getPlatformProxy` used during development via Remix's
						// `cloudflareDevProxyVitePlugin`:
						// https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy
						cf: request.cf,
						ctx: {
							waitUntil: ctx.waitUntil.bind(ctx),
							passThroughOnException: ctx.passThroughOnException.bind(ctx),
							props: {},
						},
						caches,
						env,
					},
				},
			});
			const response = await handleRemixRequest(request, loadContext);
			const headers = new Headers(response.headers);
			applySecurityHeaders(headers);
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});
		} catch (error) {
			logServerError("Worker unhandled error", error);
			const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8" });
			applySecurityHeaders(headers);
			return new Response("An unexpected error occurred", {
				status: 500,
				headers,
			});
		}
	},
} satisfies ExportedHandler<Env>;
