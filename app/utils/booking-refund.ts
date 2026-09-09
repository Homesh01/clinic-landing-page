/** Self-pay patients may cancel/change online (with full refund on cancel) only if at least this many hours before the appointment. */
export const SELF_PAY_REFUND_MIN_HOURS = 48;

/** Build RFC3339 instant for a wall-clock time in the given IANA timezone. */
export function zonedDateTimeToUtc(
	dateIso: string,
	hours: number,
	minutes: number,
	timeZone: string,
): Date {
	const utcGuess = new Date(
		Date.UTC(
			Number(dateIso.slice(0, 4)),
			Number(dateIso.slice(5, 7)) - 1,
			Number(dateIso.slice(8, 10)),
			hours,
			minutes,
			0,
		),
	);

	const asLocal = new Date(utcGuess.toLocaleString("en-US", { timeZone }));
	const asUtc = new Date(
		utcGuess.toLocaleString("en-US", { timeZone: "UTC" }),
	);
	const offsetMs = asUtc.getTime() - asLocal.getTime();

	return new Date(utcGuess.getTime() + offsetMs);
}

export function isSelfPayRefundEligible(
	dateIso: string,
	timeLabel: string,
	timeZone: string,
	now: Date = new Date(),
): boolean {
	const [hourText, minuteText] = timeLabel.split(":");
	const hour = Number(hourText);
	const minute = Number(minuteText);
	if (Number.isNaN(hour) || Number.isNaN(minute)) return false;
	const start = zonedDateTimeToUtc(dateIso, hour, minute, timeZone);
	const minMs = SELF_PAY_REFUND_MIN_HOURS * 60 * 60 * 1000;
	return start.getTime() - now.getTime() >= minMs;
}

/** Same window as refund: self-pay online cancel/reschedule only when outside the late window. */
export function isSelfPayChangeAllowed(
	dateIso: string,
	timeLabel: string,
	timeZone: string,
	now: Date = new Date(),
): boolean {
	return isSelfPayRefundEligible(dateIso, timeLabel, timeZone, now);
}
