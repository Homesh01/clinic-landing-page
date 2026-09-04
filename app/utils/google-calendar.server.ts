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

const CLINIC_OPEN = { hour: 9, minute: 0 };
const CLINIC_CLOSE = { hour: 16, minute: 0 };
const SLOT_MINUTES = 60;
const AVAILABILITY_WEEKDAYS = 14;

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

function isWeekendInZone(iso: string, timeZone: string): boolean {
	const weekday = zonedDateTimeToUtc(iso, 12, 0, timeZone).toLocaleDateString(
		"en-US",
		{ weekday: "short", timeZone },
	);
	return weekday === "Sat" || weekday === "Sun";
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
		if (isWeekendInZone(iso, timeZone)) continue;
		days.push(iso);
	}

	return days;
}

function slotStartsForDay(): { hour: number; minute: number; label: string }[] {
	const slots: { hour: number; minute: number; label: string }[] = [];
	let minutes = CLINIC_OPEN.hour * 60 + CLINIC_OPEN.minute;
	const closeMinutes = CLINIC_CLOSE.hour * 60 + CLINIC_CLOSE.minute;

	while (minutes + SLOT_MINUTES <= closeMinutes) {
		const hour = Math.floor(minutes / 60);
		const minute = minutes % 60;
		slots.push({
			hour,
			minute,
			label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
		});
		minutes += SLOT_MINUTES;
	}

	return slots;
}

export async function getAvailableDays(
	config: BookingConfig,
): Promise<DaySlots[]> {
	assertUsableCalendarId(config.calendarId);
	const accessToken = await getAccessToken(config);
	const dayIsos = listCandidateDays(config.timeZone, AVAILABILITY_WEEKDAYS);
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

	const busy = await fetchBusyPeriods(
		config,
		accessToken,
		rangeStart,
		rangeEnd,
	);
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
): Promise<boolean> {
	const [hourText, minuteText] = timeLabel.split(":");
	const hour = Number(hourText);
	const minute = Number(minuteText);
	if (Number.isNaN(hour) || Number.isNaN(minute)) return false;

	if (isWeekendInZone(dateIso, config.timeZone)) return false;
	if (!slotStartsForDay().some((slot) => slot.label === timeLabel)) return false;
	if (!listCandidateDays(config.timeZone, AVAILABILITY_WEEKDAYS).includes(dateIso)) {
		return false;
	}

	const start = zonedDateTimeToUtc(dateIso, hour, minute, config.timeZone);
	const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
	if (start.getTime() <= Date.now()) return false;

	const accessToken = await getAccessToken(config);
	const busy = await fetchBusyPeriods(config, accessToken, start, end);
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
};

function sanitizeCalendarLine(value: string): string {
	return value.replace(/[\r\n]+/g, " ").trim();
}

export async function createBookingEvent(
	config: BookingConfig,
	input: CreateBookingInput,
): Promise<{ eventId: string; htmlLink?: string }> {
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
	const accessToken = await getAccessToken(config);

	const description = [
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

	const response = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?sendUpdates=none`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				summary: `Consultation — ${input.type}`,
				description,
				start: {
					dateTime: start.toISOString(),
					timeZone: config.timeZone,
				},
				end: {
					dateTime: end.toISOString(),
					timeZone: config.timeZone,
				},
				// Patient is a guest so Google can email them if the event is
				// cancelled/deleted from Calendar. sendUpdates=none avoids a
				// Google invite on create (we send our own confirmation email).
				attendees: [{ email: input.email, displayName: input.name }],
				guestsCanInviteOthers: false,
				guestsCanModify: false,
				guestsCanSeeOtherGuests: false,
				transparency: "opaque",
			}),
		},
	);

	const data = (await response.json()) as {
		id?: string;
		htmlLink?: string;
		error?: { message?: string };
	};

	if (!response.ok || !data.id) {
		throw new Error(data.error?.message || "Could not create calendar event");
	}

	return { eventId: data.id, htmlLink: data.htmlLink };
}

export class BookingConflictError extends Error {
	constructor() {
		super("That time was just taken. Please choose another slot.");
		this.name = "BookingConflictError";
	}
}
