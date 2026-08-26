type PageIntroProps = {
	eyebrow: string;
	title: string;
	summary: string;
};

export function PageIntro({ eyebrow, title, summary }: PageIntroProps) {
	return (
		<section className="border-b border-line bg-gradient-to-b from-mist/70 to-white">
			<div className="site-container section-pad !pb-14 !pt-16 sm:!pt-20">
				<p className="eyebrow animate-fade-up">{eyebrow}</p>
				<h1
					className="mt-4 max-w-3xl font-display text-display-lg text-ink animate-fade-up"
					style={{ animationDelay: "80ms" }}
				>
					{title}
				</h1>
				<p
					className="mt-5 max-w-2xl text-lg text-ink-soft animate-fade-up"
					style={{ animationDelay: "160ms" }}
				>
					{summary}
				</p>
			</div>
		</section>
	);
}
