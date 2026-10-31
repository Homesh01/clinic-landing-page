export type TwilioConfig = {
	accountSid: string;
	authToken: string;
	fromNumber: string;
};

export function getTwilioEnvStatus(env: Env | undefined): {
	accountSid: boolean;
	authToken: boolean;
	fromNumber: boolean;
} {
	return {
		accountSid: Boolean(env?.TWILIO_ACCOUNT_SID?.trim()),
		authToken: Boolean(env?.TWILIO_AUTH_TOKEN?.trim()),
		fromNumber: Boolean(env?.TWILIO_FROM_NUMBER?.trim()),
	};
}

export function getTwilioConfig(env: Env | undefined): TwilioConfig | null {
	const status = getTwilioEnvStatus(env);
	if (!status.accountSid || !status.authToken || !status.fromNumber) {
		return null;
	}
	return {
		accountSid: env!.TWILIO_ACCOUNT_SID!.trim(),
		authToken: env!.TWILIO_AUTH_TOKEN!.trim(),
		fromNumber: env!.TWILIO_FROM_NUMBER!.trim(),
	};
}

export type TwilioSendResult =
	| {
			ok: true;
			sid: string;
			status: string;
	  }
	| {
			ok: false;
			status: "failed";
			errorCode: string;
			errorMessage: string;
	  };

/**
 * Send one administrative SMS via Twilio REST (no SDK).
 * Does not log message body or destination number.
 */
export async function sendTwilioSms(
	config: TwilioConfig,
	input: { toE164: string; body: string },
): Promise<TwilioSendResult> {
	const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
	const credentials = btoa(`${config.accountSid}:${config.authToken}`);
	const body = new URLSearchParams({
		To: input.toE164,
		From: config.fromNumber,
		Body: input.body,
	});

	const response = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Basic ${credentials}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body,
	});

	let payload: {
		sid?: string;
		status?: string;
		error_code?: number | string | null;
		error_message?: string | null;
		message?: string;
		code?: number | string;
	} = {};
	try {
		payload = (await response.json()) as typeof payload;
	} catch {
		payload = {};
	}

	if (!response.ok) {
		return {
			ok: false,
			status: "failed",
			errorCode: String(payload.code ?? payload.error_code ?? response.status),
			errorMessage: "Twilio rejected the message.",
		};
	}

	const sid = payload.sid?.trim();
	if (!sid) {
		return {
			ok: false,
			status: "failed",
			errorCode: "missing_sid",
			errorMessage: "Twilio response was incomplete.",
		};
	}

	// Twilio often returns "queued" immediately on accept. For send-result-only
	// mode (no delivery webhook), treat API acceptance as "sent".
	const raw = (payload.status ?? "sent").toLowerCase();
	const accepted = new Set(["queued", "accepted", "sending", "sent"]);
	return {
		ok: true,
		sid,
		status: accepted.has(raw) ? "sent" : raw,
	};
}
