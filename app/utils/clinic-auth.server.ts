import { createCookie, redirect } from "@remix-run/cloudflare";

const COOKIE_NAME = "clinic_staff";
const MAGIC_LINK_TTL_MS = 10 * 60 * 1000;
const SESSION_MAX_AGE_SEC = 60 * 60 * 12; // 12 hours once logged in

export type ClinicStaffSession = {
	email: string;
};

function getStaffCookieSecret(env: Env | undefined): string | undefined {
	return (
		env?.CLINIC_STAFF_COOKIE_SECRET?.trim() ||
		env?.SITE_COOKIE_SECRET?.trim() ||
		env?.SITE_PASSWORD?.trim() ||
		undefined
	);
}

export function getClinicStaffEmails(env: Env | undefined): string[] {
	const raw = env?.CLINIC_STAFF_EMAILS?.trim();
	if (!raw) return [];
	return raw
		.split(/[,;\s]+/)
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
}

export function isClinicStaffEmailConfigured(env: Env | undefined): boolean {
	return getClinicStaffEmails(env).length > 0 && Boolean(getStaffCookieSecret(env));
}

export function isAllowedClinicStaffEmail(
	env: Env | undefined,
	email: string,
): boolean {
	const normalised = email.trim().toLowerCase();
	if (!normalised) return false;
	return getClinicStaffEmails(env).includes(normalised);
}

function staffCookie(secret: string, secure: boolean) {
	return createCookie(COOKIE_NAME, {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		secure,
		secrets: [secret],
		maxAge: SESSION_MAX_AGE_SEC,
	});
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let binary = "";
	for (const byte of view) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
	const padded = value.replace(/-/g, "+").replace(/_/g, "/");
	const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
	const binary = atob(padded + pad);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

async function signPayload(secret: string, payload: string): Promise<string> {
	const key = await importHmacKey(secret);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(payload),
	);
	return toBase64Url(signature);
}

async function verifySignature(
	secret: string,
	payload: string,
	signature: string,
): Promise<boolean> {
	const key = await importHmacKey(secret);
	const sigBytes = fromBase64Url(signature);
	const sigCopy = new Uint8Array(sigBytes);
	return crypto.subtle.verify(
		"HMAC",
		key,
		sigCopy,
		new TextEncoder().encode(payload),
	);
}

/** Create a one-time-ish login token (valid 10 minutes). */
export async function createClinicMagicLinkToken(
	env: Env | undefined,
	email: string,
): Promise<{ token: string; expiresAt: Date } | null> {
	const secret = getStaffCookieSecret(env);
	const normalised = email.trim().toLowerCase();
	if (!secret || !isAllowedClinicStaffEmail(env, normalised)) return null;

	const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);
	const payloadObj = {
		email: normalised,
		exp: expiresAt.getTime(),
		nonce: crypto.randomUUID(),
	};
	const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(payloadObj)));
	const signature = await signPayload(secret, payload);
	return { token: `${payload}.${signature}`, expiresAt };
}

export async function verifyClinicMagicLinkToken(
	env: Env | undefined,
	token: string,
): Promise<{ email: string } | null> {
	const secret = getStaffCookieSecret(env);
	if (!secret || !token.includes(".")) return null;

	const [payload, signature] = token.split(".");
	if (!payload || !signature) return null;
	if (!(await verifySignature(secret, payload, signature))) return null;

	try {
		const json = new TextDecoder().decode(fromBase64Url(payload));
		const data = JSON.parse(json) as {
			email?: string;
			exp?: number;
		};
		const email = data.email?.trim().toLowerCase();
		if (!email || !data.exp || Date.now() > data.exp) return null;
		if (!isAllowedClinicStaffEmail(env, email)) return null;
		return { email };
	} catch {
		return null;
	}
}

export async function getClinicStaffSession(
	request: Request,
	env: Env | undefined,
): Promise<ClinicStaffSession | null> {
	const secret = getStaffCookieSecret(env);
	if (!secret) return null;
	const cookie = staffCookie(secret, request.url.startsWith("https:"));
	const value = await cookie.parse(request.headers.get("Cookie"));
	const email = typeof value === "string" ? value.trim().toLowerCase() : "";
	if (!email || !isAllowedClinicStaffEmail(env, email)) return null;
	return { email };
}

export async function createClinicStaffSessionHeaders(
	request: Request,
	env: Env | undefined,
	email: string,
): Promise<Headers> {
	const secret = getStaffCookieSecret(env);
	if (!secret) throw new Error("Clinic staff cookie secret is not configured.");
	const cookie = staffCookie(secret, request.url.startsWith("https:"));
	const headers = new Headers();
	headers.append(
		"Set-Cookie",
		await cookie.serialize(email.trim().toLowerCase()),
	);
	return headers;
}

export async function clearClinicStaffSessionHeaders(
	request: Request,
	env: Env | undefined,
): Promise<Headers> {
	const secret = getStaffCookieSecret(env);
	const headers = new Headers();
	if (!secret) return headers;
	const cookie = staffCookie(secret, request.url.startsWith("https:"));
	headers.append("Set-Cookie", await cookie.serialize("", { maxAge: 0 }));
	return headers;
}

export async function requireClinicStaff(
	request: Request,
	env: Env | undefined,
): Promise<ClinicStaffSession> {
	const session = await getClinicStaffSession(request, env);
	if (session) return session;
	throw redirect("/clinic");
}

export const CLINIC_MAGIC_LINK_MINUTES = 10;
