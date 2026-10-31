export type PatientFieldErrors = {
	name?: string;
	postalAddress?: string;
	email?: string;
	phone?: string;
};

export type ValidatedPatientInput = {
	name: string;
	postalAddress: string;
	email: string;
	phone: string;
};

const EMAIL_RE =
	/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const NAME_RE =
	/^[\p{L}][\p{L}\p{M}'’.\-]*(?:[ ]+[\p{L}][\p{L}\p{M}'’.\-]*)+$/u;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

const MAX_NAME = 80;
const MAX_EMAIL = 120;
const MAX_PHONE = 20;
const MAX_ADDRESS = 400;
export const MAX_SMS_BODY = 480;

function cleanText(value: string): string {
	return value
		.normalize("NFKC")
		.replace(/[\u0000-\u001F\u007F]+/g, "")
		.trim();
}

/** Accept +44… or digits with spaces; return E.164 or empty if invalid shape. */
export function normalisePhoneE164(raw: string): string {
	const cleaned = cleanText(raw).replace(/[\s().-]/g, "");
	if (PHONE_RE.test(cleaned)) return cleaned;
	if (/^00[1-9]\d{7,14}$/.test(cleaned)) return `+${cleaned.slice(2)}`;
	if (/^[1-9]\d{7,14}$/.test(cleaned)) return `+${cleaned}`;
	return cleaned.startsWith("+") ? cleaned : "";
}

export function validatePatientForm(input: {
	name: string;
	postalAddress: string;
	email: string;
	phone: string;
}):
	| { ok: true; data: ValidatedPatientInput }
	| { ok: false; errors: PatientFieldErrors; error: string } {
	const errors: PatientFieldErrors = {};
	const name = cleanText(input.name);
	const postalAddress = cleanText(input.postalAddress);
	const email = cleanText(input.email).toLowerCase();
	const phone = normalisePhoneE164(input.phone);

	if (!name) {
		errors.name = "Enter the patient’s full name.";
	} else if (name.length > MAX_NAME) {
		errors.name = "Name must be 80 characters or fewer.";
	} else if (!NAME_RE.test(name)) {
		errors.name = "Enter first and last name.";
	}

	if (!postalAddress) {
		errors.postalAddress = "Enter a postal address.";
	} else if (postalAddress.length > MAX_ADDRESS) {
		errors.postalAddress = "Address must be 400 characters or fewer.";
	}

	if (!email) {
		errors.email = "Enter an email address.";
	} else if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
		errors.email = "Enter a valid email address.";
	}

	if (!phone) {
		errors.phone = "Enter a telephone number with country code.";
	} else if (phone.length > MAX_PHONE || !PHONE_RE.test(phone)) {
		errors.phone =
			"Enter a valid phone number with country code (for example +44 7911 123456).";
	}

	if (Object.keys(errors).length > 0) {
		return {
			ok: false,
			errors,
			error: "Please correct the highlighted fields and try again.",
		};
	}

	return {
		ok: true,
		data: { name, postalAddress, email, phone },
	};
}

export function validateSmsBody(
	raw: string,
): { ok: true; body: string } | { ok: false; error: string } {
	const body = cleanText(raw);
	if (!body) {
		return { ok: false, error: "Enter a message to send." };
	}
	if (body.length > MAX_SMS_BODY) {
		return {
			ok: false,
			error: `Messages must be ${MAX_SMS_BODY} characters or fewer.`,
		};
	}
	return { ok: true, body };
}
