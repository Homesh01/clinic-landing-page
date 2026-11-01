import type { ValidatedPatientInput } from "~/utils/patient-validation";

export type PatientRecord = {
	id: string;
	name: string;
	postalAddress: string;
	email: string;
	phoneE164: string;
	createdAt: string;
	updatedAt: string;
	createdByEmail: string;
	updatedByEmail: string;
};

export type SmsMessageRecord = {
	id: string;
	patientId: string;
	toE164: string;
	body: string;
	status: string;
	twilioSid: string | null;
	errorCode: string | null;
	templateSlug: string | null;
	sentByEmail: string;
	createdAt: string;
	updatedAt: string;
};

export type PatientBookingLink = {
	patientId: string;
	bookingRef: string;
	linkedAt: string;
	linkedByEmail: string;
};

type PatientRow = {
	id: string;
	name: string;
	postal_address: string;
	email: string;
	phone_e164: string;
	created_at: string;
	updated_at: string;
	created_by_email: string;
	updated_by_email: string;
};

type SmsRow = {
	id: string;
	patient_id: string;
	to_e164: string;
	body: string;
	status: string;
	twilio_sid: string | null;
	error_code: string | null;
	template_slug: string | null;
	sent_by_email: string;
	created_at: string;
	updated_at: string;
};

type PatientBookingRow = {
	patient_id: string;
	booking_ref: string;
	linked_at: string;
	linked_by_email: string;
};

function mapPatient(row: PatientRow): PatientRecord {
	return {
		id: row.id,
		name: row.name,
		postalAddress: row.postal_address,
		email: row.email,
		phoneE164: row.phone_e164,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		createdByEmail: row.created_by_email,
		updatedByEmail: row.updated_by_email,
	};
}

function mapSms(row: SmsRow): SmsMessageRecord {
	return {
		id: row.id,
		patientId: row.patient_id,
		toE164: row.to_e164,
		body: row.body,
		status: row.status,
		twilioSid: row.twilio_sid,
		errorCode: row.error_code,
		templateSlug: row.template_slug ?? null,
		sentByEmail: row.sent_by_email,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function mapPatientBooking(row: PatientBookingRow): PatientBookingLink {
	return {
		patientId: row.patient_id,
		bookingRef: row.booking_ref,
		linkedAt: row.linked_at,
		linkedByEmail: row.linked_by_email,
	};
}

export function getPatientsDb(env: Env | undefined): D1Database | null {
	return env?.DB ?? null;
}

export function isPatientsDbConfigured(env: Env | undefined): boolean {
	return Boolean(env?.DB);
}

function nowIso(): string {
	return new Date().toISOString();
}

export async function searchPatients(
	db: D1Database,
	query: string,
): Promise<PatientRecord[]> {
	const q = query.trim();
	if (!q) {
		const { results } = await db
			.prepare(
				`SELECT * FROM patients ORDER BY name COLLATE NOCASE LIMIT 100`,
			)
			.all<PatientRow>();
		return (results ?? []).map(mapPatient);
	}

	const like = `%${q.replace(/[%_]/g, "")}%`;
	const digits = q.replace(/\D/g, "");
	const phoneLike = digits.length >= 3 ? `%${digits}%` : like;

	const { results } = await db
		.prepare(
			`SELECT * FROM patients
			 WHERE name LIKE ? COLLATE NOCASE
			    OR email LIKE ? COLLATE NOCASE
			    OR phone_e164 LIKE ?
			 ORDER BY name COLLATE NOCASE
			 LIMIT 50`,
		)
		.bind(like, like, phoneLike)
		.all<PatientRow>();
	return (results ?? []).map(mapPatient);
}

export async function getPatientById(
	db: D1Database,
	id: string,
): Promise<PatientRecord | null> {
	const row = await db
		.prepare(`SELECT * FROM patients WHERE id = ?`)
		.bind(id)
		.first<PatientRow>();
	return row ? mapPatient(row) : null;
}

export async function createPatient(
	db: D1Database,
	input: ValidatedPatientInput,
	staffEmail: string,
): Promise<PatientRecord> {
	const id = crypto.randomUUID();
	const at = nowIso();
	await db
		.prepare(
			`INSERT INTO patients (
				id, name, postal_address, email, phone_e164,
				created_at, updated_at, created_by_email, updated_by_email
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id,
			input.name,
			input.postalAddress,
			input.email,
			input.phone,
			at,
			at,
			staffEmail,
			staffEmail,
		)
		.run();

	const created = await getPatientById(db, id);
	if (!created) throw new Error("Patient create failed.");
	return created;
}

export async function updatePatient(
	db: D1Database,
	id: string,
	input: ValidatedPatientInput,
	staffEmail: string,
): Promise<PatientRecord | null> {
	const existing = await getPatientById(db, id);
	if (!existing) return null;
	const at = nowIso();
	await db
		.prepare(
			`UPDATE patients SET
				name = ?, postal_address = ?, email = ?, phone_e164 = ?,
				updated_at = ?, updated_by_email = ?
			 WHERE id = ?`,
		)
		.bind(
			input.name,
			input.postalAddress,
			input.email,
			input.phone,
			at,
			staffEmail,
			id,
		)
		.run();
	return getPatientById(db, id);
}

export async function listSmsForPatient(
	db: D1Database,
	patientId: string,
	limit = 20,
): Promise<SmsMessageRecord[]> {
	const { results } = await db
		.prepare(
			`SELECT * FROM sms_messages
			 WHERE patient_id = ?
			 ORDER BY created_at DESC
			 LIMIT ?`,
		)
		.bind(patientId, limit)
		.all<SmsRow>();
	return (results ?? []).map(mapSms);
}

export async function insertSmsMessage(
	db: D1Database,
	input: {
		patientId: string;
		toE164: string;
		body: string;
		status: string;
		twilioSid?: string | null;
		errorCode?: string | null;
		templateSlug?: string | null;
		sentByEmail: string;
	},
): Promise<SmsMessageRecord> {
	const id = crypto.randomUUID();
	const at = nowIso();
	await db
		.prepare(
			`INSERT INTO sms_messages (
				id, patient_id, to_e164, body, status, twilio_sid, error_code,
				template_slug, sent_by_email, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id,
			input.patientId,
			input.toE164,
			input.body,
			input.status,
			input.twilioSid ?? null,
			input.errorCode ?? null,
			input.templateSlug ?? null,
			input.sentByEmail,
			at,
			at,
		)
		.run();

	const row = await db
		.prepare(`SELECT * FROM sms_messages WHERE id = ?`)
		.bind(id)
		.first<SmsRow>();
	if (!row) throw new Error("SMS audit insert failed.");
	return mapSms(row);
}

export async function listBookingsForPatient(
	db: D1Database,
	patientId: string,
): Promise<PatientBookingLink[]> {
	const { results } = await db
		.prepare(
			`SELECT * FROM patient_bookings
			 WHERE patient_id = ?
			 ORDER BY linked_at DESC`,
		)
		.bind(patientId)
		.all<PatientBookingRow>();
	return (results ?? []).map(mapPatientBooking);
}

export async function getPatientByBookingRef(
	db: D1Database,
	bookingRef: string,
): Promise<PatientRecord | null> {
	const link = await db
		.prepare(`SELECT * FROM patient_bookings WHERE booking_ref = ?`)
		.bind(bookingRef.trim().toUpperCase())
		.first<PatientBookingRow>();
	if (!link) return null;
	return getPatientById(db, link.patient_id);
}

export async function linkPatientBooking(
	db: D1Database,
	input: {
		patientId: string;
		bookingRef: string;
		staffEmail: string;
	},
): Promise<PatientBookingLink> {
	const bookingRef = input.bookingRef.trim().toUpperCase();
	const at = nowIso();
	await db
		.prepare(
			`INSERT INTO patient_bookings (patient_id, booking_ref, linked_at, linked_by_email)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(booking_ref) DO UPDATE SET
				patient_id = excluded.patient_id,
				linked_at = excluded.linked_at,
				linked_by_email = excluded.linked_by_email`,
		)
		.bind(input.patientId, bookingRef, at, input.staffEmail)
		.run();
	return {
		patientId: input.patientId,
		bookingRef,
		linkedAt: at,
		linkedByEmail: input.staffEmail,
	};
}

export async function unlinkPatientBooking(
	db: D1Database,
	bookingRef: string,
): Promise<boolean> {
	const result = await db
		.prepare(`DELETE FROM patient_bookings WHERE booking_ref = ?`)
		.bind(bookingRef.trim().toUpperCase())
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/** Soft-match contacts by email or phone digits for booking link suggestions. */
export async function findPatientsMatchingContact(
	db: D1Database,
	input: { email?: string; phone?: string },
): Promise<PatientRecord[]> {
	const email = input.email?.trim().toLowerCase() ?? "";
	const phoneDigits = (input.phone ?? "").replace(/\D/g, "");
	if (!email && phoneDigits.length < 7) return [];

	const seen = new Set<string>();
	const out: PatientRecord[] = [];

	if (email) {
		const { results } = await db
			.prepare(
				`SELECT * FROM patients WHERE email = ? COLLATE NOCASE LIMIT 10`,
			)
			.bind(email)
			.all<PatientRow>();
		for (const row of results ?? []) {
			if (seen.has(row.id)) continue;
			seen.add(row.id);
			out.push(mapPatient(row));
		}
	}

	if (phoneDigits.length >= 7) {
		const like = `%${phoneDigits.slice(-9)}%`;
		const { results } = await db
			.prepare(
				`SELECT * FROM patients WHERE phone_e164 LIKE ? LIMIT 10`,
			)
			.bind(like)
			.all<PatientRow>();
		for (const row of results ?? []) {
			if (seen.has(row.id)) continue;
			seen.add(row.id);
			out.push(mapPatient(row));
		}
	}

	return out;
}

export async function updateSmsMessageStatus(
	db: D1Database,
	id: string,
	input: {
		status: string;
		twilioSid?: string | null;
		errorCode?: string | null;
	},
): Promise<void> {
	await db
		.prepare(
			`UPDATE sms_messages SET
				status = ?, twilio_sid = COALESCE(?, twilio_sid),
				error_code = ?, updated_at = ?
			 WHERE id = ?`,
		)
		.bind(
			input.status,
			input.twilioSid ?? null,
			input.errorCode ?? null,
			nowIso(),
			id,
		)
		.run();
}
