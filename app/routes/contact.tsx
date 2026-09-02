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

export default function ContactPage() {
	return (
		<>
			<PageHero
				eyebrow="Contact &amp; Locations"
				title="Reach the practice team"
				summary="Appointments are available across central London clinics. Fees and insurer details can be confirmed before your first visit."
			/>

			<section className="section-pad !pt-0">
				<div className="site-container grid gap-16 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
					<div>
						<p className="eyebrow">Locations</p>
						<ul className="mt-2 list-none p-0">
							{locations.map((location) => (
								<li
									key={location.name}
									className="border-b border-line py-7 first:pt-0"
								>
									<p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-accent">
										{location.group}
									</p>
									<h2 className="mt-2 font-display text-[1.45rem] text-ink">
										{location.name}
									</h2>
									<address className="mt-2.5 text-[0.97rem] not-italic leading-relaxed text-ink-soft">
										{location.addressLines.map((line) => (
											<span key={line} className="block">
												{line}
											</span>
										))}
									</address>
								</li>
							))}
						</ul>
					</div>

					<div>
						<div>
							<p className="eyebrow">{contact.secretaryLabel}</p>
							<h2 className="mt-4 font-display text-[1.4rem] font-semibold text-ink">
								{contact.name}
							</h2>
							<p className="mt-2 text-[0.97rem] text-ink-muted">
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
							className="scroll-mt-28 mt-10 border-t border-line pt-10"
						>
							<p className="eyebrow">Fees &amp; insurance</p>
							<p className="mt-4 text-[0.97rem] leading-relaxed text-ink-soft">
								{fees.intro}
							</p>
							<p className="mt-3 text-[0.97rem] text-ink-muted">
								{fees.insurers}
							</p>
							<p className="mt-2 text-[0.97rem] text-ink-muted">
								{fees.selfPay}
							</p>
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
