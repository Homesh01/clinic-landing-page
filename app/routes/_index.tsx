import { Link } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/cloudflare";
import { CalloutBanner } from "~/components/CalloutBanner";
import { JsonLd } from "~/components/JsonLd";
import {
	conditions,
	faqPage,
	homePlatform,
	site,
} from "~/data/content";
import {
	CLINIC_TAGLINE,
	buildPageMeta,
	clinicJsonLd,
	clinicPageTitle,
	websiteJsonLd,
} from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle(),
		description: CLINIC_TAGLINE,
		path: "/",
	});
};

export default function Index() {
	return (
		<>
			<JsonLd data={[clinicJsonLd(), websiteJsonLd()]} />
			<section className="border-b border-line bg-gradient-to-b from-mist to-white section-pad !pb-12">
				<div className="site-container">
					<div className="grid items-center gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
						<div className="max-w-2xl">
							<h1
								className="font-display text-[clamp(2.35rem,4.2vw,3.85rem)] leading-[1.05] tracking-[-0.02em] text-ink animate-fade-up md:whitespace-nowrap"
								style={{ animationDelay: "40ms" }}
							>
								{site.brand}
							</h1>
							<p
								className="mt-4 font-display text-display-md font-semibold text-ink animate-fade-up"
								style={{ animationDelay: "100ms" }}
							>
								Consultant oncology care
							</p>
							<p
								className="mt-3 text-[0.98rem] tracking-wide text-accent animate-fade-up"
								style={{ animationDelay: "130ms" }}
							>
								{site.title}
								{" · "}
								{site.subtitle}
							</p>
							<p
								className="mt-5 text-lg leading-relaxed text-ink-soft animate-fade-up"
								style={{ animationDelay: "160ms" }}
							>
								Consultant care in thyroid cancer, blood cancers and selected
								neuroendocrine tumours, with a specialist team in data analysis
								and computational methods. Open work on neoantigen vaccine
								science, and a clear focus on where personalised cancer care is
								heading.
							</p>
							<div
								className="mt-8 flex flex-wrap gap-3 animate-fade-up"
								style={{ animationDelay: "220ms" }}
							>
								<Link to="/book" className="btn-primary">
									Book a consultation
								</Link>
								<Link to="/about" className="btn-secondary">
									About the approach
								</Link>
							</div>
						</div>

						<div
							className="mx-auto w-full max-w-sm animate-fade-up lg:max-w-none"
							style={{ animationDelay: "180ms" }}
						>
							<img
								src={site.headshot}
								alt={`Portrait of ${site.name}`}
								className="headshot"
							/>
						</div>
					</div>
				</div>
			</section>

			<section className="section-pad border-t border-line">
				<div className="site-container">
					<div className="max-w-2xl">
						<p className="eyebrow">Areas of expertise</p>
						<h2 className="mt-3 font-display text-display-md text-ink">
							Conditions we treat
						</h2>
						<p className="mt-4 text-lg text-ink-soft">
							Clear diagnosis, careful planning, and joined up care across
							London clinics.
						</p>
					</div>

					<article className="mt-14 border-t border-accent/40 pt-8">
						<p className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-accent">
							Consultations
						</p>
						<h3 className="mt-3 font-display text-3xl text-ink">
							Clear next steps from the first appointment
						</h3>
						<p className="mt-4 max-w-2xl text-ink-soft">
							Whether you need a new plan, a second opinion or ongoing
							monitoring, each consultation should leave you with a clear
							written next step.
						</p>
						<Link to="/consultations" className="link-underline mt-6">
							View consultations &amp; services
							<span aria-hidden="true">→</span>
						</Link>
					</article>

					<div className="mt-14 grid gap-12 md:grid-cols-2">
						{conditions.map((condition) => (
							<article
								key={condition.slug}
								className="border-t border-line pt-8"
							>
								<h3 className="font-display text-3xl text-ink">
									{condition.title}
								</h3>
								<p className="mt-4 text-ink-soft">{condition.summary}</p>
								<Link
									to={`/conditions#${condition.slug}`}
									className="link-underline mt-6"
								>
									Learn more
									<span aria-hidden="true">→</span>
								</Link>
							</article>
						))}
					</div>
				</div>
			</section>

			<section className="border-y border-line bg-white section-pad">
				<div className="site-container">
					<div className="max-w-xl">
						<p className="eyebrow">Research Analytics Lab</p>
						<h2 className="mt-3 font-display text-display-md text-ink">
							Published vaccine science, examined in the open
						</h2>
						<p className="mt-4 text-lg leading-relaxed text-ink-soft">
							We reanalyse published neoantigen vaccine trials in the open, so
							patients and colleagues can inspect the methods and findings.
						</p>
						<Link
							to="/research/pancreatic-reanalysis"
							className="link-underline mt-8"
						>
							View the Analytics Lab
							<span aria-hidden="true">→</span>
						</Link>
					</div>

					<div className="mt-16 max-w-3xl">
						<p className="eyebrow">{homePlatform.eyebrow}</p>
						<h2 className="mt-3 font-display text-display-md text-ink">
							{homePlatform.title}
						</h2>
						<p className="mt-4 text-lg leading-relaxed text-ink-soft">
							{homePlatform.lede}
						</p>
					</div>

					<div className="mt-12 grid gap-10 md:grid-cols-3">
						{homePlatform.pillars.map((pillar) => (
							<article
								key={pillar.title}
								className="border-t border-accent/40 pt-6"
							>
								<h3 className="font-display text-2xl text-ink">
									{pillar.title}
								</h3>
								<p className="mt-4 text-[0.98rem] leading-relaxed text-ink-soft">
									{pillar.text}
								</p>
								<Link to={pillar.to} className="link-underline mt-6">
									{pillar.linkLabel}
									<span aria-hidden="true">→</span>
								</Link>
							</article>
						))}
					</div>
				</div>
			</section>

			<section className="section-pad border-t border-line bg-cream/40">
				<div className="site-container">
					<div className="max-w-2xl">
						<p className="eyebrow">FAQ</p>
						<h2 className="mt-3 font-display text-display-md text-ink">
							{faqPage.title}
						</h2>
						<p className="mt-4 text-lg text-ink-soft">
							Common questions about referrals, appointments, treatments and
							clinic locations, answered before you book.
						</p>
						<Link to="/faq" className="link-underline mt-8">
							View all FAQs
							<span aria-hidden="true">→</span>
						</Link>
					</div>
				</div>
			</section>

			<CalloutBanner
				eyebrow="Appointments"
				title="Book a consultation"
				body="View available slots and request a consultation at a time that suits you. Clinics at HCA at University College Hospital, Leaders in Oncology Care (LOC), and The Harley Street Clinic."
				actions={[
					{ label: "Book a consultation", to: "/book", variant: "primary" },
					{ label: "About the approach", to: "/about", variant: "outline" },
				]}
			/>
		</>
	);
}
