type PageHeroProps = {
	eyebrow: string;
	title: string;
	summary?: string;
	accent?: string;
	animate?: boolean;
	children?: React.ReactNode;
};

export function PageHero({
	eyebrow,
	title,
	summary,
	accent,
	animate = true,
	children,
}: PageHeroProps) {
	const motion = animate ? "animate-fade-up" : "";
	const delay = (ms: number) => (animate ? { animationDelay: `${ms}ms` } : undefined);

	return (
		<section className="border-b border-line bg-gradient-to-b from-mist to-white section-pad !pb-12">
			<div className="site-container">
				<p className={`eyebrow ${motion}`} style={delay(40)}>
					{eyebrow}
				</p>
				<h1
					className={`mt-3 max-w-3xl font-display text-display-lg text-ink ${motion}`}
					style={delay(100)}
				>
					{title}
				</h1>
				{summary ? (
					<p
						className={`mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft ${motion}`}
						style={delay(160)}
					>
						{summary}
					</p>
				) : null}
				{accent ? (
					<p
						className={`mt-4 max-w-2xl text-[0.97rem] italic text-accent ${motion}`}
						style={delay(200)}
					>
						{accent}
					</p>
				) : null}
				{children}
			</div>
		</section>
	);
}
