import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { PageIntro } from "~/components/PageIntro";
import { contact, fees, locations, site } from "~/data/content";

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
			<PageIntro
				eyebrow="Contact & locations"
				title="Reach the practice team"
				summary="Appointments are available across central London clinics. Fees and insurer details can be confirmed before your first visit."
			/>

			<section className="section-pad">
				<div className="site-container grid gap-16 lg:grid-cols-[1fr_1fr]">
					<div>
						<p className="eyebrow">Locations</p>
						<ul className="mt-8 space-y-8">
							{locations.map((location) => (
								<li
									key={location.name}
									className="border-t border-line pt-6"
								>
									<h2 className="font-display text-3xl text-ink">
										{location.name}
									</h2>
									<p className="mt-2 text-ink-muted">{location.address}</p>
								</li>
							))}
						</ul>
					</div>

					<div className="space-y-12">
						<div>
							<p className="eyebrow">Secretary / PA</p>
							<div className="mt-6 space-y-3 text-ink-soft">
								<p className="text-xl font-semibold text-ink">{contact.name}</p>
								<p>
									<a
										href={`mailto:${contact.email}`}
										className="transition-colors hover:text-accent"
									>
										{contact.email}
									</a>
								</p>
								<p>{contact.phone}</p>
							</div>
							<Link to="/book" className="btn-primary mt-8">
								Book a consultation
							</Link>
						</div>

						<div id="fees" className="scroll-mt-28 border-t border-line pt-10">
							<p className="eyebrow">Fees &amp; insurance</p>
							<p className="mt-5 text-lg text-ink-soft">{fees.intro}</p>
							<ul className="mt-6 space-y-3 text-ink-muted">
								<li>{fees.insurers}</li>
								<li>{fees.selfPay}</li>
							</ul>
						</div>
					</div>
				</div>
			</section>
		</>
	);
}
