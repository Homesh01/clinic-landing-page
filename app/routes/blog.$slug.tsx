import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { PageHero } from "~/components/PageHero";
import { getBlogShortPostBySlug } from "~/data/content";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export async function loader({ params }: LoaderFunctionArgs) {
	const slug = params.slug?.trim() ?? "";
	const post = getBlogShortPostBySlug(slug);
	if (!post) {
		throw new Response("Post not found", { status: 404 });
	}
	return { post };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data?.post) {
		return buildPageMeta({
			title: clinicPageTitle("Blog"),
			description: "Post not found.",
			path: "/blog",
			noIndex: true,
		});
	}

	const { post } = data;
	const title = post.title ?? post.paragraphs[0] ?? "Blog post";
	const description = post.paragraphs[0] ?? title;

	return buildPageMeta({
		title: clinicPageTitle(title),
		description,
		path: `/blog/${post.slug}`,
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

export default function BlogPostPage() {
	const { post } = useLoaderData<typeof loader>();
	const title = post.title ?? "Blog post";

	return (
		<>
			<PageHero
				eyebrow="Post"
				title={title}
				accent={formatPostDate(post.date)}
			/>

			<section className="content-section">
				<div className="site-container">
					<article className="max-w-prose space-y-4">
						{post.paragraphs.map((paragraph) => (
							<p
								key={paragraph.slice(0, 48)}
								className="text-[0.97rem] leading-relaxed text-ink-soft"
							>
								{paragraph}
							</p>
						))}
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
