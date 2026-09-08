import {
	generateBookingRef,
	isValidBookingRef,
	normalizeBookingRef,
} from "~/utils/booking-ref";
import { zonedDateTimeToUtc } from "~/utils/booking-refund";

export type BookingConfig = {
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	calendarId: string;
	timeZone: string;
	fromEmail?: string;
	fromName?: string;
	bccEmail?: string;
};

export type DaySlots = {
	iso: string;
	label: string;
	weekday: string;
	times: string[];
};

const CLINIC_OPEN = { hour: 10, minute: 30 };
const CLINIC_CLOSE = { hour: 14, minute: 30 };
const SLOT_MINUTES = 60;
/** Number of upcoming Fridays to offer for booking. */
const AVAILABILITY_FRIDAYS = 4;

/** Google Calendar event colour IDs (shared palette). */
const CALENDAR_COLOR_PENDING = "6"; // tangerine — pending insurer auth
const CALENDAR_COLOR_CONFIRMED = "7"; // peacock — confirmed

/** Fixed Friday slots — kept short so the diary does not look over-available. */
const BOOKABLE_SLOTS = [
	{ hour: 10, minute: 30, label: "10:30" },
	{ hour: 11, minute: 30, label: "11:30" },
	{ hour: 13, minute: 30, label: "13:30" },
] as const;

/** Trim and strip wrapping quotes / zero-width chars from dashboard secrets. */
function cleanEnv(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const cleaned = value
		.trim()
		.replace(/^[\u200B-\u200D\uFEFF]+|[\u200B-\u200D\uFEFF]+$/g, "")
		.replace(/^["']|["']$/g, "")
		.trim();
	return cleaned || undefined;
}

function redactCalendarId(calendarId: string): string {
	if (calendarId.length <= 12) return "(invalid)";
	return `${calendarId.slice(0, 6)}…${calendarId.slice(-28)}`;
}

export function getBookingConfig(env: Env | undefined): BookingConfig | null {
	const clientId = cleanEnv(env?.GOOGLE_CLIENT_ID);
	const clientSecret = cleanEnv(env?.GOOGLE_CLIENT_SECRET);
	const refreshToken = cleanEnv(env?.GOOGLE_REFRESH_TOKEN);
	const calendarId = cleanEnv(env?.GOOGLE_CALENDAR_ID);
	const timeZone = cleanEnv(env?.BOOKING_TIMEZONE) || "Europe/London";
	const fromEmail =
		cleanEnv(env?.BOOKING_FROM_EMAIL) ||
		"bookings@personalisedcancercare.com";
	const fromName =
		cleanEnv(env?.BOOKING_FROM_NAME) ||
		"Personalised Cancer Care Bookings";
	const bccEmail = cleanEnv(env?.BOOKING_BCC_EMAIL);

	if (!clientId || !clientSecret || !refreshToken || !calendarId) {
		return null;
	}

	return {
		clientId,
		clientSecret,
		refreshToken,
		calendarId,
		timeZone,
		fromEmail,
		fromName,
		bccEmail,
	};
}

function assertUsableCalendarId(calendarId: string): void {
	if (calendarId.includes("googleusercontent.com") || !calendarId.includes("@")) {
		console.error(
			"Invalid GOOGLE_CALENDAR_ID shape:",
			redactCalendarId(calendarId),
		);
		throw new Error("Booking calendar is misconfigured.");
	}
}

export async function getAccessToken(config: BookingConfig): Promise<string> {
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret,
			refresh_token: config.refreshToken,
			grant_type: "refresh_token",
		}),
	});

	const data = (await response.json()) as {
		access_token?: string;
		error?: string;
		error_description?: string;
	};

	if (!response.ok || !data.access_token) {
		throw new Error(
			data.error_description ||
				data.error ||
				"Could not refresh Google access token",
		);
	}

	return data.access_token;
}

type BusyPeriod = { start: Date; end: Date };

async function fetchBusyPeriods(
	config: BookingConfig,
	accessToken: string,
	timeMin: Date,
	timeMax: Date,
): Promise<BusyPeriod[]> {
	const response = await fetch(
		"https://www.googleapis.com/calendar/v3/freeBusy",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				timeMin: timeMin.toISOString(),
				timeMax: timeMax.toISOString(),
				timeZone: config.timeZone,
				items: [{ id: config.calendarId }],
			}),
		},
	);

	const data = (await response.json()) as {
		error?: { message?: string; code?: number; status?: string };
		calendars?: Record<
			string,
			{
				errors?: { reason?: string; message?: string }[];
				busy?: { start: string; end: string }[];
			}
		>;
	};

	if (!response.ok) {
		console.error("FreeBusy request failed:", data.error, {
			calendar: redactCalendarId(config.calendarId),
		});
		throw new Error("Could not check calendar availability.");
	}

	const calendar = data.calendars?.[config.calendarId];
	if (!calendar) {
		console.error("FreeBusy missing calendar entry:", {
			calendar: redactCalendarId(config.calendarId),
			keys: Object.keys(data.calendars ?? {}),
		});
		throw new Error("Could not check calendar availability.");
	}
	if (calendar.errors?.length) {
		console.error("FreeBusy calendar errors:", calendar.errors, {
			calendar: redactCalendarId(config.calendarId),
		});
		throw new Error("Could not check calendar availability.");
	}

	return (calendar.busy ?? []).map((period) => ({
		start: new Date(period.start),
		end: new Date(period.end),
	}));
}

function overlaps(
	slotStart: Date,
	slotEnd: Date,
	busy: readonly BusyPeriod[],
): boolean {
	return busy.some(
		(period) => slotStart < period.end && slotEnd > period.start,
	);
}

/** Build RFC3339 instant for a wall-clock time in the given IANA timezone. */
function formatDayLabel(dateIso: string, timeZone: string) {
	const noon = zonedDateTimeToUtc(dateIso, 12, 0, timeZone);
	return {
		weekday: noon.toLocaleDateString("en-GB", {
			weekday: "short",
			timeZone,
		}),
		label: noon.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
			timeZone,
		}),
	};
}

function addCalendarDays(iso: string, days: number): string {
	const date = new Date(`${iso}T12:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function isFridayInZone(iso: string, timeZone: string): boolean {
	const weekday = zonedDateTimeToUtc(iso, 12, 0, timeZone).toLocaleDateString(
		"en-US",
		{ weekday: "short", timeZone },
	);
	return weekday === "Fri";
}

function listCandidateDays(timeZone: string, count: number): string[] {
	const days: string[] = [];
	const todayIso = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());

	for (let offset = 1; days.length < count && offset < 60; offset += 1) {
		const iso = addCalendarDays(todayIso, offset);
		if (!isFridayInZone(iso, timeZone)) continue;
		days.push(iso);
	}

	return days;
}

function slotStartsForDay(): { hour: number; minute: number; label: string }[] {
	return BOOKABLE_SLOTS.map((slot) => ({ ...slot }));
}

export async function getAvailableDays(
	config: BookingConfig,
	options?: { excludeEventId?: string },
): Promise<DaySlots[]> {
	assertUsableCalendarId(config.calendarId);
	const accessToken = await getAccessToken(config);
	const dayIsos = listCandidateDays(config.timeZone, AVAILABILITY_FRIDAYS);
	if (dayIsos.length === 0) return [];

	const rangeStart = zonedDateTimeToUtc(
		dayIsos[0],
		CLINIC_OPEN.hour,
		CLINIC_OPEN.minute,
		config.timeZone,
	);
	const lastDay = dayIsos[dayIsos.length - 1];
	const rangeEnd = zonedDateTimeToUtc(
		lastDay,
		CLINIC_CLOSE.hour,
		CLINIC_CLOSE.minute,
		config.timeZone,
	);

	let busy = await fetchBusyPeriods(
		config,
		accessToken,
		rangeStart,
		rangeEnd,
	);
	if (options?.excludeEventId) {
		busy = await withoutExcludedEventBusy(
			config,
			accessToken,
			busy,
			options.excludeEventId,
		);
	}
	const slotTemplate = slotStartsForDay();
	const now = Date.now();

	return dayIsos.map((iso) => {
		const { weekday, label } = formatDayLabel(iso, config.timeZone);
		const times = slotTemplate
			.map((slot) => {
				const start = zonedDateTimeToUtc(
					iso,
					slot.hour,
					slot.minute,
					config.timeZone,
				);
				const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
				if (start.getTime() <= now) return null;
				if (overlaps(start, end, busy)) return null;
				return slot.label;
			})
			.filter((time): time is string => Boolean(time));

		return { iso, label, weekday, times };
	});
}

export async function isSlotAvailable(
	config: BookingConfig,
	dateIso: string,
	timeLabel: string,
	options?: { excludeEventId?: string },
): Promise<boolean> {
	const [hourText, minuteText] = timeLabel.split(":");
	const hour = Number(hourText);
	const minute = Number(minuteText);
	if (Number.isNaN(hour) || Number.isNaN(minute)) return false;

	if (!isFridayInZone(dateIso, config.timeZone)) return false;
	if (!slotStartsForDay().some((slot) => slot.label === timeLabel)) return false;
	if (!listCandidateDays(config.timeZone, AVAILABILITY_FRIDAYS).includes(dateIso)) {
		return false;
	}

	const start = zonedDateTimeToUtc(dateIso, hour, minute, config.timeZone);
	const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
	if (start.getTime() <= Date.now()) return false;

	const accessToken = await getAccessToken(config);
	let busy = await fetchBusyPeriods(config, accessToken, start, end);
	if (options?.excludeEventId) {
		busy = await withoutExcludedEventBusy(
			config,
			accessToken,
			busy,
			options.excludeEventId,
		);
	}
	return !overlaps(start, end, busy);
}

export type CreateBookingInput = {
	dateIso: string;
	timeLabel: string;
	name: string;
	email: string;
	phone: string;
	type: string;
	notes?: string;
	/** Deterministic Google event id ([a-v0-9]+) to prevent duplicate inserts. */
	eventId?: string;
	/** Patient-facing booking reference (generated if omitted). */
	bookingRef?: string;
	paymentMethod?: "self-pay" | "insurance";
	appointmentFormat?: "in-person" | "virtual";
	stripeSessionId?: string;
	stripePaymentIntentId?: string;
	/** Insurance bookings stay tentative until the authorisation code is verified. */
	status?: "confirmed" | "tentative";
	summaryPrefix?: string;
};

export type ManagedBooking = {
	eventId: string;
	bookingRef: string;
	dateIso: string;
	timeLabel: string;
	name: string;
	email: string;
	phone: string;
	type: string;
	status: "confirmed" | "tentative" | "cancelled";
	pendingAuth: boolean;
	paymentMethod: "self-pay" | "insurance" | "unknown";
	appointmentFormat: "in-person" | "virtual" | "unknown";
	meetLink?: string;
	stripeSessionId?: string;
	stripePaymentIntentId?: string;
	icsSequence: number;
};

type CalendarEventPayload = {
	id?: string;
	htmlLink?: string;
	hangoutLink?: string;
	status?: string;
	summary?: string;
	description?: string;
	start?: { dateTime?: string; timeZone?: string };
	end?: { dateTime?: string; timeZone?: string };
	attendees?: { email?: string; displayName?: string }[];
	conferenceData?: {
		entryPoints?: { entryPointType?: string; uri?: string }[];
		createRequest?: { status?: { statusCode?: string } };
	};
	extendedProperties?: {
		private?: Record<string, string>;
	};
	error?: { message?: string; code?: number; errors?: { reason?: string }[] };
};

function extractMeetLink(event: CalendarEventPayload): string | undefined {
	const fromHangout = event.hangoutLink?.trim();
	if (fromHangout) return fromHangout;
	const video = event.conferenceData?.entryPoints?.find(
		(entry) => entry.entryPointType === "video" && entry.uri,
	);
	return video?.uri?.trim() || undefined;
}

function sanitizeCalendarLine(value: string): string {
	return value.replace(/[\r\n]+/g, " ").trim();
}

function sameInstant(a: Date, b: Date): boolean {
	return Math.abs(a.getTime() - b.getTime()) < 2000;
}

async function fetchCalendarEvent(
	config: BookingConfig,
	accessToken: string,
	eventId: string,
): Promise<CalendarEventPayload | null> {
	const response = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);
	if (response.status === 404) return null;
	const data = (await response.json()) as CalendarEventPayload;
	if (!response.ok || !data.id) {
		throw new Error(data.error?.message || "Could not load calendar event");
	}
	return data;
}

/** Ensure Stripe / booking payment fields are stored on the calendar event. */
export async function patchBookingPaymentDetails(
	config: BookingConfig,
	eventId: string,
	input: {
		bookingRef: string;
		email: string;
		paymentMethod?: "self-pay" | "insurance";
		stripeSessionId?: string;
		stripePaymentIntentId?: string;
	},
): Promise<void> {
	const accessToken = await getAccessToken(config);
	const existing = await fetchCalendarEvent(config, accessToken, eventId);
	if (!existing?.id || existing.status === "cancelled") return;

	const privateProps: Record<string, string> = {
		...(existing.extendedProperties?.private ?? {}),
		bookingRef: input.bookingRef,
		patientEmail: input.email.trim().toLowerCase(),
		paymentMethod: input.paymentMethod ?? "self-pay",
	};
	if (input.stripeSessionId?.trim()) {
		privateProps.stripeSessionId = input.stripeSessionId.trim();
	}
	if (input.stripePaymentIntentId?.trim()) {
		privateProps.stripePaymentIntentId = input.stripePaymentIntentId.trim();
	}

	const description = existing.description ?? "";
	// Keep Stripe ids in private props only — not in patient-visible description.
	const cleanedDescription = description
		.split(/\n+/)
		.map((line) => line.trim())
		.filter(
			(line) =>
				line &&
				!/^Stripe session:/i.test(line) &&
				!/^Stripe payment:/i.test(line) &&
				!/^Booked via clinic website\.?$/i.test(line) &&
				!/^Notes:\s*Stripe /i.test(line),
		)
		.join("\n");

	const response = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				description: cleanedDescription,
				extendedProperties: { private: privateProps },
			}),
		},
	);
	if (!response.ok) {
		const data = (await response.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		console.error(
			"Failed to patch booking payment details:",
			data.error?.message || response.status,
		);
	}
}

async function withoutExcludedEventBusy(
	config: BookingConfig,
	accessToken: string,
	busy: BusyPeriod[],
	excludeEventId: string,
): Promise<BusyPeriod[]> {
	const event = await fetchCalendarEvent(config, accessToken, excludeEventId);
	if (!event?.start?.dateTime || !event.end?.dateTime) return busy;
	const excludeStart = new Date(event.start.dateTime);
	const excludeEnd = new Date(event.end.dateTime);
	return busy.filter(
		(period) =>
			!(sameInstant(period.start, excludeStart) && sameInstant(period.end, excludeEnd)),
	);
}

function wallClockFromEvent(
	dateTime: string,
	timeZone: string,
): { dateIso: string; timeLabel: string } | null {
	const date = new Date(dateTime);
	if (Number.isNaN(date.getTime())) return null;
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value;
	const year = get("year");
	const month = get("month");
	const day = get("day");
	const hour = get("hour");
	const minute = get("minute");
	if (!year || !month || !day || !hour || !minute) return null;
	return {
		dateIso: `${year}-${month}-${day}`,
		timeLabel: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
	};
}

function parseDescriptionField(
	description: string | undefined,
	label: string,
): string {
	if (!description) return "";
	const match = description.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
	return match?.[1]?.trim() ?? "";
}

function managedBookingFromEvent(
	event: CalendarEventPayload,
	timeZone: string,
): ManagedBooking | null {
	if (!event.id || event.status === "cancelled") return null;
	const bookingRef = event.extendedProperties?.private?.bookingRef?.trim();
	if (!bookingRef) return null;
	const start = event.start?.dateTime;
	if (!start) return null;
	const wall = wallClockFromEvent(start, timeZone);
	if (!wall) return null;

	const email = (
		event.extendedProperties?.private?.patientEmail ||
		event.attendees?.[0]?.email ||
		parseDescriptionField(event.description, "Email")
	)
		.trim()
		.toLowerCase();
	const name =
		event.attendees?.[0]?.displayName ||
		parseDescriptionField(event.description, "Patient") ||
		"Patient";
	const phone = parseDescriptionField(event.description, "Phone");
	const type =
		parseDescriptionField(event.description, "Consultation type") ||
		event.summary?.replace(/^PENDING AUTH —\s*/i, "").replace(/^Consultation —\s*/i, "") ||
		"Consultation";
	const privateProps = event.extendedProperties?.private ?? {};
	const pendingAuth =
		privateProps.authStatus === "confirmed"
			? false
			: event.status === "tentative" ||
				Boolean(event.summary?.toUpperCase().includes("PENDING AUTH"));
	const stripeFromNotes =
		event.description?.match(/Stripe session:\s*(cs_[a-zA-Z0-9_]+)/i)?.[1] ??
		undefined;
	const paymentIntentFromNotes =
		event.description?.match(/Stripe payment:\s*(pi_[a-zA-Z0-9_]+)/i)?.[1] ??
		undefined;
	const stripeSessionId =
		privateProps.stripeSessionId?.trim() || stripeFromNotes || undefined;
	const stripePaymentIntentId =
		privateProps.stripePaymentIntentId?.trim() ||
		paymentIntentFromNotes ||
		undefined;
	const paymentMethodRaw = privateProps.paymentMethod?.trim();
	const paymentMethod: ManagedBooking["paymentMethod"] =
		paymentMethodRaw === "self-pay" || paymentMethodRaw === "insurance"
			? paymentMethodRaw
			: stripeSessionId || stripePaymentIntentId
				? "self-pay"
				: pendingAuth
					? "insurance"
					: "unknown";
	const formatRaw =
		privateProps.appointmentFormat?.trim() ||
		parseDescriptionField(event.description, "Format").toLowerCase();
	const appointmentFormat: ManagedBooking["appointmentFormat"] =
		formatRaw === "virtual" || formatRaw === "in-person"
			? formatRaw
			: type.toLowerCase().includes("virtual")
				? "virtual"
				: "unknown";
	const meetLink =
		privateProps.meetLink?.trim() ||
		parseDescriptionField(event.description, "Google Meet") ||
		extractMeetLink(event) ||
		undefined;

	return {
		eventId: event.id,
		bookingRef,
		dateIso: wall.dateIso,
		timeLabel: wall.timeLabel,
		name,
		email,
		phone,
		type,
		status: event.status === "tentative" ? "tentative" : "confirmed",
		pendingAuth,
		paymentMethod,
		appointmentFormat,
		meetLink,
		stripeSessionId,
		stripePaymentIntentId,
		icsSequence: Number.parseInt(privateProps.icsSequence ?? "0", 10) || 0,
	};
}

function sanitizePatientVisibleNotes(notes?: string): string | undefined {
	if (!notes?.trim()) return undefined;
	const cleaned = notes
		.split(/\n+/)
		.map((line) => line.trim())
		.filter(
			(line) =>
				line &&
				!/^Stripe session:/i.test(line) &&
				!/^Stripe payment:/i.test(line) &&
				!/^Booked via clinic website\.?$/i.test(line),
		)
		.join("\n")
		.trim();
	return cleaned || undefined;
}

function buildEventDescription(input: {
	name: string;
	email: string;
	phone: string;
	type: string;
	bookingRef: string;
	notes?: string;
	appointmentFormat?: "in-person" | "virtual";
	meetLink?: string;
}): string {
	const notes = sanitizePatientVisibleNotes(input.notes);
	const manageUrl = `https://personalisedcancercare.com/manage-booking`;
	const format =
		input.appointmentFormat === "virtual"
			? "Virtual"
			: input.appointmentFormat === "in-person"
				? "In person"
				: null;
	const location =
		input.appointmentFormat === "virtual"
			? "Virtual consultation (Google Meet)"
			: input.appointmentFormat === "in-person"
				? "HCA UK at University College Hospital — 5th Floor UCH Macmillan Cancer Centre, Huntley Street, London, WC1E 6AG"
				: null;
	return [
		`Booking ref: ${sanitizeCalendarLine(input.bookingRef)}`,
		`Patient: ${sanitizeCalendarLine(input.name)}`,
		`Email: ${sanitizeCalendarLine(input.email)}`,
		`Phone: ${sanitizeCalendarLine(input.phone)}`,
		`Consultation type: ${sanitizeCalendarLine(input.type)}`,
		format ? `Format: ${format}` : null,
		location ? `Location: ${sanitizeCalendarLine(location)}` : null,
		input.meetLink
			? `Google Meet: ${sanitizeCalendarLine(input.meetLink)}`
			: null,
		notes ? `Notes: ${sanitizeCalendarLine(notes)}` : null,
		`To change or cancel, use Manage booking: ${manageUrl} (booking ref ${sanitizeCalendarLine(input.bookingRef)}).`,
	]
		.filter(Boolean)
		.join("\n");
}

async function persistMeetLinkOnEvent(
	config: BookingConfig,
	accessToken: string,
	eventId: string,
	input: {
		name: string;
		email: string;
		phone: string;
		type: string;
		bookingRef: string;
		notes?: string;
		appointmentFormat?: "in-person" | "virtual";
		meetLink: string;
		privateProps: Record<string, string>;
	},
): Promise<CalendarEventPayload | null> {
	const privateProps = {
		...input.privateProps,
		meetLink: input.meetLink,
	};
	const response = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				description: buildEventDescription({
					name: input.name,
					email: input.email,
					phone: input.phone,
					type: input.type,
					bookingRef: input.bookingRef,
					notes: input.notes,
					appointmentFormat: input.appointmentFormat,
					meetLink: input.meetLink,
				}),
				location: input.meetLink,
				extendedProperties: { private: privateProps },
			}),
		},
	);
	const data = (await response.json()) as CalendarEventPayload;
	if (!response.ok || !data.id) {
		console.error(
			"Could not persist Google Meet link on calendar event:",
			data.error?.message,
		);
		return null;
	}
	return data;
}

async function resolveMeetLinkAfterCreate(
	config: BookingConfig,
	accessToken: string,
	event: CalendarEventPayload,
): Promise<string | undefined> {
	let meetLink = extractMeetLink(event);
	if (meetLink) return meetLink;
	if (!event.id) return undefined;
	// Meet links are usually immediate; briefly retry if Google still provisioning.
	await new Promise((resolve) => setTimeout(resolve, 400));
	const refreshed = await fetchCalendarEvent(config, accessToken, event.id);
	return refreshed ? extractMeetLink(refreshed) : undefined;
}

export async function createBookingEvent(
	config: BookingConfig,
	input: CreateBookingInput,
): Promise<{
	eventId: string;
	bookingRef: string;
	htmlLink?: string;
	meetLink?: string;
	alreadyExisted?: boolean;
}> {
	const accessToken = await getAccessToken(config);
	const bookingRef = input.bookingRef?.trim() || generateBookingRef();
	const isVirtual = input.appointmentFormat === "virtual";

	if (input.eventId) {
		const existing = await fetchCalendarEvent(
			config,
			accessToken,
			input.eventId,
		);
		if (existing?.id && existing.status !== "cancelled") {
			const managed = managedBookingFromEvent(existing, config.timeZone);
			return {
				eventId: existing.id,
				bookingRef: managed?.bookingRef || bookingRef,
				htmlLink: existing.htmlLink,
				meetLink: managed?.meetLink,
				alreadyExisted: true,
			};
		}
	}

	const available = await isSlotAvailable(
		config,
		input.dateIso,
		input.timeLabel,
	);
	if (!available) {
		throw new BookingConflictError();
	}

	const [hourText, minuteText] = input.timeLabel.split(":");
	const start = zonedDateTimeToUtc(
		input.dateIso,
		Number(hourText),
		Number(minuteText),
		config.timeZone,
	);
	const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
	const email = input.email.trim().toLowerCase();
	const paymentMethod =
		input.paymentMethod ??
		(input.status === "tentative" ? "insurance" : "self-pay");
	const privateProps: Record<string, string> = {
		bookingRef,
		patientEmail: email,
		paymentMethod,
		icsSequence: "0",
	};
	if (
		input.appointmentFormat === "virtual" ||
		input.appointmentFormat === "in-person"
	) {
		privateProps.appointmentFormat = input.appointmentFormat;
	}
	if (input.stripeSessionId?.trim()) {
		privateProps.stripeSessionId = input.stripeSessionId.trim();
	}
	if (input.stripePaymentIntentId?.trim()) {
		privateProps.stripePaymentIntentId = input.stripePaymentIntentId.trim();
	}

	const createQuery = new URLSearchParams({ sendUpdates: "none" });
	if (isVirtual) {
		createQuery.set("conferenceDataVersion", "1");
	}

	// Clinic diary only — patients are notified via branded email + ICS (no Google
	// guest invite, so Gmail does not show Propose a new time).
	const response = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?${createQuery}`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				...(input.eventId ? { id: input.eventId } : {}),
				summary: `${input.summaryPrefix ?? ""}${input.summaryPrefix ? " " : ""}Consultation — ${input.type}`.trim(),
				description: buildEventDescription({
					name: input.name,
					email,
					phone: input.phone,
					type: input.type,
					bookingRef,
					notes: input.notes,
					appointmentFormat: input.appointmentFormat,
				}),
				location:
					input.appointmentFormat === "virtual"
						? "Virtual consultation (Google Meet)"
						: input.appointmentFormat === "in-person"
							? "HCA UK at University College Hospital, 5th Floor UCH Macmillan Cancer Centre, Huntley Street, London, WC1E 6AG"
							: undefined,
				status: input.status === "tentative" ? "tentative" : "confirmed",
				...(paymentMethod === "insurance" && input.status === "tentative"
					? { colorId: CALENDAR_COLOR_PENDING }
					: paymentMethod === "self-pay"
						? { colorId: CALENDAR_COLOR_CONFIRMED }
						: {}),
				start: {
					dateTime: start.toISOString(),
					timeZone: config.timeZone,
				},
				end: {
					dateTime: end.toISOString(),
					timeZone: config.timeZone,
				},
				extendedProperties: {
					private: privateProps,
				},
				transparency: "opaque",
				...(isVirtual
					? {
							conferenceData: {
								createRequest: {
									requestId: `meet-${bookingRef.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`,
									conferenceSolutionKey: { type: "hangoutsMeet" },
								},
							},
						}
					: {}),
			}),
		},
	);

	const data = (await response.json()) as CalendarEventPayload;

	if (response.status === 409 || data.error?.errors?.[0]?.reason === "duplicate") {
		if (input.eventId) {
			const existing = await fetchCalendarEvent(
				config,
				accessToken,
				input.eventId,
			);
			const managed = existing
				? managedBookingFromEvent(existing, config.timeZone)
				: null;
			return {
				eventId: input.eventId,
				bookingRef: managed?.bookingRef || bookingRef,
				meetLink: managed?.meetLink,
				alreadyExisted: true,
			};
		}
		throw new BookingConflictError();
	}

	if (!response.ok || !data.id) {
		throw new Error(data.error?.message || "Could not create calendar event");
	}

	let meetLink: string | undefined;
	if (isVirtual) {
		meetLink = await resolveMeetLinkAfterCreate(config, accessToken, data);
		if (meetLink) {
			await persistMeetLinkOnEvent(config, accessToken, data.id, {
				name: input.name,
				email,
				phone: input.phone,
				type: input.type,
				bookingRef,
				notes: input.notes,
				appointmentFormat: input.appointmentFormat,
				meetLink,
				privateProps,
			});
		} else {
			console.error(
				"Virtual booking created without a Google Meet link:",
				data.id,
			);
		}
	}

	return {
		eventId: data.id,
		bookingRef,
		htmlLink: data.htmlLink,
		meetLink,
		alreadyExisted: false,
	};
}

async function listEventsByBookingRef(
	config: BookingConfig,
	accessToken: string,
	bookingRef: string,
	patientEmail?: string,
): Promise<CalendarEventPayload[]> {
	const timeMin = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
	const timeMax = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
	const params = new URLSearchParams({
		singleEvents: "true",
		showDeleted: "false",
		orderBy: "startTime",
		maxResults: "25",
		timeMin,
		timeMax,
	});
	// Calendar API accepts repeated privateExtendedProperty as AND filters.
	params.append("privateExtendedProperty", `bookingRef=${bookingRef}`);
	if (patientEmail) {
		params.append(
			"privateExtendedProperty",
			`patientEmail=${patientEmail.trim().toLowerCase()}`,
		);
	}

	const response = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?${params}`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);
	const data = (await response.json()) as {
		items?: CalendarEventPayload[];
		error?: { message?: string };
	};
	if (!response.ok) {
		throw new Error(data.error?.message || "Could not look up booking");
	}
	return data.items ?? [];
}

/** Remove leftover events from older create+delete reschedules (same booking ref). */
async function deleteSiblingBookingEvents(
	config: BookingConfig,
	accessToken: string,
	bookingRef: string,
	keepEventId: string,
): Promise<void> {
	const items = await listEventsByBookingRef(config, accessToken, bookingRef);
	for (const item of items) {
		if (!item.id || item.id === keepEventId || item.status === "cancelled") {
			continue;
		}
		const response = await fetch(
			`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(item.id)}?sendUpdates=none`,
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		if (!response.ok && response.status !== 410) {
			console.error(
				"Failed to delete sibling booking event:",
				item.id,
				await response.text().catch(() => ""),
			);
		}
	}
}

export async function findBookingByEmailAndRef(
	config: BookingConfig,
	email: string,
	bookingRefRaw: string,
): Promise<ManagedBooking | null> {
	assertUsableCalendarId(config.calendarId);
	const bookingRef = normalizeBookingRef(bookingRefRaw);
	if (!isValidBookingRef(bookingRef)) return null;

	const patientEmail = email.trim().toLowerCase();
	const accessToken = await getAccessToken(config);
	const items = await listEventsByBookingRef(
		config,
		accessToken,
		bookingRef,
		patientEmail,
	);

	const matches: ManagedBooking[] = [];
	for (const item of items) {
		const listed = managedBookingFromEvent(item, config.timeZone);
		if (!listed) continue;
		if (listed.email !== patientEmail) continue;
		if (normalizeBookingRef(listed.bookingRef) !== bookingRef) continue;
		const full = await fetchCalendarEvent(config, accessToken, listed.eventId);
		const managed = full
			? managedBookingFromEvent(full, config.timeZone)
			: listed;
		if (!managed) continue;
		if (managed.email !== patientEmail) continue;
		// Re-check after full fetch — list payloads can be incomplete/stale.
		if (normalizeBookingRef(managed.bookingRef) !== bookingRef) continue;
		matches.push(managed);
	}

	if (matches.length === 0) return null;
	// Prefer the later slot, then remove any leftover duplicates from old reschedules.
	matches.sort((a, b) =>
		`${b.dateIso}T${b.timeLabel}`.localeCompare(`${a.dateIso}T${a.timeLabel}`),
	);
	const preferred = matches[0];
	if (matches.length > 1) {
		await deleteSiblingBookingEvents(
			config,
			accessToken,
			bookingRef,
			preferred.eventId,
		);
	}
	return preferred;
}

export async function cancelBookingEvent(
	config: BookingConfig,
	input: { eventId: string; email: string; bookingRef: string },
): Promise<ManagedBooking> {
	const accessToken = await getAccessToken(config);
	const existing = await fetchCalendarEvent(config, accessToken, input.eventId);
	if (!existing) {
		throw new Error("Booking not found.");
	}
	const managed = managedBookingFromEvent(existing, config.timeZone);
	if (
		!managed ||
		managed.email !== input.email.trim().toLowerCase() ||
		managed.bookingRef !== normalizeBookingRef(input.bookingRef)
	) {
		throw new Error("Booking not found.");
	}

	const response = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(input.eventId)}?sendUpdates=none`,
		{
			method: "DELETE",
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);

	if (!response.ok && response.status !== 410) {
		const data = (await response.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		throw new Error(data.error?.message || "Could not cancel booking");
	}

	return { ...managed, status: "cancelled" };
}

export async function rescheduleBookingEvent(
	config: BookingConfig,
	input: {
		eventId: string;
		email: string;
		bookingRef: string;
		dateIso: string;
		timeLabel: string;
	},
): Promise<ManagedBooking> {
	const accessToken = await getAccessToken(config);
	const existing = await fetchCalendarEvent(config, accessToken, input.eventId);
	if (!existing) {
		throw new Error("Booking not found.");
	}
	const managed = managedBookingFromEvent(existing, config.timeZone);
	if (
		!managed ||
		managed.email !== input.email.trim().toLowerCase() ||
		managed.bookingRef !== normalizeBookingRef(input.bookingRef)
	) {
		throw new Error("Booking not found.");
	}

	if (
		managed.dateIso === input.dateIso &&
		managed.timeLabel === input.timeLabel
	) {
		return managed;
	}

	const available = await isSlotAvailable(
		config,
		input.dateIso,
		input.timeLabel,
		{ excludeEventId: input.eventId },
	);
	if (!available) {
		throw new BookingConflictError();
	}

	const [hourRaw, minuteRaw] = input.timeLabel.split(":");
	const hour = Number(hourRaw);
	const minute = Number(minuteRaw);
	if (Number.isNaN(hour) || Number.isNaN(minute)) {
		throw new Error("Invalid time selected.");
	}
	const start = zonedDateTimeToUtc(
		input.dateIso,
		hour,
		minute,
		config.timeZone,
	);
	const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
	const paymentMethod =
		managed.paymentMethod === "unknown"
			? managed.pendingAuth
				? "insurance"
				: "self-pay"
			: managed.paymentMethod;
	const nextSequence = managed.icsSequence + 2;
	const privateProps: Record<string, string> = {
		...(existing.extendedProperties?.private ?? {}),
		bookingRef: managed.bookingRef,
		patientEmail: managed.email,
		paymentMethod,
		icsSequence: String(nextSequence),
	};
	if (
		managed.appointmentFormat === "virtual" ||
		managed.appointmentFormat === "in-person"
	) {
		privateProps.appointmentFormat = managed.appointmentFormat;
	}
	if (managed.meetLink) {
		privateProps.meetLink = managed.meetLink;
	}
	if (managed.stripeSessionId) {
		privateProps.stripeSessionId = managed.stripeSessionId;
	}
	if (managed.stripePaymentIntentId) {
		privateProps.stripePaymentIntentId = managed.stripePaymentIntentId;
	}

	// Move the same clinic event in place (patient notified via branded email + ICS).
	const cleanedDescription = buildEventDescription({
		name: managed.name,
		email: managed.email,
		phone: managed.phone || "Not provided",
		type: managed.type,
		bookingRef: managed.bookingRef,
		appointmentFormat:
			managed.appointmentFormat === "unknown"
				? undefined
				: managed.appointmentFormat,
		meetLink: managed.meetLink,
		notes: sanitizePatientVisibleNotes(
			parseDescriptionField(existing.description, "Notes") ||
				existing.description
					?.split(/\n+/)
					.filter(
						(line) =>
							!/^(Booking ref|Patient|Email|Phone|Consultation type|Format|Location|Google Meet|Notes):/i.test(
								line.trim(),
							) &&
							!/^Stripe (session|payment):/i.test(line.trim()) &&
							!/^Booked via clinic website\.?$/i.test(line.trim()) &&
							!/^To change or cancel,/i.test(line.trim()),
					)
					.join("\n"),
		),
	});

	const patchResponse = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(input.eventId)}?sendUpdates=none`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				start: {
					dateTime: start.toISOString(),
					timeZone: config.timeZone,
				},
				end: {
					dateTime: end.toISOString(),
					timeZone: config.timeZone,
				},
				description: cleanedDescription,
				location:
					managed.meetLink ||
					(managed.appointmentFormat === "virtual"
						? "Virtual consultation (Google Meet)"
						: managed.appointmentFormat === "in-person"
							? "HCA UK at University College Hospital, 5th Floor UCH Macmillan Cancer Centre, Huntley Street, London, WC1E 6AG"
							: undefined),
				extendedProperties: { private: privateProps },
				// Clear any legacy Google guest invites.
				attendees: [],
			}),
		},
	);
	const patched = (await patchResponse.json()) as CalendarEventPayload;
	if (!patchResponse.ok || !patched.id) {
		throw new Error(patched.error?.message || "Could not reschedule booking");
	}

	await deleteSiblingBookingEvents(
		config,
		accessToken,
		managed.bookingRef,
		input.eventId,
	);

	const updated = managedBookingFromEvent(patched, config.timeZone);
	if (!updated) {
		throw new Error("Could not reschedule booking");
	}
	return {
		...updated,
		icsSequence: nextSequence,
	};
}

/**
 * Staff action: mark a pending insurance booking as authorisation-confirmed.
 * Updates the clinic calendar colour/title/status (patient email is sent separately).
 */
export async function confirmInsuranceBookingEvent(
	config: BookingConfig,
	input: { eventId: string; bookingRef: string },
): Promise<ManagedBooking> {
	const accessToken = await getAccessToken(config);
	const existing = await fetchCalendarEvent(config, accessToken, input.eventId);
	if (!existing) {
		throw new Error("Booking not found.");
	}
	const managed = managedBookingFromEvent(existing, config.timeZone);
	if (
		!managed ||
		normalizeBookingRef(managed.bookingRef) !==
			normalizeBookingRef(input.bookingRef)
	) {
		throw new Error("Booking not found.");
	}
	if (!managed.pendingAuth && managed.paymentMethod !== "insurance") {
		return managed;
	}
	if (!managed.pendingAuth) {
		return managed;
	}

	const summary = (
		existing.summary || `Consultation — ${managed.type}`
	).replace(/^PENDING AUTH —\s*/i, "");
	const nextSequence = managed.icsSequence + 1;
	const privateProps: Record<string, string> = {
		...(existing.extendedProperties?.private ?? {}),
		bookingRef: managed.bookingRef,
		patientEmail: managed.email,
		paymentMethod: "insurance",
		icsSequence: String(nextSequence),
		authStatus: "confirmed",
	};
	if (
		managed.appointmentFormat === "virtual" ||
		managed.appointmentFormat === "in-person"
	) {
		privateProps.appointmentFormat = managed.appointmentFormat;
	}

	let description = (existing.description ?? "")
		.replace(
			/^Notes:\s*STATUS:\s*PENDING[^\n]*/im,
			"Notes: STATUS: CONFIRMED — insurer authorisation verified",
		)
		.replace(
			/STATUS:\s*PENDING\s*—\s*do not see patient until authorisation code is verified/i,
			"STATUS: CONFIRMED — insurer authorisation verified",
		);

	const needsMeet =
		managed.appointmentFormat === "virtual" && !managed.meetLink;
	const confirmQuery = new URLSearchParams({ sendUpdates: "none" });
	if (needsMeet) {
		confirmQuery.set("conferenceDataVersion", "1");
	}

	const response = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(input.eventId)}?${confirmQuery}`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				summary,
				description,
				status: "confirmed",
				colorId: CALENDAR_COLOR_CONFIRMED,
				attendees: [],
				extendedProperties: { private: privateProps },
				...(needsMeet
					? {
							conferenceData: {
								createRequest: {
									requestId: `meet-${managed.bookingRef.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`,
									conferenceSolutionKey: { type: "hangoutsMeet" },
								},
							},
						}
					: {}),
			}),
		},
	);
	const data = (await response.json()) as CalendarEventPayload;
	if (!response.ok || !data.id) {
		throw new Error(data.error?.message || "Could not confirm booking");
	}

	let meetLink = managed.meetLink || extractMeetLink(data);
	if (needsMeet && !meetLink) {
		meetLink = await resolveMeetLinkAfterCreate(config, accessToken, data);
	}
	if (meetLink && meetLink !== managed.meetLink) {
		privateProps.meetLink = meetLink;
		const withMeet = await persistMeetLinkOnEvent(
			config,
			accessToken,
			data.id,
			{
				name: managed.name,
				email: managed.email,
				phone: managed.phone || "Not provided",
				type: managed.type,
				bookingRef: managed.bookingRef,
				appointmentFormat:
					managed.appointmentFormat === "unknown"
						? undefined
						: managed.appointmentFormat,
				meetLink,
				privateProps,
				notes: sanitizePatientVisibleNotes(
					parseDescriptionField(description, "Notes") || undefined,
				),
			},
		);
		if (withMeet) {
			const updated = managedBookingFromEvent(withMeet, config.timeZone);
			if (updated) {
				return {
					...updated,
					pendingAuth: false,
					status: "confirmed",
					meetLink,
					icsSequence: nextSequence,
				};
			}
		}
	} else if (meetLink) {
		privateProps.meetLink = meetLink;
	}

	const updated = managedBookingFromEvent(data, config.timeZone);
	if (!updated) {
		throw new Error("Could not confirm booking");
	}
	return {
		...updated,
		pendingAuth: false,
		status: "confirmed",
		meetLink: meetLink || updated.meetLink,
		icsSequence: nextSequence,
	};
}

export async function findBookingByRef(
	config: BookingConfig,
	bookingRefRaw: string,
): Promise<ManagedBooking | null> {
	assertUsableCalendarId(config.calendarId);
	const bookingRef = normalizeBookingRef(bookingRefRaw);
	if (!isValidBookingRef(bookingRef)) return null;

	const accessToken = await getAccessToken(config);
	const items = await listEventsByBookingRef(config, accessToken, bookingRef);
	const matches: ManagedBooking[] = [];
	for (const item of items) {
		const listed = managedBookingFromEvent(item, config.timeZone);
		if (!listed) continue;
		if (normalizeBookingRef(listed.bookingRef) !== bookingRef) continue;
		const full = await fetchCalendarEvent(config, accessToken, listed.eventId);
		const managed = full
			? managedBookingFromEvent(full, config.timeZone)
			: listed;
		if (!managed) continue;
		if (normalizeBookingRef(managed.bookingRef) !== bookingRef) continue;
		matches.push(managed);
	}
	if (matches.length === 0) return null;
	matches.sort((a, b) =>
		`${b.dateIso}T${b.timeLabel}`.localeCompare(`${a.dateIso}T${a.timeLabel}`),
	);
	return matches[0];
}

export class BookingConflictError extends Error {
	constructor() {
		super("That time was just taken. Please choose another slot.");
		this.name = "BookingConflictError";
	}
}
