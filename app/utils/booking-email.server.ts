import type { BookingConfig } from "~/utils/google-calendar.server";
import { getAccessToken } from "~/utils/google-calendar.server";
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
	insurer?: string;
};

function toBase64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

function buildMimeMessage(input: {
	to: string;
	from?: string;
	replyTo?: string;
	bcc?: string;
	subject: string;
	text: string;
}): string {
	return [
		...(input.from ? [`From: ${input.from}`] : []),
		`To: ${input.to}`,
		...(input.replyTo ? [`Reply-To: ${input.replyTo}`] : []),
		...(input.bcc ? [`Bcc: ${input.bcc}`] : []),
		`Subject: ${input.subject}`,
		"MIME-Version: 1.0",
		'Content-Type: text/plain; charset="UTF-8"',
		"Content-Transfer-Encoding: 7bit",
		"",
		input.text,
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
	const paymentLines = isInsurance
		? [
				`Payment: Private medical insurance${input.insurer ? ` (${input.insurer})` : ""}`,
				"Payment: Private medical insurance. The clinic will bill your insurer.",
			]
		: ["Payment: Self-pay (received)."];

	const subject = `${site.name}: consultation confirmed`;
	const text = [
		`Dear ${input.name},`,
		"",
		`Your consultation with ${site.name} is confirmed.`,
		"",
		`Date: ${when}`,
		`Time: ${input.timeLabel} (UK time)`,
		`Type: ${input.type}`,
		...paymentLines,
		"",
		"This appointment has been added to your calendar. If you use Google Calendar, you should see it there shortly.",
		"",
		"To change or cancel, reply to this email.",
		"",
		"Kind regards,",
		fromName,
	].join("\n");

	const baseMime = {
		to: input.email,
		replyTo: config.fromEmail,
		bcc: config.bccEmail,
		subject,
		text,
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
