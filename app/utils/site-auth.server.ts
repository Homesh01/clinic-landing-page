import { createCookie, redirect } from "@remix-run/cloudflare";

const COOKIE_NAME = "site_access";

function accessCookie(secret: string, secure: boolean) {
	return createCookie(COOKIE_NAME, {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		secure,
		secrets: [secret],
		maxAge: 60 * 60 * 24 * 30,
	});
}

export function getSitePassword(env: Env | undefined): string | undefined {
	const password = env?.SITE_PASSWORD?.trim();
	return password ? password : undefined;
}

export async function hasSiteAccess(
	request: Request,
	password: string,
): Promise<boolean> {
	const cookie = accessCookie(password, request.url.startsWith("https:"));
	const value = await cookie.parse(request.headers.get("Cookie"));
	return value === "granted";
}

export async function createSiteAccessHeaders(
	request: Request,
	password: string,
): Promise<Headers> {
	const cookie = accessCookie(password, request.url.startsWith("https:"));
	const headers = new Headers();
	headers.append("Set-Cookie", await cookie.serialize("granted"));
	return headers;
}

export async function clearSiteAccessHeaders(
	request: Request,
	password: string,
): Promise<Headers> {
	const cookie = accessCookie(password, request.url.startsWith("https:"));
	const headers = new Headers();
	headers.append("Set-Cookie", await cookie.serialize("", { maxAge: 0 }));
	return headers;
}

export async function requireSiteAccess(
	request: Request,
	env: Env | undefined,
): Promise<void> {
	const password = getSitePassword(env);
	if (!password) return;

	const url = new URL(request.url);
	if (url.pathname === "/login") return;

	if (await hasSiteAccess(request, password)) return;

	const redirectTo = `${url.pathname}${url.search}`;
	throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
}
