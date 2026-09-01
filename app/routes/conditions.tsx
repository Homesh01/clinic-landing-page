import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { BloodIcon, ThyroidIcon } from "~/components/ConditionIcons";
import { conditions, conditionsPage, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `Conditions | ${site.name}` },
		{
			name: "description",
			content: conditionsPage.lede,
		},
	];
};

export default function ConditionsPage() {
	return (
		<>
			<section className="border-b border-line bg-gradient-to-b from-mist to-white section-pad !pb-12">
				<div className="site-container">
					<p className="eyebrow">Conditions</p>
					<h1 className="mt-3 max-w-3xl font-display text-display-lg text-ink">
						{conditionsPage.title}
					</h1>
					<p className="mt-5 max-w-2xl text-lg text-ink-soft">
						{conditionsPage.lede}
					</p>

					<blockquote className="mt-8 border-l-4 border-accent bg-white py-6 pl-7 pr-6">
						<p className="font-display text-xl italic leading-relaxed text-ink-soft">
							&ldquo;{conditionsPage.quote}&rdquo;
						</p>
						<p className="mt-3 text-sm font-semibold text-ink-muted">
							{conditionsPage.quoteAttr}
						</p>
					</blockquote>

					<div className="mt-8 flex flex-wrap items-center justify-between gap-5 rounded-md border border-line bg-white px-6 py-5 sm:px-7">
						<p className="text-[0.97rem] text-ink-soft">
							<strong className="font-semibold text-ink">
								{conditionsPage.reassure.strong}
							</strong>{" "}
							{conditionsPage.reassure.text}
						</p>
						<Link to="/contact" className="btn-outline shrink-0">
							Ask a question →
						</Link>
					</div>
				</div>
			</section>

			<section className="pb-4">
				<div className="site-container">
					{conditions.map((condition) => (
						<article
							key={condition.slug}
							id={condition.slug}
							className="scroll-mt-28 grid gap-10 border-b border-line py-14 first:pt-10 lg:grid-cols-[280px_1fr] lg:gap-12"
						>
							<div>
								<div
									className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-cream text-accent"
								>
									{condition.icon === "thyroid" ? (
										<ThyroidIcon />
									) : (
										<BloodIcon />
									)}
								</div>
								<p className="text-xs font-semibold uppercase tracking-wide text-accent">
									Condition
								</p>
								<h2 className="mt-2 font-display text-3xl text-ink">
									{condition.title}
								</h2>
								<p className="mt-4 text-ink-soft">{condition.plain}</p>
							</div>

							<div>
								<div className="mb-7">
									<h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
										How Dr Sayal can help
									</h3>
									<ul className="list-plain mt-4">
										{condition.howWeHelp.map((item) => (
											<li key={item.slice(0, 40)}>{item}</li>
										))}
									</ul>
								</div>

								<div className="mb-7">
									<h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
										What to expect
									</h3>
									<ol className="list-steps mt-4">
										{condition.whatToExpect.map((step) => (
											<li key={step.title}>
												<strong className="font-semibold text-ink">
													{step.title}:
												</strong>{" "}
												{step.text}
											</li>
										))}
									</ol>
								</div>

								<Link to="/book" className="link-underline">
									{condition.ctaLabel}
									<span aria-hidden="true">→</span>
								</Link>
							</div>
						</article>
					))}
				</div>
			</section>

			<section className="border-t border-line bg-cream section-pad">
				<div className="site-container grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
					<div>
						<h2 className="font-display text-3xl text-ink">
							{conditionsPage.trust.title}
						</h2>
						<p className="mt-4 text-ink-soft">{conditionsPage.trust.lede}</p>
					</div>
					<ul className="space-y-6">
						{conditionsPage.trust.points.map((point, index) => (
							<li key={point.title} className="flex gap-4">
								<span
									className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent font-display text-base font-semibold text-accent"
								>
									{index + 1}
								</span>
								<div>
									<h3 className="font-semibold text-ink">{point.title}</h3>
									<p className="mt-1 text-[0.95rem] text-ink-muted">
										{point.description}
									</p>
								</div>
							</li>
						))}
					</ul>
				</div>
			</section>

			<section className="section-pad">
				<div className="site-container">
					<div className="flex flex-wrap items-center justify-between gap-8 rounded-xl bg-accent-deep px-8 py-10 sm:px-12 sm:py-11">
						<div className="max-w-xl">
							<h2 className="font-display text-3xl text-white">
								{conditionsPage.callout.title}
							</h2>
							<p className="mt-3 text-[0.97rem] text-white/75">
								{conditionsPage.callout.body}
							</p>
						</div>
						<Link
							to="/book"
							className="inline-flex shrink-0 items-center justify-center rounded-sm bg-white px-6 py-3 text-[0.95rem] font-semibold text-accent-deep transition hover:bg-accent-soft"
						>
							Book a consultation →
						</Link>
					</div>
				</div>
			</section>
		</>
	);
}
