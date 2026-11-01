-- SMS template slug on audit rows; booking↔patient links; staff activity log.
ALTER TABLE sms_messages ADD COLUMN template_slug TEXT;

CREATE TABLE patient_bookings (
	patient_id TEXT NOT NULL,
	booking_ref TEXT NOT NULL,
	linked_at TEXT NOT NULL,
	linked_by_email TEXT NOT NULL,
	PRIMARY KEY (booking_ref),
	FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE INDEX patient_bookings_patient_idx ON patient_bookings (patient_id, linked_at DESC);

CREATE TABLE staff_activity_log (
	id TEXT PRIMARY KEY,
	actor_email TEXT NOT NULL,
	action TEXT NOT NULL,
	entity_type TEXT NOT NULL,
	entity_id TEXT NOT NULL,
	summary TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE INDEX staff_activity_created_idx ON staff_activity_log (created_at DESC);
