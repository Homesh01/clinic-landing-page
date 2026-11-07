import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { PageHero } from "~/components/PageHero";
import {
	articlePath,
	blog,
	blogPostPath,
	blogPosts,
	isBlogArticle,
	type BlogArticle,
	type BlogPost,
	type BlogShortPost,
} from "~/data/content";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Blog"),
		description: blog.intro,
		path: "/blog",
	});
};

const PREVIEW_PARAGRAPHS = 2;

function formatPostDate(iso: string) {
	const date = new Date(`${iso}T12:00:00`);
	return date.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function EntryMeta({
	kindLabel,
	date,
}: {
	kindLabel: string;
	date: string;
}) {
	return (
		<div className="space-y-1.5 sm:pt-1">
			<p className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-accent">
				{kindLabel}
			</p>
			<p className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-ink-muted">
				{formatPostDate(date)}
			</p>
		</div>
	);
}

function BlogArticleItem({ article }: { article: BlogArticle }) {
	return (
		<li className="grid gap-3 border-t border-line py-9 sm:grid-cols-[160px_1fr] sm:gap-8">
			<EntryMeta kindLabel="Article" date={article.date} />
			<div className="max-w-prose">
				{article.series ? (
					<p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-ink-muted">
						{article.series}
					</p>
				) : null}
				<h2 className="mb-3 font-display text-2xl text-ink">
					<Link
						to={articlePath(article.slug)}
						className="transition-colors hover:text-accent"
					>
						{article.title}
					</Link>
				</h2>
				<p className="text-[0.97rem] leading-relaxed text-ink-soft">
					{article.lede}
				</p>
				<Link
					to={articlePath(article.slug)}
					className="link-underline mt-5 inline-block"
				>
					Read more
					<span aria-hidden="true"> →</span>
				</Link>
			</div>
		</li>
	);
}

function BlogShortPostItem({ post }: { post: BlogShortPost }) {
	const preview = post.paragraphs.slice(0, PREVIEW_PARAGRAPHS);
	const href = blogPostPath(post.slug);

	return (
		<li className="grid gap-3 border-t border-line py-9 sm:grid-cols-[160px_1fr] sm:gap-8">
			<EntryMeta kindLabel="Post" date={post.date} />
			<div className="max-w-prose">
				{post.title ? (
					<h2 className="mb-3 font-display text-2xl text-ink">
						<Link to={href} className="transition-colors hover:text-accent">
							{post.title}
						</Link>
					</h2>
				) : null}
				<div className="space-y-4">
					{preview.map((paragraph) => (
						<p
							key={paragraph.slice(0, 48)}
							className="text-[0.97rem] leading-relaxed text-ink-soft"
						>
							{paragraph}
						</p>
					))}
				</div>
				<Link to={href} className="link-underline mt-5 inline-block">
					Read more
					<span aria-hidden="true"> →</span>
				</Link>
			</div>
		</li>
	);
}

function BlogEntryItem({ post }: { post: BlogPost }) {
	if (isBlogArticle(post)) {
		return <BlogArticleItem article={post} />;
	}
	return <BlogShortPostItem post={post} />;
}

export default function BlogPage() {
	const posts = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date));

	return (
		<>
			<PageHero
				eyebrow="Blog"
				title="Commentary and professional updates"
				summary={blog.intro}
			/>

			<section className="content-section">
				<div className="site-container">
					<ul className="m-0 list-none p-0">
						{posts.map((post) => (
							<BlogEntryItem key={post.slug} post={post} />
						))}
					</ul>
				</div>
			</section>
		</>
	);
}
