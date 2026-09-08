import type { BookingConfig } from "~/utils/google-calendar.server";
import { getAccessToken } from "~/utils/google-calendar.server";
import { zonedDateTimeToUtc } from "~/utils/booking-refund";
import {
	appointmentFormatLabel,
	IN_PERSON_CLINIC,
	inPersonLocationSingleLine,
	type AppointmentFormat,
} from "~/utils/clinic-location";
import { site } from "~/data/content";

export type BookingEmailInput = {
	dateIso: string;
	timeLabel: string;
	name: string;
	email: string;
	phone: string;
	type: string;
	notes?: string;
	paymentMethod?: "self-pay" | "insurance";
	appointmentFormat?: AppointmentFormat;
	meetLink?: string;
	insurer?: string;
	authorisationCode?: string;
	bookingRef?: string;
};

const SITE_URL = "https://personalisedcancercare.com";
const SITE_HOST = "personalisedcancercare.com";
const MANAGE_BOOKING_URL = `${SITE_URL}/manage-booking`;
const CLINIC_BRAND = "Personalised Cancer Care";
const DEFAULT_FROM_EMAIL = "bookings@personalisedcancercare.com";
const DEFAULT_FROM_NAME = "Personalised Cancer Care Bookings";

const CLINIC_LOCATION = {
	name: IN_PERSON_CLINIC.name,
	url: "https://www.hcahealthcare.co.uk/facilities/hca-uk-at-university-college-hospital",
	address: IN_PERSON_CLINIC.addressLines.join(", "),
	mapsUrl: IN_PERSON_CLINIC.mapsUrl,
} as const;

const COLORS = {
	ink: "#15202B",
	inkSoft: "#2A3644",
	inkMuted: "#5D6B78",
	cream: "#F7F4EC",
	creamCard: "#F6F3EA",
	mist: "#EDEFF0",
	line: "#E7E1D4",
	borderSoft: "#D8D2C4",
	accent: "#1F6F6A",
	accentDeep: "#175551",
	accentSoft: "#E3EFEC",
	white: "#ffffff",
	iconCal: "#F1EDE4",
	iconClock: "#E4EEF6",
	iconConsult: "#F3E8D9",
	iconPay: "#FBF0D9",
	iconPin: "#F3E1DE",
} as const;

function toBase64(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function toBase64Url(value: string): string {
	return toBase64(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 2045: base64 lines should be at most 76 characters. */
function toBase64Wrapped(value: string): string {
	const encoded = toBase64(value);
	return encoded.match(/.{1,76}/g)?.join("\r\n") ?? encoded;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
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

function resolveBookingSender(config: BookingConfig): {
	fromEmail: string;
	fromName: string;
} {
	return {
		fromEmail: config.fromEmail?.trim() || DEFAULT_FROM_EMAIL,
		fromName: config.fromName?.trim() || DEFAULT_FROM_NAME,
	};
}

const SLOT_MINUTES = 60;

function icsEscape(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r?\n/g, "\\n");
}

function formatIcsUtc(date: Date): string {
	return date
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}Z$/, "Z");
}

function appointmentWindow(
	dateIso: string,
	timeLabel: string,
	timeZone: string,
): { start: Date; end: Date } | null {
	const [hourText, minuteText] = timeLabel.split(":");
	const hour = Number(hourText);
	const minute = Number(minuteText);
	if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
	const start = zonedDateTimeToUtc(dateIso, hour, minute, timeZone);
	const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
	return { start, end };
}

function buildConsultationIcs(input: {
	dateIso: string;
	timeLabel: string;
	timeZone: string;
	type: string;
	name: string;
	email: string;
	bookingRef: string;
	fromEmail: string;
	sequence?: number;
	method?: "PUBLISH" | "REQUEST" | "CANCEL";
	appointmentFormat?: AppointmentFormat;
	meetLink?: string;
}): string | null {
	const window = appointmentWindow(input.dateIso, input.timeLabel, input.timeZone);
	if (!window) return null;
	const method = input.method ?? "REQUEST";
	const sequence = input.sequence ?? 0;
	const uid = `booking-${input.bookingRef.toLowerCase()}@${SITE_HOST}`;
	const summary = `Consultation — ${input.type}`;
	const description = [
		`Booking reference: ${input.bookingRef}`,
		`Patient: ${input.name}`,
		input.appointmentFormat
			? `Format: ${appointmentFormatLabel(input.appointmentFormat)}`
			: null,
		input.meetLink ? `Google Meet: ${input.meetLink}` : null,
		`To change or cancel: ${MANAGE_BOOKING_URL}`,
	]
		.filter(Boolean)
		.join("\n");
	const status = method === "CANCEL" ? "CANCELLED" : "CONFIRMED";
	const location =
		input.meetLink ||
		(input.appointmentFormat === "virtual"
			? "Virtual consultation (Google Meet)"
			: inPersonLocationSingleLine());

	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Personalised Cancer Care//Bookings//EN",
		"CALSCALE:GREGORIAN",
		`METHOD:${method}`,
		"BEGIN:VEVENT",
		`UID:${uid}`,
		`SEQUENCE:${sequence}`,
		`DTSTAMP:${formatIcsUtc(new Date())}`,
		`DTSTART:${formatIcsUtc(window.start)}`,
		`DTEND:${formatIcsUtc(window.end)}`,
		`SUMMARY:${icsEscape(summary)}`,
		`DESCRIPTION:${icsEscape(description)}`,
		`LOCATION:${icsEscape(location)}`,
		...(input.meetLink ? [`URL:${input.meetLink}`] : []),
		`ORGANIZER;CN=${icsEscape(CLINIC_BRAND)}:mailto:${input.fromEmail}`,
		`ATTENDEE;CN=${icsEscape(input.name)};ROLE=REQ-PARTICIPANT:mailto:${input.email}`,
		`STATUS:${status}`,
		"TRANSP:OPAQUE",
		"END:VEVENT",
		"END:VCALENDAR",
		"",
	].join("\r\n");
}

/** Shared branded shell for confirmation / change / cancellation emails. */
function wrapBookingEmailHtml(input: {
	title: string;
	statusPill: string;
	heading: string;
	leadHtml: string;
	detailRowsHtml: string;
	noteHtml: string;
	primaryCta?: { href: string; label: string };
	secondaryCta?: { href: string; label: string };
}): string {
	const primary = input.primaryCta
		? `<a href="${input.primaryCta.href}" style="display:inline-block;padding:13px 24px;background:${COLORS.accent};color:${COLORS.white};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;border-radius:3px;">${escapeHtml(input.primaryCta.label)}</a>`
		: "";
	const secondary = input.secondaryCta
		? `<a href="${input.secondaryCta.href}" style="display:inline-block;padding:12px 24px;border:1px solid ${COLORS.borderSoft};background:${COLORS.white};color:${COLORS.ink};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;border-radius:3px;">${escapeHtml(input.secondaryCta.label)}</a>`
		: "";
	const ctaBlock =
		primary || secondary
			? `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
					<tr>
						${primary ? `<td style="padding-right:12px;padding-bottom:10px;">${primary}</td>` : ""}
						${secondary ? `<td style="padding-bottom:10px;">${secondary}</td>` : ""}
					</tr>
				</table>`
			: "";

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.mist};">
	<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.mist};">
		<tr>
			<td align="center" style="padding:32px 16px;">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:${COLORS.white};border-radius:6px;overflow:hidden;">
					<tr>
						<td style="height:6px;background:${COLORS.accent};font-size:0;line-height:0;">&nbsp;</td>
					</tr>
					<tr>
						<td style="padding:32px 36px 26px;background:${COLORS.cream};border-bottom:1px solid ${COLORS.line};">
							<a href="${SITE_URL}" style="text-decoration:none;display:block;">
								<div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;color:${COLORS.ink};font-weight:700;letter-spacing:-0.3px;">
									${escapeHtml(CLINIC_BRAND)}
								</div>
								<div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.inkMuted};font-weight:500;">
									Consultant oncology care
								</div>
							</a>
						</td>
					</tr>
					<tr>
						<td style="padding:36px 36px 40px;background:${COLORS.white};">
							<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
								<tr>
									<td style="padding:9px 16px;border-radius:999px;background:${COLORS.accentSoft};font-family:Arial,Helvetica,sans-serif;font-size:12.5px;letter-spacing:0.8px;text-transform:uppercase;color:${COLORS.accentDeep};font-weight:700;">
										${input.statusPill}
									</td>
								</tr>
							</table>
							<div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.2;color:${COLORS.ink};font-weight:700;margin:0 0 16px;">
								${escapeHtml(input.heading)}
							</div>
							<p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${COLORS.inkSoft};max-width:560px;">
								${input.leadHtml}
							</p>
							<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.creamCard};border:1px solid ${COLORS.line};border-radius:8px;">
								<tr>
									<td style="padding:6px 26px;">
										<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
											${input.detailRowsHtml}
										</table>
									</td>
								</tr>
							</table>
							<p style="margin:26px 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.6;color:${COLORS.inkSoft};">
								${input.noteHtml}
							</p>
							${ctaBlock}
						</td>
					</tr>
					<tr>
						<td style="padding:26px 36px;background:${COLORS.cream};border-top:1px solid ${COLORS.line};">
							<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
								<tr>
									<td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${COLORS.inkMuted};">
										Reply to <a href="mailto:${DEFAULT_FROM_EMAIL}" style="color:${COLORS.accentDeep};text-decoration:none;font-weight:600;">${DEFAULT_FROM_EMAIL}</a>
									</td>
									<td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;">
										<a href="${SITE_URL}" style="color:${COLORS.accentDeep};text-decoration:none;font-weight:600;">${SITE_HOST}</a>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`;
}

function detailRow(input: {
	icon: string;
	iconBg: string;
	label: string;
	valueHtml: string;
	subHtml?: string;
	last?: boolean;
}): string {
	const border = input.last
		? "none"
		: `1px solid ${COLORS.line}`;
	return `
		<tr>
			<td style="padding:20px 0;border-bottom:${border};">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
					<tr>
						<td valign="top" width="56" style="width:56px;padding-right:16px;">
							<div style="width:40px;height:40px;border-radius:8px;background:${input.iconBg};font-size:19px;line-height:40px;text-align:center;">
								${input.icon}
							</div>
						</td>
						<td valign="top" style="font-family:Arial,Helvetica,sans-serif;padding-top:2px;">
							<div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:${COLORS.inkMuted};font-weight:600;margin-bottom:4px;">
								${input.label}
							</div>
							<div style="font-size:16px;line-height:1.4;color:${COLORS.ink};font-weight:700;">
								${input.valueHtml}
							</div>
							${input.subHtml ?? ""}
						</td>
					</tr>
				</table>
			</td>
		</tr>`;
}

function buildPlainText(input: {
	name: string;
	when: string;
	timeLabel: string;
	type: string;
	paymentLine: string;
	pending: boolean;
	bookingRef?: string;
	appointmentFormat?: AppointmentFormat;
	meetLink?: string;
}): string {
	const refLines = input.bookingRef
		? [`Booking reference: ${input.bookingRef}`, ""]
		: [];
	const formatLine = input.appointmentFormat
		? `Format: ${appointmentFormatLabel(input.appointmentFormat)}`
		: null;
	const locationLines =
		input.appointmentFormat === "virtual"
			? [
					"Location: Virtual consultation",
					...(input.meetLink
						? [`Google Meet: ${input.meetLink}`]
						: input.pending
							? ["Google Meet link will follow with your confirmation."]
							: []),
				]
			: input.appointmentFormat === "in-person"
				? [`Location: ${CLINIC_LOCATION.name}`, CLINIC_LOCATION.address]
				: [`Location: ${CLINIC_LOCATION.name}`, CLINIC_LOCATION.address];
	const manageLines = input.bookingRef
		? [
				`To change or cancel your appointment, visit ${MANAGE_BOOKING_URL} and enter your email with booking reference ${input.bookingRef}.`,
				...(input.pending
					? []
					: [
							"Self-pay cancellations at least 48 hours before the appointment receive an automatic full refund.",
						]),
				"",
			]
		: [
				"To change or cancel your appointment, simply reply to this email.",
				"",
			];
	const calendarLines = !input.pending
		? [
				"Add to your calendar: open the attached consultation.ics file.",
				"If you reschedule later, open the new .ics attachment to replace this event (same booking).",
				"",
			]
		: [];

	if (input.pending) {
		return [
			`Dear ${input.name},`,
			"",
			`We have received your insurance booking request with ${site.name}.`,
			"",
			...refLines,
			`Requested date: ${input.when}`,
			`Requested time: ${input.timeLabel} (UK time)`,
			`Consultation: ${input.type}`,
			...(formatLine ? [formatLine] : []),
			...locationLines,
			input.paymentLine,
			"",
			"Your appointment is pending until we verify the authorisation code with your insurer. We will email you again once it is confirmed. Please do not attend until you receive that confirmation.",
			"",
			...manageLines,
			`Website: ${SITE_URL}`,
			"",
			"If you have questions, reply to this email.",
			"",
			"Kind regards,",
			CLINIC_BRAND,
			DEFAULT_FROM_EMAIL,
		].join("\n");
	}

	return [
		`Dear ${input.name},`,
		"",
		`Your consultation with ${site.name} is confirmed. The details are below.`,
		"",
		...refLines,
		`Date: ${input.when}`,
		`Time: ${input.timeLabel} (UK time)`,
		`Consultation: ${input.type}`,
		...(formatLine ? [formatLine] : []),
		...locationLines,
		input.paymentLine,
		"",
		...calendarLines,
		...manageLines,
		`Website: ${SITE_URL}`,
		"",
		"If you have questions, reply to this email.",
		"",
		"Kind regards,",
		CLINIC_BRAND,
		DEFAULT_FROM_EMAIL,
	].join("\n");
}

function buildHtml(input: {
	name: string;
	when: string;
	timeLabel: string;
	type: string;
	paymentLabel: string;
	paymentValue: string;
	pending: boolean;
	bookingRef?: string;
	appointmentFormat?: AppointmentFormat;
	meetLink?: string;
}): string {
	const name = escapeHtml(input.name);
	const when = escapeHtml(input.when);
	const timeLabel = escapeHtml(input.timeLabel);
	const type = escapeHtml(input.type);
	const paymentLabel = escapeHtml(input.paymentLabel);
	const paymentValue = escapeHtml(input.paymentValue);
	const siteName = escapeHtml(CLINIC_BRAND);
	const siteTitle = "Consultant oncology care";
	const locationName = escapeHtml(CLINIC_LOCATION.name);
	const locationAddress = escapeHtml(CLINIC_LOCATION.address);
	const bookingRef = input.bookingRef ? escapeHtml(input.bookingRef) : "";
	const pending = input.pending;
	const isVirtual = input.appointmentFormat === "virtual";
	const formatLabel = input.appointmentFormat
		? escapeHtml(appointmentFormatLabel(input.appointmentFormat))
		: "";
	const meetLink = input.meetLink?.trim() || "";
	const meetHref = meetLink ? escapeHtml(meetLink) : "";

	const locationSub = isVirtual
		? meetLink
			? `
		<div style="margin-top:8px;">
			<a href="${meetHref}" style="font-size:13.5px;font-weight:600;color:${COLORS.accentDeep};text-decoration:underline;">
				Join Google Meet
			</a>
		</div>`
			: `
		<div style="font-size:14.5px;color:${COLORS.inkSoft};font-weight:400;margin-top:4px;line-height:1.5;">
			Google Meet link will follow with your confirmation.
		</div>`
		: `
		<div style="font-size:14.5px;color:${COLORS.inkSoft};font-weight:400;margin-top:4px;line-height:1.5;">
			${locationAddress}
		</div>
		<div style="margin-top:8px;">
			<a href="${CLINIC_LOCATION.mapsUrl}" style="font-size:13.5px;font-weight:600;color:${COLORS.accentDeep};text-decoration:underline;">
				View on Google Maps
			</a>
		</div>`;

	const statusPill = pending
		? "Pending authorisation"
		: "&#10003; Booking confirmed";
	const lead = pending
		? `We have received your insurance booking request with ${siteName}. Your appointment stays pending until we verify the authorisation code with your insurer.`
		: `Your consultation with ${siteName} is confirmed. The details are below.`;
	const note = pending
		? "We will email you again once the authorisation code has been checked and your appointment is confirmed. Please do not attend until you receive that confirmation."
		: bookingRef
			? `To change or cancel your appointment, visit <a href="${MANAGE_BOOKING_URL}" style="color:${COLORS.accentDeep};font-weight:600;">Manage booking</a> and enter your email with booking reference <strong>${bookingRef}</strong>. Self-pay cancellations at least 48 hours before the appointment receive an automatic full refund. A <strong>consultation.ics</strong> file is attached — open it to add this appointment to your calendar.`
			: "To change or cancel your appointment, simply reply to this email.";
	const pendingManage = bookingRef
		? ` You can also cancel or change the requested time via <a href="${MANAGE_BOOKING_URL}" style="color:${COLORS.accentDeep};font-weight:600;">Manage booking</a> using reference <strong>${bookingRef}</strong>.`
		: "";
	const noteHtml = pending ? `${note}${pendingManage}` : note;
	const refRow = bookingRef
		? detailRow({
				icon: "&#128196;",
				iconBg: COLORS.iconConsult,
				label: "Booking reference",
				valueHtml: bookingRef,
			})
		: "";
	const formatRow = formatLabel
		? detailRow({
				icon: "&#128187;",
				iconBg: COLORS.iconClock,
				label: "Format",
				valueHtml: formatLabel,
			})
		: "";
	const locationRow = detailRow({
		icon: "&#128205;",
		iconBg: COLORS.iconPin,
		label: isVirtual ? "Video link" : "Location",
		valueHtml: isVirtual
			? meetLink
				? `<a href="${meetHref}" style="color:${COLORS.ink};text-decoration:none;font-weight:700;">Google Meet</a>`
				: "Virtual consultation"
			: `<a href="${CLINIC_LOCATION.url}" style="color:${COLORS.ink};text-decoration:none;font-weight:700;">${locationName}</a>`,
		subHtml: locationSub,
		last: true,
	});

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${pending ? "Booking request received" : "Consultation confirmed"}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.mist};">
	<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.mist};">
		<tr>
			<td align="center" style="padding:32px 16px;">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:${COLORS.white};border-radius:6px;overflow:hidden;">
					<tr>
						<td style="height:6px;background:${COLORS.accent};font-size:0;line-height:0;">&nbsp;</td>
					</tr>
					<tr>
						<td style="padding:32px 36px 26px;background:${COLORS.cream};border-bottom:1px solid ${COLORS.line};">
							<a href="${SITE_URL}" style="text-decoration:none;display:block;">
								<div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;color:${COLORS.ink};font-weight:700;letter-spacing:-0.3px;">
									${siteName}
								</div>
								<div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.inkMuted};font-weight:500;">
									${siteTitle}
								</div>
							</a>
						</td>
					</tr>
					<tr>
						<td style="padding:36px 36px 40px;background:${COLORS.white};">
							<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
								<tr>
									<td style="padding:9px 16px;border-radius:999px;background:${COLORS.accentSoft};font-family:Arial,Helvetica,sans-serif;font-size:12.5px;letter-spacing:0.8px;text-transform:uppercase;color:${COLORS.accentDeep};font-weight:700;">
										${statusPill}
									</td>
								</tr>
							</table>

							<div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.2;color:${COLORS.ink};font-weight:700;margin:0 0 16px;">
								Dear ${name},
							</div>
							<p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${COLORS.inkSoft};max-width:560px;">
								${lead}
							</p>

							<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.creamCard};border:1px solid ${COLORS.line};border-radius:8px;">
								<tr>
									<td style="padding:6px 26px;">
										<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
											${refRow}
											${detailRow({
												icon: "&#128197;",
												iconBg: COLORS.iconCal,
												label: pending ? "Requested date" : "Date",
												valueHtml: when,
											})}
											${detailRow({
												icon: "&#128338;",
												iconBg: COLORS.iconClock,
												label: pending ? "Requested time" : "Time",
												valueHtml: `${timeLabel} (UK time)`,
											})}
											${detailRow({
												icon: "&#128203;",
												iconBg: COLORS.iconConsult,
												label: "Consultation",
												valueHtml: type,
											})}
											${formatRow}
											${detailRow({
												icon: "&#128179;",
												iconBg: COLORS.iconPay,
												label: paymentLabel,
												valueHtml: paymentValue,
											})}
											${locationRow}
										</table>
									</td>
								</tr>
							</table>

							<p style="margin:26px 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.6;color:${COLORS.inkSoft};">
								${noteHtml}
							</p>

							<table role="presentation" cellpadding="0" cellspacing="0" border="0">
								<tr>
									<td style="padding-right:14px;padding-bottom:8px;">
										<a href="${bookingRef ? MANAGE_BOOKING_URL : SITE_URL}" style="display:inline-block;padding:13px 24px;background:${COLORS.accent};color:${COLORS.white};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;border-radius:3px;">
											${bookingRef ? "Manage booking" : "Visit the website"}
										</a>
									</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr>
						<td style="padding:26px 36px;background:${COLORS.cream};border-top:1px solid ${COLORS.line};">
							<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
								<tr>
									<td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${COLORS.inkMuted};">
										Reply to <a href="mailto:${DEFAULT_FROM_EMAIL}" style="color:${COLORS.accentDeep};text-decoration:none;font-weight:600;">${DEFAULT_FROM_EMAIL}</a>
									</td>
									<td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;">
										<a href="${SITE_URL}" style="color:${COLORS.accentDeep};text-decoration:none;font-weight:600;">${SITE_HOST}</a>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`;
}
function buildMimeMessage(input: {
	to: string;
	from?: string;
	replyTo?: string;
	bcc?: string;
	subject: string;
	text: string;
	html: string;
	ics?: string;
	icsMethod?: "PUBLISH" | "REQUEST" | "CANCEL";
	icsFilename?: string;
}): string {
	const mixedBoundary = `pcc_mix_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
	const altBoundary = `pcc_alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
	const icsMethod = input.icsMethod ?? "PUBLISH";
	const icsFilename = input.icsFilename ?? "consultation.ics";

	const alternativeParts = [
		`--${altBoundary}`,
		'Content-Type: text/plain; charset="UTF-8"',
		"Content-Transfer-Encoding: base64",
		"",
		toBase64Wrapped(input.text),
		"",
		`--${altBoundary}`,
		'Content-Type: text/html; charset="UTF-8"',
		"Content-Transfer-Encoding: base64",
		"",
		toBase64Wrapped(input.html),
		"",
		`--${altBoundary}--`,
	];

	if (!input.ics) {
		return [
			...(input.from ? [`From: ${input.from}`] : []),
			`To: ${input.to}`,
			...(input.replyTo ? [`Reply-To: ${input.replyTo}`] : []),
			...(input.bcc ? [`Bcc: ${input.bcc}`] : []),
			`Subject: ${input.subject}`,
			"MIME-Version: 1.0",
			`Content-Type: multipart/alternative; boundary="${altBoundary}"`,
			"",
			...alternativeParts,
			"",
		].join("\r\n");
	}

	return [
		...(input.from ? [`From: ${input.from}`] : []),
		`To: ${input.to}`,
		...(input.replyTo ? [`Reply-To: ${input.replyTo}`] : []),
		...(input.bcc ? [`Bcc: ${input.bcc}`] : []),
		`Subject: ${input.subject}`,
		"MIME-Version: 1.0",
		`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
		"",
		`--${mixedBoundary}`,
		`Content-Type: multipart/alternative; boundary="${altBoundary}"`,
		"",
		...alternativeParts,
		"",
		`--${mixedBoundary}`,
		`Content-Type: text/calendar; charset="UTF-8"; method=${icsMethod}; name="${icsFilename}"`,
		"Content-Transfer-Encoding: base64",
		`Content-Disposition: attachment; filename="${icsFilename}"`,
		"",
		toBase64Wrapped(input.ics),
		"",
		`--${mixedBoundary}--`,
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
	const { fromEmail, fromName } = resolveBookingSender(config);
	const when = formatAppointmentDate(input.dateIso, config.timeZone);

	const isInsurance = input.paymentMethod === "insurance";
	const paymentLabel = "Payment";
	const paymentValue = isInsurance
		? `Private medical insurance${input.insurer ? ` (${input.insurer})` : ""} — pending authorisation check`
		: "Self-pay (received)";
	const paymentLine = isInsurance
		? `Payment: Private medical insurance${input.insurer ? ` (${input.insurer})` : ""}. Pending authorisation check.`
		: "Payment: Self-pay (received).";

	const ics =
		!isInsurance && input.bookingRef
			? buildConsultationIcs({
					dateIso: input.dateIso,
					timeLabel: input.timeLabel,
					timeZone: config.timeZone,
					type: input.type,
					name: input.name,
					email: input.email,
					bookingRef: input.bookingRef,
					fromEmail,
					sequence: 0,
					method: "REQUEST",
					appointmentFormat: input.appointmentFormat,
					meetLink: input.meetLink,
				})
			: null;

	const subject = isInsurance
		? `${CLINIC_BRAND}: insurance booking pending authorisation`
		: `${CLINIC_BRAND}: consultation confirmed`;
	const text = buildPlainText({
		name: input.name,
		when,
		timeLabel: input.timeLabel,
		type: input.type,
		paymentLine,
		pending: isInsurance,
		bookingRef: input.bookingRef,
		appointmentFormat: input.appointmentFormat,
		meetLink: input.meetLink,
	});
	const html = buildHtml({
		name: input.name,
		when,
		timeLabel: input.timeLabel,
		type: input.type,
		paymentLabel,
		paymentValue,
		pending: isInsurance,
		bookingRef: input.bookingRef,
		appointmentFormat: input.appointmentFormat,
		meetLink: input.meetLink,
	});

	await sendBookingMime(accessToken, {
		to: input.email,
		from: formatFromHeader(fromEmail, fromName),
		replyTo: fromEmail,
		bcc: config.bccEmail,
		subject,
		text,
		html,
		...(ics
			? {
					ics,
					icsMethod: "REQUEST" as const,
					icsFilename: "consultation.ics",
				}
			: {}),
	});
}

async function sendBookingMime(
	accessToken: string,
	mime: {
		to: string;
		from: string;
		replyTo?: string;
		bcc?: string;
		subject: string;
		text: string;
		html: string;
		ics?: string;
		icsMethod?: "PUBLISH" | "REQUEST" | "CANCEL";
		icsFilename?: string;
	},
): Promise<void> {
	await gmailSend(accessToken, toBase64Url(buildMimeMessage(mime)));
}

export async function sendBookingCancelledEmail(
	config: BookingConfig,
	input: {
		name: string;
		email: string;
		dateIso: string;
		timeLabel: string;
		type: string;
		bookingRef: string;
		icsSequence?: number;
		refundStatus?:
			| "none"
			| "refunded"
			| "not_eligible"
			| "already_refunded";
		refundAmountLabel?: string;
		refundMinHours?: number;
	},
): Promise<void> {
	const accessToken = await getAccessToken(config);
	const { fromEmail, fromName } = resolveBookingSender(config);
	const when = formatAppointmentDate(input.dateIso, config.timeZone);
	const subject = `${CLINIC_BRAND}: appointment cancelled (${input.bookingRef})`;
	const refundMinHours = input.refundMinHours ?? 48;
	const refundLine =
		input.refundStatus === "refunded"
			? `A full refund${input.refundAmountLabel ? ` of ${input.refundAmountLabel}` : ""} has been started and should appear on your statement in a few days.`
			: input.refundStatus === "already_refunded"
				? "This payment had already been refunded."
				: input.refundStatus === "not_eligible"
					? `Self-pay refunds are automatic only when you cancel at least ${refundMinHours} hours before the appointment. Please contact the clinic team if you need to discuss this payment.`
					: null;
	const lead = `Your consultation with ${site.name} has been cancelled.`;

	const text = [
		`Dear ${input.name},`,
		"",
		lead,
		"",
		`Booking reference: ${input.bookingRef}`,
		`Date: ${when}`,
		`Time: ${input.timeLabel} (UK time)`,
		`Consultation: ${input.type}`,
		...(refundLine ? ["", refundLine] : []),
		"",
		`If this was a mistake, you can book again at ${SITE_URL}/book.`,
		"",
		"Kind regards,",
		CLINIC_BRAND,
		fromEmail,
	].join("\n");

	const html = wrapBookingEmailHtml({
		title: "Appointment cancelled",
		statusPill: "Cancelled",
		heading: `Dear ${input.name},`,
		leadHtml: escapeHtml(lead),
		detailRowsHtml: [
			detailRow({
				icon: "&#128196;",
				iconBg: COLORS.iconConsult,
				label: "Booking reference",
				valueHtml: escapeHtml(input.bookingRef),
			}),
			detailRow({
				icon: "&#128197;",
				iconBg: COLORS.iconCal,
				label: "Date",
				valueHtml: escapeHtml(when),
			}),
			detailRow({
				icon: "&#128338;",
				iconBg: COLORS.iconClock,
				label: "Time",
				valueHtml: `${escapeHtml(input.timeLabel)} (UK time)`,
			}),
			detailRow({
				icon: "&#128203;",
				iconBg: COLORS.iconConsult,
				label: "Consultation",
				valueHtml: escapeHtml(input.type),
				last: !refundLine,
			}),
			...(refundLine
				? [
						detailRow({
							icon: "&#128179;",
							iconBg: COLORS.iconPay,
							label: "Refund",
							valueHtml: escapeHtml(refundLine),
							last: true,
						}),
					]
				: []),
		].join(""),
		noteHtml: `If this was a mistake, you can <a href="${SITE_URL}/book" style="color:${COLORS.accentDeep};font-weight:600;">book again</a>.`,
		primaryCta: { href: `${SITE_URL}/book`, label: "Book again" },
	});

	const ics = buildConsultationIcs({
		dateIso: input.dateIso,
		timeLabel: input.timeLabel,
		timeZone: config.timeZone,
		type: input.type,
		name: input.name,
		email: input.email,
		bookingRef: input.bookingRef,
		fromEmail,
		sequence: (input.icsSequence ?? 0) + 1,
		method: "CANCEL",
	});

	await sendBookingMime(accessToken, {
		to: input.email,
		from: formatFromHeader(fromEmail, fromName),
		replyTo: fromEmail,
		bcc: config.bccEmail,
		subject,
		text,
		html,
		...(ics
			? {
					ics,
					icsMethod: "CANCEL" as const,
					icsFilename: "consultation-cancelled.ics",
				}
			: {}),
	});
}

export async function sendBookingRescheduledEmail(
	config: BookingConfig,
	input: {
		name: string;
		email: string;
		dateIso: string;
		timeLabel: string;
		type: string;
		bookingRef: string;
		pendingAuth?: boolean;
		icsSequence?: number;
		appointmentFormat?: AppointmentFormat;
		meetLink?: string;
	},
): Promise<void> {
	const accessToken = await getAccessToken(config);
	const { fromEmail, fromName } = resolveBookingSender(config);
	const when = formatAppointmentDate(input.dateIso, config.timeZone);
	const subject = `${CLINIC_BRAND}: appointment updated (${input.bookingRef})`;
	const statusLine = input.pendingAuth
		? "Your requested time has been updated. The appointment remains pending until we verify your insurer authorisation code."
		: "Your consultation time has been updated. The details are below.";
	const sequence = input.icsSequence ?? 1;
	const meetLink = input.meetLink?.trim() || undefined;
	const ics = input.pendingAuth
		? null
		: buildConsultationIcs({
				dateIso: input.dateIso,
				timeLabel: input.timeLabel,
				timeZone: config.timeZone,
				type: input.type,
				name: input.name,
				email: input.email,
				bookingRef: input.bookingRef,
				fromEmail,
				sequence,
				method: "REQUEST",
				appointmentFormat: input.appointmentFormat,
				meetLink,
			});
	const calendarLines = ics
		? [
				"",
				"To update your calendar, open the attached consultation.ics file — it uses the same booking ID and should replace the previous time.",
				"If you still see the old time (for example after using Add to Google Calendar before), delete that older entry.",
			]
		: [];
	const meetLines = meetLink ? [`Google Meet: ${meetLink}`] : [];

	const text = [
		`Dear ${input.name},`,
		"",
		statusLine,
		"",
		`Booking reference: ${input.bookingRef}`,
		`Date: ${when}`,
		`Time: ${input.timeLabel} (UK time)`,
		`Consultation: ${input.type}`,
		...(input.appointmentFormat
			? [`Format: ${appointmentFormatLabel(input.appointmentFormat)}`]
			: []),
		...meetLines,
		...calendarLines,
		"",
		`To change or cancel again, visit ${MANAGE_BOOKING_URL}.`,
		"",
		"Kind regards,",
		CLINIC_BRAND,
		fromEmail,
	].join("\n");

	const hasFormat = Boolean(input.appointmentFormat);
	const hasMeet = Boolean(meetLink);
	const html = wrapBookingEmailHtml({
		title: "Appointment updated",
		statusPill: input.pendingAuth ? "Pending authorisation" : "Updated",
		heading: `Dear ${input.name},`,
		leadHtml: escapeHtml(statusLine),
		detailRowsHtml: [
			detailRow({
				icon: "&#128196;",
				iconBg: COLORS.iconConsult,
				label: "Booking reference",
				valueHtml: escapeHtml(input.bookingRef),
			}),
			detailRow({
				icon: "&#128197;",
				iconBg: COLORS.iconCal,
				label: "Date",
				valueHtml: escapeHtml(when),
			}),
			detailRow({
				icon: "&#128338;",
				iconBg: COLORS.iconClock,
				label: "Time",
				valueHtml: `${escapeHtml(input.timeLabel)} (UK time)`,
			}),
			detailRow({
				icon: "&#128203;",
				iconBg: COLORS.iconConsult,
				label: "Consultation",
				valueHtml: escapeHtml(input.type),
				last: !hasFormat && !hasMeet,
			}),
			...(input.appointmentFormat
				? [
						detailRow({
							icon: "&#128187;",
							iconBg: COLORS.iconClock,
							label: "Format",
							valueHtml: escapeHtml(
								appointmentFormatLabel(input.appointmentFormat),
							),
							last: !hasMeet,
						}),
					]
				: []),
			...(meetLink
				? [
						detailRow({
							icon: "&#128250;",
							iconBg: COLORS.iconPin,
							label: "Video link",
							valueHtml: `<a href="${escapeHtml(meetLink)}" style="color:${COLORS.ink};text-decoration:none;font-weight:700;">Join Google Meet</a>`,
							last: true,
						}),
					]
				: []),
		].join(""),
		noteHtml: ics
			? `Open the attached <strong>consultation.ics</strong> to update your calendar with the new time (same booking — replaces the previous event when supported). If an old Google Calendar entry remains from a previous “Add to calendar” click, delete that older one. To change or cancel again, use <a href="${MANAGE_BOOKING_URL}" style="color:${COLORS.accentDeep};font-weight:600;">Manage booking</a>.`
			: `To change or cancel again, use <a href="${MANAGE_BOOKING_URL}" style="color:${COLORS.accentDeep};font-weight:600;">Manage booking</a>.`,
		primaryCta: { href: MANAGE_BOOKING_URL, label: "Manage booking" },
	});

	await sendBookingMime(accessToken, {
		to: input.email,
		from: formatFromHeader(fromEmail, fromName),
		replyTo: fromEmail,
		bcc: config.bccEmail,
		subject,
		text,
		html,
		...(ics
			? {
					ics,
					icsMethod: "REQUEST" as const,
					icsFilename: "consultation.ics",
				}
			: {}),
	});
}

/** Sent when the clinic confirms insurer authorisation for a pending booking. */
export async function sendInsuranceBookingConfirmedEmail(
	config: BookingConfig,
	input: {
		name: string;
		email: string;
		dateIso: string;
		timeLabel: string;
		type: string;
		bookingRef: string;
		icsSequence?: number;
		appointmentFormat?: AppointmentFormat;
		meetLink?: string;
	},
): Promise<void> {
	const accessToken = await getAccessToken(config);
	const { fromEmail, fromName } = resolveBookingSender(config);
	const when = formatAppointmentDate(input.dateIso, config.timeZone);
	const subject = `${CLINIC_BRAND}: appointment confirmed (${input.bookingRef})`;
	const lead =
		"Your insurer authorisation has been verified. Your consultation is now confirmed.";
	const sequence = input.icsSequence ?? 1;
	const meetLink = input.meetLink?.trim() || undefined;
	const ics = buildConsultationIcs({
		dateIso: input.dateIso,
		timeLabel: input.timeLabel,
		timeZone: config.timeZone,
		type: input.type,
		name: input.name,
		email: input.email,
		bookingRef: input.bookingRef,
		fromEmail,
		sequence,
		method: "REQUEST",
		appointmentFormat: input.appointmentFormat,
		meetLink,
	});

	const text = [
		`Dear ${input.name},`,
		"",
		lead,
		"",
		`Booking reference: ${input.bookingRef}`,
		`Date: ${when}`,
		`Time: ${input.timeLabel} (UK time)`,
		`Consultation: ${input.type}`,
		...(input.appointmentFormat
			? [`Format: ${appointmentFormatLabel(input.appointmentFormat)}`]
			: []),
		...(meetLink ? [`Google Meet: ${meetLink}`] : []),
		"",
		"Add to your calendar: open the attached consultation.ics file.",
		"",
		`To change or cancel, visit ${MANAGE_BOOKING_URL}.`,
		"",
		"Kind regards,",
		CLINIC_BRAND,
		fromEmail,
	].join("\n");

	const hasFormat = Boolean(input.appointmentFormat);
	const hasMeet = Boolean(meetLink);
	const html = wrapBookingEmailHtml({
		title: "Appointment confirmed",
		statusPill: "&#10003; Confirmed",
		heading: `Dear ${input.name},`,
		leadHtml: escapeHtml(lead),
		detailRowsHtml: [
			detailRow({
				icon: "&#128196;",
				iconBg: COLORS.iconConsult,
				label: "Booking reference",
				valueHtml: escapeHtml(input.bookingRef),
			}),
			detailRow({
				icon: "&#128197;",
				iconBg: COLORS.iconCal,
				label: "Date",
				valueHtml: escapeHtml(when),
			}),
			detailRow({
				icon: "&#128338;",
				iconBg: COLORS.iconClock,
				label: "Time",
				valueHtml: `${escapeHtml(input.timeLabel)} (UK time)`,
			}),
			detailRow({
				icon: "&#128203;",
				iconBg: COLORS.iconConsult,
				label: "Consultation",
				valueHtml: escapeHtml(input.type),
				last: !hasFormat && !hasMeet,
			}),
			...(input.appointmentFormat
				? [
						detailRow({
							icon: "&#128187;",
							iconBg: COLORS.iconClock,
							label: "Format",
							valueHtml: escapeHtml(
								appointmentFormatLabel(input.appointmentFormat),
							),
							last: !hasMeet,
						}),
					]
				: []),
			...(meetLink
				? [
						detailRow({
							icon: "&#128250;",
							iconBg: COLORS.iconPin,
							label: "Video link",
							valueHtml: `<a href="${escapeHtml(meetLink)}" style="color:${COLORS.ink};text-decoration:none;font-weight:700;">Join Google Meet</a>`,
							last: true,
						}),
					]
				: []),
		].join(""),
		noteHtml: `A calendar file is attached — open <strong>consultation.ics</strong> to add this appointment. To change or cancel, use <a href="${MANAGE_BOOKING_URL}" style="color:${COLORS.accentDeep};font-weight:600;">Manage booking</a>.`,
		primaryCta: { href: MANAGE_BOOKING_URL, label: "Manage booking" },
	});

	await sendBookingMime(accessToken, {
		to: input.email,
		from: formatFromHeader(fromEmail, fromName),
		replyTo: fromEmail,
		bcc: config.bccEmail,
		subject,
		text,
		html,
		...(ics
			? {
					ics,
					icsMethod: "REQUEST" as const,
					icsFilename: "consultation.ics",
				}
			: {}),
	});
}

/** One-time staff sign-in link for /clinic (expires in minutes). */
export async function sendClinicStaffMagicLinkEmail(
	config: BookingConfig,
	input: { email: string; magicLinkUrl: string; expiresMinutes: number },
): Promise<void> {
	const accessToken = await getAccessToken(config);
	const { fromEmail, fromName } = resolveBookingSender(config);
	const subject = `${CLINIC_BRAND}: clinic staff sign-in link`;
	const lead = `Use this link to sign in to clinic booking tools. It expires in ${input.expiresMinutes} minutes and can only be used by authorised staff.`;

	const text = [
		"Clinic staff sign-in",
		"",
		lead,
		"",
		input.magicLinkUrl,
		"",
		"If you did not request this, you can ignore this email.",
		"",
		CLINIC_BRAND,
	].join("\n");

	const html = wrapBookingEmailHtml({
		title: "Clinic staff sign-in",
		statusPill: "Staff access",
		heading: "Sign in to clinic tools",
		leadHtml: escapeHtml(lead),
		detailRowsHtml: detailRow({
			icon: "&#128274;",
			iconBg: COLORS.iconPay,
			label: "Valid for",
			valueHtml: `${input.expiresMinutes} minutes`,
			last: true,
		}),
		noteHtml: "If you did not request this link, you can ignore this email.",
		primaryCta: { href: input.magicLinkUrl, label: "Sign in to clinic tools" },
	});

	await sendBookingMime(accessToken, {
		to: input.email,
		from: formatFromHeader(fromEmail, fromName),
		replyTo: fromEmail,
		subject,
		text,
		html,
	});
}
