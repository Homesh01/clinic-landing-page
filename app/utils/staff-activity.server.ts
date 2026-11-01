export type StaffActivityRecord = {
	id: string;
	actorEmail: string;
	action: string;
	entityType: string;
	entityId: string;
	summary: string;
	createdAt: string;
};

type ActivityRow = {
	id: string;
	actor_email: string;
	action: string;
	entity_type: string;
	entity_id: string;
	summary: string;
	created_at: string;
};

function mapRow(row: ActivityRow): StaffActivityRecord {
	return {
		id: row.id,
		actorEmail: row.actor_email,
		action: row.action,
		entityType: row.entity_type,
		entityId: row.entity_id,
		summary: row.summary,
		createdAt: row.created_at,
	};
}

export async function recordStaffActivity(
	db: D1Database,
	input: {
		actorEmail: string;
		action: string;
		entityType: string;
		entityId: string;
		summary: string;
	},
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO staff_activity_log (
				id, actor_email, action, entity_type, entity_id, summary, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			crypto.randomUUID(),
			input.actorEmail.trim().toLowerCase(),
			input.action,
			input.entityType,
			input.entityId,
			input.summary.slice(0, 500),
			new Date().toISOString(),
		)
		.run();
}

export async function listRecentActivity(
	db: D1Database,
	limit = 100,
): Promise<StaffActivityRecord[]> {
	const { results } = await db
		.prepare(
			`SELECT * FROM staff_activity_log
			 ORDER BY created_at DESC
			 LIMIT ?`,
		)
		.bind(Math.min(Math.max(limit, 1), 200))
		.all<ActivityRow>();
	return (results ?? []).map(mapRow);
}
