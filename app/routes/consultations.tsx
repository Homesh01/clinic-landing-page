import type { MetaFunction } from "@remix-run/cloudflare";
import { CalloutBanner } from "~/components/CalloutBanner";
import { PageHero } from "~/components/PageHero";
import { consultationsPage, services, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `Consultations | ${site.name}` },
		{
			name: "description",
			content: consultationsPage.lede,
		},
	];
};

export default function ConsultationsPage() {
	return (
		<>
			<PageHero
				eyebrow="Consultations &amp; services"
				title={consultationsPage.title}
				summary={consultationsPage.lede}
				accent={consultationsPage.reassure}
			/>

			<section className="content-section">
				<div className="site-container">
					<ol className="list-none m-0 p-0">
						{services.map((service, index) => (
							<li
								key={service.title}
								className="grid gap-5 border-t border-line py-9 sm:grid-cols-[70px_1fr] sm:gap-6"
							>
								<span className="font-display text-2xl text-accent/70 pt-1">
									{String(index + 1).padStart(2, "0")}
								</span>
								<div>
									<h2 className="font-display text-[1.65rem] text-ink">
										{service.title}
									</h2>
									<p className="mt-3 max-w-xl text-[0.97rem] leading-relaxed text-ink-soft">
										{service.description}
									</p>
									{"tags" in service && service.tags ? (
										<div className="mt-1">
											{service.tags.map((tag) => (
												<span key={tag.label} className="tag-teal">
													{tag.label}
												</span>
											))}
										</div>
									) : null}
								</div>
							</li>
						))}
					</ol>
					<div className="border-b border-line" />
				</div>
			</section>

			<CalloutBanner
				title={consultationsPage.callout.title}
				body={consultationsPage.callout.body}
				actions={[
					{ label: "Book a consultation", to: "/book", variant: "primary" },
					{
						label: "About fees & insurance",
						to: "/contact#fees",
						variant: "outline",
					},
				]}
			/>
		</>
	);
}
