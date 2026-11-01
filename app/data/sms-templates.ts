export type SmsTemplate = {
	slug: string;
	label: string;
	body: string;
};

/** Code-defined administrative SMS presets. Use {{name}} for the contact name. */
export const SMS_TEMPLATES: readonly SmsTemplate[] = [
	{
		slug: "results-ready",
		label: "Results ready",
		body: "Hello {{name}}, your results are ready. Please contact Personalised Cancer Care to arrange a discussion.",
	},
	{
		slug: "appointment-reminder",
		label: "Appointment reminder",
		body: "Hello {{name}}, this is a reminder of your upcoming appointment with Personalised Cancer Care. If you need to reschedule, please reply to your booking email or contact the clinic.",
	},
	{
		slug: "please-call",
		label: "Please call the clinic",
		body: "Hello {{name}}, please contact Personalised Cancer Care at your earliest convenience regarding your care.",
	},
] as const;

export function getSmsTemplate(slug: string | null | undefined): SmsTemplate | null {
	if (!slug) return null;
	return SMS_TEMPLATES.find((t) => t.slug === slug) ?? null;
}

export function applySmsTemplate(
	template: SmsTemplate,
	vars: { name: string },
): string {
	const name = vars.name.trim() || "there";
	return template.body.replaceAll("{{name}}", name);
}
