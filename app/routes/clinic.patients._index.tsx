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
	useSearchParams,
} from "@remix-run/react";
import { json, redirect } from "@remix-run/cloudflare";
import { ClinicStaffChrome } from "~/components/clinic/ClinicStaffChrome";
import { PatientContactForm } from "~/components/clinic/PatientContactForm";
import { PageHero } from "~/components/PageHero";
import { requireClinicStaff } from "~/utils/clinic-staff.server";
import {
	createPatient,
	getPatientsDb,
	isPatientsDbConfigured,
	searchPatients,
} from "~/utils/patients.server";
import {
	validatePatientForm,
	type PatientFieldErrors,
} from "~/utils/patient-validation";
import { logServerError } from "~/utils/safe-log.server";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Patient contacts"),
		description: "Staff patient contact directory.",
		path: "/clinic/patients",
		noIndex: true,
	});
};

export async function loader({ request, context }: LoaderFunctionArgs) {
	const env = context.cloudflare.env;
	const staff = await requireClinicStaff(request, env);
	const url = new URL(request.url);
	const q = url.searchParams.get("q")?.trim() ?? "";
	const dbConfigured = isPatientsDbConfigured(env);
	const db = getPatientsDb(env);

	let patients: Awaited<ReturnType<typeof searchPatients>> = [];
	if (db) {
		try {
			patients = await searchPatients(db, q);
		} catch (error) {
			logServerError("Patient search error", error);
			return json({
				staff,
				dbConfigured,
				q,
				patients: [] as typeof patients,
				loadError: "Could not load patients. Check that D1 migrations are applied.",
			});
		}
	}

	return json(
		{
			staff,
			dbConfigured,
			q,
			patients,
			loadError: null as string | null,
		},
		{
			headers: {
				"Cache-Control": "private, no-store",
			},
		},
	);
}

export async function action({ request, context }: ActionFunctionArgs) {
	const env = context.cloudflare.env;
	const staff = await requireClinicStaff(request, env);
	const db = getPatientsDb(env);
	if (!db) {
		return json(
			{
				ok: false as const,
				intent: "create" as const,
				error: "Patient database is not configured.",
			},
			{ status: 503 },
		);
	}

	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "");
	if (intent !== "create") {
		return json(
			{ ok: false as const, intent, error: "Unknown action." },
			{ status: 400 },
		);
	}

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
				intent: "create" as const,
				error: validated.error,
				errors: validated.errors,
				values: {
					name: String(formData.get("name") ?? ""),
					postalAddress: String(formData.get("postalAddress") ?? ""),
					email: String(formData.get("email") ?? ""),
					phone: String(formData.get("phone") ?? ""),
				},
			},
			{ status: 400 },
		);
	}

	try {
		const patient = await createPatient(db, validated.data, staff.email);
		throw redirect(`/clinic/patients/${patient.id}`);
	} catch (error) {
		if (error instanceof Response) throw error;
		logServerError("Patient create error", error);
		return json(
			{
				ok: false as const,
				intent: "create" as const,
				error: "Could not save the patient. Try again.",
			},
			{ status: 500 },
		);
	}
}

export default function ClinicPatientsPage() {
	const { staff, dbConfigured, q, patients, loadError } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";
	const [searchParams] = useSearchParams();
	const showAdd = searchParams.get("new") === "1";

	const failedCreate =
		actionData && !actionData.ok && actionData.intent === "create"
			? actionData
			: null;
	const createErrors: PatientFieldErrors | undefined =
		failedCreate && "errors" in failedCreate
			? (failedCreate.errors as PatientFieldErrors)
			: undefined;
	const createValues =
		failedCreate && "values" in failedCreate
			? (failedCreate.values as {
					name: string;
					postalAddress: string;
					email: string;
					phone: string;
				})
			: undefined;
	const createError = failedCreate?.error ?? null;

	return (
		<>
			<PageHero
				eyebrow="Clinic"
				title="Patient contacts"
				summary="Name, address, email and telephone only — no clinical notes."
			/>

			<section className="section-pad">
				<div className="site-container max-w-2xl space-y-8">
					<ClinicStaffChrome
						staffEmail={staff.email}
						active="patients"
					/>

					{!dbConfigured ? (
						<div className="border border-line bg-cream/70 px-6 py-8">
							<p className="eyebrow">Unavailable</p>
							<h2 className="mt-3 font-display text-3xl text-ink">
								Patient database not configured
							</h2>
							<p className="mt-3 text-ink-soft">
								Create a Cloudflare D1 database, set the database ID in{" "}
								<code className="text-sm">wrangler.json</code>, apply
								migrations, then redeploy. See{" "}
								<code className="text-sm">docs/clinic-patients-setup.md</code>.
							</p>
						</div>
					) : (
						<>
							{loadError ? (
								<p className="text-sm text-red-700" role="alert">
									{loadError}
								</p>
							) : null}

							<div className="flex flex-wrap items-center justify-between gap-3">
								<Form method="get" className="flex flex-1 flex-wrap gap-2">
									<input
										name="q"
										defaultValue={q}
										placeholder="Search name, email or phone"
										className="input-field min-w-[12rem] flex-1"
									/>
									<button type="submit" className="btn-secondary">
										Search
									</button>
								</Form>
								{showAdd ? (
									<Link
										to="/clinic/patients"
										className="text-sm text-ink-muted underline-offset-4 hover:underline"
									>
										Cancel add
									</Link>
								) : (
									<Link to="/clinic/patients?new=1" className="btn-primary">
										Add patient
									</Link>
								)}
							</div>

							{showAdd || createError ? (
								<div className="border border-line bg-white px-6 py-7">
									<h2 className="font-display text-2xl text-ink">
										Add patient
									</h2>
									<p className="mt-2 text-sm text-ink-soft">
										Contact details only. Do not enter diagnoses, results or
										clinical notes here.
									</p>
									<Form method="post" className="mt-6 space-y-5">
										<PatientContactForm
											intent="create"
											submitLabel="Save patient"
											submitting={submitting}
											defaults={createValues}
											errors={createErrors}
										/>
										{createError ? (
											<p className="text-sm text-red-700" role="alert">
												{createError}
											</p>
										) : null}
									</Form>
								</div>
							) : null}

							<div className="border border-line bg-white">
								{patients.length === 0 ? (
									<p className="px-6 py-8 text-ink-soft">
										{q
											? "No patients matched that search."
											: "No patients yet. Add a fictional test record first."}
									</p>
								) : (
									<ul className="divide-y divide-line">
										{patients.map((patient) => (
											<li key={patient.id}>
												<Link
													to={`/clinic/patients/${patient.id}`}
													className="block px-6 py-4 transition-colors hover:bg-cream/40"
												>
													<p className="font-semibold text-ink">
														{patient.name}
													</p>
													<p className="mt-1 text-sm text-ink-soft">
														{patient.email} · {patient.phoneE164}
													</p>
												</Link>
											</li>
										))}
									</ul>
								)}
							</div>
						</>
					)}
				</div>
			</section>
		</>
	);
}
