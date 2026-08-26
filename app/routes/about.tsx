import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { PageIntro } from "~/components/PageIntro";
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
			content: about.lead,
		},
	];
};

export default function AboutPage() {
	return (
		<>
			<PageIntro
				eyebrow="About"
				title="A clinician at the intersection of oncology and AI"
				summary={about.lead}
			/>

			<section className="section-pad">
				<div className="site-container grid gap-14 lg:grid-cols-[1.35fr_0.85fr]">
					<div className="prose-clinic max-w-prose">
						{about.paragraphs.map((paragraph) => (
							<p key={paragraph.slice(0, 48)}>{paragraph}</p>
						))}
						<blockquote className="mt-10 border-l-2 border-accent pl-5 font-display text-2xl italic leading-snug text-ink">
							{about.belief}
						</blockquote>
					</div>

					<aside className="space-y-10 lg:pt-2">
						<div>
							<p className="eyebrow">Credentials</p>
							<ul className="mt-5 space-y-5">
								{credentials.map((item) => (
									<li key={item.abbr} className="border-b border-line pb-4">
										<p className="font-semibold text-ink">{item.abbr}</p>
										<p className="mt-1 text-[0.95rem] text-ink-muted">
											{item.detail}
										</p>
									</li>
								))}
							</ul>
						</div>

						<div>
							<p className="eyebrow">Appointments</p>
							<ul className="mt-5 space-y-4 text-[0.95rem] text-ink-soft">
								{appointments.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>

						<Link to="/book" className="btn-primary">
							Book a consultation
						</Link>
					</aside>
				</div>
			</section>
		</>
	);
}
