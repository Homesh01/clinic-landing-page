import type { MetaFunction } from "@remix-run/cloudflare";
import { useMemo, useState } from "react";
import { RichText } from "~/components/RichText";
import {
	type ConferenceEntry,
	type ConferenceTiming,
	conferenceEntries,
	conferenceYearLabels,
	conferencesPage,
	site,
} from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `Conferences & publications | ${site.name}` },
		{
			name: "description",
			content:
				"Selected conferences, presentations and talks by Dr Karen Sayal.",
		},
	];
};

type Filter = "all" | "upcoming" | "past";

const filters: { id: Filter; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "upcoming", label: "Upcoming" },
	{ id: "past", label: "Past" },
];

function matchesFilter(timing: ConferenceTiming, filter: Filter) {
	if (filter === "all") return true;
	if (filter === "upcoming") {
		return timing === "upcoming" || timing === "ongoing";
	}
	return timing === "past";
}

function groupByYear(entries: readonly ConferenceEntry[]) {
	const years = [...new Set(entries.map((entry) => entry.year))].sort(
		(a, b) => b - a,
	);
	return years.map((year) => ({
		year,
		entries: entries.filter((entry) => entry.year === year),
	}));
}

export default function ConferencesPage() {
	const [filter, setFilter] = useState<Filter>("all");

	const visibleGroups = useMemo(() => {
		const filtered = conferenceEntries.filter((entry) =>
			matchesFilter(entry.timing, filter),
		);
		return groupByYear(filtered);
	}, [filter]);

	return (
		<>
			<section className="border-b border-line bg-gradient-to-b from-mist to-white section-pad !pb-12">
				<div className="site-container">
					<p className="eyebrow">Conferences &amp; Publications</p>
					<h1 className="mt-3 max-w-3xl font-display text-display-lg text-ink">
						{conferencesPage.title}
					</h1>
				</div>
			</section>

			<section className="pb-6">
				<div className="site-container">
					<div className="mt-4">
						<p className="eyebrow">{conferencesPage.sectionEyebrow}</p>
					</div>

					<div className="mt-7 flex flex-wrap gap-2.5">
						{filters.map((item) => (
							<button
								key={item.id}
								type="button"
								className={`rounded-full border px-4 py-1.5 text-[0.82rem] font-semibold transition ${
									filter === item.id
										? "border-accent bg-accent-soft text-accent"
										: "border-line bg-white text-ink-muted hover:border-accent/40"
								}`}
								onClick={() => setFilter(item.id)}
							>
								{item.label}
							</button>
						))}
					</div>

					{visibleGroups.map((group) => (
						<div key={group.year} className="mt-11 first:mt-10">
							<div className="flex items-baseline gap-4">
								<h2 className="font-display text-[1.75rem] text-accent">
									{group.year}
								</h2>
								{filter === "all" && conferenceYearLabels[group.year] ? (
									<span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
										{conferenceYearLabels[group.year]}
									</span>
								) : null}
								<div className="h-px flex-1 bg-line" />
							</div>

							<ul className="list-none m-0 p-0">
								{group.entries.map((entry) => (
									<li
										key={`${entry.year}-${entry.title}`}
										className="grid gap-2 border-b border-line py-7 last:border-b-0 sm:grid-cols-[190px_1fr] sm:gap-7"
									>
										<div className="sm:pt-0.5">
											<p className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-accent">
												{entry.date}
											</p>
											<p className="mt-1.5 text-[0.82rem] leading-snug text-ink-muted">
												{entry.location}
											</p>
											{entry.tag ? (
												<span className="mt-2 inline-block rounded-sm bg-accent-soft px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-accent">
													{entry.tag}
												</span>
											) : null}
										</div>
										<div>
											<h3 className="font-display text-[1.4rem] leading-snug text-ink">
												{entry.title}
											</h3>
											<RichText
												segments={entry.description}
												className="mt-2 max-w-prose text-[0.97rem] leading-relaxed text-ink-soft"
											/>
										</div>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</section>
		</>
	);
}
