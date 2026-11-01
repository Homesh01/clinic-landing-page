-- Clinic-wide settings (e.g. public site password gate).
CREATE TABLE clinic_settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	updated_by_email TEXT NOT NULL
);
