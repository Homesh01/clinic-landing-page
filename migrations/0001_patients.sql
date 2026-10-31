-- Patient contact directory and outbound SMS audit (no clinical fields).
CREATE TABLE patients (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	postal_address TEXT NOT NULL,
	email TEXT NOT NULL,
	phone_e164 TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	created_by_email TEXT NOT NULL,
	updated_by_email TEXT NOT NULL
);

CREATE INDEX patients_name_idx ON patients (name);
CREATE INDEX patients_email_idx ON patients (email);
CREATE INDEX patients_phone_idx ON patients (phone_e164);

CREATE TABLE sms_messages (
	id TEXT PRIMARY KEY,
	patient_id TEXT NOT NULL,
	to_e164 TEXT NOT NULL,
	body TEXT NOT NULL,
	status TEXT NOT NULL,
	twilio_sid TEXT,
	error_code TEXT,
	sent_by_email TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE INDEX sms_patient_idx ON sms_messages (patient_id, created_at DESC);
CREATE INDEX sms_sid_idx ON sms_messages (twilio_sid);
