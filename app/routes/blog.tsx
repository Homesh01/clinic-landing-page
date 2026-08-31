import type { MetaFunction } from "@remix-run/cloudflare";
import { PageIntro } from "~/components/PageIntro";
import { blog, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `Blog | ${site.name}` },
		{
			name: "description",
			content: blog.intro,
		},
	];
};

export default function BlogPage() {
	return (
		<>
			<PageIntro
				eyebrow="Blog"
				title="Commentary and professional updates"
				summary={blog.intro}
			/>

			<section className="section-pad">
				<div className="site-container max-w-3xl">
					<p className="text-sm text-ink-muted">{blog.note}</p>

					<ul className="mt-10 space-y-6">
						{blog.social.map((item) => (
							<li
								key={item.platform}
								className="rounded-md border border-line bg-cream/50 p-6 sm:p-8"
							>
								<p className="eyebrow">{item.platform}</p>
								<h2 className="mt-3 font-display text-3xl text-ink">
									{item.label}
								</h2>
								<p className="mt-3 text-ink-soft">{item.description}</p>
								<a
									href={item.url}
									target="_blank"
									rel="noreferrer"
									className="link-underline mt-6"
								>
									View profile
									<span aria-hidden="true">↗</span>
								</a>
							</li>
						))}
					</ul>
				</div>
			</section>
		</>
	);
}
