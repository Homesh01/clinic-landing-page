import { isLocalDevRequest } from "~/utils/site-auth.server";

/**
 * Canonical public site origin for Stripe redirects and staff magic links.
 * Prefer PUBLIC_SITE_URL so Host-header spoofing cannot rewrite outbound URLs.
 * Localhost falls back to the request origin when unset.
 */
export function getPublicSiteOrigin(
	request: Request,
	env: Env | undefined,
): string {
	const configured = env?.PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
	if (configured) {
		try {
			return new URL(configured).origin;
		} catch {
			// Fall through to request origin.
		}
	}

	return new URL(request.url).origin;
}

export function isPublicSiteUrlConfigured(env: Env | undefined): boolean {
	const configured = env?.PUBLIC_SITE_URL?.trim();
	if (!configured) return false;
	try {
		new URL(configured);
		return true;
	} catch {
		return false;
	}
}

/** True when production should set PUBLIC_SITE_URL (not local). */
export function shouldPreferConfiguredPublicUrl(request: Request): boolean {
	return !isLocalDevRequest(request);
}
