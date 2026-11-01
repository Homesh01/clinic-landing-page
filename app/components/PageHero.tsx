type PageHeroProps = {
	eyebrow: string;
	title: string;
	summary?: string;
	accent?: string;
	animate?: boolean;
	/** clinical = soft mist wash; lab = cooler white with a precise accent rule */
	tone?: "clinical" | "lab";
	children?: React.ReactNode;
};

export function PageHero({
	eyebrow,
	title,
	summary,
	accent,
	animate = true,
	tone = "clinical",
	children,
}: PageHeroProps) {
	const motion = animate ? "animate-fade-up" : "";
	const delay = (ms: number) =>
		animate ? { animationDelay: `${ms}ms` } : undefined;

	const sectionClass =
		tone === "lab"
			? "border-b border-line bg-white section-pad !pb-12"
			: "border-b border-line bg-gradient-to-b from-mist to-white section-pad !pb-12";

	return (
		<section className={sectionClass}>
			<div className="site-container">
				{tone === "lab" ? (
					<div className="mb-6 h-px w-16 bg-accent" aria-hidden="true" />
				) : null}
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
						className={`mt-4 max-w-2xl text-[0.97rem] tracking-wide text-accent ${
							tone === "lab" ? "not-italic" : "italic"
						} ${motion}`}
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
