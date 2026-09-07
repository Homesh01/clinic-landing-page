import type { MetaFunction } from "@remix-run/cloudflare";
import { CalloutBanner } from "~/components/CalloutBanner";
import { PageHero } from "~/components/PageHero";
import { contact, contactPage, fees, locations } from "~/data/content";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Contact & locations"),
		description:
			"Contact Personalised Cancer Care — London clinic locations, fees, insurance, and how to reach the clinic team.",
		path: "/contact",
	});
};

function LocationBlock({
	location,
}: {
	location: (typeof locations)[number];
}) {
	return (
		<>
			<h2 className="section-subtitle">
				{location.name}
			</h2>
			<address className="mt-2.5 text-[0.97rem] not-italic leading-relaxed text-ink-soft">
				{location.addressLines.map((line) => (
					<span key={line} className="block">
						{line}
					</span>
				))}
			</address>
			<a
				href={location.mapsUrl}
				target="_blank"
				rel="noreferrer"
				className="link-underline mt-3 text-[0.95rem]"
			>
				View on Google Maps
			</a>
		</>
	);
}

export default function ContactPage() {
	return (
		<>
			<PageHero
				eyebrow="Contact &amp; Locations"
				title="Reach the clinic team"
				summary="Appointments are available across central London clinics. Self-pay fees are listed below; insurance bookings need an authorisation code and are confirmed after verification."
			/>

			<section className="content-section">
				<div className="site-container">
					<div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-x-16">
						<div>
							<p className="eyebrow">Locations</p>
							<div className="mt-5">
								{locations.map((location) => (
									<div key={location.name} className="border-t border-line py-7">
										<LocationBlock location={location} />
									</div>
								))}
							</div>
						</div>

						<div>
							<p className="eyebrow">{contact.secretaryLabel}</p>
							<div className="mt-5 border-t border-line py-7">
								<p className="text-[0.97rem] text-ink-soft">
									<a
										href={`mailto:${contact.email}`}
										className="transition-colors hover:text-accent"
									>
										{contact.email}
									</a>
								</p>
								<p className="mt-2 text-[0.92rem] italic text-ink-muted">
									{contact.enquiriesNote}
								</p>
							</div>

							<div
								id="fees"
								className="scroll-mt-28 border-t border-line py-7"
							>
								<p className="eyebrow">
									Fees &amp; insurance
								</p>
								<p className="mt-2.5 text-[0.97rem] leading-relaxed text-ink-soft">
									{fees.intro}
								</p>
								<ul className="mt-4 space-y-2 text-[0.97rem] text-ink">
									{fees.selfPay.map((item) => (
										<li
											key={item.label}
											className="flex items-baseline justify-between gap-4"
										>
											<span className="text-ink-soft">{item.label}</span>
											<span className="shrink-0 font-medium tabular-nums">
												{item.amount}
											</span>
										</li>
									))}
								</ul>
								<p className="mt-4 text-[0.97rem] leading-relaxed text-ink-muted">
									{fees.insurers}
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			<CalloutBanner
				tightTop
				title={contactPage.callout.title}
				body={contactPage.callout.body}
				actions={[
					{
						label: contactPage.callout.emailLabel,
						href: `mailto:${contact.email}`,
						variant: "primary",
					},
					{
						label: contactPage.callout.bookLabel,
						to: "/book",
						variant: "outline",
					},
				]}
			/>
		</>
	);
}
