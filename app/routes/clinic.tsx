import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/cloudflare";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { json } from "@remix-run/cloudflare";
import { PageHero } from "~/components/PageHero";
import { isValidBookingRef, normalizeBookingRef } from "~/utils/booking-ref";
import { sendInsuranceBookingConfirmedEmail } from "~/utils/booking-email.server";
import {
	confirmInsuranceBookingEvent,
	findBookingByRef,
	getBookingConfig,
} from "~/utils/google-calendar.server";
import { requireSiteAccess } from "~/utils/site-auth.server";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

function formatBookingDate(dateIso: string): string {
	const [year, month, day] = dateIso.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day, 12));
	return new Intl.DateTimeFormat("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "Europe/London",
	}).format(date);
}

function getClinicStaffPassword(env: Env | undefined): string | undefined {
	const dedicated = env?.CLINIC_STAFF_PASSWORD?.trim();
	if (dedicated) return dedicated;
	return env?.SITE_PASSWORD?.trim() || undefined;
}

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Clinic booking tools"),
		description: "Staff tools for confirming insurance authorisations.",
		path: "/clinic",
		noIndex: true,
	});
};

export async function loader({ request, context }: LoaderFunctionArgs) {
	await requireSiteAccess(request, context.cloudflare.env);
	const staffPassword = getClinicStaffPassword(context.cloudflare.env);
	const config = getBookingConfig(context.cloudflare.env);
	return json({
		configured: Boolean(config),
		staffGateConfigured: Boolean(staffPassword),
	});
}

export async function action({ request, context }: ActionFunctionArgs) {
	await requireSiteAccess(request, context.cloudflare.env);
	const env = context.cloudflare.env;
	const staffPassword = getClinicStaffPassword(env);
	const config = getBookingConfig(env);

	if (!config || !staffPassword) {
		return json(
			{
				ok: false as const,
				error: "Clinic tools are not configured.",
			},
			{ status: 503 },
		);
	}

	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "lookup");
	const staffKey = String(formData.get("staffKey") ?? "");
	const bookingRef = normalizeBookingRef(
		String(formData.get("bookingRef") ?? ""),
	);

	if (staffKey !== staffPassword) {
		return json(
			{
				ok: false as const,
				intent,
				error: "Staff password incorrect.",
				bookingRef,
			},
			{ status: 401 },
		);
	}

	if (!isValidBookingRef(bookingRef)) {
		return json(
			{
				ok: false as const,
				intent,
				error: "Enter a valid booking reference (for example PCC-ABCD2345).",
				bookingRef,
			},
			{ status: 400 },
		);
	}

	try {
		if (intent === "lookup") {
			const booking = await findBookingByRef(config, bookingRef);
			if (!booking) {
				return json(
					{
						ok: false as const,
						intent,
						error: "No upcoming booking matched that reference.",
						bookingRef,
					},
					{ status: 404 },
				);
			}
			return json({
				ok: true as const,
				intent: "lookup" as const,
				booking,
			});
		}

		if (intent === "confirm") {
			const eventId = String(formData.get("eventId") ?? "").trim();
			if (!eventId) {
				return json(
					{
						ok: false as const,
						intent,
						error: "Booking details were missing. Look up the booking again.",
						bookingRef,
					},
					{ status: 400 },
				);
			}
			const existing = await findBookingByRef(config, bookingRef);
			if (!existing || existing.eventId !== eventId) {
				return json(
					{
						ok: false as const,
						intent,
						error: "No upcoming booking matched that reference.",
						bookingRef,
					},
					{ status: 404 },
				);
			}
			if (!existing.pendingAuth) {
				return json({
					ok: true as const,
					intent: "confirm" as const,
					booking: existing,
					alreadyConfirmed: true as const,
				});
			}

			const booking = await confirmInsuranceBookingEvent(config, {
				eventId,
				bookingRef,
			});
			try {
				await sendInsuranceBookingConfirmedEmail(config, {
					name: booking.name,
					email: booking.email,
					dateIso: booking.dateIso,
					timeLabel: booking.timeLabel,
					type: booking.type,
					bookingRef: booking.bookingRef,
				});
			} catch (emailError) {
				console.error("Insurance confirm email error:", emailError);
			}
			return json({
				ok: true as const,
				intent: "confirm" as const,
				booking,
				alreadyConfirmed: false as const,
			});
		}

		return json(
			{ ok: false as const, intent, error: "Unknown action.", bookingRef },
			{ status: 400 },
		);
	} catch (error) {
		console.error("Clinic tools error:", error);
		return json(
			{
				ok: false as const,
				intent,
				error:
					error instanceof Error
						? error.message
						: "Something went wrong. Please try again.",
				bookingRef,
			},
			{ status: 500 },
		);
	}
}

export default function ClinicPage() {
	const { configured, staffGateConfigured } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";

	const lookedUp =
		actionData && actionData.ok && actionData.intent === "lookup"
			? actionData.booking
			: null;
	const confirmed =
		actionData && actionData.ok && actionData.intent === "confirm"
			? actionData
			: null;
	const error = actionData && !actionData.ok ? actionData.error : null;
	const bookingRefDefault =
		actionData && "bookingRef" in actionData && actionData.bookingRef
			? String(actionData.bookingRef)
			: "";

	return (
		<>
			<PageHero
				eyebrow="Clinic"
				title="Confirm insurance bookings"
				summary="Look up a pending authorisation by booking reference, then mark it confirmed. The patient receives a confirmation email and calendar invite."
			/>

			<section className="section-pad">
				<div className="site-container max-w-2xl space-y-8">
					{!configured || !staffGateConfigured ? (
						<div className="border border-line bg-cream/70 px-6 py-8">
							<p className="eyebrow">Unavailable</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								Clinic tools are not configured
							</h2>
							<p className="mt-3 text-ink-soft">
								Set Google booking secrets and{" "}
								<code className="text-sm">CLINIC_STAFF_PASSWORD</code> (or{" "}
								<code className="text-sm">SITE_PASSWORD</code>) to use this
								page.
							</p>
						</div>
					) : confirmed ? (
						<div className="border border-accent/25 bg-accent-soft px-6 py-8">
							<p className="eyebrow">Confirmed</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								{confirmed.alreadyConfirmed
									? "Already confirmed"
									: "Authorisation confirmed"}
							</h2>
							<p className="mt-3 text-ink-soft">
								{confirmed.booking.name} ·{" "}
								{formatBookingDate(confirmed.booking.dateIso)} at{" "}
								{confirmed.booking.timeLabel} ({confirmed.booking.bookingRef})
							</p>
							{!confirmed.alreadyConfirmed ? (
								<p className="mt-3 text-ink-soft">
									Calendar updated (pending colour cleared), patient invited,
									and confirmation email sent.
								</p>
							) : null}
						</div>
					) : (
						<>
							<Form method="post" className="space-y-5 border border-line bg-white px-6 py-7">
								<input type="hidden" name="intent" value="lookup" />
								<label className="block">
									<span className="mb-2 block text-sm font-semibold text-ink">
										Staff password
									</span>
									<input
										required
										type="password"
										name="staffKey"
										autoComplete="current-password"
										className="input-field"
									/>
								</label>
								<label className="block">
									<span className="mb-2 block text-sm font-semibold text-ink">
										Booking reference
									</span>
									<input
										required
										name="bookingRef"
										defaultValue={bookingRefDefault}
										placeholder="PCC-XXXXXXXX"
										className="input-field uppercase"
									/>
								</label>
								{error ? (
									<p className="text-sm text-red-700" role="alert">
										{error}
									</p>
								) : null}
								<button
									type="submit"
									className="btn-primary"
									disabled={submitting}
								>
									{submitting ? "Looking up…" : "Look up booking"}
								</button>
							</Form>

							{lookedUp ? (
								<div className="space-y-5 border border-line bg-cream/50 px-6 py-7">
									<p className="eyebrow">
										{lookedUp.pendingAuth ? "Pending authorisation" : "Booking"}
									</p>
									<h2 className="font-display text-3xl text-ink">
										{lookedUp.name}
									</h2>
									<p className="text-ink-soft">
										{formatBookingDate(lookedUp.dateIso)} at {lookedUp.timeLabel}
										<br />
										{lookedUp.email}
										<br />
										{lookedUp.type} · {lookedUp.bookingRef}
									</p>
									{lookedUp.pendingAuth ? (
										<Form method="post" className="space-y-4">
											<input type="hidden" name="intent" value="confirm" />
											<input
												type="hidden"
												name="eventId"
												value={lookedUp.eventId}
											/>
											<input
												type="hidden"
												name="bookingRef"
												value={lookedUp.bookingRef}
											/>
											<label className="block">
												<span className="mb-2 block text-sm font-semibold text-ink">
													Staff password
												</span>
												<input
													required
													type="password"
													name="staffKey"
													autoComplete="current-password"
													className="input-field"
												/>
											</label>
											<button
												type="submit"
												className="btn-primary"
												disabled={submitting}
											>
												{submitting
													? "Confirming…"
													: "Confirm authorisation"}
											</button>
										</Form>
									) : (
										<p className="font-semibold text-ink">
											This booking is already confirmed — no action needed.
										</p>
									)}
								</div>
							) : null}
						</>
					)}
				</div>
			</section>
		</>
	);
}
