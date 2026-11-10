import { Link } from "@remix-run/react";
import { contact, locations, privacyNotice, site } from "~/data/content";

export function Footer() {
	return (
		<footer className="border-t border-line bg-cream">
			<div className="site-container section-pad !py-16">
				<div className="grid gap-12 md:grid-cols-[1.4fr_1fr] md:gap-16">
					<div>
						<p className="font-display text-3xl text-ink">{site.brand}</p>
						<p className="mt-5 max-w-md text-[0.98rem] text-ink-soft">
							<Link
								to="/contact"
								className="font-semibold text-accent-deep underline-offset-2 transition-colors hover:text-accent hover:underline"
							>
								Get in touch
							</Link>{" "}
							with any questions, or to arrange a consultation.
						</p>
					</div>

					<div>
						<p className="eyebrow">Contact</p>
						<ul className="mt-4 space-y-3 text-ink-soft">
							<li>
								<span className="block text-sm text-ink-muted">
									{contact.secretaryLabel}
								</span>
								<a
									href={`mailto:${contact.email}`}
									className="transition-colors hover:text-accent"
								>
									{contact.email}
								</a>
							</li>
							<li className="text-sm text-ink-muted">{contact.enquiriesNote}</li>
							<li className="pt-2 text-sm leading-relaxed text-ink-muted">
								{locations[0].name}
							</li>
						</ul>
					</div>
				</div>

				<div className="mt-14 flex flex-col gap-3 border-t border-line pt-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
					<p>
						© {new Date().getFullYear()} {site.brand}. All rights reserved.
					</p>
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
						<Link
							to={privacyNotice.path}
							className="transition-colors hover:text-accent"
						>
							Patient Privacy Notice
						</Link>
						<a
							href={site.gmcVerifyUrl}
							target="_blank"
							rel="noreferrer"
							className="transition-colors hover:text-accent"
						>
							GMC {site.gmc}
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}
