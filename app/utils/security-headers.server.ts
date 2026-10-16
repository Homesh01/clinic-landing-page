/** Baseline browser security headers for HTML and API responses. */
export function applySecurityHeaders(headers: Headers): void {
	if (!headers.has("X-Content-Type-Options")) {
		headers.set("X-Content-Type-Options", "nosniff");
	}
	if (!headers.has("X-Frame-Options")) {
		headers.set("X-Frame-Options", "SAMEORIGIN");
	}
	if (!headers.has("Referrer-Policy")) {
		headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	}
	if (!headers.has("Permissions-Policy")) {
		headers.set(
			"Permissions-Policy",
			"camera=(), microphone=(), geolocation=()",
		);
	}
	// After self-hosting fonts, keep CSP tight. 'unsafe-inline' remains for
	// Remix/Tailwind inline styles; no third-party script hosts are allowed.
	if (!headers.has("Content-Security-Policy")) {
		headers.set(
			"Content-Security-Policy",
			[
				"default-src 'self'",
				"base-uri 'self'",
				"object-src 'none'",
				"frame-ancestors 'self'",
				"img-src 'self' data:",
				"font-src 'self'",
				"style-src 'self' 'unsafe-inline'",
				"script-src 'self' 'unsafe-inline'",
				"connect-src 'self'",
				"form-action 'self'",
				"upgrade-insecure-requests",
			].join("; "),
		);
	}
}
