import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { BlogArticleBody } from "~/components/BlogArticleBody";
import { PageHero } from "~/components/PageHero";
import { getBlogArticleBySlug } from "~/data/content";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export async function loader({ params }: LoaderFunctionArgs) {
	const slug = params.slug?.trim() ?? "";
	const article = getBlogArticleBySlug(slug);
	if (!article) {
		throw new Response("Article not found", { status: 404 });
	}
	return { article };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data?.article) {
		return buildPageMeta({
			title: clinicPageTitle("Article"),
			description: "Article not found.",
			path: "/blog",
			noIndex: true,
		});
	}

	const { article } = data;
	return buildPageMeta({
		title: clinicPageTitle(article.title),
		description: article.lede,
		path: `/article/${article.slug}`,
		ogType: "article",
	});
};

function formatPostDate(iso: string) {
	const date = new Date(`${iso}T12:00:00`);
	return date.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

export default function ArticlePage() {
	const { article } = useLoaderData<typeof loader>();
	const eyebrow = article.series
		? `Article / ${article.series}`
		: "Article";

	return (
		<>
			<PageHero
				eyebrow={eyebrow}
				title={article.title}
				summary={article.lede}
				accent={formatPostDate(article.date)}
			/>

			<section className="content-section">
				<div className="site-container">
					<article className="max-w-prose">
						<BlogArticleBody blocks={article.blocks} />
					</article>

					<p className="mt-12 max-w-prose">
						<Link to="/blog" className="link-underline">
							← Back to blog
						</Link>
					</p>
				</div>
			</section>
		</>
	);
}
