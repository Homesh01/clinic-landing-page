import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
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
			<section className="border-b border-line bg-gradient-to-b from-mist to-white section-pad !pb-12">
				<div className="site-container">
					<p className="eyebrow">Contact &amp; Locations</p>
					<h1 className="mt-3 max-w-3xl font-display text-display-lg text-ink">
						Reach the practice team
					</h1>
					<p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
						Appointments are available across central London clinics. Fees and
						insurer details can be confirmed before your first visit.
					</p>
				</div>
			</section>

			<section className="section-pad">
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
							<Link to="/book" className="btn-primary mt-6">
								Book a consultation
							</Link>
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

			<section className="section-pad !pt-0">
				<div className="site-container">
					<div className="flex flex-wrap items-center justify-between gap-8 rounded-xl bg-accent-deep px-8 py-10 sm:px-12 sm:py-11">
						<div className="max-w-xl">
							<h2 className="font-display text-3xl text-white">
								{contactPage.callout.title}
							</h2>
							<p className="mt-3 text-[0.97rem] text-white/75">
								{contactPage.callout.body}
							</p>
						</div>
						<div className="flex shrink-0 flex-wrap gap-3">
							<a
								href={`mailto:${contact.email}`}
								className="inline-flex items-center justify-center rounded-sm bg-white px-6 py-3 text-[0.95rem] font-semibold text-accent-deep transition hover:bg-accent-soft"
							>
								{contactPage.callout.emailLabel}
							</a>
							<Link
								to="/book"
								className="inline-flex items-center justify-center rounded-sm border border-white/25 px-6 py-3 text-[0.95rem] font-semibold text-white transition hover:border-white/60"
							>
								{contactPage.callout.bookLabel}
							</Link>
						</div>
					</div>
				</div>
			</section>
		</>
	);
}
