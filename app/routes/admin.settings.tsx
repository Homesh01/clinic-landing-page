import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/cloudflare";
import {
	Form,
	useActionData,
	useLoaderData,
	useNavigation,
} from "@remix-run/react";
import { json } from "@remix-run/cloudflare";
import { ClinicStaffChrome } from "~/components/clinic/ClinicStaffChrome";
import { PageHero } from "~/components/PageHero";
import { requireClinicStaff } from "~/utils/clinic-staff.server";
import {
	getSitePasswordGateState,
	setSitePasswordGateEnabled,
} from "~/utils/clinic-settings.server";
import { getPatientsDb } from "~/utils/patients.server";
import {
	getSitePassword,
	isLocalDevRequest,
} from "~/utils/site-auth.server";
import { logServerError } from "~/utils/safe-log.server";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";
import { recordStaffActivity } from "~/utils/staff-activity.server";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Admin settings"),
		description: "Administration settings.",
		path: "/admin/settings",
		noIndex: true,
	});
};

export async function loader({ request, context }: LoaderFunctionArgs) {
	const env = context.cloudflare.env;
	const staff = await requireClinicStaff(request, env);
	const isLocal = isLocalDevRequest(request);
	const gate = await getSitePasswordGateState(env, { isLocal });
	const passwordConfigured = Boolean(getSitePassword(env));

	return json(
		{
			staff,
			gate,
			passwordConfigured,
			isLocal,
		},
		{
			headers: {
				"Cache-Control": "private, no-store",
			},
		},
	);
}

export async function action({ request, context }: ActionFunctionArgs) {
	const env = context.cloudflare.env;
	const staff = await requireClinicStaff(request, env);
	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "");

	if (intent !== "enable-gate" && intent !== "disable-gate") {
		return json(
			{ ok: false as const, error: "Unknown action." },
			{ status: 400 },
		);
	}

	const enable = intent === "enable-gate";
	if (!enable && formData.get("confirmed") !== "yes") {
		return json(
			{
				ok: false as const,
				error: "Confirm that you want the public site open without a password.",
			},
			{ status: 400 },
		);
	}

	try {
		const gate = await setSitePasswordGateEnabled(env, enable, staff.email);
		const db = getPatientsDb(env);
		if (db) {
			try {
				await recordStaffActivity(db, {
					actorEmail: staff.email,
					action: enable ? "enable_site_gate" : "disable_site_gate",
					entityType: "settings",
					entityId: "site_password_gate",
					summary: enable
						? "Enabled public site password gate"
						: "Disabled public site password gate",
				});
			} catch (logError) {
				logServerError("Activity log error", logError);
			}
		}
		return json({ ok: true as const, gate });
	} catch (error) {
		logServerError("Site gate toggle error", error);
		return json(
			{
				ok: false as const,
				error:
					"Could not update the setting. Check that D1 migrations are applied.",
			},
			{ status: 500 },
		);
	}
}

function formatWhen(iso: string | null): string {
	if (!iso) return "Never changed";
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

export default function ClinicAdminPage() {
	const { staff, gate, passwordConfigured } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";

	const currentGate =
		actionData && actionData.ok ? actionData.gate : gate;
	const error = actionData && !actionData.ok ? actionData.error : null;

	return (
		<>
			<PageHero
				eyebrow="Admin"
				title="Settings"
				summary="Site-wide settings for authorised staff."
			/>

			<section className="section-pad">
				<div className="site-container max-w-2xl space-y-8">
					<ClinicStaffChrome staffEmail={staff.email} active="settings" />

					<div className="border border-line bg-white px-6 py-7">
						<p className="eyebrow">Public site access</p>
						<h2 className="mt-3 font-display text-2xl text-ink">
							Password gate
						</h2>
						<p className="mt-3 text-ink-soft">
							When the gate is on, visitors must enter the site password before
							using the public website. Staff tools at{" "}
							<code className="text-sm">/admin</code> still require your magic
							link sign-in either way. Default before anyone changes it: off
							(public site open).
						</p>

						{!passwordConfigured ? (
							<p className="mt-4 text-sm text-ink-soft" role="status">
								<code className="text-sm">SITE_PASSWORD</code> is not set, so
								the public site is already open. Setting a password in Workers
								secrets is required before the gate can lock the site.
							</p>
						) : null}

						{!currentGate.persistable ? (
							<p className="mt-4 text-sm text-red-700" role="alert">
								Settings cannot be saved until the clinic D1 database and
								migrations are available.
							</p>
						) : null}

						<div className="mt-6 border border-line bg-cream/40 px-5 py-4">
							<p className="font-semibold text-ink">
								Status:{" "}
								{currentGate.enabled ? "Gate on (password required)" : "Gate off (public site open)"}
							</p>
							<p className="mt-2 text-sm text-ink-muted">
								{formatWhen(currentGate.updatedAt)}
								{currentGate.updatedByEmail
									? ` · ${currentGate.updatedByEmail}`
									: ""}
							</p>
						</div>

						{error ? (
							<p className="mt-4 text-sm text-red-700" role="alert">
								{error}
							</p>
						) : null}

						{actionData?.ok ? (
							<p className="mt-4 text-sm text-accent-deep" role="status">
								Saved.
							</p>
						) : null}

						{currentGate.persistable && passwordConfigured ? (
							<div className="mt-6 flex flex-wrap gap-3">
								{currentGate.enabled ? (
									<Form method="post" className="space-y-4">
										<input type="hidden" name="intent" value="disable-gate" />
										<label className="flex items-start gap-3 text-sm text-ink">
											<input
												type="checkbox"
												name="confirmed"
												value="yes"
												required
												className="mt-1"
											/>
											<span>
												I understand the public website will be reachable
												without a password until the gate is turned back on.
											</span>
										</label>
										<button
											type="submit"
											className="btn-primary"
											disabled={submitting}
										>
											{submitting ? "Updating…" : "Turn gate off"}
										</button>
									</Form>
								) : (
									<Form method="post">
										<input type="hidden" name="intent" value="enable-gate" />
										<button
											type="submit"
											className="btn-primary"
											disabled={submitting}
										>
											{submitting ? "Updating…" : "Turn gate on"}
										</button>
									</Form>
								)}
							</div>
						) : null}
					</div>
				</div>
			</section>
		</>
	);
}
