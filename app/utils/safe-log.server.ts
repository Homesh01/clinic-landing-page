/**
 * Minimal server logging for Cloudflare Workers.
 * Avoids dumping request bodies, tokens, or full error objects that may
 * contain patient or payment details into Workers observability.
 */

function redact(value: string): string {
	return value
		.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
		.replace(/\bsk_(?:live|test)_[A-Za-z0-9]+\b/g, "[stripe_key]")
		.replace(/\bwhsec_[A-Za-z0-9]+\b/g, "[webhook_secret]")
		.replace(/\bcs_(?:live|test)_[A-Za-z0-9]+\b/g, "[checkout_session]")
		.replace(/\bpi_[A-Za-z0-9]+\b/g, "[payment_intent]")
		.replace(/\bBearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]")
		.replace(/\beya[A-Za-z0-9_\-]{20,}\b/g, "[token]")
		.slice(0, 280);
}

export function safeErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return redact(error.message || error.name || "Error");
	}
	if (typeof error === "string") {
		return redact(error);
	}
	return "unknown_error";
}

/** Log an operational failure without serialising nested patient/payment payloads. */
export function logServerError(context: string, error: unknown): void {
	const name = error instanceof Error ? error.name : typeof error;
	console.error(context, {
		name,
		message: safeErrorMessage(error),
	});
}
