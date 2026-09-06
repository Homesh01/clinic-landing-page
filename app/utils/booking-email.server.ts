import type { BookingConfig } from "~/utils/google-calendar.server";
import { getAccessToken } from "~/utils/google-calendar.server";
import { contact, site } from "~/data/content";

export type BookingEmailInput = {
	dateIso: string;
	timeLabel: string;
	name: string;
	email: string;
	phone: string;
	type: string;
	notes?: string;
	paymentMethod?: "self-pay" | "insurance";
	insurer?: string;
	authorisationCode?: string;
};

const SITE_URL = "https://personalisedcancercare.com";
const SITE_HOST = "personalisedcancercare.com";

const CLINIC_LOCATION = {
	name: "HCA UK at University College Hospital, part of HCA Healthcare UK",
	url: "https://www.hcahealthcare.co.uk/facilities/hca-uk-at-university-college-hospital",
	address: "5th Floor UCH Macmillan Cancer Centre, Huntley Street, London, WC1E 6AG",
	mapsUrl:
		"https://maps.google.com/?q=51.523115436389844,-0.1356995398324203",
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
}): string {
	if (input.pending) {
		return [
			`Dear ${input.name},`,
			"",
			`We have received your insurance booking request with ${site.name}.`,
			"",
			`Requested date: ${input.when}`,
			`Requested time: ${input.timeLabel} (UK time)`,
			`Consultation: ${input.type}`,
			input.paymentLine,
			`Location: ${CLINIC_LOCATION.name}`,
			CLINIC_LOCATION.address,
			"",
			"Your appointment is pending until we verify the authorisation code with your insurer. We will email you again once it is confirmed. Please do not attend until you receive that confirmation.",
			"",
			`Website: ${SITE_URL}`,
			"",
			"If you have questions, reply to this email.",
			"",
			"Kind regards,",
			`${site.name} · ${site.title}`,
			SITE_HOST,
			contact.email,
		].join("\n");
	}

	return [
		`Dear ${input.name},`,
		"",
		`Your consultation with ${site.name} is confirmed. The details are below, and this appointment has been added to your calendar.`,
		"",
		`Date: ${input.when}`,
		`Time: ${input.timeLabel} (UK time)`,
		`Consultation: ${input.type}`,
		input.paymentLine,
		`Location: ${CLINIC_LOCATION.name}`,
		CLINIC_LOCATION.address,
		`Maps: ${CLINIC_LOCATION.mapsUrl}`,
		"",
		"To change or cancel your appointment, simply reply to this email.",
		"",
		`Website: ${SITE_URL}`,
		`Book again: ${SITE_URL}/book`,
		"",
		"Kind regards,",
		`${site.name} · ${site.title}`,
		SITE_HOST,
		contact.email,
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
}): string {
	const name = escapeHtml(input.name);
	const when = escapeHtml(input.when);
	const timeLabel = escapeHtml(input.timeLabel);
	const type = escapeHtml(input.type);
	const paymentLabel = escapeHtml(input.paymentLabel);
	const paymentValue = escapeHtml(input.paymentValue);
	const siteName = escapeHtml(site.name);
	const siteTitle = escapeHtml(site.title);
	const locationName = escapeHtml(CLINIC_LOCATION.name);
	const locationAddress = escapeHtml(CLINIC_LOCATION.address);
	const pending = input.pending;

	const locationSub = `
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
		: `Your consultation with ${siteName} is confirmed. The details are below, and this appointment has been added to your calendar.`;
	const note = pending
		? "We will email you again once the authorisation code has been checked and your appointment is confirmed. Please do not attend until you receive that confirmation."
		: "To change or cancel your appointment, simply reply to this email.";

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
											${detailRow({
												icon: "&#128179;",
												iconBg: COLORS.iconPay,
												label: paymentLabel,
												valueHtml: paymentValue,
											})}
											${detailRow({
												icon: "&#128205;",
												iconBg: COLORS.iconPin,
												label: "Location",
												valueHtml: `<a href="${CLINIC_LOCATION.url}" style="color:${COLORS.ink};text-decoration:none;font-weight:700;">${locationName}</a>`,
												subHtml: locationSub,
												last: true,
											})}
										</table>
									</td>
								</tr>
							</table>

							<p style="margin:26px 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.6;color:${COLORS.inkSoft};">
								${note}
							</p>

							<table role="presentation" cellpadding="0" cellspacing="0" border="0">
								<tr>
									<td style="padding-right:14px;padding-bottom:8px;">
										<a href="${SITE_URL}" style="display:inline-block;padding:13px 24px;background:${COLORS.accent};color:${COLORS.white};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;border-radius:3px;">
											Visit the website
										</a>
									</td>
									${
										pending
											? ""
											: `<td style="padding-bottom:8px;">
										<a href="${SITE_URL}/book" style="display:inline-block;padding:12px 24px;border:1px solid ${COLORS.borderSoft};background:${COLORS.white};color:${COLORS.ink};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;border-radius:3px;">
											Book again
										</a>
									</td>`
									}
								</tr>
							</table>
						</td>
					</tr>
					<tr>
						<td style="padding:26px 36px;background:${COLORS.cream};border-top:1px solid ${COLORS.line};">
							<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
								<tr>
									<td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${COLORS.inkMuted};">
										${siteName} &middot; ${siteTitle}
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
}): string {
	const boundary = `pcc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
	return [
		...(input.from ? [`From: ${input.from}`] : []),
		`To: ${input.to}`,
		...(input.replyTo ? [`Reply-To: ${input.replyTo}`] : []),
		...(input.bcc ? [`Bcc: ${input.bcc}`] : []),
		`Subject: ${input.subject}`,
		"MIME-Version: 1.0",
		`Content-Type: multipart/alternative; boundary="${boundary}"`,
		"",
		`--${boundary}`,
		'Content-Type: text/plain; charset="UTF-8"',
		"Content-Transfer-Encoding: base64",
		"",
		toBase64Wrapped(input.text),
		"",
		`--${boundary}`,
		'Content-Type: text/html; charset="UTF-8"',
		"Content-Transfer-Encoding: base64",
		"",
		toBase64Wrapped(input.html),
		"",
		`--${boundary}--`,
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
	const when = formatAppointmentDate(input.dateIso, config.timeZone);
	const fromName = config.fromName || `${site.name} bookings`;

	const isInsurance = input.paymentMethod === "insurance";
	const paymentLabel = "Payment";
	const paymentValue = isInsurance
		? `Private medical insurance${input.insurer ? ` (${input.insurer})` : ""} — pending authorisation check`
		: "Self-pay (received)";
	const paymentLine = isInsurance
		? `Payment: Private medical insurance${input.insurer ? ` (${input.insurer})` : ""}. Pending authorisation check.`
		: "Payment: Self-pay (received).";

	const subject = isInsurance
		? `${site.name}: insurance booking pending authorisation`
		: `${site.name}: consultation confirmed`;
	const text = buildPlainText({
		name: input.name,
		when,
		timeLabel: input.timeLabel,
		type: input.type,
		paymentLine,
		pending: isInsurance,
	});
	const html = buildHtml({
		name: input.name,
		when,
		timeLabel: input.timeLabel,
		type: input.type,
		paymentLabel,
		paymentValue,
		pending: isInsurance,
	});

	const baseMime = {
		to: input.email,
		replyTo: config.fromEmail,
		bcc: config.bccEmail,
		subject,
		text,
		html,
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
