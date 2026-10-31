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
	getClinicStaffSession,
	isClinicStaffEmailConfigured,
} from "~/utils/clinic-auth.server";
import { getBookingConfig } from "~/utils/google-calendar.server";
import { isPatientsDbConfigured } from "~/utils/patients.server";
import { requireSiteAccess } from "~/utils/site-auth.server";
import { logServerError } from "~/utils/safe-log.server";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";
import { getTwilioConfig } from "~/utils/twilio-sms.server";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Clinic tools"),
		description: "Staff sign-in and clinic administration tools.",
		path: "/clinic",
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

	return json({
		emailConfigured: Boolean(config),
		staffAuthConfigured: isClinicStaffEmailConfigured(env),
		patientsConfigured: isPatientsDbConfigured(env),
		twilioConfigured: Boolean(getTwilioConfig(env)),
		staff,
		authStatus,
		magicLinkMinutes: CLINIC_MAGIC_LINK_MINUTES,
	});
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
			const origin = new URL(request.url).origin;
			const magicLinkUrl = `${origin}/clinic/auth?token=${encodeURIComponent(created.token)}`;
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
		// Target index action via /clinic?index from child pages; always land on hub.
		throw redirect("/clinic", { headers });
	}

	return json(
		{ ok: false as const, intent, error: "Unknown action." },
		{ status: 400 },
	);
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
	} = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";

	const linkRequested =
		actionData && actionData.ok && actionData.intent === "request-link";
	const error = actionData && !actionData.ok ? actionData.error : null;

	return (
		<>
			<PageHero
				eyebrow="Clinic"
				title="Clinic tools"
				summary="Staff sign-in by email."
			/>

			<section className="section-pad">
				<div className="site-container max-w-2xl space-y-8">
					{!emailConfigured || !staffAuthConfigured ? (
						<div className="border border-line bg-cream/70 px-6 py-8">
							<p className="eyebrow">Unavailable</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								Clinic tools are not configured
							</h2>
							<p className="mt-3 text-ink-soft">
								Set Google booking secrets and{" "}
								<code className="text-sm">CLINIC_STAFF_EMAILS</code> (comma-
								separated staff addresses) to enable magic-link sign-in.
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

							<div className="space-y-4">
								<p className="eyebrow">Tools</p>
								<ul className="space-y-3">
									<li>
										<Link
											to="/clinic/bookings"
											className="block border border-line bg-white px-6 py-5 transition-colors hover:border-accent"
										>
											<p className="font-display text-2xl text-ink">Bookings</p>
											<p className="mt-2 text-ink-soft">
												Look up appointments, confirm insurance authorisation,
												reschedule or cancel.
											</p>
										</Link>
									</li>
									<li>
										<Link
											to="/clinic/patients"
											className="block border border-line bg-white px-6 py-5 transition-colors hover:border-accent"
										>
											<p className="font-display text-2xl text-ink">
												Patient contacts
											</p>
											<p className="mt-2 text-ink-soft">
												Add and search contact details, and send administrative
												SMS
												{!patientsConfigured
													? " (database not configured yet)"
													: !twilioConfigured
														? " (Twilio not configured yet)"
														: ""}
												.
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
