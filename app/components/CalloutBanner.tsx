import { Link } from "@remix-run/react";

export type CalloutAction = {
	label: string;
	to?: string;
	href?: string;
	variant: "primary" | "outline";
};

type CalloutBannerProps = {
	title: string;
	body: string;
	actions: readonly CalloutAction[];
	eyebrow?: string;
	tightTop?: boolean;
};

export function CalloutBanner({
	title,
	body,
	actions,
	eyebrow,
	tightTop = false,
}: CalloutBannerProps) {
	return (
		<section className={`section-pad ${tightTop ? "!pt-0" : ""}`}>
			<div className="site-container">
				<div className="callout-banner">
					<div className="max-w-xl">
						{eyebrow ? (
							<p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white/55">
								{eyebrow}
							</p>
						) : null}
						<h2
							className={`font-display text-3xl text-white ${eyebrow ? "mt-3" : ""}`}
						>
							{title}
						</h2>
						<p className="mt-3 text-[0.97rem] text-white/75">{body}</p>
					</div>
					<div className="flex shrink-0 flex-wrap gap-3">
						{actions.map((action) => {
							const className =
								action.variant === "primary"
									? "btn-callout-primary"
									: "btn-callout-outline";

							if (action.href) {
								return (
									<a
										key={action.label}
										href={action.href}
										className={className}
									>
										{action.label}
									</a>
								);
							}

							return (
								<Link key={action.label} to={action.to ?? "/"} className={className}>
									{action.label}
								</Link>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
}
