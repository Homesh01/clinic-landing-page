import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { FaqAccordion } from "~/components/FaqAccordion";
import { faqPage, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `FAQ | ${site.name}` },
		{
			name: "description",
			content: faqPage.lede,
		},
	];
};

export default function FaqPage() {
	return (
		<>
			<section className="border-b border-line bg-gradient-to-b from-mist to-white section-pad !pb-12">
				<div className="site-container">
					<p className="eyebrow">FAQ</p>
					<h1 className="mt-3 max-w-3xl font-display text-display-lg text-ink">
						{faqPage.title}
					</h1>
					<p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
						{faqPage.lede}
					</p>
				</div>
			</section>

			<section className="pb-6">
				<div className="site-container">
					<FaqAccordion groups={faqPage.groups} />
				</div>
			</section>

			<section className="section-pad">
				<div className="site-container">
					<div className="flex flex-wrap items-center justify-between gap-8 rounded-xl bg-accent-deep px-8 py-10 sm:px-12 sm:py-11">
						<div className="max-w-xl">
							<h2 className="font-display text-3xl text-white">
								{faqPage.callout.title}
							</h2>
							<p className="mt-3 text-[0.97rem] text-white/75">
								{faqPage.callout.body}
							</p>
						</div>
						<div className="flex shrink-0 flex-wrap gap-3">
							<Link
								to="/book"
								className="inline-flex items-center justify-center rounded-sm bg-white px-6 py-3 text-[0.95rem] font-semibold text-accent-deep transition hover:bg-accent-soft"
							>
								Book a consultation
							</Link>
							<Link
								to="/contact#fees"
								className="inline-flex items-center justify-center rounded-sm border border-white/25 px-6 py-3 text-[0.95rem] font-semibold text-white transition hover:border-white/60"
							>
								About fees &amp; insurance
							</Link>
						</div>
					</div>
				</div>
			</section>
		</>
	);
}
