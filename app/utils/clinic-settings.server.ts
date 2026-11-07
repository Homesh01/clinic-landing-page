import { getPatientsDb } from "~/utils/patients.server";

export const SITE_PASSWORD_GATE_KEY = "site_password_gate_enabled";

export type SitePasswordGateState = {
	/** When true, public pages require the site password (if SITE_PASSWORD is set). */
	enabled: boolean;
	updatedAt: string | null;
	updatedByEmail: string | null;
	/** False when D1 is not bound or the settings table is unavailable. */
	persistable: boolean;
};

function nowIso(): string {
	return new Date().toISOString();
}

/** Local default: off. Production default: on. */
export function defaultSitePasswordGateEnabled(isLocal: boolean): boolean {
	return !isLocal;
}

/**
 * Stored value is "0" | "1". When no row exists, local defaults off and
 * remote defaults on.
 */
export async function getSitePasswordGateState(
	env: Env | undefined,
	options: { isLocal: boolean },
): Promise<SitePasswordGateState> {
	const fallbackEnabled = defaultSitePasswordGateEnabled(options.isLocal);
	const db = getPatientsDb(env);
	if (!db) {
		return {
			enabled: fallbackEnabled,
			updatedAt: null,
			updatedByEmail: null,
			persistable: false,
		};
	}

	try {
		const row = await db
			.prepare(
				`SELECT value, updated_at, updated_by_email FROM clinic_settings WHERE key = ?`,
			)
			.bind(SITE_PASSWORD_GATE_KEY)
			.first<{
				value: string;
				updated_at: string;
				updated_by_email: string;
			}>();

		if (!row) {
			return {
				enabled: fallbackEnabled,
				updatedAt: null,
				updatedByEmail: null,
				persistable: true,
			};
		}

		return {
			enabled: row.value !== "0",
			updatedAt: row.updated_at,
			updatedByEmail: row.updated_by_email,
			persistable: true,
		};
	} catch {
		// Table missing before migration, use environment default.
		return {
			enabled: fallbackEnabled,
			updatedAt: null,
			updatedByEmail: null,
			persistable: false,
		};
	}
}

export async function setSitePasswordGateEnabled(
	env: Env | undefined,
	enabled: boolean,
	staffEmail: string,
): Promise<SitePasswordGateState> {
	const db = getPatientsDb(env);
	if (!db) {
		throw new Error("Clinic database is not configured.");
	}

	const at = nowIso();
	const value = enabled ? "1" : "0";
	await db
		.prepare(
			`INSERT INTO clinic_settings (key, value, updated_at, updated_by_email)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(key) DO UPDATE SET
				value = excluded.value,
				updated_at = excluded.updated_at,
				updated_by_email = excluded.updated_by_email`,
		)
		.bind(SITE_PASSWORD_GATE_KEY, value, at, staffEmail)
		.run();

	return {
		enabled,
		updatedAt: at,
		updatedByEmail: staffEmail,
		persistable: true,
	};
}
