import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/cloudflare";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
} from "@remix-run/react";
import { json, redirect } from "@remix-run/cloudflare";
import { ClinicStaffChrome } from "~/components/clinic/ClinicStaffChrome";
import { PageHero } from "~/components/PageHero";
import { sendClinicStaffMagicLinkEmail } from "~/utils/booking-email.server";
import {
	CLINIC_MAGIC_LINK_MINUTES,
	clearClinicStaffSessionHeaders,
	createClinicMagicLinkToken,
	getClinicStaffEmails,
	getClinicStaffSession,
	isClinicStaffEmailConfigured,
} from "~/utils/clinic-auth.server";
import { getSitePasswordGateState } from "~/utils/clinic-settings.server";
import { formatBookingDate } from "~/utils/format-date";
import {
	getBookingConfig,
	listManagedBookingsInRange,
} from "~/utils/google-calendar.server";
import { isPatientsDbConfigured } from "~/utils/patients.server";
import {
	getPublicSiteOrigin,
	isPublicSiteUrlConfigured,
	shouldPreferConfiguredPublicUrl,
} from "~/utils/public-url.server";
import {
	getSitePassword,
	isLocalDevRequest,
	requireSiteAccess,
} from "~/utils/site-auth.server";
import { logServerError } from "~/utils/safe-log.server";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";
import { getTwilioConfig } from "~/utils/twilio-sms.server";
import { partitionUpcomingBookings } from "~/utils/upcoming-bookings";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Admin"),
		description: "Staff sign-in and administration tools.",
		path: "/admin",
		noIndex: true,
	});
};

export async function loader({ request, context }: LoaderFunctionArgs) {
	await requireSiteAccess(request, context.cloudflare.env);
	const env = context.cloudflare.env;
	const staff = await getClinicStaffSession(request, env);
	const config = getBookingConfig(env);
	const url = new URL(request.url);
	const authStatus = url.searchParams.get("auth");
	const isLocal = isLocalDevRequest(request);
	const gate = await getSitePasswordGateState(env, { isLocal });

	const health = {
		calendarEmail: Boolean(config),
		staffAllowlist: getClinicStaffEmails(env).length > 0,
		staffCookieSecret: Boolean(env?.CLINIC_STAFF_COOKIE_SECRET?.trim()),
		publicSiteUrl: isPublicSiteUrlConfigured(env),
		publicSiteUrlPreferred: shouldPreferConfiguredPublicUrl(request),
		patientsDb: isPatientsDbConfigured(env),
		twilio: Boolean(getTwilioConfig(env)),
		sitePassword: Boolean(getSitePassword(env)),
		gateEnabled: gate.enabled,
	};

	let todayBookings: Awaited<
		ReturnType<typeof listManagedBookingsInRange>
	> = [];
	let laterPreview: typeof todayBookings = [];
	if (staff && config) {
		try {
			const upcoming = await listManagedBookingsInRange(
				config,
				new Date(Date.now() - 60 * 60 * 1000),
				new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
			);
			const parts = partitionUpcomingBookings(upcoming);
			todayBookings = parts.todayBookings;
			laterPreview = parts.laterBookings.slice(0, 5);
		} catch (error) {
			logServerError("Hub upcoming bookings error", error);
		}
	}

	return json(
		{
			emailConfigured: Boolean(config),
			staffAuthConfigured: isClinicStaffEmailConfigured(env),
			patientsConfigured: isPatientsDbConfigured(env),
			twilioConfigured: Boolean(getTwilioConfig(env)),
			staff,
			authStatus,
			magicLinkMinutes: CLINIC_MAGIC_LINK_MINUTES,
			health,
			todayBookings,
			laterPreview,
		},
		{
			headers: {
				// Session-specific: avoid Remix/browser reusing a logged-out hub payload.
				"Cache-Control": "private, no-store",
			},
		},
	);
}

/** Always re-run when entering the hub so staff session is not stale. */
export function shouldRevalidate() {
	return true;
}

export async function action({ request, context }: ActionFunctionArgs) {
	await requireSiteAccess(request, context.cloudflare.env);
	const env = context.cloudflare.env;
	const config = getBookingConfig(env);
	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "");

	if (intent === "request-link") {
		if (!config || !isClinicStaffEmailConfigured(env)) {
			return json(
				{
					ok: false as const,
					intent,
					error: "Staff sign-in is not configured.",
				},
				{ status: 503 },
			);
		}

		const email = String(formData.get("email") ?? "")
			.trim()
			.toLowerCase();
		const created = await createClinicMagicLinkToken(env, email);
		// Same response whether or not the email is allowlisted (no enumeration).
		if (created) {
			const origin = getPublicSiteOrigin(request, env);
			const magicLinkUrl = `${origin}/admin/auth?token=${encodeURIComponent(created.token)}`;
			try {
				await sendClinicStaffMagicLinkEmail(config, {
					email,
					magicLinkUrl,
					expiresMinutes: CLINIC_MAGIC_LINK_MINUTES,
				});
			} catch (emailError) {
				logServerError("Clinic magic link email error", emailError);
				return json(
					{
						ok: false as const,
						intent,
						error: "Could not send the sign-in email. Try again shortly.",
						email,
					},
					{ status: 502 },
				);
			}
		}
		return json({
			ok: true as const,
			intent: "request-link" as const,
			email,
		});
	}

	if (intent === "logout") {
		const headers = await clearClinicStaffSessionHeaders(request, env);
		// Target index action via /admin?index from child pages; always land on hub.
		throw redirect("/admin", { headers });
	}

	return json(
		{ ok: false as const, intent, error: "Unknown action." },
		{ status: 400 },
	);
}

type HealthCheck = { label: string; ok: boolean; fix: string };

function buildHealthChecks(health: {
	calendarEmail: boolean;
	staffAllowlist: boolean;
	staffCookieSecret: boolean;
	publicSiteUrl: boolean;
	publicSiteUrlPreferred: boolean;
	patientsDb: boolean;
	twilio: boolean;
	sitePassword: boolean;
	gateEnabled: boolean;
}): HealthCheck[] {
	const publicUrlOk = health.publicSiteUrl || !health.publicSiteUrlPreferred;
	const staffLoginOk =
		health.staffAllowlist && health.staffCookieSecret && publicUrlOk;

	let staffFix = "Set staff emails and cookie secret";
	if (!health.staffAllowlist) staffFix = "Set CLINIC_STAFF_EMAILS";
	else if (!health.staffCookieSecret) staffFix = "Set CLINIC_STAFF_COOKIE_SECRET";
	else if (!publicUrlOk) staffFix = "Set PUBLIC_SITE_URL";

	return [
		{
			label: "Bookings",
			ok: health.calendarEmail,
			fix: "Add Google calendar / email secrets",
		},
		{
			label: "Staff login",
			ok: staffLoginOk,
			fix: staffFix,
		},
		{
			label: "Patients",
			ok: health.patientsDb,
			fix: "Bind the patients D1 database",
		},
		{
			label: "SMS",
			ok: health.twilio,
			fix: "Add Twilio secrets",
		},
		{
			label: "Site gate",
			ok: health.sitePassword || !health.gateEnabled,
			fix: health.gateEnabled
				? "Set SITE_PASSWORD (gate is on)"
				: "Site password not set",
		},
	];
}

export default function ClinicHubPage() {
	const {
		emailConfigured,
		staffAuthConfigured,
		patientsConfigured,
		twilioConfigured,
		staff,
		authStatus,
		magicLinkMinutes,
		health,
		todayBookings,
		laterPreview,
	} = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";

	const linkRequested =
		actionData && actionData.ok && actionData.intent === "request-link";
	const error = actionData && !actionData.ok ? actionData.error : null;
	const healthIssues = buildHealthChecks(health).filter((c) => !c.ok);
	const gateLabel = health.gateEnabled ? "on" : "off";

	return (
		<>
			<PageHero
				eyebrow="Admin"
				title="Admin"
				summary="Staff sign-in by email."
			/>

			<section className="section-pad">
				<div className="site-container max-w-2xl space-y-8">
					{!emailConfigured || !staffAuthConfigured ? (
						<div className="border border-line bg-cream/70 px-6 py-8">
							<p className="eyebrow">Unavailable</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								Admin tools are not configured
							</h2>
							<p className="mt-3 text-ink-soft">
								Set Google booking secrets,{" "}
								<code className="text-sm">CLINIC_STAFF_EMAILS</code>, and{" "}
								<code className="text-sm">CLINIC_STAFF_COOKIE_SECRET</code> to
								enable magic-link sign-in.
							</p>
						</div>
					) : !staff ? (
						<div className="border border-line bg-white px-6 py-7">
							<p className="eyebrow">Staff sign-in</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								Email a sign-in link
							</h2>
							<p className="mt-3 text-ink-soft">
								Enter your authorised staff email. We send a link that works for{" "}
								{magicLinkMinutes} minutes.
							</p>

							{authStatus === "expired" ? (
								<p className="mt-4 text-sm text-red-700" role="alert">
									That sign-in link is invalid or has expired. Request a new
									one.
								</p>
							) : null}

							{linkRequested ? (
								<div className="mt-6 border border-accent/25 bg-accent-soft px-5 py-5">
									<p className="font-semibold text-ink">Check your email</p>
									<p className="mt-2 text-ink-soft">
										If{" "}
										<span className="font-semibold text-ink">
											{actionData &&
											actionData.ok &&
											actionData.intent === "request-link"
												? actionData.email
												: "that address"}
										</span>{" "}
										is authorised, a sign-in link is on its way. It expires in{" "}
										{magicLinkMinutes} minutes.
									</p>
								</div>
							) : (
								<Form method="post" className="mt-6 space-y-5">
									<input type="hidden" name="intent" value="request-link" />
									<label className="block">
										<span className="mb-2 block text-sm font-semibold text-ink">
											Staff email
										</span>
										<input
											required
											type="email"
											name="email"
											autoComplete="email"
											placeholder="you@example.com"
											defaultValue={
												actionData &&
												!actionData.ok &&
												"email" in actionData &&
												actionData.email
													? String(actionData.email)
													: ""
											}
											className="input-field"
										/>
									</label>
									{error && actionData?.intent === "request-link" ? (
										<p className="text-sm text-red-700" role="alert">
											{error}
										</p>
									) : null}
									<button
										type="submit"
										className="btn-primary"
										disabled={submitting}
									>
										{submitting ? "Sending…" : "Email sign-in link"}
									</button>
								</Form>
							)}
						</div>
					) : (
						<>
							<ClinicStaffChrome
								staffEmail={staff.email}
								active="hub"
								authOk={authStatus === "ok"}
							/>

							<div className="border border-line bg-white px-5 py-5 sm:px-6">
								<p className="eyebrow">Operational health</p>
								{healthIssues.length === 0 ? (
									<p className="mt-3 text-sm text-ink-soft">
										All set · site gate {gateLabel}
									</p>
								) : (
									<ul className="mt-3">
										{healthIssues.map((check) => (
											<li
												key={check.label}
												className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-2 last:border-b-0"
											>
												<span className="text-sm text-ink">{check.label}</span>
												<span className="text-sm font-semibold text-amber-800">
													{check.fix}
												</span>
											</li>
										))}
										<li className="pt-2 text-sm text-ink-soft">
											Site gate {gateLabel}
										</li>
									</ul>
								)}
							</div>

							{(todayBookings.length > 0 || laterPreview.length > 0) && (
								<div className="border border-line bg-cream/40 px-5 py-5 sm:px-6">
									<div className="flex flex-wrap items-baseline justify-between gap-2">
										<p className="eyebrow">Upcoming</p>
										<Link
											to="/admin/bookings"
											className="text-sm font-semibold text-accent-deep underline-offset-2 hover:underline"
										>
											Full schedule →
										</Link>
									</div>
									<ul className="mt-3 space-y-2 text-sm">
										{todayBookings.slice(0, 4).map((booking) => (
											<li key={booking.eventId} className="text-ink-soft">
												<span className="font-semibold text-ink">Today</span>{" "}
												{booking.timeLabel} · {booking.name} ·{" "}
												<Link
													to={`/admin/bookings?ref=${encodeURIComponent(booking.bookingRef)}`}
													className="text-accent-deep hover:underline"
												>
													{booking.bookingRef}
												</Link>
											</li>
										))}
										{laterPreview.map((booking) => (
											<li key={booking.eventId} className="text-ink-soft">
												{formatBookingDate(booking.dateIso)}{" "}
												{booking.timeLabel} · {booking.name} ·{" "}
												<Link
													to={`/admin/bookings?ref=${encodeURIComponent(booking.bookingRef)}`}
													className="text-accent-deep hover:underline"
												>
													{booking.bookingRef}
												</Link>
											</li>
										))}
									</ul>
								</div>
							)}

							<div className="space-y-4">
								<p className="eyebrow">Tools</p>
								<ul className="space-y-3">
									<li>
										<Link
											to="/admin/bookings"
											className="block border border-line bg-white px-6 py-5 transition-colors hover:border-accent"
										>
											<p className="font-display text-2xl text-ink">Bookings</p>
											<p className="mt-2 text-ink-soft">
												Upcoming schedule, lookup, confirm insurance
												authorisation, reschedule or cancel.
											</p>
										</Link>
									</li>
									<li>
										<Link
											to="/admin/patients"
											className="block border border-line bg-white px-6 py-5 transition-colors hover:border-accent"
										>
											<p className="font-display text-2xl text-ink">
												Patient contacts
											</p>
											<p className="mt-2 text-ink-soft">
												Add and search contact details, link bookings, and send
												administrative SMS
												{!patientsConfigured
													? " (database not configured yet)"
													: !twilioConfigured
														? " (Twilio not configured yet)"
														: ""}
												.
											</p>
										</Link>
									</li>
									<li>
										<Link
											to="/admin/activity"
											className="block border border-line bg-white px-6 py-5 transition-colors hover:border-accent"
										>
											<p className="font-display text-2xl text-ink">Activity</p>
											<p className="mt-2 text-ink-soft">
												Recent staff actions across bookings, contacts, SMS, and
												settings.
											</p>
										</Link>
									</li>
									<li>
										<Link
											to="/admin/settings"
											className="block border border-line bg-white px-6 py-5 transition-colors hover:border-accent"
										>
											<p className="font-display text-2xl text-ink">Admin</p>
											<p className="mt-2 text-ink-soft">
												Turn the public site password gate on or off.
											</p>
										</Link>
									</li>
								</ul>
							</div>
						</>
					)}
				</div>
			</section>
		</>
	);
}
