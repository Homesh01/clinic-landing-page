import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { PageIntro } from "~/components/PageIntro";
import { conditions, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `Conditions | ${site.name}` },
		{
			name: "description",
			content:
				"Specialist care for thyroid cancer and radiotherapy for haematological malignancies.",
		},
	];
};

export default function ConditionsPage() {
	return (
		<>
			<PageIntro
				eyebrow="Conditions"
				title="Areas of clinical expertise"
				summary="Focused care for thyroid cancer and radiotherapy in haematological malignancies, delivered as part of a multidisciplinary team."
			/>

			<section className="section-pad">
				<div className="site-container space-y-20">
					{conditions.map((condition) => (
						<article
							key={condition.slug}
							id={condition.slug}
							className="scroll-mt-28 grid gap-8 border-t border-line pt-12 lg:grid-cols-[0.85fr_1.15fr]"
						>
							<div>
								<h2 className="font-display text-display-md text-ink">
									{condition.title}
								</h2>
							</div>
							<div>
								<p className="text-lg leading-relaxed text-ink-soft">
									{condition.body}
								</p>
								<Link to="/book" className="link-underline mt-8">
									Request a consultation
									<span aria-hidden="true">→</span>
								</Link>
							</div>
						</article>
					))}
				</div>
			</section>
		</>
	);
}
