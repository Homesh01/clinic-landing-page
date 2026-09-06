/** Crockford-ish alphabet — avoids I/O/0/1 for easier phone/email reading. */
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Public patient booking reference, e.g. PCC-K7M3N2P9 */
export function generateBookingRef(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	let body = "";
	for (const byte of bytes) {
		body += REF_ALPHABET[byte % REF_ALPHABET.length];
	}
	return `PCC-${body}`;
}

export function normalizeBookingRef(value: string): string {
	const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
	if (cleaned.startsWith("PCC") && cleaned.length >= 11) {
		return `PCC-${cleaned.slice(3, 11)}`;
	}
	if (/^[A-Z2-9]{8}$/.test(cleaned)) {
		return `PCC-${cleaned}`;
	}
	return cleaned ? `PCC-${cleaned}` : "";
}

export function isValidBookingRef(value: string): boolean {
	return /^PCC-[A-Z2-9]{8}$/.test(normalizeBookingRef(value));
}
