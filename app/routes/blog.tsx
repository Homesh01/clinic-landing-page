import type { MetaFunction } from "@remix-run/cloudflare";
import { useState } from "react";
import { PageHero } from "~/components/PageHero";
import { type BlogPost, blog, blogPosts, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `Blog | ${site.name}` },
		{
			name: "description",
			content: blog.intro,
		},
	];
};

const PREVIEW_PARAGRAPHS = 2;
const PREVIEW_CHAR_LIMIT = 360;

function formatPostDate(iso: string) {
	const date = new Date(`${iso}T12:00:00`);
	return date.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function getPreview(paragraphs: readonly string[]) {
	const totalLength = paragraphs.join(" ").length;
	const expandable =
		paragraphs.length > PREVIEW_PARAGRAPHS || totalLength > PREVIEW_CHAR_LIMIT;

	if (!expandable) {
		return { preview: paragraphs, expandable: false };
	}

	if (paragraphs.length > PREVIEW_PARAGRAPHS) {
		return {
			preview: paragraphs.slice(0, PREVIEW_PARAGRAPHS),
			expandable: true,
		};
	}

	return { preview: paragraphs.slice(0, 1), expandable: true };
}

function BlogPostItem({ post }: { post: BlogPost }) {
	const [expanded, setExpanded] = useState(false);
	const { preview, expandable } = getPreview(post.paragraphs);
	const paragraphs = expanded || !expandable ? post.paragraphs : preview;

	return (
		<li className="grid gap-3 border-t border-line py-9 sm:grid-cols-[160px_1fr] sm:gap-8">
			<p className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-accent sm:pt-1">
				{formatPostDate(post.date)}
			</p>
			<div className="max-w-prose">
				<div className="space-y-4">
					{paragraphs.map((paragraph) => (
						<p
							key={paragraph.slice(0, 48)}
							className="text-[0.97rem] leading-relaxed text-ink-soft"
						>
							{paragraph}
						</p>
					))}
				</div>
				{expandable ? (
					<button
						type="button"
						className="link-underline mt-5 border-0 bg-transparent p-0"
						aria-expanded={expanded}
						onClick={() => setExpanded((value) => !value)}
					>
						{expanded ? "Show less" : "Read more"}
						<span aria-hidden="true">{expanded ? " ↑" : " ↓"}</span>
					</button>
				) : null}
			</div>
		</li>
	);
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
					<ul className="list-none m-0 p-0">
						{posts.map((post) => (
							<BlogPostItem
								key={`${post.date}-${post.paragraphs[0]?.slice(0, 32)}`}
								post={post}
							/>
						))}
					</ul>
				</div>
			</section>
		</>
	);
}
