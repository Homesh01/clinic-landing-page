import type { ManagedBooking } from "~/utils/google-calendar.server";

/** YYYY-MM-DD in Europe/London. */
export function londonDateIso(date = new Date()): string {
	return date.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

export function partitionUpcomingBookings(bookings: ManagedBooking[]) {
	const today = londonDateIso();
	const todayBookings = bookings.filter((b) => b.dateIso === today);
	const laterBookings = bookings.filter((b) => b.dateIso > today);
	return { today, todayBookings, laterBookings };
}
