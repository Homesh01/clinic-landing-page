import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/cloudflare";
import { ClinicStaffChrome } from "~/components/clinic/ClinicStaffChrome";
import { PageHero } from "~/components/PageHero";
import { requireClinicStaff } from "~/utils/clinic-staff.server";
import { getPatientsDb, isPatientsDbConfigured } from "~/utils/patients.server";
import { logServerError } from "~/utils/safe-log.server";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";
import { listRecentActivity } from "~/utils/staff-activity.server";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Staff activity"),
		description: "Recent staff actions in admin tools.",
		path: "/admin/activity",
		noIndex: true,
	});
};

function formatWhen(iso: string): string {
	try {
		return new Intl.DateTimeFormat("en-GB", {
			dateStyle: "medium",
			timeStyle: "short",
			timeZone: "Europe/London",
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}

export async function loader({ request, context }: LoaderFunctionArgs) {
	const env = context.cloudflare.env;
	const staff = await requireClinicStaff(request, env);
	const dbConfigured = isPatientsDbConfigured(env);
	const db = getPatientsDb(env);

	let entries: Awaited<ReturnType<typeof listRecentActivity>> = [];
	let loadError: string | null = null;
	if (db) {
		try {
			entries = await listRecentActivity(db, 100);
		} catch (error) {
			logServerError("Staff activity load error", error);
			loadError =
				"Could not load activity. Check that D1 migration 0003 is applied.";
		}
	}

	return json(
		{ staff, dbConfigured, entries, loadError },
		{ headers: { "Cache-Control": "private, no-store" } },
	);
}

export default function ClinicActivityPage() {
	const { staff, dbConfigured, entries, loadError } =
		useLoaderData<typeof loader>();

	return (
		<>
			<PageHero
				eyebrow="Admin"
				title="Activity"
				summary="Recent staff actions across bookings, contacts, SMS, and settings."
			/>

			<section className="section-pad">
				<div className="site-container max-w-3xl space-y-8">
					<ClinicStaffChrome staffEmail={staff.email} active="activity" />

					{!dbConfigured ? (
						<div className="border border-line bg-cream/70 px-6 py-8">
							<p className="eyebrow">Unavailable</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								Patient database not configured
							</h2>
							<p className="mt-3 text-ink-soft">
								Activity logging uses D1. See{" "}
								<code className="text-sm">docs/clinic-patients-setup.md</code>.
							</p>
						</div>
					) : loadError ? (
						<p className="text-sm text-red-700" role="alert">
							{loadError}
						</p>
					) : entries.length === 0 ? (
						<p className="text-ink-soft">No activity recorded yet.</p>
					) : (
						<ul className="divide-y divide-line border border-line bg-white">
							{entries.map((entry) => (
								<li key={entry.id} className="px-5 py-4">
									<p className="font-semibold text-ink">{entry.summary}</p>
									<p className="mt-1 text-sm text-ink-muted">
										{formatWhen(entry.createdAt)} · {entry.actorEmail} ·{" "}
										{entry.action}
										{entry.entityType === "patient" ? (
											<>
												{" · "}
												<Link
													to={`/admin/patients/${entry.entityId}`}
													className="text-accent-deep underline-offset-2 hover:underline"
												>
													Open contact
												</Link>
											</>
										) : null}
										{entry.entityType === "booking" ? (
											<>
												{" · "}
												<Link
													to={`/admin/bookings?ref=${encodeURIComponent(entry.entityId)}`}
													className="text-accent-deep underline-offset-2 hover:underline"
												>
													Open booking
												</Link>
											</>
										) : null}
									</p>
								</li>
							))}
						</ul>
					)}
				</div>
			</section>
		</>
	);
}
