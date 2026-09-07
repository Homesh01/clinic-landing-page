export type PhoneCountry = {
	/** ISO 3166-1 alpha-2 */
	iso: string;
	name: string;
	/** Dial code digits only, e.g. "44" */
	dial: string;
};

/** Curated list for the booking form — UK first as clinic default. */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
	{ iso: "GB", name: "United Kingdom", dial: "44" },
	{ iso: "IE", name: "Ireland", dial: "353" },
	{ iso: "US", name: "United States", dial: "1" },
	{ iso: "CA", name: "Canada", dial: "1" },
	{ iso: "AU", name: "Australia", dial: "61" },
	{ iso: "NZ", name: "New Zealand", dial: "64" },
	{ iso: "AE", name: "United Arab Emirates", dial: "971" },
	{ iso: "SA", name: "Saudi Arabia", dial: "966" },
	{ iso: "QA", name: "Qatar", dial: "974" },
	{ iso: "KW", name: "Kuwait", dial: "965" },
	{ iso: "BH", name: "Bahrain", dial: "973" },
	{ iso: "OM", name: "Oman", dial: "968" },
	{ iso: "IN", name: "India", dial: "91" },
	{ iso: "PK", name: "Pakistan", dial: "92" },
	{ iso: "BD", name: "Bangladesh", dial: "880" },
	{ iso: "NG", name: "Nigeria", dial: "234" },
	{ iso: "ZA", name: "South Africa", dial: "27" },
	{ iso: "KE", name: "Kenya", dial: "254" },
	{ iso: "GH", name: "Ghana", dial: "233" },
	{ iso: "FR", name: "France", dial: "33" },
	{ iso: "DE", name: "Germany", dial: "49" },
	{ iso: "ES", name: "Spain", dial: "34" },
	{ iso: "IT", name: "Italy", dial: "39" },
	{ iso: "PT", name: "Portugal", dial: "351" },
	{ iso: "NL", name: "Netherlands", dial: "31" },
	{ iso: "BE", name: "Belgium", dial: "32" },
	{ iso: "CH", name: "Switzerland", dial: "41" },
	{ iso: "AT", name: "Austria", dial: "43" },
	{ iso: "SE", name: "Sweden", dial: "46" },
	{ iso: "NO", name: "Norway", dial: "47" },
	{ iso: "DK", name: "Denmark", dial: "45" },
	{ iso: "FI", name: "Finland", dial: "358" },
	{ iso: "PL", name: "Poland", dial: "48" },
	{ iso: "RO", name: "Romania", dial: "40" },
	{ iso: "GR", name: "Greece", dial: "30" },
	{ iso: "TR", name: "Türkiye", dial: "90" },
	{ iso: "EG", name: "Egypt", dial: "20" },
	{ iso: "CN", name: "China", dial: "86" },
	{ iso: "HK", name: "Hong Kong", dial: "852" },
	{ iso: "SG", name: "Singapore", dial: "65" },
	{ iso: "MY", name: "Malaysia", dial: "60" },
	{ iso: "JP", name: "Japan", dial: "81" },
	{ iso: "KR", name: "South Korea", dial: "82" },
	{ iso: "BR", name: "Brazil", dial: "55" },
	{ iso: "MX", name: "Mexico", dial: "52" },
] as const;

export const DEFAULT_PHONE_COUNTRY_ISO = "GB";

export function findPhoneCountry(iso: string): PhoneCountry | undefined {
	return PHONE_COUNTRIES.find((country) => country.iso === iso);
}

/** Strip a leading 0 from national numbers (common UK/EU local format). */
export function nationalDigits(value: string): string {
	const digits = value.replace(/\D/g, "");
	if (digits.startsWith("0") && digits.length > 1) {
		return digits.slice(1);
	}
	return digits;
}

/** Build E.164-style number for storage (+447911123456). */
export function formatInternationalPhone(
	dialCode: string,
	nationalNumber: string,
): string {
	const dial = dialCode.replace(/\D/g, "");
	const national = nationalDigits(nationalNumber);
	if (!dial || !national) return "";
	return `+${dial}${national}`;
}

export function phoneCountryLabel(country: PhoneCountry): string {
	return `${country.name} (+${country.dial})`;
}
