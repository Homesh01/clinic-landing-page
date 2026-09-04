import type { BookingConfig } from "~/utils/google-calendar.server";
import {
	getAccessToken,
	zonedDateTimeToUtc,
} from "~/utils/google-calendar.server";
import { site } from "~/data/content";

export type BookingEmailInput = {
	dateIso: string;
	timeLabel: string;
	name: string;
	email: string;
	phone: string;
	type: string;
	notes?: string;
};

const SLOT_MINUTES = 60;
const MIME_BOUNDARY = "clinic_booking_boundary_7f3a9c";

function toBase64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toBase64(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function formatAppointmentDate(dateIso: string, timeZone: string): string {
	const [year, month, day] = dateIso.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day, 12));
	return new Intl.DateTimeFormat("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone,
	}).format(date);
}

function formatFromHeader(fromEmail: string, fromName?: string): string {
	if (!fromName) return fromEmail;
	const escaped = fromName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	return `"${escaped}" <${fromEmail}>`;
}

function escapeIcsText(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r\n|\n|\r/g, "\\n");
}

function formatIcsUtc(date: Date): string {
	return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildIcsAttachment(input: {
	uid: string;
	title: string;
	description: string;
	start: Date;
	end: Date;
	organizerEmail: string;
	organizerName: string;
}): string {
	const stamp = formatIcsUtc(new Date());
	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Dr Karen Sayal Clinic//Booking//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"BEGIN:VEVENT",
		`UID:${input.uid}`,
		`DTSTAMP:${stamp}`,
		`DTSTART:${formatIcsUtc(input.start)}`,
		`DTEND:${formatIcsUtc(input.end)}`,
		`SUMMARY:${escapeIcsText(input.title)}`,
		`DESCRIPTION:${escapeIcsText(input.description)}`,
		`ORGANIZER;CN=${escapeIcsText(input.organizerName)}:mailto:${input.organizerEmail}`,
		"STATUS:CONFIRMED",
		"SEQUENCE:0",
		"END:VEVENT",
		"END:VCALENDAR",
		"",
	].join("\r\n");
}

function buildMimeMessage(input: {
	to: string;
	from?: string;
	replyTo?: string;
	bcc?: string;
	subject: string;
	text: string;
	icsFilename: string;
	icsContent: string;
}): string {
	const icsBase64 = toBase64(input.icsContent).replace(/(.{76})/g, "$1\r\n");

	return [
		...(input.from ? [`From: ${input.from}`] : []),
		`To: ${input.to}`,
		...(input.replyTo ? [`Reply-To: ${input.replyTo}`] : []),
		...(input.bcc ? [`Bcc: ${input.bcc}`] : []),
		`Subject: ${input.subject}`,
		"MIME-Version: 1.0",
		`Content-Type: multipart/mixed; boundary="${MIME_BOUNDARY}"`,
		"",
		`--${MIME_BOUNDARY}`,
		'Content-Type: text/plain; charset="UTF-8"',
		"Content-Transfer-Encoding: 7bit",
		"",
		input.text,
		"",
		`--${MIME_BOUNDARY}`,
		'Content-Type: text/calendar; method=PUBLISH; charset="UTF-8"; name="appointment.ics"',
		"Content-Transfer-Encoding: base64",
		`Content-Disposition: attachment; filename="${input.icsFilename}"`,
		"",
		icsBase64,
		`--${MIME_BOUNDARY}--`,
		"",
	].join("\r\n");
}

async function gmailSend(
	accessToken: string,
	raw: string,
): Promise<{ id: string }> {
	const response = await fetch(
		"https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ raw }),
		},
	);

	const data = (await response.json()) as {
		id?: string;
		error?: { message?: string };
	};

	if (!response.ok || !data.id) {
		throw new Error(
			data.error?.message || "Could not send confirmation email",
		);
	}

	return { id: data.id };
}

export async function sendPatientBookingConfirmation(
	config: BookingConfig,
	input: BookingEmailInput,
): Promise<void> {
	const accessToken = await getAccessToken(config);
	const [hourText, minuteText] = input.timeLabel.split(":");
	const start = zonedDateTimeToUtc(
		input.dateIso,
		Number(hourText),
		Number(minuteText),
		config.timeZone,
	);
	const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
	const when = formatAppointmentDate(input.dateIso, config.timeZone);
	const title = `Consultation with ${site.name}`;
	const details = [
		`Consultation type: ${input.type}`,
		`Phone: ${input.phone}`,
		input.notes?.trim() ? `Notes: ${input.notes.trim()}` : null,
	]
		.filter(Boolean)
		.join("\n");

	const fromName = config.fromName || `${site.name} bookings`;
	const organizerEmail =
		config.fromEmail || "bookings@personalisedcancercare.com";

	// Keep the body short and avoid long tracking-style URLs (spam trigger).
	const subject = `${site.name}: consultation confirmed`;
	const text = [
		`Dear ${input.name},`,
		"",
		`Your consultation with ${site.name} is confirmed.`,
		"",
		`Date: ${when}`,
		`Time: ${input.timeLabel} (UK time)`,
		`Type: ${input.type}`,
		"",
		"A calendar file is attached (appointment.ics). Open it to add this appointment to your calendar.",
		"",
		"To change or cancel, reply to this email.",
		"",
		"Kind regards,",
		fromName,
	].join("\n");

	const icsContent = buildIcsAttachment({
		uid: `booking-${input.dateIso}-${input.timeLabel.replace(":", "")}-${Date.now()}@personalisedcancercare.com`,
		title,
		description: details,
		start,
		end,
		organizerEmail,
		organizerName: fromName,
	});

	const baseMime = {
		to: input.email,
		replyTo: config.fromEmail,
		bcc: config.bccEmail,
		subject,
		text,
		icsFilename: "appointment.ics",
		icsContent,
	};

	try {
		if (!config.fromEmail) {
			throw new Error("BOOKING_FROM_EMAIL not set");
		}
		await gmailSend(
			accessToken,
			toBase64Url(
				buildMimeMessage({
					...baseMime,
					from: formatFromHeader(config.fromEmail, fromName),
				}),
			),
		);
	} catch (error) {
		console.error(
			"Booking email with custom From failed; retrying as account default:",
			error,
		);
		await gmailSend(
			accessToken,
			toBase64Url(
				buildMimeMessage({
					...baseMime,
					from: undefined,
				}),
			),
		);
	}
}
