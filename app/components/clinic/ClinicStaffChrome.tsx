import { Form, Link } from "@remix-run/react";

const TOOLS = [
	{ to: "/clinic/bookings", label: "Bookings" },
	{ to: "/clinic/patients", label: "Patient contacts" },
] as const;

type Props = {
	staffEmail: string;
	active?: "hub" | "bookings" | "patients";
	authOk?: boolean;
};

export function ClinicStaffChrome({
	staffEmail,
	active = "hub",
	authOk = false,
}: Props) {
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
				<p>
					Signed in as{" "}
					<span className="font-semibold text-ink">{staffEmail}</span>
					{authOk ? " · link accepted" : null}
				</p>
				<div className="flex flex-wrap items-center gap-4">
					{active !== "hub" ? (
						<Link
							to="/clinic"
							className="underline-offset-4 hover:underline"
						>
							Clinic home
						</Link>
					) : null}
					{/* ?index posts to clinic._index (layout has no action). */}
					<Form method="post" action="/clinic?index">
						<input type="hidden" name="intent" value="logout" />
						<button
							type="submit"
							className="underline-offset-4 hover:underline"
						>
							Sign out
						</button>
					</Form>
				</div>
			</div>

			<nav aria-label="Clinic tools" className="flex flex-wrap gap-2">
				{TOOLS.map((tool) => {
					const isActive =
						(tool.to === "/clinic/bookings" && active === "bookings") ||
						(tool.to === "/clinic/patients" && active === "patients");
					return (
						<Link
							key={tool.to}
							to={tool.to}
							className={
								isActive
									? "border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-ink"
									: "border border-line bg-white px-4 py-2 text-sm text-ink-soft hover:border-accent hover:text-ink"
							}
						>
							{tool.label}
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
