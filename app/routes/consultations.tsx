import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { PageIntro } from "~/components/PageIntro";
import { services, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `Consultations | ${site.name}` },
		{
			name: "description",
			content:
				"New patient consultations, second opinions, radiotherapy planning, ongoing monitoring, and virtual appointments.",
		},
	];
};

export default function ConsultationsPage() {
	return (
		<>
			<PageIntro
				eyebrow="Consultations & services"
				title="How care begins and continues"
				summary="From first review to ongoing monitoring, each service is designed to give you clarity, options, and a written plan."
			/>

			<section className="section-pad">
				<div className="site-container">
					<ol className="divide-y divide-line border-y border-line">
						{services.map((service, index) => (
							<li
								key={service.title}
								className="grid gap-4 py-10 sm:grid-cols-[5rem_1fr] sm:gap-10"
							>
								<span className="font-display text-3xl text-accent/70">
									{String(index + 1).padStart(2, "0")}
								</span>
								<div>
									<h2 className="font-display text-3xl text-ink">
										{service.title}
									</h2>
									<p className="mt-3 max-w-2xl text-lg text-ink-soft">
										{service.description}
									</p>
								</div>
							</li>
						))}
					</ol>

					<div className="mt-16 flex flex-wrap items-center gap-4">
						<Link to="/book" className="btn-primary">
							Book an appointment
						</Link>
						<Link to="/contact" className="btn-secondary">
							Ask about fees &amp; insurance
						</Link>
					</div>
				</div>
			</section>
		</>
	);
}
