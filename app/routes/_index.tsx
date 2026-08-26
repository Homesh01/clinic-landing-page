import { Link } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/cloudflare";
import { conditions, services, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `${site.name} | ${site.title}` },
		{
			name: "description",
			content: site.tagline,
		},
	];
};

export default function Index() {
	return (
		<>
			<section className="relative isolate min-h-[min(92vh,52rem)] overflow-hidden">
				<div className="absolute inset-0 -z-10">
					<img
						src="https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=2400&q=80"
						alt=""
						className="h-full w-full object-cover animate-soft-pan"
					/>
					<div className="absolute inset-0 bg-gradient-to-r from-white via-white/92 to-white/55" />
					<div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-white/30" />
				</div>

				<div className="site-container flex min-h-[min(92vh,52rem)] flex-col justify-center py-20">
					<div className="max-w-2xl">
						<p
							className="font-display text-display-xl text-ink animate-fade-up"
							style={{ animationDelay: "40ms" }}
						>
							{site.name}
						</p>
						<h1
							className="mt-5 max-w-xl font-display text-display-md font-medium text-ink-soft animate-fade-up"
							style={{ animationDelay: "120ms" }}
						>
							Consultant Clinical Oncologist
						</h1>
						<p
							className="mt-6 max-w-lg text-lg leading-relaxed text-ink-muted animate-fade-up"
							style={{ animationDelay: "200ms" }}
						>
							Specialist care in thyroid cancer and radiotherapy for
							haematological malignancies — personalised, precise, and
							grounded in both clinical practice and translational AI.
						</p>
						<div
							className="mt-10 flex flex-wrap gap-3 animate-fade-up"
							style={{ animationDelay: "280ms" }}
						>
							<Link to="/book" className="btn-primary">
								Book a consultation
							</Link>
							<Link to="/about" className="btn-secondary">
								About Dr Sayal
							</Link>
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

			<section className="border-y border-line bg-mist/50 section-pad">
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

			<section className="section-pad">
				<div className="site-container overflow-hidden rounded-sm bg-ink px-8 py-14 text-white sm:px-12 sm:py-16">
					<div className="max-w-2xl">
						<p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white/55">
							Appointments
						</p>
						<h2 className="mt-4 font-display text-display-md text-white">
							Book online, or speak with the practice team
						</h2>
						<p className="mt-4 text-lg text-white/75">
							View available slots and request a consultation at a time that
							suits you. Clinics at UCLH (HCA), The London Oncology Clinic,
							and Harley Street.
						</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<Link
								to="/book"
								className="inline-flex items-center justify-center rounded-sm bg-white px-6 py-3 text-[0.95rem] font-semibold text-ink transition hover:bg-cream"
							>
								Book now
							</Link>
							<Link
								to="/contact"
								className="inline-flex items-center justify-center rounded-sm border border-white/25 px-6 py-3 text-[0.95rem] font-semibold text-white transition hover:border-white/60"
							>
								Contact &amp; locations
							</Link>
						</div>
					</div>
				</div>
			</section>
		</>
	);
}
