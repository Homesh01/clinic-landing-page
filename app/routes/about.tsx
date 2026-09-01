import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import {
	about,
	appointments,
	credentials,
	site,
} from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `About | ${site.name}` },
		{
			name: "description",
			content: about.heroLede,
		},
	];
};

export default function AboutPage() {
	return (
		<>
			<section className="border-b border-line bg-gradient-to-b from-mist to-white section-pad">
				<div className="site-container">
					<div className="grid items-start gap-12 lg:grid-cols-[1.3fr_0.7fr] lg:gap-16">
						<div>
							<p className="eyebrow">About</p>
							<h1 className="mt-3 max-w-2xl font-display text-display-lg text-ink">
								{about.heroTitle}
							</h1>
							<p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
								{about.heroLede}
							</p>
							<div className="mt-8 flex flex-wrap gap-3">
								<Link to="/book" className="btn-primary">
									Book a consultation
								</Link>
								<a href="#background" className="btn-secondary">
									Read her full background ↓
								</a>
							</div>
						</div>
						<div className="mx-auto w-full max-w-xs lg:max-w-none">
							<img
								src={site.headshot}
								alt={`Portrait of ${site.name}`}
								className="headshot"
							/>
						</div>
					</div>
				</div>
			</section>

			<section id="background" className="scroll-mt-28 section-pad">
				<div className="site-container grid gap-14 lg:grid-cols-[1.55fr_0.8fr]">
					<div className="max-w-prose">
						{about.sections.map((section) => (
							<section key={section.heading} className="mb-10 last:mb-0">
								<h2 className="font-display text-2xl font-semibold text-ink">
									{section.heading}
								</h2>
								<div className="prose-clinic mt-4">
									{section.paragraphs.map((paragraph) => (
										<p key={paragraph.slice(0, 48)}>{paragraph}</p>
									))}
								</div>
							</section>
						))}

						<blockquote className="mt-8 border-l-[3px] border-accent pl-6 font-display text-2xl italic leading-snug text-ink">
							{about.belief}
						</blockquote>

						<div className="mt-12 rounded-md bg-mist p-6 sm:p-7">
							<p className="max-w-prose text-[0.97rem] text-ink-soft">
								<strong className="font-semibold text-ink">
									Ready to arrange a consultation?
								</strong>{" "}
								{about.bottomCta}
							</p>
						</div>
					</div>

					<aside className="lg:sticky lg:top-28 lg:self-start">
						<div>
							<p className="eyebrow">Credentials</p>
							<ul className="mt-5">
								{credentials.map((item) => (
									<li
										key={item.abbr}
										className="border-b border-line py-4 first:border-t"
									>
										<p className="font-semibold text-ink">{item.abbr}</p>
										<p className="mt-1 text-[0.9rem] text-ink-muted">
											{item.abbr === "GMC" ? (
												<>
													Registration No.{" "}
													<a
														href={site.gmcVerifyUrl}
														target="_blank"
														rel="noreferrer"
														className="text-accent transition-colors hover:text-accent-deep"
													>
														{site.gmc}
													</a>
												</>
											) : (
												item.detail
											)}
										</p>
									</li>
								))}
							</ul>
						</div>

						<div className="mt-10">
							<p className="eyebrow">Appointments</p>
							<ul className="mt-5 space-y-4">
								{appointments.map((item) => (
									<li key={item.role} className="text-[0.95rem] text-ink-soft">
										{item.role}
										{"current" in item && item.current ? (
											<span className="ml-1 text-xs text-ink-muted">
												(current)
											</span>
										) : null}
									</li>
								))}
							</ul>
						</div>
					</aside>
				</div>
			</section>
		</>
	);
}
