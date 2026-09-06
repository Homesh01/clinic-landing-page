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
	useRevalidator,
} from "@remix-run/react";
import { json, redirect } from "@remix-run/cloudflare";
import { useEffect, useMemo, useRef, useState, type AnimationEvent, type ChangeEvent, type FormEvent } from "react";
import { PageHero } from "~/components/PageHero";
import { booking, contact, site } from "~/data/content";
import {
	getAvailableDays,
	getBookingConfig,
	isSlotAvailable,
	BookingConflictError,
	createBookingEvent,
} from "~/utils/google-calendar.server";
import {
	CONSULTATION_TYPES,
	type BookingFieldErrors,
	type PaymentMethod,
	validateBookingForm,
} from "~/utils/booking-validation";
import { sendPatientBookingConfirmation } from "~/utils/booking-email.server";
import { generateBookingRef } from "~/utils/booking-ref";
import { requireSiteAccess } from "~/utils/site-auth.server";
import {
	consultationAmountPence,
	createBookingCheckoutSession,
	formatGbpFromPence,
	fulfillPaidCheckoutSession,
	getStripeConfig,
	retrieveCheckoutSession,
} from "~/utils/stripe.server";

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

/** Keeps browser autofill and later edits in sync with React state. */
function useEditableField<T extends HTMLInputElement | HTMLTextAreaElement>(
	initial = "",
) {
	const [value, setValue] = useState(initial);
	const ref = useRef<T | null>(null);

	function syncFromDom() {
		const next = ref.current?.value ?? "";
		setValue((current) => (current === next ? current : next));
	}

	useEffect(() => {
		// Chrome/Safari often autofill without firing input events.
		const interval = window.setInterval(syncFromDom, 200);
		const stop = window.setTimeout(() => window.clearInterval(interval), 2500);
		return () => {
			window.clearInterval(interval);
			window.clearTimeout(stop);
		};
	}, []);

	return {
		ref,
		value,
		onChange: (event: ChangeEvent<T>) => setValue(event.target.value),
		onInput: (event: FormEvent<T>) => setValue(event.currentTarget.value),
		onFocus: syncFromDom,
		onBlur: syncFromDom,
		onAnimationStart: (event: AnimationEvent<T>) => {
			if (event.animationName === "onAutoFillStart") syncFromDom();
		},
	};
}

function calendarNotesForBooking(input: {
	paymentMethod: "self-pay" | "insurance";
	insurer?: string;
	membershipNumber?: string;
	authorisationCode?: string;
	notes?: string;
	stripeSessionId?: string;
}): string {
	const lines: string[] = [];
	if (input.paymentMethod === "insurance") {
		lines.push(
			"STATUS: PENDING — do not see patient until authorisation code is verified",
		);
		lines.push(
			"Payment: Private medical insurance (verify authorisation, then bill insurer / share code with hospital)",
		);
		if (input.insurer) lines.push(`Insurer: ${input.insurer}`);
		if (input.authorisationCode) {
			lines.push(`Authorisation code: ${input.authorisationCode}`);
		}
		if (input.membershipNumber) {
			lines.push(`Membership / policy: ${input.membershipNumber}`);
		}
	} else {
		lines.push("Payment: Self-pay");
		if (input.stripeSessionId) {
			lines.push(`Stripe session: ${input.stripeSessionId}`);
		}
	}
	if (input.notes?.trim()) lines.push(input.notes.trim());
	return lines.join("\n");
}

type BookingSuccess = {
	name: string;
	dateIso: string;
	timeLabel: string;
	emailSent: boolean;
	paymentMethod: "self-pay" | "insurance";
	bookingRef?: string;
};

export const meta: MetaFunction = () => {
	return [
		{ title: `Book a consultation | ${site.name}` },
		{
			name: "description",
			content: booking.intro,
		},
	];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
	const env = context.cloudflare.env;
	const config = getBookingConfig(env);
	const stripe = getStripeConfig(env);
	const url = new URL(request.url);

	let checkoutResult: BookingSuccess | null = null;
	let checkoutError: string | null = null;
	const checkoutCancelled = url.searchParams.get("checkout") === "cancelled";
	const sessionId = url.searchParams.get("session_id");

	if (sessionId && stripe && config) {
		try {
			const session = await retrieveCheckoutSession(stripe, sessionId);
			const fulfillment = await fulfillPaidCheckoutSession({
				env,
				stripe,
				session,
			});
			if (fulfillment.ok) {
				checkoutResult = {
					name: fulfillment.name,
					dateIso: fulfillment.dateIso,
					timeLabel: fulfillment.timeLabel,
					emailSent: fulfillment.emailSent,
					paymentMethod: "self-pay",
					bookingRef: fulfillment.bookingRef,
				};
			} else {
				checkoutError = fulfillment.error;
			}
		} catch (error) {
			console.error("Checkout session confirm error:", error);
			checkoutError =
				"Payment may have succeeded, but we could not confirm the appointment automatically. Please contact the clinic team with your payment receipt.";
		}
	}

	const fees = {
		standard: formatGbpFromPence(
			consultationAmountPence("New Patient Consultation"),
		),
		followUp: formatGbpFromPence(
			consultationAmountPence("Follow-up / Monitoring"),
		),
	};

	if (!config) {
		return json({
			configured: false as const,
			days: [] as Awaited<ReturnType<typeof getAvailableDays>>,
			error: null as string | null,
			checkoutResult,
			checkoutError,
			checkoutCancelled,
			stripeReady: Boolean(stripe),
			fees,
		});
	}

	try {
		const days = await getAvailableDays(config);
		return json({
			configured: true as const,
			days,
			error: null as string | null,
			checkoutResult,
			checkoutError,
			checkoutCancelled,
			stripeReady: Boolean(stripe),
			fees,
		});
	} catch (error) {
		console.error("Booking availability error:", error);
		return json({
			configured: true as const,
			days: [] as Awaited<ReturnType<typeof getAvailableDays>>,
			error:
				"Could not load availability right now. Please try again shortly, or contact the clinic team.",
			checkoutResult,
			checkoutError,
			checkoutCancelled,
			stripeReady: Boolean(stripe),
			fees,
		});
	}
}

export async function action({ request, context }: ActionFunctionArgs) {
	await requireSiteAccess(request, context.cloudflare.env);

	const env = context.cloudflare.env;
	const config = getBookingConfig(env);
	const stripe = getStripeConfig(env);

	if (!config) {
		return json(
			{
				ok: false as const,
				error: "Online booking is not configured yet.",
				errors: {} as BookingFieldErrors,
			},
			{ status: 503 },
		);
	}

	const formData = await request.formData();
	const dateIso = String(formData.get("date") ?? "");
	const timeLabel = String(formData.get("time") ?? "");
	const name = String(formData.get("name") ?? "");
	const email = String(formData.get("email") ?? "");
	const phone = String(formData.get("phone") ?? "");
	const type = String(formData.get("type") ?? "");
	const paymentMethod = String(formData.get("paymentMethod") ?? "");
	const insurer = String(formData.get("insurer") ?? "");
	const membershipNumber = String(formData.get("membershipNumber") ?? "");
	const authorisationCode = String(formData.get("authorisationCode") ?? "");
	const notes = String(formData.get("notes") ?? "");

	let allowedTimesForDate: string[] = [];
	try {
		const days = await getAvailableDays(config);
		allowedTimesForDate =
			days.find((day) => day.iso === dateIso.trim())?.times ?? [];
	} catch (error) {
		console.error("Booking availability check error:", error);
		return json(
			{
				ok: false as const,
				error:
					"Could not verify availability right now. Please try again shortly.",
				errors: {} as BookingFieldErrors,
			},
			{ status: 503 },
		);
	}

	const validated = validateBookingForm({
		dateIso,
		timeLabel,
		name,
		email,
		phone,
		type,
		paymentMethod,
		insurer,
		membershipNumber,
		authorisationCode,
		notes,
		allowedTimesForDate,
	});

	if (!validated.ok) {
		return json(
			{
				ok: false as const,
				error: validated.error,
				errors: validated.errors,
			},
			{ status: 400 },
		);
	}

	const booking = validated.data;

	try {
		const stillFree = await isSlotAvailable(
			config,
			booking.dateIso,
			booking.timeLabel,
		);
		if (!stillFree) {
			return json(
				{
					ok: false as const,
					error: "That time was just taken. Please choose another slot.",
					errors: {
						time: "That time was just taken. Please choose another slot.",
					} as BookingFieldErrors,
				},
				{ status: 409 },
			);
		}

		if (booking.paymentMethod === "insurance") {
			const created = await createBookingEvent(config, {
				...booking,
				status: "tentative",
				summaryPrefix: "PENDING AUTH —",
				notes: calendarNotesForBooking(booking),
			});

			let emailSent = true;
			try {
				await sendPatientBookingConfirmation(config, {
					...booking,
					bookingRef: created.bookingRef,
				});
			} catch (emailError) {
				emailSent = false;
				console.error("Insurance booking confirmation email error:", emailError);
			}

			return json({
				ok: true as const,
				booking: {
					name: booking.name,
					dateIso: booking.dateIso,
					timeLabel: booking.timeLabel,
					emailSent,
					paymentMethod: "insurance" as const,
					bookingRef: created.bookingRef,
				},
			});
		}

		if (!stripe) {
			return json(
				{
					ok: false as const,
					error:
						"Self-pay booking is temporarily unavailable. Please choose insurance or contact the clinic team.",
					errors: {} as BookingFieldErrors,
				},
				{ status: 503 },
			);
		}

		const origin = new URL(request.url).origin;
		const bookingRef = generateBookingRef();
		const session = await createBookingCheckoutSession({
			stripe,
			booking,
			bookingRef,
			successUrl: `${origin}/book?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}/book?checkout=cancelled`,
		});

		return redirect(session.url);
	} catch (error) {
		if (error instanceof BookingConflictError) {
			return json(
				{
					ok: false as const,
					error: "That time was just taken. Please choose another slot.",
					errors: {
						time: "That time was just taken. Please choose another slot.",
					} as BookingFieldErrors,
				},
				{ status: 409 },
			);
		}

		console.error("Booking submit error:", error);
		const detail =
			error instanceof Error && /api key|invalid/i.test(error.message)
				? "Stripe rejected the API key. Check STRIPE_SECRET_KEY in .dev.vars (test key from Developers → API keys), then restart the dev server."
				: booking.paymentMethod === "self-pay"
					? "Could not start payment. Please try again."
					: "Could not complete the booking. Please try again.";
		return json(
			{
				ok: false as const,
				error: detail,
				errors: {} as BookingFieldErrors,
			},
			{ status: 500 },
		);
	}
}

export default function BookPage() {
	const {
		configured,
		days,
		error: availabilityError,
		checkoutResult,
		checkoutError,
		checkoutCancelled,
		fees,
	} = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const revalidator = useRevalidator();
	const submitting = navigation.state === "submitting";

	const bookableDays = useMemo(
		() => days.filter((day) => day.times.length > 0),
		[days],
	);
	const [selectedDay, setSelectedDay] = useState(bookableDays[0]?.iso ?? "");
	const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
		null,
	);
	const [consultationType, setConsultationType] = useState<string>(
		CONSULTATION_TYPES[0],
	);
	const nameField = useEditableField<HTMLInputElement>();
	const emailField = useEditableField<HTMLInputElement>();
	const phoneField = useEditableField<HTMLInputElement>();
	const insurerField = useEditableField<HTMLInputElement>();
	const membershipField = useEditableField<HTMLInputElement>();
	const authorisationField = useEditableField<HTMLInputElement>();
	const notesField = useEditableField<HTMLTextAreaElement>();

	useEffect(() => {
		if (!bookableDays.some((day) => day.iso === selectedDay)) {
			setSelectedDay(bookableDays[0]?.iso ?? "");
			setSelectedSlot(null);
		}
	}, [bookableDays, selectedDay]);

	useEffect(() => {
		if (
			actionData &&
			!actionData.ok &&
			actionData.errors?.time &&
			!actionData.errors.name
		) {
			revalidator.revalidate();
		}
	}, [actionData, revalidator]);

	const selectedDaySlots =
		bookableDays.find((day) => day.iso === selectedDay)?.times ?? [];

	const insuranceSuccess =
		actionData && actionData.ok ? actionData.booking : null;
	const confirmed = checkoutResult ?? insuranceSuccess;
	const success = Boolean(confirmed);
	const fieldErrors =
		actionData && !actionData.ok ? actionData.errors : null;
	const feeLabel =
		consultationType === "Follow-up / Monitoring"
			? fees.followUp
			: fees.standard;
	const isInsurance = paymentMethod === "insurance";
	const isSelfPay = paymentMethod === "self-pay";

	function fieldClass(hasError: boolean) {
		return hasError
			? "input-field border-red-400 focus:border-red-500"
			: "input-field";
	}

	return (
		<>
			<PageHero
				eyebrow="Book a consultation"
				title="Choose a time that works for you"
				summary={booking.intro}
			/>

			<section className="section-pad">
				<div className="site-container grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
					<div>
						{success && confirmed ? (
							<div className="border border-accent/25 bg-accent-soft px-6 py-8">
								<p className="eyebrow">
									{confirmed.paymentMethod === "insurance"
										? "Request received"
										: "Booking confirmed"}
								</p>
								<h2 className="mt-3 font-display text-3xl text-ink">
									Thank you, {confirmed.name}
								</h2>
								<p className="mt-3 text-ink-soft">
									{confirmed.paymentMethod === "insurance" ? (
										<>
											Your requested consultation for{" "}
											<strong className="font-semibold text-ink">
												{formatBookingDate(confirmed.dateIso)}
											</strong>{" "}
											at{" "}
											<strong className="font-semibold text-ink">
												{confirmed.timeLabel}
											</strong>{" "}
											is pending until we verify your insurer authorisation
											code. The clinic team will confirm the appointment once
											that check is complete — please do not attend until you
											receive confirmation.
											{confirmed.emailSent
												? " A message has been sent to the address you provided."
												: " We could not send the email automatically — please contact the clinic if you need written confirmation."}
										</>
									) : (
										<>
											Your consultation is booked for{" "}
											<strong className="font-semibold text-ink">
												{formatBookingDate(confirmed.dateIso)}
											</strong>{" "}
											at{" "}
											<strong className="font-semibold text-ink">
												{confirmed.timeLabel}
											</strong>
											. Payment was received.
											{confirmed.emailSent
												? " A confirmation email has been sent to the address you provided."
												: " We could not send the confirmation email automatically — please contact the clinic if you need written confirmation."}{" "}
											The clinic team may follow up if anything further is
											needed.
										</>
									)}
								</p>
								{confirmed.bookingRef ? (
									<p className="mt-4 text-ink-soft">
										Booking reference:{" "}
										<strong className="font-semibold text-ink">
											{confirmed.bookingRef}
										</strong>
										.{" "}
										<Link to="/manage-booking" className="link-underline">
											Manage booking
										</Link>
									</p>
								) : null}
							</div>
						) : !configured ? (
							<div className="border border-line bg-cream/70 px-6 py-8">
								<p className="eyebrow">Booking unavailable</p>
								<h2 className="mt-3 font-display text-3xl text-ink">
									Online booking is not configured yet
								</h2>
								<p className="mt-3 text-ink-soft">
									Please contact the clinic team by email to arrange an
									appointment.
								</p>
							</div>
						) : (
							<>
								<p className="text-sm text-ink-muted">{booking.note}</p>
								<p className="mt-2 text-sm text-ink-muted">
									Self-pay fees: New Patient, Second Opinion and Virtual{" "}
									{fees.standard}; Follow-up / Monitoring {fees.followUp}{" "}
									(payable when you book). Insurance bookings need an
									authorisation code and stay pending until the clinic verifies
									it.
								</p>

								{checkoutCancelled ? (
									<p
										className="mt-4 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
										role="status"
									>
										Payment was cancelled. Your appointment has not been booked
										— you can choose a time and try again.
									</p>
								) : null}

								{checkoutError ? (
									<p
										className="mt-4 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
										role="alert"
									>
										{checkoutError}
									</p>
								) : null}

								{availabilityError ? (
									<p
										className="mt-4 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
										role="alert"
									>
										{availabilityError}
									</p>
								) : null}

								{actionData && !actionData.ok ? (
									<p
										className="mt-4 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
										role="alert"
									>
										{actionData.error}
									</p>
								) : null}

								{bookableDays.length === 0 && !availabilityError ? (
									<p className="mt-8 text-ink-soft">
										No open slots in the next few weeks. Please contact the
										clinic team to arrange an appointment.
									</p>
								) : null}

								{bookableDays.length > 0 ? (
									<>
										<div className="mt-8">
											<p className="eyebrow">Available dates</p>
											<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
												{bookableDays.map((day) => {
													const active = day.iso === selectedDay;
													return (
														<button
															key={day.iso}
															type="button"
															onClick={() => {
																setSelectedDay(day.iso);
																setSelectedSlot(null);
															}}
															className={`rounded-sm border px-3 py-3 text-left transition ${
																active
																	? "border-accent bg-accent text-white"
																	: "border-line bg-white hover:border-accent/40"
															}`}
														>
															<span className="block text-xs uppercase tracking-wide opacity-80">
																{day.weekday}
															</span>
															<span className="mt-1 block text-sm font-semibold">
																{day.label}
															</span>
														</button>
													);
												})}
											</div>
										</div>

										<div className="mt-10">
											<p className="eyebrow">Available times (GMT)</p>
											<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
												{selectedDaySlots.map((time) => {
													const active = selectedSlot === time;
													return (
														<button
															key={time}
															type="button"
															onClick={() => setSelectedSlot(time)}
															className={`rounded-sm border px-4 py-3 text-sm font-semibold transition ${
																active
																	? "border-accent bg-accent-soft text-accent-deep"
																	: "border-line bg-white text-ink hover:border-accent/40"
															}`}
														>
															{time}
														</button>
													);
												})}
											</div>
										</div>

										<div className="mt-10">
											<p className="eyebrow">Payment method</p>
											<div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
												{(
													[
														{
															value: "self-pay" as const,
															label: "Self-pay",
															hint: "Pay securely online when you book",
														},
														{
															value: "insurance" as const,
															label: "Private insurance",
															hint: "Authorisation code required",
														},
													] as const
												).map((option) => {
													const active = paymentMethod === option.value;
													return (
														<button
															key={option.value}
															type="button"
															onClick={() => setPaymentMethod(option.value)}
															className={`rounded-sm border px-4 py-3 text-left transition ${
																active
																	? "border-accent bg-accent-soft text-accent-deep"
																	: "border-line bg-white text-ink hover:border-accent/40"
															}`}
														>
															<span className="block text-sm font-semibold">
																{option.label}
															</span>
															<span
																className={`mt-1 block text-xs ${
																	active ? "text-accent-deep/80" : "text-ink-muted"
																}`}
															>
																{option.hint}
															</span>
														</button>
													);
												})}
											</div>
											{fieldErrors?.paymentMethod ? (
												<p className="mt-2 text-sm text-red-700" role="alert">
													{fieldErrors.paymentMethod}
												</p>
											) : null}
										</div>

										<Form
											method="post"
											className="mt-10 space-y-5 border-t border-line pt-10"
											noValidate
										>
											<input type="hidden" name="date" value={selectedDay} />
											<input
												type="hidden"
												name="time"
												value={selectedSlot ?? ""}
											/>
											<input
												type="hidden"
												name="paymentMethod"
												value={paymentMethod ?? ""}
											/>

											{fieldErrors?.date || fieldErrors?.time ? (
												<p className="text-sm text-red-700" role="alert">
													{fieldErrors.time || fieldErrors.date}
												</p>
											) : null}

											<div className="grid gap-5 sm:grid-cols-2">
												<label className="block">
													<span className="mb-2 block text-sm font-semibold text-ink">
														Full name
													</span>
													<input
														required
														type="text"
														name="name"
														autoComplete="name"
														minLength={3}
														maxLength={80}
														ref={nameField.ref}
														value={nameField.value}
														onChange={nameField.onChange}
														onInput={nameField.onInput}
														onFocus={nameField.onFocus}
														onBlur={nameField.onBlur}
														onAnimationStart={nameField.onAnimationStart}
														className={fieldClass(Boolean(fieldErrors?.name))}
														aria-invalid={Boolean(fieldErrors?.name)}
														aria-describedby={
															fieldErrors?.name ? "name-error" : undefined
														}
													/>
													{fieldErrors?.name ? (
														<span
															id="name-error"
															className="mt-1.5 block text-sm text-red-700"
														>
															{fieldErrors.name}
														</span>
													) : null}
												</label>

												<label className="block">
													<span className="mb-2 block text-sm font-semibold text-ink">
														Email
													</span>
													<input
														required
														type="email"
														name="email"
														autoComplete="email"
														inputMode="email"
														maxLength={120}
														ref={emailField.ref}
														value={emailField.value}
														onChange={emailField.onChange}
														onInput={emailField.onInput}
														onFocus={emailField.onFocus}
														onBlur={emailField.onBlur}
														onAnimationStart={emailField.onAnimationStart}
														className={fieldClass(Boolean(fieldErrors?.email))}
														aria-invalid={Boolean(fieldErrors?.email)}
														aria-describedby={
															fieldErrors?.email ? "email-error" : undefined
														}
													/>
													{fieldErrors?.email ? (
														<span
															id="email-error"
															className="mt-1.5 block text-sm text-red-700"
														>
															{fieldErrors.email}
														</span>
													) : null}
												</label>
											</div>

											<label className="block">
												<span className="mb-2 block text-sm font-semibold text-ink">
													Phone
												</span>
												<input
													required
													type="tel"
													name="phone"
													autoComplete="tel"
													inputMode="tel"
													minLength={8}
													maxLength={30}
													ref={phoneField.ref}
													value={phoneField.value}
													onChange={phoneField.onChange}
													onInput={phoneField.onInput}
													onFocus={phoneField.onFocus}
													onBlur={phoneField.onBlur}
													onAnimationStart={phoneField.onAnimationStart}
													className={fieldClass(Boolean(fieldErrors?.phone))}
													placeholder="Contact number"
													aria-invalid={Boolean(fieldErrors?.phone)}
													aria-describedby={
														fieldErrors?.phone ? "phone-error" : undefined
													}
												/>
												{fieldErrors?.phone ? (
													<span
														id="phone-error"
														className="mt-1.5 block text-sm text-red-700"
													>
														{fieldErrors.phone}
													</span>
												) : null}
											</label>

											<label className="block">
												<span className="mb-2 block text-sm font-semibold text-ink">
													Consultation type
												</span>
												<select
													name="type"
													required
													className={fieldClass(Boolean(fieldErrors?.type))}
													value={consultationType}
													onChange={(event) =>
														setConsultationType(event.target.value)
													}
													aria-invalid={Boolean(fieldErrors?.type)}
												>
													{CONSULTATION_TYPES.map((option) => (
														<option key={option} value={option}>
															{option}
															{isSelfPay
																? option === "Follow-up / Monitoring"
																	? ` (${fees.followUp})`
																	: ` (${fees.standard})`
																: ""}
														</option>
													))}
												</select>
												{isSelfPay ? (
													<p className="mt-1.5 text-sm text-ink-muted">
														Fee for this consultation:{" "}
														<span className="font-semibold text-ink">
															{feeLabel}
														</span>
													</p>
												) : isInsurance ? (
													<p className="mt-1.5 text-sm text-ink-muted">
														No online payment. Your appointment stays pending
														until we verify your insurer authorisation code.
													</p>
												) : null}
												{fieldErrors?.type ? (
													<span className="mt-1.5 block text-sm text-red-700">
														{fieldErrors.type}
													</span>
												) : null}
											</label>

											{isInsurance ? (
												<div className="space-y-5">
													<div className="grid gap-5 sm:grid-cols-2">
														<label className="block">
															<span className="mb-2 block text-sm font-semibold text-ink">
																Insurer
															</span>
															<input
																required
																type="text"
																name="insurer"
																maxLength={80}
																ref={insurerField.ref}
																value={insurerField.value}
																onChange={insurerField.onChange}
																onInput={insurerField.onInput}
																onFocus={insurerField.onFocus}
																onBlur={insurerField.onBlur}
																onAnimationStart={
																	insurerField.onAnimationStart
																}
																className={fieldClass(
																	Boolean(fieldErrors?.insurer),
																)}
																placeholder="e.g. Bupa, AXA, Aviva"
																aria-invalid={Boolean(fieldErrors?.insurer)}
															/>
															{fieldErrors?.insurer ? (
																<span className="mt-1.5 block text-sm text-red-700">
																	{fieldErrors.insurer}
																</span>
															) : null}
														</label>

														<label className="block">
															<span className="mb-2 block text-sm font-semibold text-ink">
																Authorisation code
															</span>
															<input
																required
																type="text"
																name="authorisationCode"
																maxLength={80}
																ref={authorisationField.ref}
																value={authorisationField.value}
																onChange={authorisationField.onChange}
																onInput={authorisationField.onInput}
																onFocus={authorisationField.onFocus}
																onBlur={authorisationField.onBlur}
																onAnimationStart={
																	authorisationField.onAnimationStart
																}
																className={fieldClass(
																	Boolean(fieldErrors?.authorisationCode),
																)}
																placeholder="From your insurer"
																aria-invalid={Boolean(
																	fieldErrors?.authorisationCode,
																)}
															/>
															{fieldErrors?.authorisationCode ? (
																<span className="mt-1.5 block text-sm text-red-700">
																	{fieldErrors.authorisationCode}
																</span>
															) : null}
														</label>
													</div>

													<label className="block">
														<span className="mb-2 block text-sm font-semibold text-ink">
															Membership / policy number{" "}
															<span className="font-normal text-ink-muted">
																(optional)
															</span>
														</span>
														<input
															type="text"
															name="membershipNumber"
															maxLength={60}
															ref={membershipField.ref}
															value={membershipField.value}
															onChange={membershipField.onChange}
															onInput={membershipField.onInput}
															onFocus={membershipField.onFocus}
															onBlur={membershipField.onBlur}
															onAnimationStart={
																membershipField.onAnimationStart
															}
															className={fieldClass(
																Boolean(fieldErrors?.membershipNumber),
															)}
															aria-invalid={Boolean(
																fieldErrors?.membershipNumber,
															)}
														/>
														{fieldErrors?.membershipNumber ? (
															<span className="mt-1.5 block text-sm text-red-700">
																{fieldErrors.membershipNumber}
															</span>
														) : null}
													</label>

													<p className="text-sm text-ink-muted">
														Ask your insurer for an authorisation code before
														booking. We verify the code before confirming your
														appointment, and share it with the hospital for
														facility billing.
													</p>
												</div>
											) : null}

											<label className="block">
												<span className="mb-2 block text-sm font-semibold text-ink">
													Notes (optional)
												</span>
												<textarea
													name="notes"
													rows={4}
													maxLength={1000}
													ref={notesField.ref}
													value={notesField.value}
													onChange={notesField.onChange}
													onInput={notesField.onInput}
													onFocus={notesField.onFocus}
													onBlur={notesField.onBlur}
													onAnimationStart={notesField.onAnimationStart}
													className={fieldClass(Boolean(fieldErrors?.notes))}
													placeholder="Brief context for the appointment"
													aria-invalid={Boolean(fieldErrors?.notes)}
												/>
												{fieldErrors?.notes ? (
													<span className="mt-1.5 block text-sm text-red-700">
														{fieldErrors.notes}
													</span>
												) : null}
											</label>

											<button
												type="submit"
												className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
												disabled={
													!selectedDay ||
													!selectedSlot ||
													!paymentMethod ||
													submitting
												}
											>
												{submitting
													? isInsurance
														? "Booking…"
														: "Redirecting to payment…"
														: isInsurance
														? "Submit insurance request"
														: isSelfPay
															? "Pay and book"
															: "Choose a payment method"}
											</button>
										</Form>
									</>
								) : null}
							</>
						)}
					</div>

					<aside className="h-fit border border-line bg-cream/70 p-7 sm:p-8">
						<p className="eyebrow">Prefer to speak with someone?</p>
						<h2 className="mt-3 font-display text-3xl text-ink">
							Contact the clinic team
						</h2>
						<p className="mt-4 text-ink-soft">
							For help arranging an appointment, email the clinic team.
						</p>
						<ul className="mt-6 space-y-3 text-ink-soft">
							<li>
								<a
									href={`mailto:${contact.email}`}
									className="transition-colors hover:text-accent"
								>
									{contact.email}
								</a>
							</li>
							<li className="text-sm italic text-ink-muted">
								{contact.enquiriesNote}
							</li>
						</ul>
						<Link to="/contact" className="link-underline mt-8">
							View locations &amp; fees
							<span aria-hidden="true">→</span>
						</Link>
					</aside>
				</div>
			</section>
		</>
	);
}
