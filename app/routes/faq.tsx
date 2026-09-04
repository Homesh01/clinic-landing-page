import type { MetaFunction } from "@remix-run/cloudflare";
import { CalloutBanner } from "~/components/CalloutBanner";
import { FaqAccordion } from "~/components/FaqAccordion";
import { PageHero } from "~/components/PageHero";
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
			<PageHero
				eyebrow="FAQ"
				title={faqPage.title}
				summary={faqPage.lede}
			/>

			<section className="content-section pt-5 sm:pt-5">
				<div className="site-container">
					<FaqAccordion groups={faqPage.groups} />
				</div>
			</section>

			<CalloutBanner
				title={faqPage.callout.title}
				body={faqPage.callout.body}
				actions={[
					{ label: "Book a consultation", to: "/book", variant: "primary" },
					{
						label: "About fees & insurance",
						to: "/contact#fees",
						variant: "outline",
					},
				]}
			/>
		</>
	);
}
