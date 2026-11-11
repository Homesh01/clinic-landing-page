-- Public site is open by default; staff can re-enable the password gate in /admin/settings.
INSERT INTO clinic_settings (key, value, updated_at, updated_by_email)
VALUES (
	'site_password_gate_enabled',
	'0',
	datetime('now'),
	'system:migration-0004'
)
ON CONFLICT(key) DO UPDATE SET
	value = '0',
	updated_at = excluded.updated_at,
	updated_by_email = excluded.updated_by_email;
