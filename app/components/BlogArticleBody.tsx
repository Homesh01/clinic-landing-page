import {
	isProseLink,
	type BlogArticleBlock,
	type ProseParagraph,
} from "~/data/content";

const externalLinkClass =
	"text-accent underline-offset-2 transition-colors hover:text-accent-deep hover:underline";

function BlockCaption({ children }: { children: string }) {
	return (
		<p className="mt-3 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-ink-muted">
			{children}
		</p>
	);
}

function ProseText({
	text,
	className,
}: {
	text: ProseParagraph;
	className?: string;
}) {
	if (typeof text === "string") {
		return <p className={className}>{text}</p>;
	}

	return (
		<p className={className}>
			{text.map((chunk, index) =>
				typeof chunk === "string" ? (
					<span key={index}>{chunk}</span>
				) : isProseLink(chunk) ? (
					<a
						key={index}
						href={chunk.href}
						target="_blank"
						rel="noreferrer"
						className={externalLinkClass}
					>
						{chunk.text}
					</a>
				) : null,
			)}
		</p>
	);
}

export function BlogArticleBody({
	blocks,
}: {
	blocks: readonly BlogArticleBlock[];
}) {
	return (
		<div className="space-y-8">
			{blocks.map((block, index) => {
				const key = `${block.type}-${index}`;

				if (block.type === "heading") {
					return (
						<h2 key={key} className="section-subtitle pt-2">
							{block.text}
						</h2>
					);
				}

				if (block.type === "paragraph") {
					return (
						<ProseText
							key={key}
							text={block.text}
							className="text-[0.97rem] leading-relaxed text-ink-soft"
						/>
					);
				}

				if (block.type === "flow") {
					return (
						<figure key={key} className="space-y-4">
							<ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
								{block.items.map((item, itemIndex) => (
									<li
										key={item}
										className="border-t border-accent/40 pt-3 text-[0.95rem] leading-relaxed text-ink-soft"
									>
										<span className="mb-2 block text-[0.72rem] font-bold uppercase tracking-[0.08em] text-accent">
											{itemIndex + 1}
										</span>
										{item}
									</li>
								))}
							</ol>
							{block.caption ? (
								<figcaption>
									<BlockCaption>{block.caption}</BlockCaption>
								</figcaption>
							) : null}
						</figure>
					);
				}

				if (block.type === "steps") {
					return (
						<figure key={key} className="space-y-4">
							<ol className="list-steps">
								{block.items.map((item) => (
									<li key={item.title}>
										<p className="font-semibold text-ink">{item.title}</p>
										<p className="mt-1 leading-relaxed">{item.body}</p>
									</li>
								))}
							</ol>
							{block.caption ? (
								<figcaption>
									<BlockCaption>{block.caption}</BlockCaption>
								</figcaption>
							) : null}
						</figure>
					);
				}

				if (block.type === "compare") {
					return (
						<figure key={key} className="space-y-4">
							<div className="grid gap-8 sm:grid-cols-2">
								{block.items.map((item) => (
									<div key={item.title} className="border-t border-line pt-4">
										<h3 className="font-display text-xl text-ink">
											{item.title}
										</h3>
										<p className="mt-3 text-[0.97rem] leading-relaxed text-ink-soft">
											<span className="font-semibold text-ink">Purpose. </span>
											{item.purpose}
										</p>
										<div className="mt-2 text-[0.97rem] leading-relaxed text-ink-soft">
											<span className="font-semibold text-ink">Design. </span>
											{typeof item.design === "string" ? (
												item.design
											) : (
												item.design.map((chunk, chunkIndex) =>
													typeof chunk === "string" ? (
														<span key={chunkIndex}>{chunk}</span>
													) : isProseLink(chunk) ? (
														<a
															key={chunkIndex}
															href={chunk.href}
															target="_blank"
															rel="noreferrer"
															className={externalLinkClass}
														>
															{chunk.text}
														</a>
													) : null,
												)
											)}
										</div>
									</div>
								))}
							</div>
							{block.caption ? (
								<figcaption>
									<BlockCaption>{block.caption}</BlockCaption>
								</figcaption>
							) : null}
						</figure>
					);
				}

				if (block.type === "questions") {
					return (
						<ul key={key} className="list-plain m-0 p-0">
							{block.items.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					);
				}

				return (
					<figure key={key} className="space-y-3 border-t border-line pt-6">
						<figcaption>
							<BlockCaption>Sources</BlockCaption>
						</figcaption>
						<ol className="m-0 list-decimal space-y-2 pl-5 text-[0.92rem] leading-relaxed text-ink-muted">
							{block.items.map((item) => (
								<li key={item.href}>
									<a
										href={item.href}
										target="_blank"
										rel="noreferrer"
										className={externalLinkClass}
									>
										{item.text}
									</a>
								</li>
							))}
						</ol>
					</figure>
				);
			})}
		</div>
	);
}
