import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { PageHero } from "~/components/PageHero";
import { contact, privacyNotice } from "~/data/content";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle(privacyNotice.title),
		description: privacyNotice.lede,
		path: privacyNotice.path,
	});
};

export default function PatientPrivacyNoticePage() {
	const { company } = privacyNotice;

	return (
		<>
			<PageHero
				eyebrow="Privacy"
				title={privacyNotice.title}
				summary={privacyNotice.lede}
			/>

			<section className="content-section">
				<div className="site-container max-w-3xl">
					<p className="text-sm text-ink-muted">
						Last updated: {privacyNotice.lastUpdated}
					</p>

					<div className="mt-8 space-y-3 border-t border-line pt-8 text-[0.97rem] leading-relaxed text-ink-soft">
						<p>
							<span className="font-semibold text-ink">Company:</span>{" "}
							{company.legalName}
						</p>
						<p>
							<span className="font-semibold text-ink">Company number:</span>{" "}
							{company.companyNumber}
						</p>
						<p>
							<span className="font-semibold text-ink">Registered office:</span>{" "}
							{company.registeredOffice}
						</p>
						<p>
							<span className="font-semibold text-ink">Privacy enquiries:</span>{" "}
							<a
								href={`mailto:${contact.email}`}
								className="transition-colors hover:text-accent"
							>
								{contact.email}
							</a>
						</p>
					</div>

					<div className="mt-12 space-y-10">
						{privacyNotice.sections.map((section) => (
							<section key={section.heading}>
								<h2 className="font-display text-2xl text-ink">
									{section.heading}
								</h2>
								{"paragraphs" in section && section.paragraphs
									? section.paragraphs.map((paragraph) => (
											<p
												key={paragraph}
												className="mt-3 text-[0.97rem] leading-relaxed text-ink-soft"
											>
												{paragraph}
											</p>
										))
									: null}
								{"bullets" in section && section.bullets ? (
									<ul className="mt-3 list-disc space-y-2 pl-5 text-[0.97rem] leading-relaxed text-ink-soft">
										{section.bullets.map((item) => (
											<li key={item}>{item}</li>
										))}
									</ul>
								) : null}
								{"closing" in section && section.closing
									? section.closing.map((paragraph) => (
											<p
												key={paragraph}
												className="mt-3 text-[0.97rem] leading-relaxed text-ink-soft"
											>
												{paragraph}
											</p>
										))
									: null}
							</section>
						))}
					</div>

					<p className="mt-12 text-[0.97rem] text-ink-muted">
						Questions about this notice? Email{" "}
						<a
							href={`mailto:${contact.email}`}
							className="font-medium text-ink transition-colors hover:text-accent"
						>
							{contact.email}
						</a>{" "}
						or return to{" "}
						<Link to="/contact" className="link-underline">
							Contact
						</Link>
						.
					</p>
				</div>
			</section>
		</>
	);
}
