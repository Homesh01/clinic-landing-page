import { Form, Link } from "@remix-run/react";

const TOOLS = [
	{ to: "/admin/bookings", label: "Bookings", active: "bookings" },
	{ to: "/admin/patients", label: "Patient contacts", active: "patients" },
	{ to: "/admin/activity", label: "Activity", active: "activity" },
	{ to: "/admin/settings", label: "Settings", active: "settings" },
] as const;

type Props = {
	staffEmail: string;
	active?: "hub" | "bookings" | "patients" | "activity" | "settings";
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
							to="/admin"
							prefetch="none"
							className="underline-offset-4 hover:underline"
						>
							Admin home
						</Link>
					) : null}
					{/* ?index posts to admin._index (layout has no action). */}
					<Form method="post" action="/admin?index">
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

			<nav aria-label="Admin tools" className="flex flex-wrap gap-2">
				{TOOLS.map((tool) => {
					const isActive = tool.active === active;
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
