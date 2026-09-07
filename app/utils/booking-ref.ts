/** Crockford-ish alphabet — avoids I/O/0/1 for easier phone/email reading. */
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REF_BODY_RE = new RegExp(`^[${REF_ALPHABET}]{8}$`);

/** Public patient booking reference, e.g. PCC-K7M3N2P9 */
export function generateBookingRef(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	let body = "";
	for (const byte of bytes) {
		body += REF_ALPHABET[byte % REF_ALPHABET.length];
	}
	return `PCC-${body}`;
}

/**
 * Normalise user input to `PCC-XXXXXXXX`.
 * Rejects anything that is not exactly a PCC prefix + 8 valid body characters
 * (no silent truncation of longer / mistyped values).
 */
export function normalizeBookingRef(value: string): string {
	const compact = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
	const withPrefix = compact.match(/^PCC([A-Z2-9]{8})$/);
	if (withPrefix && REF_BODY_RE.test(withPrefix[1])) {
		return `PCC-${withPrefix[1]}`;
	}
	if (REF_BODY_RE.test(compact)) {
		return `PCC-${compact}`;
	}
	return "";
}

export function isValidBookingRef(value: string): boolean {
	return /^PCC-[A-Z2-9]{8}$/.test(normalizeBookingRef(value));
}
