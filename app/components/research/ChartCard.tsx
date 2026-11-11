import type { ReactNode } from "react";

type ChartCardProps = {
	title: string;
	explanation: string;
	children: ReactNode;
	actions?: ReactNode;
	/** Defaults to synthetic demo labelling used across Research Lab pages. */
	datasetLabel?: string;
};

export function ChartCard({
	title,
	explanation,
	children,
	actions,
	datasetLabel = "Synthetic demonstration data",
}: ChartCardProps) {
	return (
		<section className="border border-line border-t-2 border-t-accent/70 bg-white">
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
				<div>
					<h3 className="font-display text-xl text-ink sm:text-2xl">{title}</h3>
					<p className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">
						Dataset · {datasetLabel}
					</p>
				</div>
				{actions ? (
					<div className="flex flex-wrap gap-2">{actions}</div>
				) : null}
			</div>
			<div className="px-2 py-4 sm:px-4">{children}</div>
			<p className="border-t border-line px-5 py-4 text-sm leading-relaxed text-ink-soft sm:px-6">
				<span className="font-semibold text-ink">
					What does this figure show us?{" "}
				</span>
				{explanation}
			</p>
		</section>
	);
}
