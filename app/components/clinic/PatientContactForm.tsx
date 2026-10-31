import type { PatientFieldErrors } from "~/utils/patient-validation";

type Values = {
	name?: string;
	postalAddress?: string;
	email?: string;
	phone?: string;
};

type Props = {
	defaults?: Values;
	errors?: PatientFieldErrors;
	submitLabel: string;
	submitting: boolean;
	intent: "create" | "update";
};

export function PatientContactForm({
	defaults,
	errors,
	submitLabel,
	submitting,
	intent,
}: Props) {
	return (
		<>
			<input type="hidden" name="intent" value={intent} />
			<label className="block">
				<span className="mb-2 block text-sm font-semibold text-ink">Name</span>
				<input
					required
					name="name"
					defaultValue={defaults?.name ?? ""}
					autoComplete="name"
					className="input-field"
				/>
				{errors?.name ? (
					<p className="mt-2 text-sm text-red-700">{errors.name}</p>
				) : null}
			</label>
			<label className="block">
				<span className="mb-2 block text-sm font-semibold text-ink">
					Postal address
				</span>
				<textarea
					required
					name="postalAddress"
					rows={3}
					defaultValue={defaults?.postalAddress ?? ""}
					autoComplete="street-address"
					className="input-field"
				/>
				{errors?.postalAddress ? (
					<p className="mt-2 text-sm text-red-700">{errors.postalAddress}</p>
				) : null}
			</label>
			<label className="block">
				<span className="mb-2 block text-sm font-semibold text-ink">
					Email address
				</span>
				<input
					required
					type="email"
					name="email"
					defaultValue={defaults?.email ?? ""}
					autoComplete="email"
					className="input-field"
				/>
				{errors?.email ? (
					<p className="mt-2 text-sm text-red-700">{errors.email}</p>
				) : null}
			</label>
			<label className="block">
				<span className="mb-2 block text-sm font-semibold text-ink">
					Telephone number
				</span>
				<input
					required
					type="tel"
					name="phone"
					defaultValue={defaults?.phone ?? ""}
					placeholder="+44 …"
					autoComplete="tel"
					className="input-field"
				/>
				{errors?.phone ? (
					<p className="mt-2 text-sm text-red-700">{errors.phone}</p>
				) : null}
			</label>
			<button type="submit" className="btn-primary" disabled={submitting}>
				{submitting ? "Saving…" : submitLabel}
			</button>
		</>
	);
}
