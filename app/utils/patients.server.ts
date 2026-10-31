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
	sentByEmail: string;
	createdAt: string;
	updatedAt: string;
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
	sent_by_email: string;
	created_at: string;
	updated_at: string;
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
		sentByEmail: row.sent_by_email,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
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
		sentByEmail: string;
	},
): Promise<SmsMessageRecord> {
	const id = crypto.randomUUID();
	const at = nowIso();
	await db
		.prepare(
			`INSERT INTO sms_messages (
				id, patient_id, to_e164, body, status, twilio_sid, error_code,
				sent_by_email, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id,
			input.patientId,
			input.toE164,
			input.body,
			input.status,
			input.twilioSid ?? null,
			input.errorCode ?? null,
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
