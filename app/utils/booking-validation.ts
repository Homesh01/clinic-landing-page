const CONSULTATION_TYPES = [
	"New Patient Consultation",
	"Second Opinion",
	"Follow-up / Monitoring",
	"Virtual Consultation",
] as const;

export type ConsultationType = (typeof CONSULTATION_TYPES)[number];

export { CONSULTATION_TYPES };

export type BookingFieldErrors = {
	date?: string;
	time?: string;
	name?: string;
	email?: string;
	phone?: string;
	type?: string;
	notes?: string;
};

export type ValidatedBookingInput = {
	dateIso: string;
	timeLabel: string;
	name: string;
	email: string;
	phone: string;
	type: ConsultationType;
	notes?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE =
	/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const NAME_RE =
	/^[\p{L}][\p{L}\p{M}'’.\-]*(?:[ ]+[\p{L}][\p{L}\p{M}'’.\-]*)+$/u;
const PHONE_RE = /^\+?[0-9][0-9\s().\-]{6,24}$/;

const MAX_NAME = 80;
const MAX_EMAIL = 120;
const MAX_PHONE = 30;
const MAX_NOTES = 1000;

function cleanText(value: string): string {
	return value
		.normalize("NFKC")
		.replace(/[\u0000-\u001F\u007F]/g, "")
		.trim();
}

function isAllowedConsultationType(value: string): value is ConsultationType {
	return (CONSULTATION_TYPES as readonly string[]).includes(value);
}

export function validateBookingForm(input: {
	dateIso: string;
	timeLabel: string;
	name: string;
	email: string;
	phone: string;
	type: string;
	notes: string;
	allowedTimesForDate: readonly string[];
}):
	| { ok: true; data: ValidatedBookingInput }
	| { ok: false; errors: BookingFieldErrors; error: string } {
	const errors: BookingFieldErrors = {};

	const dateIso = cleanText(input.dateIso);
	const timeLabel = cleanText(input.timeLabel);
	const name = cleanText(input.name);
	const email = cleanText(input.email).toLowerCase();
	const phone = cleanText(input.phone);
	const type = cleanText(input.type);
	const notes = cleanText(input.notes);

	if (!DATE_RE.test(dateIso)) {
		errors.date = "Please choose a valid date.";
	}

	if (!TIME_RE.test(timeLabel)) {
		errors.time = "Please choose a valid time.";
	} else if (!input.allowedTimesForDate.includes(timeLabel)) {
		errors.time = "That time is no longer available. Please choose another.";
	}

	if (!name) {
		errors.name = "Please enter your full name.";
	} else if (name.length > MAX_NAME) {
		errors.name = "Name must be 80 characters or fewer.";
	} else if (!NAME_RE.test(name)) {
		errors.name = "Please enter your first and last name.";
	}

	if (!email) {
		errors.email = "Please enter your email address.";
	} else if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
		errors.email = "Please enter a valid email address.";
	}

	if (!phone) {
		errors.phone = "Please enter a contact number.";
	} else if (phone.length > MAX_PHONE || !PHONE_RE.test(phone)) {
		errors.phone =
			"Please enter a valid phone number (digits, spaces, +, or brackets).";
	} else {
		const digitCount = phone.replace(/\D/g, "").length;
		if (digitCount < 8 || digitCount > 15) {
			errors.phone = "Phone number should contain 8 to 15 digits.";
		}
	}

	if (!type || !isAllowedConsultationType(type)) {
		errors.type = "Please choose a consultation type.";
	}

	if (notes.length > MAX_NOTES) {
		errors.notes = "Notes must be 1000 characters or fewer.";
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
		data: {
			dateIso,
			timeLabel,
			name,
			email,
			phone,
			type: type as ConsultationType,
			notes: notes || undefined,
		},
	};
}
