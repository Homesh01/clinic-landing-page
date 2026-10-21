import { Link } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/cloudflare";
import { CalloutBanner } from "~/components/CalloutBanner";
import { JsonLd } from "~/components/JsonLd";
import {
	conditions,
	faqPage,
	homePlatform,
	services,
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
					<div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
						<div className="max-w-xl">
							<p
								className="font-display text-display-xl text-ink animate-fade-up"
								style={{ animationDelay: "40ms" }}
							>
								{site.name}
							</p>
							<h1
								className="mt-4 font-display text-display-md font-semibold text-ink animate-fade-up"
								style={{ animationDelay: "100ms" }}
							>
								{site.title}
							</h1>
							<p
								className="mt-2 text-[0.98rem] tracking-wide text-accent animate-fade-up"
								style={{ animationDelay: "130ms" }}
							>
								{site.subtitle}
							</p>
							<p
								className="mt-5 text-lg leading-relaxed text-ink-soft animate-fade-up"
								style={{ animationDelay: "160ms" }}
							>
								Specialist care in thyroid cancer and blood cancers, with a
								growing software practice in personalised cancer analytics —
								building toward advanced diagnostics and personalised cancer
								vaccines.
							</p>
							<div
								className="mt-8 flex flex-wrap gap-3 animate-fade-up"
								style={{ animationDelay: "220ms" }}
							>
								<Link to="/book" className="btn-primary">
									Book a consultation
								</Link>
								<Link
									to="/research/neovaxmi-reanalysis"
									className="btn-secondary"
								>
									Explore the Analytics Lab
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
							Focused oncology for complex pathways
						</h2>
						<p className="mt-4 text-lg text-ink-soft">
							Care centred on clear diagnosis, careful planning, and
							multidisciplinary collaboration across London clinics.
						</p>
					</div>

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

			<section className="border-y border-line bg-mist/40 section-pad">
				<div className="site-container">
					<div className="max-w-3xl">
						<p className="eyebrow">{homePlatform.eyebrow}</p>
						<h2 className="mt-3 font-display text-display-md text-ink">
							{homePlatform.title}
						</h2>
						<p className="mt-4 text-lg leading-relaxed text-ink-soft">
							{homePlatform.lede}
						</p>
					</div>

					<div className="mt-14 grid gap-10 md:grid-cols-3">
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

			<section className="section-pad">
				<div className="site-container grid items-end gap-12 lg:grid-cols-[1.1fr_0.9fr]">
					<div>
						<p className="eyebrow">Consultations</p>
						<h2 className="mt-3 font-display text-display-md text-ink">
							Clear next steps from the first appointment
						</h2>
						<p className="mt-4 max-w-xl text-lg text-ink-soft">
							Whether you are seeking a new treatment plan, a second opinion,
							or ongoing monitoring, each consultation is structured to give
							you a written, actionable pathway.
						</p>
						<Link to="/consultations" className="link-underline mt-8">
							View consultations &amp; services
							<span aria-hidden="true">→</span>
						</Link>
					</div>

					<ul className="space-y-4">
						{services.slice(0, 4).map((service) => (
							<li
								key={service.title}
								className="border-l-2 border-accent/30 pl-5"
							>
								<p className="font-semibold text-ink">{service.title}</p>
								<p className="mt-1 text-[0.98rem] text-ink-muted">
									{service.description}
								</p>
							</li>
						))}
					</ul>
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
							Common questions about referrals, appointments, treatments, and
							clinic locations — with clear answers before you book.
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
				title="Book a consultation, or explore the Analytics Lab"
				body="View available slots and request a consultation at a time that suits you. Clinics at HCA at University College Hospital, Leaders in Oncology Care (LOC), and The Harley Street Clinic. The Research Analytics Lab includes a reanalysis of published NeoVaxMI trial data."
				actions={[
					{ label: "Book a consultation", to: "/book", variant: "primary" },
					{
						label: "Research Analytics Lab",
						to: "/research/neovaxmi-reanalysis",
						variant: "outline",
					},
				]}
			/>
		</>
	);
}
