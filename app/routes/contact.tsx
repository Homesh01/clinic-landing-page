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
				"Clinic locations, fees and insurance information, and how to contact Dr Karen Sayal’s practice team.",
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
	const [firstLocation, secondLocation, thirdLocation] = locations;

	return (
		<>
			<PageHero
				eyebrow="Contact &amp; Locations"
				title="Reach the practice team"
				summary="Appointments are available across central London clinics. Fees and insurer details can be confirmed before your first visit."
			/>

			<section className="pt-8 sm:pt-10 pb-16 sm:pb-24">
				<div className="site-container">
					<div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-16">
						<p className="eyebrow">Locations</p>
						<p className="eyebrow hidden lg:block">
							{contact.secretaryLabel}
						</p>
					</div>

					{/*
					  Shared grid so row heights match across columns:
					  row 1 = first location | secretary
					  row 2 = second location | fees  (dividers align)
					  row 3 = third location
					*/}
					<div className="mt-5 grid grid-cols-1 lg:grid-cols-2 lg:items-stretch lg:gap-x-16">
						<div className="order-1 border-t border-line py-7">
							<LocationBlock location={firstLocation} />
						</div>

						<div className="order-4 border-t border-line py-7 lg:order-2">
							<p className="eyebrow mb-4 lg:hidden">
								{contact.secretaryLabel}
							</p>
							<h2 className="font-display text-[1.45rem] leading-snug text-ink">
								{contact.name}
							</h2>
							<p className="mt-2.5 text-[0.97rem] text-ink-soft">
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

						<div className="order-2 border-t border-line py-7 lg:order-3">
							<LocationBlock location={secondLocation} />
						</div>

						<div
							id="fees"
							className="order-5 scroll-mt-28 border-t border-line py-7 lg:order-4"
						>
							<p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-accent">
								Fees &amp; insurance
							</p>
							<p className="mt-2.5 text-[0.97rem] leading-relaxed text-ink-soft">
								{fees.intro}
							</p>
							<p className="mt-3 text-[0.97rem] text-ink-muted">
								{fees.insurers}
							</p>
							<p className="mt-2 text-[0.97rem] text-ink-muted">
								{fees.selfPay}
							</p>
						</div>

						{thirdLocation ? (
							<div className="order-3 border-t border-line py-7 lg:order-5">
								<LocationBlock location={thirdLocation} />
							</div>
						) : null}
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
