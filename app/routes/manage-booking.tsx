import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/cloudflare";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { json } from "@remix-run/cloudflare";
import { useEffect, useMemo, useState } from "react";
import { PageHero } from "~/components/PageHero";
import { site } from "~/data/content";
import {
	sendBookingCancelledEmail,
	sendBookingRescheduledEmail,
} from "~/utils/booking-email.server";
import {
	isValidBookingRef,
	normalizeBookingRef,
} from "~/utils/booking-ref";
import {
	BookingConflictError,
	SELF_PAY_REFUND_MIN_HOURS,
	cancelBookingEvent,
	findBookingByEmailAndRef,
	getAvailableDays,
	getBookingConfig,
	isSelfPayRefundEligible,
	rescheduleBookingEvent,
} from "~/utils/google-calendar.server";
import {
	formatGbpFromPence,
	getStripeConfig,
	refundPaymentIntent,
	resolvePaymentIntentForBooking,
} from "~/utils/stripe.server";
import { requireSiteAccess } from "~/utils/site-auth.server";

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

const EMAIL_RE =
	/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const meta: MetaFunction = () => {
	return [
		{ title: `Manage booking | ${site.name}` },
		{
			name: "description",
			content:
				"Look up your consultation with your email and booking reference to cancel or change the time.",
		},
	];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
	await requireSiteAccess(request, context.cloudflare.env);
	const config = getBookingConfig(context.cloudflare.env);
	return json({
		configured: Boolean(config),
		refundMinHours: SELF_PAY_REFUND_MIN_HOURS,
		timeZone: config?.timeZone ?? "Europe/London",
	});
}

export async function action({ request, context }: ActionFunctionArgs) {
	await requireSiteAccess(request, context.cloudflare.env);
	const config = getBookingConfig(context.cloudflare.env);
	if (!config) {
		return json(
			{
				ok: false as const,
				intent: "lookup",
				error: "Online booking is not configured yet.",
				email: "",
				bookingRef: "",
			},
			{ status: 503 },
		);
	}

	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "lookup");
	const email = String(formData.get("email") ?? "")
		.trim()
		.toLowerCase();
	const bookingRef = normalizeBookingRef(
		String(formData.get("bookingRef") ?? ""),
	);

	if (!EMAIL_RE.test(email) || !isValidBookingRef(bookingRef)) {
		return json(
			{
				ok: false as const,
				intent,
				error:
					"Enter the email address used when booking and a valid booking reference (for example PCC-ABCD1234).",
				email,
				bookingRef,
			},
			{ status: 400 },
		);
	}

	try {
		if (intent === "lookup") {
			const booking = await findBookingByEmailAndRef(
				config,
				email,
				bookingRef,
			);
			if (!booking) {
				return json(
					{
						ok: false as const,
						intent,
						error:
							"No upcoming booking matched that email and reference. Check the confirmation email, or contact the clinic team.",
						email,
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
					error: "Booking details were missing. Please look up the booking again.",
					email,
					bookingRef,
				},
				{ status: 400 },
			);
		}

		if (intent === "cancel") {
			const existing = await findBookingByEmailAndRef(
				config,
				email,
				bookingRef,
			);
			if (!existing || existing.eventId !== eventId) {
				return json(
					{
						ok: false as const,
						intent,
						error:
							"No upcoming booking matched that email and reference. Check the confirmation email, or contact the clinic team.",
						email,
						bookingRef,
					},
					{ status: 404 },
				);
			}

			let refundStatus:
				| "none"
				| "refunded"
				| "not_eligible"
				| "already_refunded"
				| "missing_payment" = "none";
			let refundAmountLabel: string | undefined;

			const mayBeSelfPay = existing.paymentMethod !== "insurance";
			if (mayBeSelfPay) {
				const eligible = isSelfPayRefundEligible(
					existing.dateIso,
					existing.timeLabel,
					config.timeZone,
				);
				if (!eligible) {
					refundStatus =
						existing.paymentMethod === "self-pay" ||
						Boolean(existing.stripeSessionId)
							? "not_eligible"
							: "none";
				} else {
					const stripe = getStripeConfig(context.cloudflare.env);
					if (!stripe) {
						return json(
							{
								ok: false as const,
								intent,
								error:
									"Automatic refund is temporarily unavailable. Please contact the clinic team before cancelling so your payment can be refunded.",
								email,
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
						});
					} catch (lookupError) {
						console.error("Stripe payment lookup for refund failed:", lookupError);
					}

					if (!paymentIntentId) {
						refundStatus =
							existing.paymentMethod === "self-pay"
								? "missing_payment"
								: "none";
					} else {
						try {
							const refund = await refundPaymentIntent(stripe, paymentIntentId);
							refundStatus = refund.alreadyRefunded
								? "already_refunded"
								: "refunded";
							if (refund.amountPence > 0) {
								refundAmountLabel = formatGbpFromPence(refund.amountPence);
							}
						} catch (refundError) {
							console.error("Self-pay cancel refund error:", refundError);
							return json(
								{
									ok: false as const,
									intent,
									error:
										"We could not process the Stripe refund automatically. Your appointment was not cancelled — please contact the clinic team.",
									email,
									bookingRef,
								},
								{ status: 502 },
							);
						}
					}
				}
			}

			const booking = await cancelBookingEvent(config, {
				eventId,
				email,
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
					refundMinHours: SELF_PAY_REFUND_MIN_HOURS,
				});
			} catch (emailError) {
				console.error("Cancel confirmation email error:", emailError);
			}
			return json({
				ok: true as const,
				intent: "cancel" as const,
				booking,
				refundStatus,
				refundAmountLabel,
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
						email,
						bookingRef,
					},
					{ status: 400 },
				);
			}

			const booking = await rescheduleBookingEvent(config, {
				eventId,
				email,
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
					type: booking.type,
					bookingRef: booking.bookingRef,
					pendingAuth: booking.pendingAuth,
					icsSequence: booking.icsSequence,
				});
			} catch (emailError) {
				console.error("Reschedule confirmation email error:", emailError);
			}
			return json({
				ok: true as const,
				intent: "reschedule" as const,
				booking,
			});
		}

		return json(
			{
				ok: false as const,
				intent,
				error: "Unknown action.",
				email,
				bookingRef,
			},
			{ status: 400 },
		);
	} catch (error) {
		if (error instanceof BookingConflictError) {
			return json(
				{
					ok: false as const,
					intent,
					error: error.message,
					email,
					bookingRef,
				},
				{ status: 409 },
			);
		}
		console.error("Manage booking error:", error);
		return json(
			{
				ok: false as const,
				intent,
				error: "Something went wrong. Please try again or contact the clinic team.",
				email,
				bookingRef,
			},
			{ status: 500 },
		);
	}
}

export default function ManageBookingPage() {
	const { configured, refundMinHours, timeZone } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";

	const lookedUp =
		actionData && actionData.ok && actionData.intent === "lookup"
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

	const booking = lookedUp?.booking ?? null;
	const days = lookedUp?.days ?? [];
	const bookableDays = useMemo(
		() => days.filter((day) => day.times.length > 0),
		[days],
	);
	const refundEligible =
		booking != null &&
		booking.paymentMethod !== "insurance" &&
		isSelfPayRefundEligible(booking.dateIso, booking.timeLabel, timeZone);

	const [selectedDay, setSelectedDay] = useState("");
	const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
	const [mode, setMode] = useState<"choose" | "change" | "cancel">("choose");

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
				eyebrow="Manage booking"
				title="Cancel or change your appointment"
				summary="Enter the email address and booking reference from your confirmation email."
			/>

			<section className="section-pad">
				<div className="site-container max-w-2xl">
					{!configured ? (
						<div className="border border-line bg-cream/70 px-6 py-8">
							<p className="eyebrow">Unavailable</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								Online booking management is not configured yet
							</h2>
							<p className="mt-3 text-ink-soft">
								Please email the clinic team to cancel or change an appointment.
							</p>
						</div>
					) : cancelled ? (
						<div className="border border-accent/25 bg-accent-soft px-6 py-8">
							<p className="eyebrow">Cancelled</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								Your appointment has been cancelled
							</h2>
							<p className="mt-3 text-ink-soft">
								{formatBookingDate(cancelled.booking.dateIso)} at{" "}
								{cancelled.booking.timeLabel} ({cancelled.booking.bookingRef}) is
								no longer booked.
							</p>
							{cancelled.refundStatus === "refunded" ||
							cancelled.refundStatus === "already_refunded" ? (
								<p className="mt-3 text-ink-soft">
									{cancelled.refundStatus === "already_refunded"
										? "This payment had already been refunded."
										: `A full refund${cancelled.refundAmountLabel ? ` of ${cancelled.refundAmountLabel}` : ""} has been started and should appear on your statement in a few days.`}
								</p>
							) : cancelled.refundStatus === "not_eligible" ? (
								<p className="mt-3 text-ink-soft">
									Self-pay refunds are automatic only when you cancel at least{" "}
									{refundMinHours} hours before the appointment. Please contact
									the clinic team if you need to discuss this payment.
								</p>
							) : cancelled.refundStatus === "missing_payment" ? (
								<p className="mt-3 text-ink-soft">
									Your appointment was cancelled, but we could not match the
									Stripe payment automatically. Please contact the clinic team
									about a refund.
								</p>
							) : null}
							<p className="mt-4 text-ink-soft">
								<Link to="/book" className="link-underline">
									Book a new consultation
								</Link>
							</p>
						</div>
					) : rescheduled ? (
						<div className="border border-accent/25 bg-accent-soft px-6 py-8">
							<p className="eyebrow">Updated</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								Your appointment time has been changed
							</h2>
							<p className="mt-3 text-ink-soft">
								You are now booked for{" "}
								<strong className="font-semibold text-ink">
									{formatBookingDate(rescheduled.dateIso)}
								</strong>{" "}
								at{" "}
								<strong className="font-semibold text-ink">
									{rescheduled.timeLabel}
								</strong>
								. Reference: {rescheduled.bookingRef}.
							</p>
							{rescheduled.pendingAuth ? (
								<p className="mt-3 text-ink-soft">
									This request is still pending insurer authorisation — please
									do not attend until you receive confirmation.
								</p>
							) : null}
							<p className="mt-4 text-ink-soft">
								<Link to="/manage-booking" className="link-underline">
									Manage again
								</Link>
							</p>
						</div>
					) : booking ? (
						<div className="space-y-8">
							<div className="border border-line bg-cream/50 px-6 py-7">
								<p className="eyebrow">Your booking</p>
								<h2 className="mt-3 font-display text-3xl text-ink">
									{booking.name}
								</h2>
								<dl className="mt-5 grid gap-3 text-[0.97rem] text-ink-soft">
									<div>
										<dt className="text-ink-muted">Reference</dt>
										<dd className="font-semibold text-ink">
											{booking.bookingRef}
										</dd>
									</div>
									<div>
										<dt className="text-ink-muted">Date</dt>
										<dd className="font-semibold text-ink">
											{formatBookingDate(booking.dateIso)}
										</dd>
									</div>
									<div>
										<dt className="text-ink-muted">Time</dt>
										<dd className="font-semibold text-ink">
											{booking.timeLabel} (UK time)
										</dd>
									</div>
									<div>
										<dt className="text-ink-muted">Consultation</dt>
										<dd className="font-semibold text-ink">{booking.type}</dd>
									</div>
									{booking.pendingAuth ? (
										<div>
											<dt className="text-ink-muted">Status</dt>
											<dd className="font-semibold text-ink">
												Pending authorisation
											</dd>
										</div>
									) : null}
								</dl>
							</div>

							{mode === "choose" ? (
								<div className="flex flex-wrap gap-3">
									<button
										type="button"
										className="btn-primary"
										onClick={() => setMode("change")}
									>
										Change time
									</button>
									<button
										type="button"
										className="border border-line bg-white px-5 py-3 text-[0.95rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
										onClick={() => setMode("cancel")}
									>
										Cancel appointment
									</button>
									<button
										type="button"
										className="px-2 py-3 text-[0.95rem] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
										onClick={() => {
											window.location.assign("/manage-booking");
										}}
									>
										Look up a different booking
									</button>
								</div>
							) : null}

							{mode === "cancel" ? (
								<div className="border border-line px-6 py-7">
									<h3 className="font-display text-2xl text-ink">
										Cancel this appointment?
									</h3>
									<p className="mt-3 text-ink-soft">
										This removes the appointment from the clinic calendar.
										{booking.paymentMethod !== "insurance" ? (
											refundEligible ? (
												<>
													{" "}
													Because you are cancelling at least {refundMinHours}{" "}
													hours before the appointment, a full Stripe refund will
													be started automatically.
												</>
											) : (
												<>
													{" "}
													Automatic self-pay refunds are only available at least{" "}
													{refundMinHours} hours before the appointment. Within
													that window, please contact the clinic team about the
													payment.
												</>
											)
										) : null}
									</p>
									<div className="mt-6 flex flex-wrap gap-3">
										<Form method="post">
											<input type="hidden" name="intent" value="cancel" />
											<input type="hidden" name="email" value={booking.email} />
											<input
												type="hidden"
												name="bookingRef"
												value={booking.bookingRef}
											/>
											<input
												type="hidden"
												name="eventId"
												value={booking.eventId}
											/>
											<button
												type="submit"
												className="btn-primary disabled:opacity-50"
												disabled={submitting}
											>
												{submitting ? "Cancelling…" : "Confirm cancellation"}
											</button>
										</Form>
										<button
											type="button"
											className="px-4 py-3 text-[0.95rem] text-ink-muted hover:text-ink"
											onClick={() => setMode("choose")}
										>
											Keep appointment
										</button>
									</div>
								</div>
							) : null}

							{mode === "change" ? (
								<div className="border border-line px-6 py-7">
									<h3 className="font-display text-2xl text-ink">
										Choose a new time
									</h3>
									<p className="mt-3 text-ink-soft">
										Your current slot stays reserved until the new time is
										confirmed.
									</p>

									{bookableDays.length === 0 ? (
										<p className="mt-5 text-ink-soft">
											No other times are available right now. Please try again
											later or contact the clinic team.
										</p>
									) : (
										<Form method="post" className="mt-6 space-y-6">
											<input type="hidden" name="intent" value="reschedule" />
											<input type="hidden" name="email" value={booking.email} />
											<input
												type="hidden"
												name="bookingRef"
												value={booking.bookingRef}
											/>
											<input
												type="hidden"
												name="eventId"
												value={booking.eventId}
											/>
											<input type="hidden" name="date" value={selectedDay} />
											<input
												type="hidden"
												name="time"
												value={selectedSlot ?? ""}
											/>

											<div>
												<p className="text-sm font-semibold text-ink">Date</p>
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
												<p className="text-sm font-semibold text-ink">Time</p>
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
												<p className="text-sm text-red-700">{error}</p>
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
						</div>
					) : (
						<div className="border border-line bg-cream/40 px-6 py-8">
							<Form method="post" className="space-y-5">
								<input type="hidden" name="intent" value="lookup" />
								<div>
									<label
										htmlFor="email"
										className="mb-1.5 block text-sm font-semibold text-ink"
									>
										Email used when booking
									</label>
									<input
										id="email"
										name="email"
										type="email"
										autoComplete="email"
										required
										defaultValue={
											actionData && !actionData.ok ? actionData.email : ""
										}
										className="input-field"
									/>
								</div>
								<div>
									<label
										htmlFor="bookingRef"
										className="mb-1.5 block text-sm font-semibold text-ink"
									>
										Booking reference
									</label>
									<input
										id="bookingRef"
										name="bookingRef"
										type="text"
										autoComplete="off"
										required
										placeholder="PCC-XXXXXXXX"
										defaultValue={
											actionData && !actionData.ok ? actionData.bookingRef : ""
										}
										className="input-field uppercase tracking-wide"
									/>
									<p className="mt-2 text-sm text-ink-muted">
										Find this in your confirmation email.
									</p>
								</div>
								{error ? (
									<p className="text-sm text-red-700">{error}</p>
								) : null}
								<button
									type="submit"
									className="btn-primary disabled:opacity-50"
									disabled={submitting}
								>
									{submitting ? "Looking up…" : "Find booking"}
								</button>
							</Form>
							<p className="mt-6 text-sm text-ink-muted">
								Need a new appointment instead?{" "}
								<Link to="/book" className="link-underline">
									Book a consultation
								</Link>
							</p>
						</div>
					)}
				</div>
			</section>
		</>
	);
}
