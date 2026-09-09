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
import { useEffect, useMemo, useState } from "react";
import { PageHero } from "~/components/PageHero";
import { isValidBookingRef, normalizeBookingRef } from "~/utils/booking-ref";
import {
	sendBookingCancelledEmail,
	sendBookingRescheduledEmail,
	sendClinicStaffMagicLinkEmail,
	sendInsuranceBookingConfirmedEmail,
} from "~/utils/booking-email.server";
import {
	CLINIC_MAGIC_LINK_MINUTES,
	clearClinicStaffSessionHeaders,
	createClinicMagicLinkToken,
	getClinicStaffSession,
	isClinicStaffEmailConfigured,
} from "~/utils/clinic-auth.server";
import { formatBookingDate } from "~/utils/format-date";
import {
	BookingConflictError,
	cancelBookingEvent,
	confirmInsuranceBookingEvent,
	findBookingByRef,
	getAvailableDays,
	getBookingConfig,
	rescheduleBookingEvent,
} from "~/utils/google-calendar.server";
import { requireSiteAccess } from "~/utils/site-auth.server";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";
import {
	formatGbpFromPence,
	getStripeConfig,
	refundPaymentIntent,
	resolvePaymentIntentForBooking,
} from "~/utils/stripe.server";

function paymentLabel(booking: {
	paymentMethod: string;
	pendingAuth: boolean;
}): string {
	if (booking.paymentMethod === "insurance") {
		return booking.pendingAuth
			? "Insurance — pending authorisation"
			: "Insurance — confirmed";
	}
	if (booking.paymentMethod === "self-pay") return "Self-pay (Stripe)";
	return "Payment method unknown";
}

function isPaidBooking(booking: {
	paymentMethod: string;
	stripeSessionId?: string;
	stripePaymentIntentId?: string;
}): boolean {
	if (booking.paymentMethod === "insurance") {
		return Boolean(
			booking.stripeSessionId || booking.stripePaymentIntentId,
		);
	}
	return (
		booking.paymentMethod === "self-pay" ||
		Boolean(booking.stripeSessionId) ||
		Boolean(booking.stripePaymentIntentId) ||
		booking.paymentMethod === "unknown"
	);
}

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Clinic booking tools"),
		description: "Staff tools for clinic booking management.",
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
		configured: Boolean(config),
		staffAuthConfigured: isClinicStaffEmailConfigured(env),
		stripeConfigured: Boolean(getStripeConfig(env)),
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
				console.error("Clinic magic link email error:", emailError);
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
		return json({ ok: true as const, intent: "logout" as const }, { headers });
	}

	const staff = await getClinicStaffSession(request, env);
	if (!staff) {
		return json(
			{
				ok: false as const,
				intent,
				error: "Sign in with your staff email to continue.",
			},
			{ status: 401 },
		);
	}

	if (!config) {
		return json(
			{
				ok: false as const,
				intent,
				error: "Clinic tools are not configured.",
			},
			{ status: 503 },
		);
	}

	const bookingRef = normalizeBookingRef(
		String(formData.get("bookingRef") ?? ""),
	);

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
			const days = await getAvailableDays(config);
			const availableDays = days.map((day) => ({
				...day,
				times:
					day.iso === booking.dateIso
						? day.times.filter((time) => time !== booking.timeLabel)
						: day.times,
			}));
			return json({
				ok: true as const,
				intent: "lookup" as const,
				booking,
				days: availableDays,
			});
		}

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

		if (intent === "confirm") {
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
					icsSequence: booking.icsSequence,
					appointmentFormat:
						booking.appointmentFormat === "unknown"
							? undefined
							: booking.appointmentFormat,
					meetLink: booking.meetLink,
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

		if (intent === "reschedule") {
			const dateIso = String(formData.get("date") ?? "").trim();
			const timeLabel = String(formData.get("time") ?? "").trim();
			if (!dateIso || !timeLabel) {
				return json(
					{
						ok: false as const,
						intent,
						error: "Choose a new date and time.",
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

			const previousDateIso = existing.dateIso;
			const previousTimeLabel = existing.timeLabel;
			const booking = await rescheduleBookingEvent(config, {
				eventId,
				email: existing.email,
				bookingRef,
				dateIso,
				timeLabel,
			});
			try {
				await sendBookingRescheduledEmail(config, {
					name: booking.name,
					email: booking.email,
					dateIso: booking.dateIso,
					timeLabel: booking.timeLabel,
					previousDateIso,
					previousTimeLabel,
					type: booking.type,
					bookingRef: booking.bookingRef,
					pendingAuth: booking.pendingAuth,
					icsSequence: booking.icsSequence,
					appointmentFormat:
						booking.appointmentFormat === "unknown"
							? undefined
							: booking.appointmentFormat,
					meetLink: booking.meetLink,
				});
			} catch (emailError) {
				console.error("Clinic reschedule email error:", emailError);
			}
			return json({
				ok: true as const,
				intent: "reschedule" as const,
				booking,
			});
		}

		if (intent === "cancel") {
			const issueRefund = formData.get("issueRefund") === "on";
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

			let refundStatus:
				| "none"
				| "refunded"
				| "not_eligible"
				| "already_refunded" = "none";
			let refundAmountLabel: string | undefined;

			const paid = isPaidBooking(existing);
			const isInsuranceOnly =
				existing.paymentMethod === "insurance" &&
				!existing.stripeSessionId &&
				!existing.stripePaymentIntentId;

			if (paid && !isInsuranceOnly && issueRefund) {
				const stripe = getStripeConfig(env);
				if (!stripe) {
					return json(
						{
							ok: false as const,
							intent,
							error:
								"Stripe is not configured, so the paid booking was not cancelled. Configure Stripe or cancel without refund.",
							bookingRef,
						},
						{ status: 503 },
					);
				}

				let paymentIntentId: string | null = null;
				try {
					paymentIntentId = await resolvePaymentIntentForBooking(stripe, {
						bookingRef: existing.bookingRef,
						stripeSessionId: existing.stripeSessionId,
						stripePaymentIntentId: existing.stripePaymentIntentId,
						email: existing.email,
						dateIso: existing.dateIso,
						timeLabel: existing.timeLabel,
					});
				} catch (lookupError) {
					console.error("Clinic cancel refund lookup failed:", lookupError);
				}

				if (!paymentIntentId) {
					return json(
						{
							ok: false as const,
							intent,
							error:
								"Could not find the Stripe payment for this booking, so it was not cancelled. Uncheck refund to cancel the calendar only, or refund in Stripe Dashboard first.",
							bookingRef,
						},
						{ status: 502 },
					);
				}

				try {
					const refund = await refundPaymentIntent(stripe, paymentIntentId);
					refundStatus = refund.alreadyRefunded
						? "already_refunded"
						: "refunded";
					if (refund.amountPence > 0) {
						refundAmountLabel = formatGbpFromPence(refund.amountPence);
					}
				} catch (refundError) {
					console.error("Clinic cancel refund error:", refundError);
					return json(
						{
							ok: false as const,
							intent,
							error: `Stripe refund failed (${refundError instanceof Error ? refundError.message : "unknown error"}). Booking was not cancelled.`,
							bookingRef,
						},
						{ status: 502 },
					);
				}
			}

			const booking = await cancelBookingEvent(config, {
				eventId,
				email: existing.email,
				bookingRef,
			});
			try {
				await sendBookingCancelledEmail(config, {
					name: booking.name,
					email: booking.email,
					dateIso: booking.dateIso,
					timeLabel: booking.timeLabel,
					type: booking.type,
					bookingRef: booking.bookingRef,
					icsSequence: existing.icsSequence,
					refundStatus,
					refundAmountLabel,
				});
			} catch (emailError) {
				console.error("Clinic cancel email error:", emailError);
			}

			return json({
				ok: true as const,
				intent: "cancel" as const,
				booking,
				refundStatus,
				refundAmountLabel,
			});
		}

		return json(
			{ ok: false as const, intent, error: "Unknown action.", bookingRef },
			{ status: 400 },
		);
	} catch (error) {
		if (error instanceof BookingConflictError) {
			return json(
				{
					ok: false as const,
					intent,
					error: error.message,
					bookingRef,
				},
				{ status: 409 },
			);
		}
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
	const {
		configured,
		staffAuthConfigured,
		stripeConfigured,
		staff,
		authStatus,
		magicLinkMinutes,
	} = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";

	const linkRequested =
		actionData && actionData.ok && actionData.intent === "request-link";

	const lookedUp =
		actionData && actionData.ok && actionData.intent === "lookup"
			? actionData
			: null;
	const booking = lookedUp?.booking ?? null;
	const days = lookedUp?.days ?? [];
	const confirmed =
		actionData && actionData.ok && actionData.intent === "confirm"
			? actionData
			: null;
	const cancelled =
		actionData && actionData.ok && actionData.intent === "cancel"
			? actionData
			: null;
	const rescheduled =
		actionData && actionData.ok && actionData.intent === "reschedule"
			? actionData.booking
			: null;
	const error = actionData && !actionData.ok ? actionData.error : null;
	const bookingRefDefault =
		actionData && "bookingRef" in actionData && actionData.bookingRef
			? String(actionData.bookingRef)
			: "";

	const bookableDays = useMemo(
		() => days.filter((day) => day.times.length > 0),
		[days],
	);
	const canRefund = booking ? isPaidBooking(booking) : false;

	const [mode, setMode] = useState<"choose" | "change" | "cancel" | "confirm">(
		"choose",
	);
	const [selectedDay, setSelectedDay] = useState("");
	const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

	useEffect(() => {
		if (!booking) {
			setMode("choose");
			setSelectedDay("");
			setSelectedSlot(null);
			return;
		}
		setMode("choose");
		setSelectedDay(bookableDays[0]?.iso ?? "");
		setSelectedSlot(null);
	}, [booking?.eventId, bookableDays]);

	useEffect(() => {
		if (!bookableDays.some((day) => day.iso === selectedDay)) {
			setSelectedDay(bookableDays[0]?.iso ?? "");
			setSelectedSlot(null);
		}
	}, [bookableDays, selectedDay]);

	const selectedDaySlots =
		bookableDays.find((day) => day.iso === selectedDay)?.times ?? [];

	return (
		<>
			<PageHero
				eyebrow="Clinic"
				title="Clinic booking tools"
				summary="Staff sign-in by email."
			/>

			<section className="section-pad">
				<div className="site-container max-w-2xl space-y-8">
					{!configured || !staffAuthConfigured ? (
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
									Calendar updated and confirmation email sent (with calendar
									file).
								</p>
							) : null}
							<p className="mt-6">
								<a href="/clinic" className="font-semibold text-accent-deep">
									Look up another booking
								</a>
							</p>
						</div>
					) : rescheduled ? (
						<div className="border border-accent/25 bg-accent-soft px-6 py-8">
							<p className="eyebrow">Updated</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								Appointment time changed
							</h2>
							<p className="mt-3 text-ink-soft">
								{rescheduled.name} is now booked for{" "}
								{formatBookingDate(rescheduled.dateIso)} at{" "}
								{rescheduled.timeLabel} ({rescheduled.bookingRef}).
							</p>
							{rescheduled.pendingAuth ? (
								<p className="mt-3 text-ink-soft">
									Still pending insurer authorisation — confirmation calendar
									file is sent once authorisation is confirmed.
								</p>
							) : null}
							<p className="mt-6">
								<a href="/clinic" className="font-semibold text-accent-deep">
									Look up another booking
								</a>
							</p>
						</div>
					) : cancelled ? (
						<div className="border border-line bg-cream/70 px-6 py-8">
							<p className="eyebrow">Cancelled</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								{cancelled.refundStatus === "refunded" ||
								cancelled.refundStatus === "already_refunded"
									? "Booking cancelled — refund processed"
									: "Booking cancelled"}
							</h2>
							<p className="mt-3 text-ink-soft">
								{cancelled.booking.name} ·{" "}
								{formatBookingDate(cancelled.booking.dateIso)} at{" "}
								{cancelled.booking.timeLabel} ({cancelled.booking.bookingRef})
							</p>
							{cancelled.refundStatus === "refunded" ? (
								<p className="mt-3 text-ink-soft">
									Stripe refund
									{cancelled.refundAmountLabel
										? ` of ${cancelled.refundAmountLabel}`
										: ""}{" "}
									started. Patient emailed.
								</p>
							) : cancelled.refundStatus === "already_refunded" ? (
								<p className="mt-3 text-ink-soft">
									Payment was already refunded in Stripe. Patient emailed.
								</p>
							) : (
								<p className="mt-3 text-ink-soft">
									Calendar cleared and patient emailed
									{isPaidBooking(cancelled.booking)
										? " (no automatic refund)."
										: "."}
								</p>
							)}
							<p className="mt-6">
								<a href="/clinic" className="font-semibold text-accent-deep">
									Look up another booking
								</a>
							</p>
						</div>
					) : (
						<>
							<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
								<p>
									Signed in as{" "}
									<span className="font-semibold text-ink">{staff.email}</span>
									{authStatus === "ok" ? " · link accepted" : null}
								</p>
								<Form method="post">
									<input type="hidden" name="intent" value="logout" />
									<button
										type="submit"
										className="underline-offset-4 hover:underline"
									>
										Sign out
									</button>
								</Form>
							</div>

							{booking ? (
								<div className="space-y-6">
									<div className="border border-line bg-cream/50 px-6 py-7">
										<p className="eyebrow">
											{booking.pendingAuth
												? "Pending authorisation"
												: "Booking"}
										</p>
										<h2 className="mt-2 font-display text-3xl text-ink">
											{booking.name}
										</h2>
										<p className="mt-3 text-ink-soft">
											{formatBookingDate(booking.dateIso)} at{" "}
											{booking.timeLabel}
											<br />
											{booking.email}
											<br />
											{booking.type} · {booking.bookingRef}
											<br />
											{paymentLabel(booking)}
										</p>
									</div>

									{mode === "choose" ? (
										<div className="flex flex-wrap gap-3">
											{booking.pendingAuth ? (
												<button
													type="button"
													className="btn-primary"
													onClick={() => setMode("confirm")}
												>
													Confirm authorisation
												</button>
											) : null}
											<button
												type="button"
												className={
													booking.pendingAuth ? "btn-secondary" : "btn-primary"
												}
												onClick={() => setMode("change")}
											>
												Change time
											</button>
											<button
												type="button"
												className="border border-line bg-white px-5 py-3 text-[0.95rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
												onClick={() => setMode("cancel")}
											>
												Cancel booking
											</button>
											<button
												type="button"
												className="px-2 py-3 text-[0.95rem] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
												onClick={() => {
													window.location.assign("/clinic");
												}}
											>
												Look up a different booking
											</button>
										</div>
									) : null}

									{mode === "confirm" ? (
										<div className="border border-line bg-white px-6 py-7">
											<h3 className="font-display text-2xl text-ink">
												Confirm insurer authorisation?
											</h3>
											<p className="mt-3 text-ink-soft">
												Marks the booking confirmed, updates calendar colour,
												and sends the patient a confirmation email with a
												calendar file.
											</p>
											<Form method="post" className="mt-6 space-y-4">
												<input type="hidden" name="intent" value="confirm" />
												<input
													type="hidden"
													name="eventId"
													value={booking.eventId}
												/>
												<input
													type="hidden"
													name="bookingRef"
													value={booking.bookingRef}
												/>
												{error && actionData?.intent === "confirm" ? (
													<p className="text-sm text-red-700" role="alert">
														{error}
													</p>
												) : null}
												<div className="flex flex-wrap gap-3">
													<button
														type="submit"
														className="btn-primary"
														disabled={submitting}
													>
														{submitting
															? "Confirming…"
															: "Confirm authorisation"}
													</button>
													<button
														type="button"
														className="px-4 py-3 text-[0.95rem] text-ink-muted hover:text-ink"
														onClick={() => setMode("choose")}
													>
														Back
													</button>
												</div>
											</Form>
										</div>
									) : null}

									{mode === "change" ? (
										<div className="border border-line bg-white px-6 py-7">
											<h3 className="font-display text-2xl text-ink">
												Choose a new time
											</h3>
											<p className="mt-3 text-ink-soft">
												Works for insured and paid bookings. Patient is
												emailed. Pending insurance stays without a calendar
												invite.
											</p>

											{bookableDays.length === 0 ? (
												<>
													<p className="mt-5 text-ink-soft">
														No other times are available right now.
													</p>
													<button
														type="button"
														className="mt-4 px-4 py-3 text-[0.95rem] text-ink-muted hover:text-ink"
														onClick={() => setMode("choose")}
													>
														Back
													</button>
												</>
											) : (
												<Form method="post" className="mt-6 space-y-6">
													<input
														type="hidden"
														name="intent"
														value="reschedule"
													/>
													<input
														type="hidden"
														name="eventId"
														value={booking.eventId}
													/>
													<input
														type="hidden"
														name="bookingRef"
														value={booking.bookingRef}
													/>
													<input type="hidden" name="date" value={selectedDay} />
													<input
														type="hidden"
														name="time"
														value={selectedSlot ?? ""}
													/>

													<div>
														<p className="text-sm font-semibold text-ink">
															Date
														</p>
														<div className="mt-3 flex flex-wrap gap-2">
															{bookableDays.map((day) => (
																<button
																	key={day.iso}
																	type="button"
																	className={
																		selectedDay === day.iso
																			? "border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-ink"
																			: "border border-line bg-white px-4 py-2 text-sm text-ink-soft hover:border-accent"
																	}
																	onClick={() => {
																		setSelectedDay(day.iso);
																		setSelectedSlot(null);
																	}}
																>
																	{day.weekday} {day.label}
																</button>
															))}
														</div>
													</div>

													<div>
														<p className="text-sm font-semibold text-ink">
															Time
														</p>
														<div className="mt-3 flex flex-wrap gap-2">
															{selectedDaySlots.map((time) => (
																<button
																	key={time}
																	type="button"
																	className={
																		selectedSlot === time
																			? "border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-ink"
																			: "border border-line bg-white px-4 py-2 text-sm text-ink-soft hover:border-accent"
																	}
																	onClick={() => setSelectedSlot(time)}
																>
																	{time}
																</button>
															))}
														</div>
													</div>

													{error && actionData?.intent === "reschedule" ? (
														<p className="text-sm text-red-700" role="alert">
															{error}
														</p>
													) : null}

													<div className="flex flex-wrap gap-3">
														<button
															type="submit"
															className="btn-primary disabled:opacity-50"
															disabled={!selectedSlot || submitting}
														>
															{submitting ? "Updating…" : "Confirm new time"}
														</button>
														<button
															type="button"
															className="px-4 py-3 text-[0.95rem] text-ink-muted hover:text-ink"
															onClick={() => setMode("choose")}
														>
															Back
														</button>
													</div>
												</Form>
											)}
										</div>
									) : null}

									{mode === "cancel" ? (
										<div className="border border-line bg-white px-6 py-7">
											<h3 className="font-display text-2xl text-ink">
												Cancel this booking?
											</h3>
											<p className="mt-3 text-ink-soft">
												Removes the appointment from the clinic calendar and
												emails the patient. Staff are not limited by the
												48-hour patient cancel/change window.
											</p>
											<Form method="post" className="mt-6 space-y-4">
												<input type="hidden" name="intent" value="cancel" />
												<input
													type="hidden"
													name="eventId"
													value={booking.eventId}
												/>
												<input
													type="hidden"
													name="bookingRef"
													value={booking.bookingRef}
												/>
												{canRefund ? (
													<label className="flex items-start gap-3 text-sm text-ink">
														<input
															type="checkbox"
															name="issueRefund"
															defaultChecked={stripeConfigured}
															disabled={!stripeConfigured}
															className="mt-1"
														/>
														<span>
															Issue Stripe refund
															{!stripeConfigured
																? " (Stripe not configured — cancel without refund only)"
																: " (optional — leave unchecked to cancel without refunding)"}
														</span>
													</label>
												) : (
													<p className="text-sm text-ink-soft">
														Insurance booking — no Stripe refund.
													</p>
												)}
												{error && actionData?.intent === "cancel" ? (
													<p className="text-sm text-red-700" role="alert">
														{error}
													</p>
												) : null}
												<div className="flex flex-wrap gap-3">
													<button
														type="submit"
														className="btn-primary"
														disabled={submitting}
													>
														{submitting
															? "Cancelling…"
															: "Confirm cancellation"}
													</button>
													<button
														type="button"
														className="px-4 py-3 text-[0.95rem] text-ink-muted hover:text-ink"
														onClick={() => setMode("choose")}
													>
														Keep booking
													</button>
												</div>
											</Form>
										</div>
									) : null}
								</div>
							) : (
								<Form
									method="post"
									className="space-y-5 border border-line bg-white px-6 py-7"
								>
									<input type="hidden" name="intent" value="lookup" />
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
							)}
						</>
					)}
				</div>
			</section>
		</>
	);
}
