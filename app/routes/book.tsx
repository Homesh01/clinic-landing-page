import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/cloudflare";
import { Form, Link, useActionData, useLoaderData, useNavigation, useRevalidator } from "@remix-run/react";
import { json } from "@remix-run/cloudflare";
import { useEffect, useMemo, useState } from "react";
import { PageHero } from "~/components/PageHero";
import { booking, contact, site } from "~/data/content";
import {
	BookingConflictError,
	createBookingEvent,
	getAvailableDays,
	getBookingConfig,
} from "~/utils/google-calendar.server";
import { sendPatientBookingConfirmation } from "~/utils/booking-email.server";
import {
	CONSULTATION_TYPES,
	type BookingFieldErrors,
	validateBookingForm,
} from "~/utils/booking-validation";

export const meta: MetaFunction = () => {
	return [
		{ title: `Book a consultation | ${site.name}` },
		{
			name: "description",
			content: booking.intro,
		},
	];
};

export async function loader({ context }: LoaderFunctionArgs) {
	const config = getBookingConfig(context.cloudflare.env);

	if (!config) {
		return json({
			configured: false as const,
			days: [] as Awaited<ReturnType<typeof getAvailableDays>>,
			error: null as string | null,
		});
	}

	try {
		const days = await getAvailableDays(config);
		return json({
			configured: true as const,
			days,
			error: null as string | null,
		});
	} catch (error) {
		console.error("Booking availability error:", error);
		return json({
			configured: true as const,
			days: [] as Awaited<ReturnType<typeof getAvailableDays>>,
			error:
				"Could not load availability right now. Please try again shortly, or contact the practice team.",
		});
	}
}

export async function action({ request, context }: ActionFunctionArgs) {
	const config = getBookingConfig(context.cloudflare.env);
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
	const notes = String(formData.get("notes") ?? "");

	let allowedTimesForDate: string[] | undefined;
	try {
		const days = await getAvailableDays(config);
		allowedTimesForDate = days.find((day) => day.iso === dateIso.trim())?.times;
	} catch {
		allowedTimesForDate = undefined;
	}

	const validated = validateBookingForm({
		dateIso,
		timeLabel,
		name,
		email,
		phone,
		type,
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

	try {
		await createBookingEvent(config, validated.data);

		let emailSent = true;
		try {
			await sendPatientBookingConfirmation(config, validated.data);
		} catch (emailError) {
			emailSent = false;
			console.error("Booking confirmation email error:", emailError);
		}

		return json({
			ok: true as const,
			dateIso: validated.data.dateIso,
			timeLabel: validated.data.timeLabel,
			name: validated.data.name,
			emailSent,
		});
	} catch (error) {
		console.error("Booking create error:", error);
		const message =
			error instanceof BookingConflictError
				? error.message
				: "Could not complete the booking. Please try again.";

		return json(
			{
				ok: false as const,
				error: message,
				errors: (error instanceof BookingConflictError
					? { time: message }
					: {}) as BookingFieldErrors,
			},
			{ status: error instanceof BookingConflictError ? 409 : 500 },
		);
	}
}

export default function BookPage() {
	const { configured, days, error: availabilityError } =
		useLoaderData<typeof loader>();
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

	const success = actionData && "ok" in actionData && actionData.ok;
	const fieldErrors =
		actionData && !actionData.ok ? actionData.errors : null;

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
						{success ? (
							<div className="border border-accent/25 bg-accent-soft px-6 py-8">
								<p className="eyebrow">Booking confirmed</p>
								<h2 className="mt-3 font-display text-3xl text-ink">
									Thank you, {actionData.name}
								</h2>
								<p className="mt-3 text-ink-soft">
									Your consultation is booked for{" "}
									<strong className="font-semibold text-ink">
										{actionData.dateIso}
									</strong>{" "}
									at{" "}
									<strong className="font-semibold text-ink">
										{actionData.timeLabel}
									</strong>
									.
									{actionData.emailSent
										? " A confirmation email has been sent to the address you provided."
										: " We could not send the confirmation email automatically — please contact the practice if you need written confirmation."}{" "}
									The practice team may follow up if anything further is needed.
								</p>
								<Link to="/book" className="link-underline mt-6">
									Book another consultation
									<span aria-hidden="true">→</span>
								</Link>
							</div>
						) : !configured ? (
							<div className="border border-line bg-cream/70 px-6 py-8">
								<p className="eyebrow">Booking unavailable</p>
								<h2 className="mt-3 font-display text-3xl text-ink">
									Online booking is not configured yet
								</h2>
								<p className="mt-3 text-ink-soft">
									Please contact the practice team by email to arrange an
									appointment.
								</p>
							</div>
						) : (
							<>
								<p className="text-sm text-ink-muted">{booking.note}</p>

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
										practice team to arrange an appointment.
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
											<p className="eyebrow">Available times</p>
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
														name="name"
														autoComplete="name"
														minLength={3}
														maxLength={80}
														className={fieldClass(Boolean(fieldErrors?.name))}
														placeholder="First and last name"
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
														className={fieldClass(Boolean(fieldErrors?.email))}
														placeholder="you@example.com"
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
													defaultValue="New Patient Consultation"
													aria-invalid={Boolean(fieldErrors?.type)}
												>
													{CONSULTATION_TYPES.map((option) => (
														<option key={option} value={option}>
															{option}
														</option>
													))}
												</select>
												{fieldErrors?.type ? (
													<span className="mt-1.5 block text-sm text-red-700">
														{fieldErrors.type}
													</span>
												) : null}
											</label>

											<label className="block">
												<span className="mb-2 block text-sm font-semibold text-ink">
													Notes (optional)
												</span>
												<textarea
													name="notes"
													rows={4}
													maxLength={1000}
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
												disabled={!selectedDay || !selectedSlot || submitting}
											>
												{submitting ? "Booking…" : "Book consultation"}
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
							Contact the practice team
						</h2>
						<p className="mt-4 text-ink-soft">
							Contact the secretary by email and the practice team can help
							arrange a suitable appointment.
						</p>
						<ul className="mt-6 space-y-3 text-ink-soft">
							<li>
								<span className="block text-sm text-ink-muted">
									{contact.secretaryLabel}
								</span>
								{contact.name}
							</li>
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
