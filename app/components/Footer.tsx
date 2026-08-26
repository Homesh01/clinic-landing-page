import { Link } from "@remix-run/react";
import { contact, locations, nav, site } from "~/data/content";

export function Footer() {
	return (
		<footer className="border-t border-line bg-cream">
			<div className="site-container section-pad !py-16">
				<div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
					<div>
						<p className="font-display text-3xl text-ink">{site.name}</p>
						<p className="mt-2 text-sm uppercase tracking-[0.16em] text-ink-muted">
							{site.title}
						</p>
						<p className="mt-5 max-w-md text-[0.98rem] text-ink-soft">
							Specialist care in thyroid cancer and radiotherapy for
							haematological malignancies, with clinics in central London.
						</p>
						<Link to="/book" className="btn-primary mt-8">
							Book a consultation
						</Link>
					</div>

					<div>
						<p className="eyebrow">Navigate</p>
						<ul className="mt-4 space-y-2.5">
							{nav.map((item) => (
								<li key={item.to}>
									<Link
										to={item.to}
										className="text-ink-soft transition-colors hover:text-accent"
									>
										{item.label}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div>
						<p className="eyebrow">Contact</p>
						<ul className="mt-4 space-y-3 text-ink-soft">
							<li>
								<span className="block text-sm text-ink-muted">
									{contact.secretaryLabel}
								</span>
								{contact.name}
							</li>
							<li>
								<a
									href={`mailto:${contact.email}`}
									className="transition-colors hover:text-accent"
								>
									{contact.email}
								</a>
							</li>
							<li>{contact.phone}</li>
						</ul>
						<p className="mt-6 text-sm text-ink-muted">
							{locations[0].name}
						</p>
					</div>
				</div>

				<div className="mt-14 flex flex-col gap-3 border-t border-line pt-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
					<p>
						© {new Date().getFullYear()} {site.name}. All rights reserved.
					</p>
					<p>GMC Registration No. {site.gmc}</p>
				</div>
			</div>
		</footer>
	);
}
