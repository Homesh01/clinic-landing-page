import type { MetaFunction } from "@remix-run/cloudflare";
import { PageIntro } from "~/components/PageIntro";
import { insights, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `Insights | ${site.name}` },
		{
			name: "description",
			content: insights.intro,
		},
	];
};

export default function InsightsPage() {
	return (
		<>
			<PageIntro
				eyebrow="Insights"
				title="Commentary and professional updates"
				summary={insights.intro}
			/>

			<section className="section-pad">
				<div className="site-container max-w-3xl">
					<p className="text-sm text-ink-muted">{insights.note}</p>

					<ul className="mt-10 space-y-6">
						{insights.social.map((item) => (
							<li
								key={item.platform}
								className="border border-line rounded-md bg-cream/50 p-6 sm:p-8"
							>
								<p className="eyebrow">{item.platform}</p>
								<h2 className="mt-3 font-display text-3xl text-ink">
									{item.label}
								</h2>
								<p className="mt-3 text-ink-soft">{item.description}</p>
								<a
									href={item.url}
									target="_blank"
									rel="noreferrer"
									className="link-underline mt-6"
								>
									View profile
									<span aria-hidden="true">↗</span>
								</a>
							</li>
						))}
					</ul>
				</div>
			</section>
		</>
	);
}
