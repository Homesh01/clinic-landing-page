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
};

const SITE_URL = "https://personalisedcancercare.com";
const COLORS = {
	ink: "#15202b",
	inkSoft: "#2a3644",
	inkMuted: "#5d6b78",
	cream: "#f8f7f4",
	mist: "#eef2f4",
	line: "#dce3e8",
	accent: "#1f6f6a",
	accentDeep: "#155652",
	accentSoft: "#e4f1ef",
	white: "#ffffff",
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

function detailRow(icon: string, label: string, value: string): string {
	return `
		<tr>
			<td style="padding:0 0 14px 0;">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
					<tr>
						<td valign="top" width="40" style="width:40px;padding-right:14px;">
							<div style="width:36px;height:36px;border-radius:8px;background:${COLORS.accentSoft};color:${COLORS.accent};font-size:16px;line-height:36px;text-align:center;">
								${icon}
							</div>
						</td>
						<td valign="middle" style="font-family:'Source Sans 3',Arial,Helvetica,sans-serif;">
							<div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.inkMuted};font-weight:600;">
								${label}
							</div>
							<div style="margin-top:3px;font-size:16px;line-height:1.4;color:${COLORS.ink};font-weight:600;">
								${value}
							</div>
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
	fromName: string;
}): string {
	return [
		`Dear ${input.name},`,
		"",
		`Your consultation with ${site.name} is confirmed.`,
		"",
		`Date: ${input.when}`,
		`Time: ${input.timeLabel} (UK time)`,
		`Type: ${input.type}`,
		input.paymentLine,
		"",
		"This appointment has been added to your calendar. If you use Google Calendar, you should see it there shortly.",
		"",
		`Website: ${SITE_URL}`,
		`Book again: ${SITE_URL}/book`,
		"",
		"To change or cancel, reply to this email.",
		"",
		"Kind regards,",
		input.fromName,
		site.title,
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
	fromName: string;
}): string {
	const name = escapeHtml(input.name);
	const when = escapeHtml(input.when);
	const timeLabel = escapeHtml(input.timeLabel);
	const type = escapeHtml(input.type);
	const paymentLabel = escapeHtml(input.paymentLabel);
	const paymentValue = escapeHtml(input.paymentValue);
	const fromName = escapeHtml(input.fromName);
	const siteName = escapeHtml(site.name);
	const siteTitle = escapeHtml(site.title);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Consultation confirmed</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.mist};">
	<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.mist};padding:32px 16px;">
		<tr>
			<td align="center">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:${COLORS.white};border:1px solid ${COLORS.line};border-radius:4px;overflow:hidden;">
					<tr>
						<td style="height:6px;background:${COLORS.accent};font-size:0;line-height:0;">&nbsp;</td>
					</tr>
					<tr>
						<td style="padding:32px 32px 24px 32px;background:${COLORS.cream};border-bottom:1px solid ${COLORS.line};">
							<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;color:${COLORS.ink};font-weight:600;">
								${siteName}
							</div>
							<div style="margin-top:6px;font-family:'Source Sans 3',Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.inkMuted};">
								${siteTitle}
							</div>
						</td>
					</tr>
					<tr>
						<td style="padding:32px;">
							<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
								<tr>
									<td style="padding:6px 12px;border-radius:999px;background:${COLORS.accentSoft};font-family:'Source Sans 3',Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.accentDeep};font-weight:700;">
										&#10003; Booking confirmed
									</td>
								</tr>
							</table>
							<div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:${COLORS.ink};font-weight:600;">
								Dear ${name},
							</div>
							<p style="margin:14px 0 0 0;font-family:'Source Sans 3',Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${COLORS.inkSoft};">
								Your consultation with ${siteName} is confirmed. The details are below, and this appointment has been added to your calendar.
							</p>

							<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0;padding:20px;background:${COLORS.cream};border:1px solid ${COLORS.line};border-radius:4px;">
								${detailRow("&#128197;", "Date", when)}
								${detailRow("&#128338;", "Time", `${timeLabel} (UK time)`)}
								${detailRow("&#128203;", "Consultation", type)}
								${detailRow("&#128179;", paymentLabel, paymentValue)}
							</table>

							<p style="margin:0;font-family:'Source Sans 3',Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${COLORS.inkSoft};">
								To change or cancel your appointment, simply reply to this email.
							</p>

							<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
								<tr>
									<td>
										<a href="${SITE_URL}" style="display:inline-block;padding:14px 22px;background:${COLORS.accent};color:${COLORS.white};text-decoration:none;font-family:'Source Sans 3',Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;border-radius:3px;">
											Visit the website
										</a>
									</td>
									<td width="12" style="width:12px;font-size:0;">&nbsp;</td>
									<td>
										<a href="${SITE_URL}/book" style="display:inline-block;padding:13px 20px;border:1px solid ${COLORS.line};background:${COLORS.white};color:${COLORS.ink};text-decoration:none;font-family:'Source Sans 3',Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;border-radius:3px;">
											Book again
										</a>
									</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr>
						<td style="padding:22px 32px;background:${COLORS.cream};border-top:1px solid ${COLORS.line};">
							<p style="margin:0;font-family:'Source Sans 3',Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${COLORS.inkSoft};">
								Kind regards,<br />
								<strong style="color:${COLORS.ink};">${fromName}</strong><br />
								${siteTitle}
							</p>
							<p style="margin:14px 0 0 0;font-family:'Source Sans 3',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${COLORS.inkMuted};">
								<a href="${SITE_URL}" style="color:${COLORS.accent};text-decoration:none;">${SITE_URL.replace(/^https:\/\//, "")}</a>
								&nbsp;&middot;&nbsp;
								<a href="mailto:${escapeHtml(contact.email)}" style="color:${COLORS.accent};text-decoration:none;">${escapeHtml(contact.email)}</a>
							</p>
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
		? `Private medical insurance${input.insurer ? ` (${input.insurer})` : ""} — the clinic will bill your insurer`
		: "Self-pay (received)";
	const paymentLine = isInsurance
		? `Payment: Private medical insurance${input.insurer ? ` (${input.insurer})` : ""}. The clinic will bill your insurer.`
		: "Payment: Self-pay (received).";

	const subject = `${site.name}: consultation confirmed`;
	const text = buildPlainText({
		name: input.name,
		when,
		timeLabel: input.timeLabel,
		type: input.type,
		paymentLine,
		fromName,
	});
	const html = buildHtml({
		name: input.name,
		when,
		timeLabel: input.timeLabel,
		type: input.type,
		paymentLabel,
		paymentValue,
		fromName,
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
