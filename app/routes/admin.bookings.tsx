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
	useSearchParams,
} from "@remix-run/react";
import { json } from "@remix-run/cloudflare";
import { useEffect, useMemo, useState } from "react";
import { ClinicStaffChrome } from "~/components/clinic/ClinicStaffChrome";
import { PageHero } from "~/components/PageHero";
import { isValidBookingRef, normalizeBookingRef } from "~/utils/booking-ref";
import {
	sendBookingCancelledEmail,
	sendBookingRescheduledEmail,
	sendInsuranceBookingConfirmedEmail,
} from "~/utils/booking-email.server";
import { requireClinicStaff } from "~/utils/clinic-staff.server";
import { formatBookingDate } from "~/utils/format-date";
import {
	BookingConflictError,
	cancelBookingEvent,
	confirmInsuranceBookingEvent,
	findBookingByRef,
	getAvailableDays,
	getBookingConfig,
	listManagedBookingsInRange,
	rescheduleBookingEvent,
	type ManagedBooking,
} from "~/utils/google-calendar.server";
import {
	findPatientsMatchingContact,
	getPatientByBookingRef,
	getPatientById,
	getPatientsDb,
	linkPatientBooking,
	searchPatients,
	unlinkPatientBooking,
	type PatientRecord,
} from "~/utils/patients.server";
import { logServerError } from "~/utils/safe-log.server";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";
import { recordStaffActivity } from "~/utils/staff-activity.server";
import {
	formatGbpFromPence,
	getStripeConfig,
	refundPaymentIntent,
	resolvePaymentIntentForBooking,
} from "~/utils/stripe.server";
import { partitionUpcomingBookings } from "~/utils/upcoming-bookings";

function paymentLabel(booking: {
	paymentMethod: string;
	pendingAuth: boolean;
}): string {
	if (booking.paymentMethod === "insurance") {
		return booking.pendingAuth
			? "Insurance, pending authorisation"
			: "Insurance, confirmed";
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
		title: clinicPageTitle("Admin bookings"),
		description: "Staff tools for clinic booking management.",
		path: "/admin/bookings",
		noIndex: true,
	});
};

async function loadPatientLinkContext(
	env: Env,
	booking: ManagedBooking,
): Promise<{
	linkedPatient: PatientRecord | null;
	suggestedPatients: PatientRecord[];
}> {
	const db = getPatientsDb(env);
	if (!db) return { linkedPatient: null, suggestedPatients: [] };
	try {
		const linkedPatient = await getPatientByBookingRef(db, booking.bookingRef);
		const suggestedPatients = linkedPatient
			? []
			: await findPatientsMatchingContact(db, {
					email: booking.email,
					phone: booking.phone,
				});
		return { linkedPatient, suggestedPatients };
	} catch (error) {
		logServerError("Patient link context error", error);
		return { linkedPatient: null, suggestedPatients: [] };
	}
}

export async function loader({ request, context }: LoaderFunctionArgs) {
	const env = context.cloudflare.env;
	const staff = await requireClinicStaff(request, env);
	const config = getBookingConfig(env);
	const url = new URL(request.url);
	const refParam = normalizeBookingRef(url.searchParams.get("ref") ?? "");

	let upcoming: ManagedBooking[] = [];
	let upcomingError: string | null = null;
	if (config) {
		try {
			const timeMin = new Date(Date.now() - 60 * 60 * 1000);
			const timeMax = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
			upcoming = await listManagedBookingsInRange(config, timeMin, timeMax);
		} catch (error) {
			logServerError("Upcoming bookings load error", error);
			upcomingError = "Could not load upcoming bookings from Google Calendar.";
		}
	}

	const { today, todayBookings, laterBookings } =
		partitionUpcomingBookings(upcoming);

	let preloadedLookup: {
		booking: ManagedBooking;
		days: Awaited<ReturnType<typeof getAvailableDays>>;
		linkedPatient: PatientRecord | null;
		suggestedPatients: PatientRecord[];
	} | null = null;

	if (config && isValidBookingRef(refParam)) {
		try {
			const booking = await findBookingByRef(config, refParam);
			if (booking) {
				const days = await getAvailableDays(config);
				const availableDays = days.map((day) => ({
					...day,
					times:
						day.iso === booking.dateIso
							? day.times.filter((time) => time !== booking.timeLabel)
							: day.times,
				}));
				const linkCtx = await loadPatientLinkContext(env, booking);
				preloadedLookup = {
					booking,
					days: availableDays,
					...linkCtx,
				};
			}
		} catch (error) {
			logServerError("Preload booking by ref error", error);
		}
	}

	return json(
		{
			configured: Boolean(config),
			stripeConfigured: Boolean(getStripeConfig(env)),
			staff,
			todayIso: today,
			todayBookings,
			laterBookings,
			upcomingError,
			initialRef: isValidBookingRef(refParam) ? refParam : "",
			patientsDbConfigured: Boolean(getPatientsDb(env)),
			preloadedLookup,
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
	const config = getBookingConfig(env);
	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "");
	const db = getPatientsDb(env);

	if (!config) {
		return json(
			{
				ok: false as const,
				intent,
				error: "Admin tools are not configured.",
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
		if (intent === "link-patient" || intent === "unlink-patient") {
			if (!db) {
				return json(
					{
						ok: false as const,
						intent,
						error: "Patient database is not configured.",
						bookingRef,
					},
					{ status: 503 },
				);
			}
			if (intent === "unlink-patient") {
				await unlinkPatientBooking(db, bookingRef);
				try {
					await recordStaffActivity(db, {
						actorEmail: staff.email,
						action: "unlink_booking",
						entityType: "booking",
						entityId: bookingRef,
						summary: `Unlinked patient from booking ${bookingRef}`,
					});
				} catch (logError) {
					logServerError("Activity log error", logError);
				}
				const booking = await findBookingByRef(config, bookingRef);
				const days = booking ? await getAvailableDays(config) : [];
				const availableDays = booking
					? days.map((day) => ({
							...day,
							times:
								day.iso === booking.dateIso
									? day.times.filter((time) => time !== booking.timeLabel)
									: day.times,
						}))
					: [];
				const linkCtx = booking
					? await loadPatientLinkContext(env, booking)
					: { linkedPatient: null, suggestedPatients: [] };
				return json({
					ok: true as const,
					intent: "lookup" as const,
					booking,
					days: availableDays,
					...linkCtx,
					linkMessage: "Booking unlinked from patient contact.",
				});
			}

			const patientId = String(formData.get("patientId") ?? "").trim();
			const patient = patientId ? await getPatientById(db, patientId) : null;
			if (!patient) {
				return json(
					{
						ok: false as const,
						intent,
						error: "Select a patient contact to link.",
						bookingRef,
					},
					{ status: 400 },
				);
			}
			await linkPatientBooking(db, {
				patientId: patient.id,
				bookingRef,
				staffEmail: staff.email,
			});
			try {
				await recordStaffActivity(db, {
					actorEmail: staff.email,
					action: "link_booking",
					entityType: "booking",
					entityId: bookingRef,
					summary: `Linked ${patient.name} to booking ${bookingRef}`,
				});
			} catch (logError) {
				logServerError("Activity log error", logError);
			}
			const booking = await findBookingByRef(config, bookingRef);
			const days = booking ? await getAvailableDays(config) : [];
			const availableDays = booking
				? days.map((day) => ({
						...day,
						times:
							day.iso === booking.dateIso
								? day.times.filter((time) => time !== booking.timeLabel)
								: day.times,
					}))
				: [];
			const linkCtx = booking
				? await loadPatientLinkContext(env, booking)
				: {
						linkedPatient: patient,
						suggestedPatients: [] as PatientRecord[],
					};
			return json({
				ok: true as const,
				intent: "lookup" as const,
				booking,
				days: availableDays,
				...linkCtx,
				linkMessage: `Linked to ${patient.name}.`,
			});
		}

		if (intent === "search-patients-for-link") {
			if (!db) {
				return json(
					{
						ok: false as const,
						intent,
						error: "Patient database is not configured.",
						bookingRef,
					},
					{ status: 503 },
				);
			}
			const q = String(formData.get("q") ?? "").trim();
			const booking = await findBookingByRef(config, bookingRef);
			if (!booking) {
				return json(
					{
						ok: false as const,
						intent: "lookup",
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
			const linkCtx = await loadPatientLinkContext(env, booking);
			const searchResults = q ? await searchPatients(db, q) : [];
			return json({
				ok: true as const,
				intent: "lookup" as const,
				booking,
				days: availableDays,
				...linkCtx,
				patientSearchResults: searchResults,
				patientSearchQuery: q,
			});
		}

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
			const linkCtx = await loadPatientLinkContext(env, booking);
			return json({
				ok: true as const,
				intent: "lookup" as const,
				booking,
				days: availableDays,
				...linkCtx,
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
				logServerError("Insurance confirm email error", emailError);
			}
			if (db) {
				try {
					await recordStaffActivity(db, {
						actorEmail: staff.email,
						action: "confirm_booking",
						entityType: "booking",
						entityId: booking.bookingRef,
						summary: `Confirmed insurance booking ${booking.bookingRef} (${booking.name})`,
					});
				} catch (logError) {
					logServerError("Activity log error", logError);
				}
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
				logServerError("Clinic reschedule email error", emailError);
			}
			if (db) {
				try {
					await recordStaffActivity(db, {
						actorEmail: staff.email,
						action: "reschedule_booking",
						entityType: "booking",
						entityId: booking.bookingRef,
						summary: `Rescheduled ${booking.bookingRef} to ${booking.dateIso} ${booking.timeLabel}`,
					});
				} catch (logError) {
					logServerError("Activity log error", logError);
				}
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
					logServerError("Clinic cancel refund lookup failed", lookupError);
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
					logServerError("Clinic cancel refund error", refundError);
					return json(
						{
							ok: false as const,
							intent,
							error:
								"Stripe refund failed. Booking was not cancelled. Try again or refund in the Stripe Dashboard.",
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
				logServerError("Clinic cancel email error", emailError);
			}

			if (db) {
				try {
					await recordStaffActivity(db, {
						actorEmail: staff.email,
						action: "cancel_booking",
						entityType: "booking",
						entityId: booking.bookingRef,
						summary: `Cancelled booking ${booking.bookingRef} (${booking.name})`,
					});
				} catch (logError) {
					logServerError("Activity log error", logError);
				}
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
		logServerError("Admin tools error", error);
		return json(
			{
				ok: false as const,
				intent,
				error: "Something went wrong. Please try again.",
				bookingRef,
			},
			{ status: 500 },
		);
	}
}

function UpcomingTable({
	title,
	bookings,
}: {
	title: string;
	bookings: ManagedBooking[];
}) {
	if (bookings.length === 0) {
		return (
			<div>
				<h3 className="text-sm font-semibold text-ink">{title}</h3>
				<p className="mt-2 text-sm text-ink-soft">None.</p>
			</div>
		);
	}
	return (
		<div>
			<h3 className="text-sm font-semibold text-ink">{title}</h3>
			<div className="mt-3 overflow-x-auto border border-line">
				<table className="min-w-full text-left text-sm">
					<thead className="bg-cream/50 text-ink-muted">
						<tr>
							<th className="px-3 py-2 font-medium">When</th>
							<th className="px-3 py-2 font-medium">Patient</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">Ref</th>
						</tr>
					</thead>
					<tbody>
						{bookings.map((row) => (
							<tr key={row.eventId} className="border-t border-line">
								<td className="px-3 py-2 text-ink">
									{formatBookingDate(row.dateIso)} · {row.timeLabel}
								</td>
								<td className="px-3 py-2 text-ink-soft">
									{row.name}
									<span className="block text-xs text-ink-muted">
										{row.type}
										{row.appointmentFormat !== "unknown"
											? ` · ${row.appointmentFormat}`
											: ""}
									</span>
								</td>
								<td className="px-3 py-2 text-ink-soft">
									{row.pendingAuth
										? "Pending auth"
										: row.status === "tentative"
											? "Tentative"
											: "Confirmed"}
								</td>
								<td className="px-3 py-2">
									<Link
										to={`/admin/bookings?ref=${encodeURIComponent(row.bookingRef)}`}
										className="font-medium text-accent-deep underline-offset-2 hover:underline"
									>
										{row.bookingRef}
									</Link>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default function ClinicBookingsPage() {
	const {
		configured,
		stripeConfigured,
		staff,
		todayBookings,
		laterBookings,
		upcomingError,
		initialRef,
		patientsDbConfigured,
		preloadedLookup,
	} = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const [searchParams] = useSearchParams();
	const submitting = navigation.state === "submitting";

	const lookedUp =
		actionData && actionData.ok && actionData.intent === "lookup"
			? actionData
			: preloadedLookup
				? {
						ok: true as const,
						intent: "lookup" as const,
						...preloadedLookup,
					}
				: null;
	const booking = lookedUp?.booking ?? null;
	const days = lookedUp?.days ?? [];
	const linkedPatient =
		lookedUp && "linkedPatient" in lookedUp
			? (lookedUp.linkedPatient as PatientRecord | null)
			: null;
	const suggestedPatients =
		lookedUp && "suggestedPatients" in lookedUp
			? (lookedUp.suggestedPatients as PatientRecord[])
			: [];
	const patientSearchResults =
		lookedUp && "patientSearchResults" in lookedUp
			? (lookedUp.patientSearchResults as PatientRecord[])
			: [];
	const linkMessage =
		lookedUp && "linkMessage" in lookedUp && lookedUp.linkMessage
			? String(lookedUp.linkMessage)
			: null;
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
			: initialRef || searchParams.get("ref") || "";

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
				eyebrow="Admin"
				title="Bookings"
				summary="Look up and manage appointments."
			/>

			<section className="section-pad">
				<div className="site-container max-w-4xl space-y-8">
					<ClinicStaffChrome
						staffEmail={staff.email}
						active="bookings"
					/>

					{configured ? (
						<div className="space-y-6 border border-line bg-white px-5 py-6 sm:px-6">
							<div>
								<p className="eyebrow">Schedule</p>
								<h2 className="mt-2 font-display text-2xl text-ink">
									Upcoming appointments
								</h2>
								<p className="mt-2 text-sm text-ink-soft">
									Today and the next seven days from Google Calendar (managed
									bookings only).
								</p>
							</div>
							{upcomingError ? (
								<p className="text-sm text-red-700" role="alert">
									{upcomingError}
								</p>
							) : (
								<div className="space-y-6">
									<UpcomingTable title="Today" bookings={todayBookings} />
									<UpcomingTable
										title="Next 7 days"
										bookings={laterBookings}
									/>
								</div>
							)}
						</div>
					) : null}

					{!configured ? (
						<div className="border border-line bg-cream/70 px-6 py-8">
							<p className="eyebrow">Unavailable</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								Booking tools are not configured
							</h2>
							<p className="mt-3 text-ink-soft">
								Set Google Calendar booking secrets to enable appointment
								lookup and changes.
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
								{confirmed.booking.timeLabel} (UK time) (
								{confirmed.booking.bookingRef})
							</p>
							{!confirmed.alreadyConfirmed ? (
								<p className="mt-3 text-ink-soft">
									Calendar updated and confirmation email sent (with calendar
									file).
								</p>
							) : null}
							<p className="mt-6">
								<a
									href="/admin/bookings"
									className="font-semibold text-accent-deep"
								>
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
								{rescheduled.timeLabel} (UK time) ({rescheduled.bookingRef}).
							</p>
							{rescheduled.pendingAuth ? (
								<p className="mt-3 text-ink-soft">
									Still pending insurer authorisation, confirmation calendar
									file is sent once authorisation is confirmed.
								</p>
							) : null}
							<p className="mt-6">
								<a
									href="/admin/bookings"
									className="font-semibold text-accent-deep"
								>
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
									? "Booking cancelled, refund processed"
									: "Booking cancelled"}
							</h2>
							<p className="mt-3 text-ink-soft">
								{cancelled.booking.name} ·{" "}
								{formatBookingDate(cancelled.booking.dateIso)} at{" "}
								{cancelled.booking.timeLabel} (UK time) (
								{cancelled.booking.bookingRef})
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
								<a
									href="/admin/bookings"
									className="font-semibold text-accent-deep"
								>
									Look up another booking
								</a>
							</p>
						</div>
					) : (
						<>
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
											{booking.timeLabel} (UK time)
											<br />
											{booking.email}
											{booking.phone ? (
												<>
													<br />
													{booking.phone}
												</>
											) : null}
											<br />
											{booking.type} · {booking.bookingRef}
											<br />
											{paymentLabel(booking)}
										</p>
									</div>

									{patientsDbConfigured ? (
										<div className="border border-line bg-white px-6 py-6">
											<h3 className="font-display text-xl text-ink">
												Patient contact
											</h3>
											{linkMessage ? (
												<p className="mt-2 text-sm text-accent-deep" role="status">
													{linkMessage}
												</p>
											) : null}
											{linkedPatient ? (
												<div className="mt-3 space-y-3">
													<p className="text-ink-soft">
														Linked to{" "}
														<Link
															to={`/admin/patients/${linkedPatient.id}`}
															className="font-semibold text-accent-deep underline-offset-2 hover:underline"
														>
															{linkedPatient.name}
														</Link>{" "}
														({linkedPatient.email})
													</p>
													<Form method="post">
														<input
															type="hidden"
															name="intent"
															value="unlink-patient"
														/>
														<input
															type="hidden"
															name="bookingRef"
															value={booking.bookingRef}
														/>
														<button
															type="submit"
															className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
															disabled={submitting}
														>
															Unlink
														</button>
													</Form>
												</div>
											) : (
												<div className="mt-3 space-y-4">
													<p className="text-sm text-ink-soft">
														No contact linked yet.
													</p>
													<p>
														<Link
															to={`/admin/patients?new=1&name=${encodeURIComponent(booking.name)}&email=${encodeURIComponent(booking.email)}&phone=${encodeURIComponent(booking.phone)}&bookingRef=${encodeURIComponent(booking.bookingRef)}`}
															className="btn-secondary"
														>
															Create contact from booking
														</Link>
													</p>
													{suggestedPatients.length > 0 ? (
														<ul className="space-y-2">
															{suggestedPatients.map((patient) => (
																<li
																	key={patient.id}
																	className="flex flex-wrap items-center justify-between gap-2 border border-line px-3 py-2 text-sm"
																>
																	<span>
																		{patient.name} · {patient.email}
																	</span>
																	<Form method="post">
																		<input
																			type="hidden"
																			name="intent"
																			value="link-patient"
																		/>
																		<input
																			type="hidden"
																			name="bookingRef"
																			value={booking.bookingRef}
																		/>
																		<input
																			type="hidden"
																			name="patientId"
																			value={patient.id}
																		/>
																		<button
																			type="submit"
																			className="font-semibold text-accent-deep"
																			disabled={submitting}
																		>
																			Link
																		</button>
																	</Form>
																</li>
															))}
														</ul>
													) : null}
													<Form
														method="post"
														className="flex flex-wrap items-end gap-2"
													>
														<input
															type="hidden"
															name="intent"
															value="search-patients-for-link"
														/>
														<input
															type="hidden"
															name="bookingRef"
															value={booking.bookingRef}
														/>
														<label className="grow text-sm">
															<span className="mb-1 block font-semibold text-ink">
																Search contacts
															</span>
															<input
																name="q"
																className="input-field"
																placeholder="Name, email or phone"
																defaultValue={
																	lookedUp &&
																	"patientSearchQuery" in lookedUp &&
																	lookedUp.patientSearchQuery
																		? String(lookedUp.patientSearchQuery)
																		: ""
																}
															/>
														</label>
														<button
															type="submit"
															className="btn-secondary"
															disabled={submitting}
														>
															Search
														</button>
													</Form>
													{patientSearchResults.length > 0 ? (
														<ul className="space-y-2">
															{patientSearchResults.map((patient) => (
																<li
																	key={patient.id}
																	className="flex flex-wrap items-center justify-between gap-2 border border-line px-3 py-2 text-sm"
																>
																	<span>
																		{patient.name} · {patient.email}
																	</span>
																	<Form method="post">
																		<input
																			type="hidden"
																			name="intent"
																			value="link-patient"
																		/>
																		<input
																			type="hidden"
																			name="bookingRef"
																			value={booking.bookingRef}
																		/>
																		<input
																			type="hidden"
																			name="patientId"
																			value={patient.id}
																		/>
																		<button
																			type="submit"
																			className="font-semibold text-accent-deep"
																			disabled={submitting}
																		>
																			Link
																		</button>
																	</Form>
																</li>
															))}
														</ul>
													) : null}
												</div>
											)}
										</div>
									) : null}

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
													window.location.assign("/admin/bookings");
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
															Time (UK time)
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
																? " (Stripe not configured, cancel without refund only)"
																: " (optional, leave unchecked to cancel without refunding)"}
														</span>
													</label>
												) : (
													<p className="text-sm text-ink-soft">
														Insurance booking, no Stripe refund.
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
