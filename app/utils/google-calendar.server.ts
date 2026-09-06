import {
	generateBookingRef,
	isValidBookingRef,
	normalizeBookingRef,
} from "~/utils/booking-ref";

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
	const fromEmail = cleanEnv(env?.BOOKING_FROM_EMAIL);
	const fromName = cleanEnv(env?.BOOKING_FROM_NAME);
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
export function zonedDateTimeToUtc(
	dateIso: string,
	hours: number,
	minutes: number,
	timeZone: string,
): Date {
	const utcGuess = new Date(
		Date.UTC(
			Number(dateIso.slice(0, 4)),
			Number(dateIso.slice(5, 7)) - 1,
			Number(dateIso.slice(8, 10)),
			hours,
			minutes,
			0,
		),
	);

	const asLocal = new Date(
		utcGuess.toLocaleString("en-US", { timeZone }),
	);
	const asUtc = new Date(
		utcGuess.toLocaleString("en-US", { timeZone: "UTC" }),
	);
	const offsetMs = asUtc.getTime() - asLocal.getTime();

	return new Date(utcGuess.getTime() + offsetMs);
}

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
	stripeSessionId?: string;
	/** Insurance bookings stay tentative until the authorisation code is verified. */
	status?: "confirmed" | "tentative";
	summaryPrefix?: string;
};

/** Full self-pay refund if cancelled at least this many days before the appointment. */
export const SELF_PAY_REFUND_MIN_DAYS = 5;

export function isSelfPayRefundEligible(
	dateIso: string,
	timeLabel: string,
	timeZone: string,
	now: Date = new Date(),
): boolean {
	const [hourText, minuteText] = timeLabel.split(":");
	const hour = Number(hourText);
	const minute = Number(minuteText);
	if (Number.isNaN(hour) || Number.isNaN(minute)) return false;
	const start = zonedDateTimeToUtc(dateIso, hour, minute, timeZone);
	const minMs = SELF_PAY_REFUND_MIN_DAYS * 24 * 60 * 60 * 1000;
	return start.getTime() - now.getTime() >= minMs;
}

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
	stripeSessionId?: string;
};

type CalendarEventPayload = {
	id?: string;
	htmlLink?: string;
	status?: string;
	summary?: string;
	description?: string;
	start?: { dateTime?: string; timeZone?: string };
	end?: { dateTime?: string; timeZone?: string };
	attendees?: { email?: string; displayName?: string }[];
	extendedProperties?: {
		private?: Record<string, string>;
	};
	error?: { message?: string; code?: number; errors?: { reason?: string }[] };
};

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
	const pendingAuth =
		event.status === "tentative" ||
		Boolean(event.summary?.toUpperCase().includes("PENDING AUTH"));
	const privateProps = event.extendedProperties?.private ?? {};
	const stripeFromNotes =
		event.description?.match(/Stripe session:\s*(cs_[\w]+)/i)?.[1] ??
		undefined;
	const stripeSessionId =
		privateProps.stripeSessionId?.trim() || stripeFromNotes || undefined;
	const paymentMethodRaw = privateProps.paymentMethod?.trim();
	const paymentMethod: ManagedBooking["paymentMethod"] =
		paymentMethodRaw === "self-pay" || paymentMethodRaw === "insurance"
			? paymentMethodRaw
			: stripeSessionId
				? "self-pay"
				: pendingAuth
					? "insurance"
					: "unknown";

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
		stripeSessionId,
	};
}

function buildEventDescription(input: {
	name: string;
	email: string;
	phone: string;
	type: string;
	bookingRef: string;
	notes?: string;
}): string {
	return [
		`Booking ref: ${sanitizeCalendarLine(input.bookingRef)}`,
		`Patient: ${sanitizeCalendarLine(input.name)}`,
		`Email: ${sanitizeCalendarLine(input.email)}`,
		`Phone: ${sanitizeCalendarLine(input.phone)}`,
		`Consultation type: ${sanitizeCalendarLine(input.type)}`,
		input.notes?.trim()
			? `Notes: ${sanitizeCalendarLine(input.notes.trim())}`
			: null,
		"",
		"Booked via clinic website.",
	]
		.filter(Boolean)
		.join("\n");
}

export async function createBookingEvent(
	config: BookingConfig,
	input: CreateBookingInput,
): Promise<{
	eventId: string;
	bookingRef: string;
	htmlLink?: string;
	alreadyExisted?: boolean;
}> {
	const accessToken = await getAccessToken(config);
	const bookingRef = input.bookingRef?.trim() || generateBookingRef();

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
	};
	if (input.stripeSessionId?.trim()) {
		privateProps.stripeSessionId = input.stripeSessionId.trim();
	}

	const response = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?sendUpdates=none`,
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
				}),
				status: input.status === "tentative" ? "tentative" : "confirmed",
				start: {
					dateTime: start.toISOString(),
					timeZone: config.timeZone,
				},
				end: {
					dateTime: end.toISOString(),
					timeZone: config.timeZone,
				},
				// Do not invite the patient as an attendee — that can auto-add
				// the clinic event to their Gmail calendar and conflict with the .ics.
				extendedProperties: {
					private: privateProps,
				},
				transparency: "opaque",
			}),
		},
	);

	const data = (await response.json()) as CalendarEventPayload;

	if (response.status === 409 || data.error?.errors?.[0]?.reason === "duplicate") {
		if (input.eventId) {
			return { eventId: input.eventId, bookingRef, alreadyExisted: true };
		}
		throw new BookingConflictError();
	}

	if (!response.ok || !data.id) {
		throw new Error(data.error?.message || "Could not create calendar event");
	}

	return {
		eventId: data.id,
		bookingRef,
		htmlLink: data.htmlLink,
		alreadyExisted: false,
	};
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
	const timeMin = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
	const timeMax = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();

	const params = new URLSearchParams({
		singleEvents: "true",
		showDeleted: "false",
		orderBy: "startTime",
		maxResults: "10",
		timeMin,
		timeMax,
		privateExtendedProperty: `bookingRef=${bookingRef}`,
	});

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

	for (const item of data.items ?? []) {
		const managed = managedBookingFromEvent(item, config.timeZone);
		if (!managed) continue;
		if (managed.email !== patientEmail) continue;
		if (managed.bookingRef !== bookingRef) continue;
		return managed;
	}

	return null;
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

	const [hourText, minuteText] = input.timeLabel.split(":");
	const start = zonedDateTimeToUtc(
		input.dateIso,
		Number(hourText),
		Number(minuteText),
		config.timeZone,
	);
	const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);

	const response = await fetch(
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
				extendedProperties: {
					private: {
						bookingRef: managed.bookingRef,
						patientEmail: managed.email,
						paymentMethod:
							managed.paymentMethod === "unknown"
								? "self-pay"
								: managed.paymentMethod,
						...(managed.stripeSessionId
							? { stripeSessionId: managed.stripeSessionId }
							: {}),
					},
				},
			}),
		},
	);

	const data = (await response.json()) as CalendarEventPayload;
	if (!response.ok || !data.id) {
		throw new Error(data.error?.message || "Could not reschedule booking");
	}

	const updated = managedBookingFromEvent(data, config.timeZone);
	if (!updated) {
		throw new Error("Could not reschedule booking");
	}
	return updated;
}

export class BookingConflictError extends Error {
	constructor() {
		super("That time was just taken. Please choose another slot.");
		this.name = "BookingConflictError";
	}
}
