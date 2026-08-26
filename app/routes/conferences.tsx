import type { MetaFunction } from "@remix-run/cloudflare";
import { PageIntro } from "~/components/PageIntro";
import { conferences, publications, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `Conferences & publications | ${site.name}` },
		{
			name: "description",
			content:
				"Selected conferences, presentations and publications by Dr Karen Sayal.",
		},
	];
};

export default function ConferencesPage() {
	return (
		<>
			<PageIntro
				eyebrow="Conferences & publications"
				title="Selected talks and written work"
				summary="Placeholder entries are ready for your conference titles and publication citations — swap them in whenever you have the final list."
			/>

			<section className="section-pad">
				<div className="site-container grid gap-16 lg:grid-cols-2">
					<div>
						<p className="eyebrow">Conferences &amp; presentations</p>
						<ul className="mt-8 space-y-8">
							{conferences.map((item, index) => (
								<li
									key={`conference-${index}`}
									className="border-t border-line pt-6"
								>
									<h2 className="font-display text-2xl text-ink">
										{item.title}
									</h2>
									<p className="mt-2 text-ink-muted">{item.detail}</p>
								</li>
							))}
						</ul>
					</div>

					<div>
						<p className="eyebrow">Publications</p>
						<ul className="mt-8 space-y-8">
							{publications.map((item, index) => (
								<li
									key={`publication-${index}`}
									className="border-t border-line pt-6"
								>
									<h2 className="font-display text-2xl text-ink">
										{item.title}
									</h2>
									<p className="mt-2 text-ink-muted">{item.detail}</p>
								</li>
							))}
						</ul>
					</div>
				</div>
			</section>
		</>
	);
}
