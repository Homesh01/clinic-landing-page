import {
	BookingConflictError,
	createBookingEvent,
	getBookingConfig,
	patchBookingPaymentDetails,
} from "~/utils/google-calendar.server";
import { sendPatientBookingConfirmation } from "~/utils/booking-email.server";
import type { ValidatedBookingInput } from "~/utils/booking-validation";
import { CONSULTATION_TYPES } from "~/utils/booking-validation";
import { site } from "~/data/content";

export type StripeConfig = {
	secretKey: string;
	webhookSecret?: string;
};

const STANDARD_AMOUNT_PENCE = 350_00;
const FOLLOW_UP_AMOUNT_PENCE = 250_00;

/** Google Calendar event ids may only use [a-v0-9]. */
export async function calendarEventIdForStripeSession(
	sessionId: string,
): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(sessionId),
	);
	const hex = [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	return `bk${hex}`;
}

export function getStripeConfig(env: Env | undefined): StripeConfig | null {
	const secretKey = env?.STRIPE_SECRET_KEY?.trim()
		.replace(/^["']|["']$/g, "")
		.trim();
	if (!secretKey) return null;
	return {
		secretKey,
		webhookSecret:
			env?.STRIPE_WEBHOOK_SECRET?.trim()
				.replace(/^["']|["']$/g, "")
				.trim() || undefined,
	};
}

export function consultationAmountPence(type: string): number {
	return type === "Follow-up / Monitoring"
		? FOLLOW_UP_AMOUNT_PENCE
		: STANDARD_AMOUNT_PENCE;
}

export function formatGbpFromPence(amountPence: number): string {
	return new Intl.NumberFormat("en-GB", {
		style: "currency",
		currency: "GBP",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amountPence / 100);
}

type CheckoutSession = {
	id: string;
	url: string | null;
	payment_status: string;
	status: string;
	customer_email?: string | null;
	metadata?: Record<string, string> | null;
	payment_intent?: string | { id: string; amount?: number; status?: string } | null;
};

async function stripeRequest<T>(
	secretKey: string,
	path: string,
	init?: RequestInit & { form?: Record<string, string> },
): Promise<T> {
	const { form, headers: initHeaders, ...rest } = init ?? {};
	const headers: HeadersInit = {
		Authorization: `Bearer ${secretKey}`,
		...(initHeaders ?? {}),
	};

	let body: BodyInit | undefined = rest.body ?? undefined;
	if (form) {
		(headers as Record<string, string>)["Content-Type"] =
			"application/x-www-form-urlencoded";
		body = new URLSearchParams(form);
	}

	const response = await fetch(`https://api.stripe.com/v1${path}`, {
		...rest,
		method: form ? rest.method ?? "POST" : rest.method,
		headers,
		body,
	});

	const data = (await response.json()) as T & {
		error?: { message?: string };
	};

	if (!response.ok) {
		throw new Error(data.error?.message || `Stripe request failed (${path})`);
	}

	return data;
}

function bookingToMetadata(
	input: ValidatedBookingInput & { bookingRef: string },
): Record<string, string> {
	return {
		dateIso: input.dateIso,
		timeLabel: input.timeLabel,
		name: input.name.slice(0, 500),
		email: input.email.slice(0, 500),
		phone: input.phone.slice(0, 500),
		type: input.type.slice(0, 500),
		paymentMethod: "self-pay",
		notes: (input.notes ?? "").slice(0, 500),
		bookingRef: input.bookingRef.slice(0, 32),
	};
}

function metadataToBooking(
	metadata: Record<string, string> | null | undefined,
): (ValidatedBookingInput & { bookingRef?: string }) | null {
	if (!metadata?.dateIso || !metadata.timeLabel || !metadata.name) return null;
	if (!metadata.email || !metadata.phone || !metadata.type) return null;
	if (!(CONSULTATION_TYPES as readonly string[]).includes(metadata.type)) {
		return null;
	}

	return {
		dateIso: metadata.dateIso,
		timeLabel: metadata.timeLabel,
		name: metadata.name,
		email: metadata.email,
		phone: metadata.phone,
		type: metadata.type as ValidatedBookingInput["type"],
		paymentMethod: "self-pay",
		notes: metadata.notes?.trim() ? metadata.notes.trim() : undefined,
		bookingRef: metadata.bookingRef?.trim() || undefined,
	};
}

export async function createBookingCheckoutSession(input: {
	stripe: StripeConfig;
	booking: ValidatedBookingInput;
	bookingRef: string;
	successUrl: string;
	cancelUrl: string;
}): Promise<{ id: string; url: string }> {
	const amount = consultationAmountPence(input.booking.type);
	const metadata = bookingToMetadata({
		...input.booking,
		bookingRef: input.bookingRef,
	});

	const form: Record<string, string> = {
		mode: "payment",
		success_url: input.successUrl,
		cancel_url: input.cancelUrl,
		customer_email: input.booking.email,
		client_reference_id: `${input.booking.dateIso}_${input.booking.timeLabel}`,
		"line_items[0][quantity]": "1",
		"line_items[0][price_data][currency]": "gbp",
		"line_items[0][price_data][unit_amount]": String(amount),
		"line_items[0][price_data][product_data][name]": `Consultation — ${input.booking.type}`,
		"line_items[0][price_data][product_data][description]": `${site.name} · ${input.booking.dateIso} ${input.booking.timeLabel} (UK)`,
		"payment_intent_data[description]": `${site.name} consultation (${input.booking.type})`,
	};

	for (const [key, value] of Object.entries(metadata)) {
		form[`metadata[${key}]`] = value;
		form[`payment_intent_data[metadata][${key}]`] = value;
	}

	const session = await stripeRequest<CheckoutSession>(
		input.stripe.secretKey,
		"/checkout/sessions",
		{ method: "POST", form },
	);

	if (!session.url) {
		throw new Error("Stripe Checkout session did not return a URL");
	}

	return { id: session.id, url: session.url };
}

export async function retrieveCheckoutSession(
	stripe: StripeConfig,
	sessionId: string,
): Promise<CheckoutSession> {
	return stripeRequest<CheckoutSession>(
		stripe.secretKey,
		`/checkout/sessions/${encodeURIComponent(sessionId)}`,
	);
}

export async function refundPaidCheckoutSession(
	stripe: StripeConfig,
	sessionId: string,
): Promise<{ refundId: string; amountPence: number; alreadyRefunded: boolean }> {
	const session = await retrieveCheckoutSession(stripe, sessionId);
	const paymentIntentId =
		typeof session.payment_intent === "string"
			? session.payment_intent
			: session.payment_intent?.id;
	if (!paymentIntentId) {
		throw new Error("Paid session is missing a payment to refund.");
	}
	return refundPaymentIntent(stripe, paymentIntentId);
}

export async function refundPaymentIntent(
	stripe: StripeConfig,
	paymentIntentId: string,
): Promise<{ refundId: string; amountPence: number; alreadyRefunded: boolean }> {
	try {
		const refund = await stripeRequest<{
			id: string;
			amount: number;
			status: string;
		}>(stripe.secretKey, "/refunds", {
			method: "POST",
			form: {
				payment_intent: paymentIntentId,
				reason: "requested_by_customer",
			},
		});
		return {
			refundId: refund.id,
			amountPence: refund.amount,
			alreadyRefunded: false,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (
			/already been refunded|has already been refunded|charge_already_refunded/i.test(
				message,
			)
		) {
			const pi = await stripeRequest<{
				id: string;
				amount?: number;
				amount_received?: number;
			}>(
				stripe.secretKey,
				`/payment_intents/${encodeURIComponent(paymentIntentId)}`,
			);
			return {
				refundId: paymentIntentId,
				amountPence: pi.amount_received ?? pi.amount ?? 0,
				alreadyRefunded: true,
			};
		}
		throw error;
	}
}

/** Resolve a PaymentIntent id from session id, PI id, or booking metadata search. */
export async function resolvePaymentIntentForBooking(
	stripe: StripeConfig,
	input: {
		bookingRef: string;
		stripeSessionId?: string;
		stripePaymentIntentId?: string;
		email?: string;
		dateIso?: string;
		timeLabel?: string;
	},
): Promise<string | null> {
	if (input.stripePaymentIntentId?.startsWith("pi_")) {
		return input.stripePaymentIntentId;
	}

	if (input.stripeSessionId?.startsWith("cs_")) {
		try {
			const session = await retrieveCheckoutSession(
				stripe,
				input.stripeSessionId,
			);
			const fromSession =
				typeof session.payment_intent === "string"
					? session.payment_intent
					: session.payment_intent?.id;
			if (fromSession) return fromSession;
		} catch (error) {
			console.error("Stripe session retrieve for refund failed:", error);
		}
	}

	const safeRef = input.bookingRef.replace(/[^A-Za-z0-9-]/g, "");
	const safeEmail = (input.email ?? "").trim().toLowerCase().replace(/'/g, "");
	const safeDate = (input.dateIso ?? "").replace(/[^0-9-]/g, "");
	const safeTime = (input.timeLabel ?? "").replace(/[^0-9:]/g, "");

	const trySearch = async (query: string): Promise<string | null> => {
		const piSearch = await stripeRequest<{
			data?: { id: string; status?: string }[];
		}>(
			stripe.secretKey,
			`/payment_intents/search?${new URLSearchParams({
				query,
				limit: "5",
			}).toString()}`,
		);
		const succeeded = (piSearch.data ?? []).find(
			(pi) => pi.status === "succeeded",
		);
		return succeeded?.id ?? null;
	};

	if (safeRef) {
		try {
			const byRef = await trySearch(`metadata['bookingRef']:'${safeRef}'`);
			if (byRef) return byRef;
		} catch (error) {
			console.error("Stripe payment_intent search by bookingRef failed:", error);
		}
	}

	if (safeEmail && safeDate && safeTime) {
		try {
			const bySlot = await trySearch(
				`metadata['email']:'${safeEmail}' AND metadata['dateIso']:'${safeDate}' AND metadata['timeLabel']:'${safeTime}'`,
			);
			if (bySlot) return bySlot;
		} catch (error) {
			console.error("Stripe payment_intent search by slot failed:", error);
		}
	}

	if (safeRef) {
		try {
			const sessionId = await findPaidCheckoutSessionByBookingRef(
				stripe,
				safeRef,
			);
			if (sessionId) {
				const session = await retrieveCheckoutSession(stripe, sessionId);
				const fromSession =
					typeof session.payment_intent === "string"
						? session.payment_intent
						: session.payment_intent?.id;
				if (fromSession) return fromSession;
			}
		} catch (error) {
			console.error("Stripe checkout session search failed:", error);
		}
	}

	// Final fallback when Search API is unavailable: scan recent PaymentIntents.
	try {
		const scanned = await findPaymentIntentByScanning(stripe, {
			bookingRef: safeRef,
			email: safeEmail,
			dateIso: safeDate,
			timeLabel: safeTime,
		});
		if (scanned) return scanned;
	} catch (error) {
		console.error("Stripe payment_intent scan failed:", error);
	}

	return null;
}

type StripePaymentIntentListItem = {
	id: string;
	status?: string;
	metadata?: Record<string, string> | null;
};

async function findPaymentIntentByScanning(
	stripe: StripeConfig,
	input: {
		bookingRef: string;
		email: string;
		dateIso: string;
		timeLabel: string;
	},
): Promise<string | null> {
	let startingAfter: string | undefined;
	for (let page = 0; page < 5; page += 1) {
		const params = new URLSearchParams({ limit: "100" });
		if (startingAfter) params.set("starting_after", startingAfter);
		const result = await stripeRequest<{
			data?: StripePaymentIntentListItem[];
			has_more?: boolean;
		}>(stripe.secretKey, `/payment_intents?${params.toString()}`);

		for (const pi of result.data ?? []) {
			if (pi.status !== "succeeded") continue;
			const meta = pi.metadata ?? {};
			if (input.bookingRef && meta.bookingRef === input.bookingRef) {
				return pi.id;
			}
			if (
				input.email &&
				input.dateIso &&
				input.timeLabel &&
				meta.email?.toLowerCase() === input.email &&
				meta.dateIso === input.dateIso &&
				meta.timeLabel === input.timeLabel
			) {
				return pi.id;
			}
		}

		if (!result.has_more || !result.data?.length) break;
		startingAfter = result.data[result.data.length - 1]?.id;
	}
	return null;
}

/** Look up a paid Checkout session by booking reference when calendar metadata is missing. */
export async function findPaidCheckoutSessionByBookingRef(
	stripe: StripeConfig,
	bookingRef: string,
): Promise<string | null> {
	const safeRef = bookingRef.replace(/[^A-Za-z0-9-]/g, "");
	if (!safeRef) return null;

	const query = `metadata['bookingRef']:'${safeRef}'`;
	const result = await stripeRequest<{
		data?: { id: string; payment_status?: string }[];
	}>(
		stripe.secretKey,
		`/checkout/sessions/search?${new URLSearchParams({
			query,
			limit: "5",
		}).toString()}`,
	);

	const paid = (result.data ?? []).find(
		(session) => session.payment_status === "paid",
	);
	return paid?.id ?? null;
}

async function markSessionFulfilled(
	stripe: StripeConfig,
	sessionId: string,
	eventId: string,
	bookingRef: string,
	paymentIntentId?: string,
): Promise<void> {
	await stripeRequest(stripe.secretKey, `/checkout/sessions/${encodeURIComponent(sessionId)}`, {
		method: "POST",
		form: {
			"metadata[calendar_event_id]": eventId,
			"metadata[bookingRef]": bookingRef,
			"metadata[fulfilled]": "1",
			...(paymentIntentId
				? { "metadata[payment_intent_id]": paymentIntentId }
				: {}),
		},
	});
}

function successFromBooking(
	booking: ValidatedBookingInput & { bookingRef?: string },
	alreadyFulfilled: boolean,
	emailSent: boolean,
): FulfillmentResult {
	return {
		ok: true,
		alreadyFulfilled,
		dateIso: booking.dateIso,
		timeLabel: booking.timeLabel,
		name: booking.name,
		emailSent,
		bookingRef: booking.bookingRef,
	};
}

export type FulfillmentResult =
	| {
			ok: true;
			alreadyFulfilled?: boolean;
			dateIso: string;
			timeLabel: string;
			name: string;
			emailSent: boolean;
			bookingRef?: string;
	  }
	| { ok: false; error: string };

async function readFulfilledBooking(
	stripe: StripeConfig,
	sessionId: string,
): Promise<(ValidatedBookingInput & { bookingRef?: string }) | null> {
	const session = await retrieveCheckoutSession(stripe, sessionId);
	if (session.metadata?.fulfilled !== "1") return null;
	return metadataToBooking(session.metadata);
}

export async function fulfillPaidCheckoutSession(input: {
	env: Env;
	stripe: StripeConfig;
	session: CheckoutSession;
}): Promise<FulfillmentResult> {
	// Always re-fetch so webhook + success-page races see the latest metadata.
	const session = await retrieveCheckoutSession(
		input.stripe,
		input.session.id,
	);

	if (session.payment_status !== "paid") {
		return { ok: false, error: "Payment has not been completed." };
	}

	const booking = metadataToBooking(session.metadata);
	if (!booking) {
		return { ok: false, error: "Paid session is missing booking details." };
	}

	if (session.metadata?.fulfilled === "1") {
		return successFromBooking(booking, true, true);
	}

	const calendarConfig = getBookingConfig(input.env);
	if (!calendarConfig) {
		return {
			ok: false,
			error: "Booking calendar is not configured after payment.",
		};
	}

	try {
		const eventId = await calendarEventIdForStripeSession(session.id);
		const bookingRef =
			booking.bookingRef?.trim() ||
			session.metadata?.bookingRef?.trim() ||
			undefined;
		const paymentIntentId =
			typeof session.payment_intent === "string"
				? session.payment_intent
				: session.payment_intent?.id;
		const created = await createBookingEvent(calendarConfig, {
			...booking,
			eventId,
			bookingRef,
			paymentMethod: "self-pay",
			stripeSessionId: session.id,
			stripePaymentIntentId: paymentIntentId,
			notes: [
				booking.notes,
				`Stripe session: ${session.id}`,
				paymentIntentId ? `Stripe payment: ${paymentIntentId}` : null,
			]
				.filter(Boolean)
				.join("\n"),
		});
		await patchBookingPaymentDetails(calendarConfig, created.eventId, {
			bookingRef: created.bookingRef,
			email: booking.email,
			paymentMethod: "self-pay",
			stripeSessionId: session.id,
			stripePaymentIntentId: paymentIntentId,
		});
		await markSessionFulfilled(
			input.stripe,
			session.id,
			created.eventId,
			created.bookingRef,
			paymentIntentId,
		);

		if (created.alreadyExisted) {
			return successFromBooking(
				{ ...booking, bookingRef: created.bookingRef },
				true,
				true,
			);
		}

		let emailSent = true;
		try {
			await sendPatientBookingConfirmation(calendarConfig, {
				...booking,
				paymentMethod: "self-pay",
				bookingRef: created.bookingRef,
			});
		} catch (emailError) {
			emailSent = false;
			console.error("Post-payment confirmation email error:", emailError);
		}

		return successFromBooking(
			{ ...booking, bookingRef: created.bookingRef },
			false,
			emailSent,
		);
	} catch (error) {
		// Another request (webhook or success page) may have just fulfilled this payment.
		const fulfilledBooking = await readFulfilledBooking(
			input.stripe,
			session.id,
		);
		if (fulfilledBooking) {
			return successFromBooking(fulfilledBooking, true, true);
		}

		if (error instanceof BookingConflictError) {
			// Brief retry — the winner may still be writing Stripe metadata.
			await new Promise((resolve) => setTimeout(resolve, 800));
			const again = await readFulfilledBooking(input.stripe, session.id);
			if (again) {
				return successFromBooking(again, true, true);
			}

			return {
				ok: false,
				error:
					"Payment received, but that time was taken before confirmation. The clinic team will contact you to rearrange or refund.",
			};
		}

		console.error("Post-payment booking create error:", error);
		return {
			ok: false,
			error:
				"Payment received, but the appointment could not be confirmed automatically. The clinic team will contact you shortly.",
		};
	}
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
	if (a.byteLength !== b.byteLength) return false;
	let mismatch = 0;
	for (let i = 0; i < a.byteLength; i += 1) {
		mismatch |= a[i]! ^ b[i]!;
	}
	return mismatch === 0;
}

async function hmacSha256Hex(
	secret: string,
	payload: string,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(payload),
	);
	return [...new Uint8Array(signature)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function verifyStripeWebhookSignature(input: {
	payload: string;
	signatureHeader: string | null;
	webhookSecret: string;
	toleranceSeconds?: number;
}): Promise<boolean> {
	if (!input.signatureHeader) return false;

	const parts = Object.fromEntries(
		input.signatureHeader.split(",").map((item) => {
			const [key, ...rest] = item.split("=");
			return [key, rest.join("=")];
		}),
	);

	const timestamp = parts.t;
	const signature = parts.v1;
	if (!timestamp || !signature) return false;

	const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
	if (
		Number.isNaN(ageSeconds) ||
		ageSeconds > (input.toleranceSeconds ?? 300)
	) {
		return false;
	}

	const expected = await hmacSha256Hex(
		input.webhookSecret,
		`${timestamp}.${input.payload}`,
	);

	const encoder = new TextEncoder();
	return timingSafeEqualBytes(encoder.encode(expected), encoder.encode(signature));
}

export type StripeWebhookEvent = {
	id: string;
	type: string;
	data: { object: CheckoutSession };
};

export async function parseStripeWebhookEvent(
	payload: string,
): Promise<StripeWebhookEvent> {
	return JSON.parse(payload) as StripeWebhookEvent;
}
