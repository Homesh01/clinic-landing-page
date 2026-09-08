import { locations } from "~/data/content";

/** Default in-person clinic for bookings (for now: UCH Macmillan). */
export const IN_PERSON_CLINIC = locations[0];

export const APPOINTMENT_FORMATS = ["in-person", "virtual"] as const;
export type AppointmentFormat = (typeof APPOINTMENT_FORMATS)[number];

export function isAppointmentFormat(value: string): value is AppointmentFormat {
	return (APPOINTMENT_FORMATS as readonly string[]).includes(value);
}

export function appointmentFormatLabel(format: AppointmentFormat): string {
	return format === "virtual" ? "Virtual" : "In person";
}

export function inPersonLocationLines(): string[] {
	return [...IN_PERSON_CLINIC.addressLines];
}

export function inPersonLocationSingleLine(): string {
	return `${IN_PERSON_CLINIC.name}, ${IN_PERSON_CLINIC.addressLines.join(", ")}`;
}
