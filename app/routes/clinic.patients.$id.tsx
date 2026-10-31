import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/cloudflare";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
} from "@remix-run/react";
import { json } from "@remix-run/cloudflare";
import { useEffect, useState } from "react";
import { ClinicStaffChrome } from "~/components/clinic/ClinicStaffChrome";
import { PatientContactForm } from "~/components/clinic/PatientContactForm";
import { PageHero } from "~/components/PageHero";
import { requireClinicStaff } from "~/utils/clinic-staff.server";
import {
	getPatientById,
	getPatientsDb,
	insertSmsMessage,
	listSmsForPatient,
	updatePatient,
	updateSmsMessageStatus,
} from "~/utils/patients.server";
import {
	MAX_SMS_BODY,
	validatePatientForm,
	validateSmsBody,
	type PatientFieldErrors,
} from "~/utils/patient-validation";
import { logServerError } from "~/utils/safe-log.server";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";
import { getTwilioConfig, sendTwilioSms } from "~/utils/twilio-sms.server";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Patient contact"),
		description: "Staff patient contact record.",
		path: "/clinic/patients",
		noIndex: true,
	});
};

export async function loader({ request, context, params }: LoaderFunctionArgs) {
	const env = context.cloudflare.env;
	const staff = await requireClinicStaff(request, env);
	const db = getPatientsDb(env);
	const id = params.id?.trim() ?? "";

	if (!db || !id) {
		throw json({ error: "Not found" }, { status: 404 });
	}

	const patient = await getPatientById(db, id);
	if (!patient) {
		throw json({ error: "Not found" }, { status: 404 });
	}

	const messages = await listSmsForPatient(db, patient.id, 100);
	return json(
		{
			staff,
			patient,
			messages,
			twilioConfigured: Boolean(getTwilioConfig(env)),
			maxSmsBody: MAX_SMS_BODY,
		},
		{
			headers: {
				"Cache-Control": "private, no-store",
			},
		},
	);
}

export async function action({ request, context, params }: ActionFunctionArgs) {
	const env = context.cloudflare.env;
	const staff = await requireClinicStaff(request, env);
	const db = getPatientsDb(env);
	const id = params.id?.trim() ?? "";
	if (!db || !id) {
		return json(
			{ ok: false as const, intent: "update" as const, error: "Not found." },
			{ status: 404 },
		);
	}

	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "");

	if (intent === "update") {
		const validated = validatePatientForm({
			name: String(formData.get("name") ?? ""),
			postalAddress: String(formData.get("postalAddress") ?? ""),
			email: String(formData.get("email") ?? ""),
			phone: String(formData.get("phone") ?? ""),
		});
		if (!validated.ok) {
			return json(
				{
					ok: false as const,
					intent: "update" as const,
					error: validated.error,
					errors: validated.errors,
				},
				{ status: 400 },
			);
		}
		try {
			const updated = await updatePatient(db, id, validated.data, staff.email);
			if (!updated) {
				return json(
					{
						ok: false as const,
						intent: "update" as const,
						error: "Patient not found.",
					},
					{ status: 404 },
				);
			}
			return json({
				ok: true as const,
				intent: "update" as const,
				patient: updated,
			});
		} catch (error) {
			logServerError("Patient update error", error);
			return json(
				{
					ok: false as const,
					intent: "update" as const,
					error: "Could not save changes.",
				},
				{ status: 500 },
			);
		}
	}

	if (intent === "send-sms") {
		const twilio = getTwilioConfig(env);
		if (!twilio) {
			return json(
				{
					ok: false as const,
					intent: "send-sms" as const,
					error: "Twilio is not configured.",
				},
				{ status: 503 },
			);
		}

		const patient = await getPatientById(db, id);
		if (!patient) {
			return json(
				{
					ok: false as const,
					intent: "send-sms" as const,
					error: "Patient not found.",
				},
				{ status: 404 },
			);
		}

		const confirmed = formData.get("confirmed") === "yes";
		if (!confirmed) {
			return json(
				{
					ok: false as const,
					intent: "send-sms" as const,
					error: "Confirm the message before sending.",
				},
				{ status: 400 },
			);
		}

		const validated = validateSmsBody(String(formData.get("body") ?? ""));
		if (!validated.ok) {
			return json(
				{
					ok: false as const,
					intent: "send-sms" as const,
					error: validated.error,
					draft: String(formData.get("body") ?? ""),
				},
				{ status: 400 },
			);
		}

		let auditId: string | null = null;
		try {
			const audit = await insertSmsMessage(db, {
				patientId: patient.id,
				toE164: patient.phoneE164,
				body: validated.body,
				status: "sending",
				sentByEmail: staff.email,
			});
			auditId = audit.id;

			const result = await sendTwilioSms(twilio, {
				toE164: patient.phoneE164,
				body: validated.body,
			});

			if (result.ok) {
				await updateSmsMessageStatus(db, audit.id, {
					status: result.status || "sent",
					twilioSid: result.sid,
					errorCode: null,
				});
				return json({
					ok: true as const,
					intent: "send-sms" as const,
					status: result.status || "sent",
				});
			}

			await updateSmsMessageStatus(db, audit.id, {
				status: "failed",
				errorCode: result.errorCode,
			});
			return json(
				{
					ok: false as const,
					intent: "send-sms" as const,
					error: "Message could not be sent. Check the number and Twilio account.",
					draft: validated.body,
				},
				{ status: 502 },
			);
		} catch (error) {
			logServerError("SMS send error", error);
			if (auditId) {
				try {
					await updateSmsMessageStatus(db, auditId, {
						status: "failed",
						errorCode: "exception",
					});
				} catch (updateError) {
					logServerError("SMS audit update error", updateError);
				}
			}
			return json(
				{
					ok: false as const,
					intent: "send-sms" as const,
					error: "Message could not be sent. Try again shortly.",
					draft: validated.body,
				},
				{ status: 500 },
			);
		}
	}

	return json(
		{ ok: false as const, intent, error: "Unknown action." },
		{ status: 400 },
	);
}

function formatWhen(iso: string): string {
	try {
		return new Intl.DateTimeFormat("en-GB", {
			dateStyle: "medium",
			timeStyle: "short",
			timeZone: "Europe/London",
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}

/** Staff-facing label; Twilio "queued" means accepted without a delivery webhook. */
function formatSmsStatus(status: string): string {
	const normalised = status.trim().toLowerCase();
	if (
		normalised === "queued" ||
		normalised === "accepted" ||
		normalised === "sending" ||
		normalised === "sent"
	) {
		return "Sent";
	}
	if (!normalised) return status;
	return normalised.charAt(0).toUpperCase() + normalised.slice(1);
}

export default function ClinicPatientDetailPage() {
	const { staff, patient, messages, twilioConfigured, maxSmsBody } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";
	const [smsMode, setSmsMode] = useState<"idle" | "compose" | "confirm">(
		"idle",
	);
	const [smsDraft, setSmsDraft] = useState("");

	useEffect(() => {
		if (actionData && actionData.ok && actionData.intent === "send-sms") {
			setSmsMode("idle");
			setSmsDraft("");
		}
	}, [actionData]);

	const failedUpdate =
		actionData && !actionData.ok && actionData.intent === "update"
			? actionData
			: null;
	const updateErrors: PatientFieldErrors | undefined =
		failedUpdate && "errors" in failedUpdate
			? (failedUpdate.errors as PatientFieldErrors)
			: undefined;
	const updateOk =
		actionData && actionData.ok && actionData.intent === "update";
	const updateError =
		actionData && !actionData.ok && actionData.intent === "update"
			? actionData.error
			: null;
	const smsOk =
		actionData && actionData.ok && actionData.intent === "send-sms";
	const smsError =
		actionData && !actionData.ok && actionData.intent === "send-sms"
			? actionData.error
			: null;
	const displayPatient =
		actionData && actionData.ok && actionData.intent === "update"
			? actionData.patient
			: patient;

	return (
		<>
			<PageHero
				eyebrow="Clinic"
				title={displayPatient.name}
				summary="Contact details and administrative SMS."
			/>

			<section className="section-pad">
				<div className="site-container max-w-2xl space-y-8">
					<ClinicStaffChrome
						staffEmail={staff.email}
						active="patients"
					/>

					<p>
						<Link
							to="/clinic/patients"
							className="text-sm font-semibold text-accent-deep underline-offset-4 hover:underline"
						>
							← All patients
						</Link>
					</p>

					<div className="border border-line bg-white px-6 py-7">
						<h2 className="font-display text-2xl text-ink">Details</h2>
						{updateOk ? (
							<p className="mt-3 text-sm text-accent-deep" role="status">
								Saved.
							</p>
						) : null}
						<Form method="post" className="mt-6 space-y-5">
							<PatientContactForm
								intent="update"
								submitLabel="Save changes"
								submitting={
									submitting &&
									navigation.formData?.get("intent") === "update"
								}
								defaults={{
									name: displayPatient.name,
									postalAddress: displayPatient.postalAddress,
									email: displayPatient.email,
									phone: displayPatient.phoneE164,
								}}
								errors={updateErrors}
							/>
							{updateError ? (
								<p className="text-sm text-red-700" role="alert">
									{updateError}
								</p>
							) : null}
						</Form>
						<p className="mt-6 text-xs text-ink-muted">
							Created {formatWhen(displayPatient.createdAt)} by{" "}
							{displayPatient.createdByEmail}
							<br />
							Updated {formatWhen(displayPatient.updatedAt)} by{" "}
							{displayPatient.updatedByEmail}
						</p>
					</div>

					<div className="border border-line bg-white px-6 py-7">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<h2 className="font-display text-2xl text-ink">SMS</h2>
							{smsMode === "idle" ? (
								<button
									type="button"
									className="btn-primary"
									disabled={!twilioConfigured}
									onClick={() => {
										setSmsMode("compose");
										setSmsDraft(
											actionData &&
												!actionData.ok &&
												actionData.intent === "send-sms" &&
												"draft" in actionData &&
												actionData.draft
												? String(actionData.draft)
												: "",
										);
									}}
								>
									Send SMS
								</button>
							) : null}
						</div>

						{!twilioConfigured ? (
							<p className="mt-3 text-ink-soft">
								Twilio is not configured. Set{" "}
								<code className="text-sm">TWILIO_ACCOUNT_SID</code>,{" "}
								<code className="text-sm">TWILIO_AUTH_TOKEN</code> and{" "}
								<code className="text-sm">TWILIO_FROM_NUMBER</code> in{" "}
								<code className="text-sm">.dev.vars</code> (local) or Workers
								secrets (production), then restart or redeploy.
							</p>
						) : null}

						<p className="mt-3 text-sm text-ink-soft">
							Administrative messages only. Do not include diagnoses, test
							results, medication details or other sensitive clinical
							information.
						</p>

						{smsOk ? (
							<p className="mt-4 text-sm text-accent-deep" role="status">
								Message sent.
							</p>
						) : null}
						{smsError && smsMode === "idle" ? (
							<p className="mt-4 text-sm text-red-700" role="alert">
								{smsError}
							</p>
						) : null}

						{smsMode === "compose" ? (
							<div className="mt-6 space-y-4">
								<label className="block">
									<span className="mb-2 block text-sm font-semibold text-ink">
										Message to {displayPatient.phoneE164}
									</span>
									<textarea
										rows={4}
										maxLength={maxSmsBody}
										value={smsDraft}
										onChange={(event) => setSmsDraft(event.target.value)}
										className="input-field"
										placeholder="Short administrative message…"
									/>
									<p className="mt-2 text-xs text-ink-muted">
										{smsDraft.length}/{maxSmsBody}
									</p>
								</label>
								<div className="flex flex-wrap gap-3">
									<button
										type="button"
										className="btn-primary"
										disabled={!smsDraft.trim()}
										onClick={() => setSmsMode("confirm")}
									>
										Review before sending
									</button>
									<button
										type="button"
										className="px-4 py-3 text-[0.95rem] text-ink-muted hover:text-ink"
										onClick={() => {
											setSmsMode("idle");
											setSmsDraft("");
										}}
									>
										Cancel
									</button>
								</div>
							</div>
						) : null}

						{smsMode === "confirm" ? (
							<div className="mt-6 border border-accent/25 bg-accent-soft px-5 py-5">
								<p className="font-semibold text-ink">Confirm send?</p>
								<p className="mt-2 whitespace-pre-wrap text-ink-soft">
									{smsDraft}
								</p>
								<p className="mt-3 text-sm text-ink-soft">
									To: {displayPatient.phoneE164}
								</p>
								{smsError ? (
									<p className="mt-3 text-sm text-red-700" role="alert">
										{smsError}
									</p>
								) : null}
								<Form method="post" className="mt-5 flex flex-wrap gap-3">
									<input type="hidden" name="intent" value="send-sms" />
									<input type="hidden" name="confirmed" value="yes" />
									<input type="hidden" name="body" value={smsDraft} />
									<button
										type="submit"
										className="btn-primary"
										disabled={
											submitting &&
											navigation.formData?.get("intent") === "send-sms"
										}
									>
										{submitting &&
										navigation.formData?.get("intent") === "send-sms"
											? "Sending…"
											: "Send now"}
									</button>
									<button
										type="button"
										className="px-4 py-3 text-[0.95rem] text-ink-muted hover:text-ink"
										onClick={() => setSmsMode("compose")}
									>
										Edit
									</button>
								</Form>
							</div>
						) : null}

						<div className="mt-8">
							<h3 className="text-sm font-semibold text-ink">Recent SMS</h3>
							{messages.length === 0 ? (
								<p className="mt-3 text-sm text-ink-soft">No messages yet.</p>
							) : (
								<div className="mt-3 max-h-80 overflow-y-auto overscroll-contain border border-line pr-1">
									<ul className="space-y-3 p-3">
										{messages.map((message) => (
											<li
												key={message.id}
												className="border border-line bg-white px-4 py-3 text-sm"
											>
												<p className="font-semibold text-ink">
													{formatSmsStatus(message.status)}
													{message.errorCode
														? ` (${message.errorCode})`
														: ""}
												</p>
												<p className="mt-1 whitespace-pre-wrap text-ink-soft">
													{message.body}
												</p>
												<p className="mt-2 text-xs text-ink-muted">
													{formatWhen(message.createdAt)} ·{" "}
													{message.sentByEmail}
												</p>
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
					</div>
				</div>
			</section>
		</>
	);
}
