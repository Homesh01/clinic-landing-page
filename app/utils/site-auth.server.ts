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

function getCookieSecret(env: Env | undefined, password: string): string {
	const dedicated = env?.SITE_COOKIE_SECRET?.trim();
	return dedicated || password;
}

export function timingSafeEqual(a: string, b: string): boolean {
	const encoder = new TextEncoder();
	const left = encoder.encode(a);
	const right = encoder.encode(b);
	const length = Math.max(left.byteLength, right.byteLength);
	let mismatch = left.byteLength === right.byteLength ? 0 : 1;

	for (let i = 0; i < length; i += 1) {
		const leftByte = left[i] ?? 0;
		const rightByte = right[i] ?? 0;
		mismatch |= leftByte ^ rightByte;
	}

	return mismatch === 0;
}

export async function hasSiteAccess(
	request: Request,
	env: Env | undefined,
	password: string,
): Promise<boolean> {
	const cookie = accessCookie(
		getCookieSecret(env, password),
		request.url.startsWith("https:"),
	);
	const value = await cookie.parse(request.headers.get("Cookie"));
	return value === "granted";
}

export async function createSiteAccessHeaders(
	request: Request,
	env: Env | undefined,
	password: string,
): Promise<Headers> {
	const cookie = accessCookie(
		getCookieSecret(env, password),
		request.url.startsWith("https:"),
	);
	const headers = new Headers();
	headers.append("Set-Cookie", await cookie.serialize("granted"));
	return headers;
}

export async function clearSiteAccessHeaders(
	request: Request,
	env: Env | undefined,
	password: string,
): Promise<Headers> {
	const cookie = accessCookie(
		getCookieSecret(env, password),
		request.url.startsWith("https:"),
	);
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
	if (url.pathname === "/api/stripe-webhook") return;

	if (await hasSiteAccess(request, env, password)) return;

	const redirectTo = `${url.pathname}${url.search}`;
	throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
}
