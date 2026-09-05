import type { MetaFunction } from "@remix-run/cloudflare";
import { CalloutBanner } from "~/components/CalloutBanner";
import { PageHero } from "~/components/PageHero";
import { contact, contactPage, fees, locations, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `Contact & locations | ${site.name}` },
		{
			name: "description",
			content:
				"Clinic locations, fees and insurance information, and how to contact Dr Karen Sayal’s clinic team.",
		},
	];
};

function LocationBlock({
	location,
}: {
	location: (typeof locations)[number];
}) {
	return (
		<>
			<p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-accent">
				{location.group}
			</p>
			<h2 className="mt-2 font-display text-[1.45rem] leading-snug text-ink">
				{location.name}
			</h2>
			<address className="mt-2.5 text-[0.97rem] not-italic leading-relaxed text-ink-soft">
				{location.addressLines.map((line) => (
					<span key={line} className="block">
						{line}
					</span>
				))}
			</address>
		</>
	);
}

export default function ContactPage() {
	return (
		<>
			<PageHero
				eyebrow="Contact &amp; Locations"
				title="Reach the clinic team"
				summary="Appointments are available across central London clinics. Self-pay fees are listed below; for private insurance, the clinic bills your insurer."
			/>

			<section className="pt-8 sm:pt-10 pb-16 sm:pb-24">
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
								<p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-accent">
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
