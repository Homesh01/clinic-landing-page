/** Format a calendar date ISO (YYYY-MM-DD) for UK clinic copy. */
export function formatBookingDate(dateIso: string): string {
	const [year, month, day] = dateIso.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day, 12));
	return new Intl.DateTimeFormat("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "Europe/London",
	}).format(date);
}
