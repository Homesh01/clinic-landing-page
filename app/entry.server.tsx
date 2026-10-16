import type { AppLoadContext, EntryContext } from "@remix-run/cloudflare";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { logServerError } from "~/utils/safe-log.server";
import { applySecurityHeaders } from "~/utils/security-headers.server";

const ABORT_DELAY = 5000;

export default async function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	remixContext: EntryContext,
	_loadContext: AppLoadContext,
) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), ABORT_DELAY);

	const body = await renderToReadableStream(
		<RemixServer
			context={remixContext}
			url={request.url}
			abortDelay={ABORT_DELAY}
		/>,
		{
			signal: controller.signal,
			onError(error: unknown) {
				if (!controller.signal.aborted) {
					logServerError("SSR render error", error);
				}
				responseStatusCode = 500;
			},
		},
	);

	body.allReady.then(() => clearTimeout(timeoutId));

	if (isbot(request.headers.get("user-agent") || "")) {
		await body.allReady;
	}

	responseHeaders.set("Content-Type", "text/html");
	applySecurityHeaders(responseHeaders);
	return new Response(body, {
		headers: responseHeaders,
		status: responseStatusCode,
	});
}
