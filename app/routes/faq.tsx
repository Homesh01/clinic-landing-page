import type { MetaFunction } from "@remix-run/cloudflare";
import { CalloutBanner } from "~/components/CalloutBanner";
import { FaqAccordion } from "~/components/FaqAccordion";
import { JsonLd } from "~/components/JsonLd";
import { PageHero } from "~/components/PageHero";
import { faqPage } from "~/data/content";
import { buildPageMeta, clinicPageTitle, faqPageJsonLd } from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("FAQ"),
		description: faqPage.lede,
		path: "/faq",
	});
};

export default function FaqPage() {
	return (
		<>
			<JsonLd data={faqPageJsonLd()} />
			<PageHero
				eyebrow="FAQ"
				title={faqPage.title}
				summary={faqPage.lede}
			/>

			<section className="content-section">
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
