import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { useMemo, useState } from "react";
import {
	Area,
	Bar,
	BarChart,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ChartCard } from "~/components/research/ChartCard";
import {
	CHART_ACCENT,
	CHART_INK,
	CHART_LINE,
	CHART_MUTED,
	tooltipStyle,
} from "~/components/research/chart-theme";
import { PageHero } from "~/components/PageHero";
import {
	DIST_DATASET_LABEL,
	DIST_GLOSSARY,
	DIST_SEED,
	DIST_SERIES,
	betaBinomialPosterior,
	bootstrapMeanDistribution,
	descriptiveMoments,
	fitGaussianMixture,
	histogramDensity,
	kolmogorovSmirnovNormal,
	mixtureDensityCurve,
	monteCarloPowerCurve,
	qqNormalPlot,
	splitByMedian,
	twoSampleWelchSummary,
} from "~/data/synthetic-distribution-stats";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Distributions & inference"),
		description:
			"Statistical demonstrator on large synthetic measurement series: mixture densities, QQ plots, KS tests, bootstrap sampling distributions, Bayesian posteriors and Monte Carlo power.",
		path: "/research/distribution-inference",
	});
};

export default function DistributionInferencePage() {
	const [seriesId, setSeriesId] = useState(DIST_SERIES[0]!.id);
	const [mixtureK, setMixtureK] = useState(3);
	const [successes, setSuccesses] = useState(42);
	const [trials, setTrials] = useState(120);
	const [methodologyOpen, setMethodologyOpen] = useState(false);
	const [glossaryOpen, setGlossaryOpen] = useState(false);

	const series = useMemo(
		() => DIST_SERIES.find((row) => row.id === seriesId) ?? DIST_SERIES[0]!,
		[seriesId],
	);

	const moments = useMemo(
		() => descriptiveMoments(series.values),
		[series.values],
	);
	const hist = useMemo(
		() => histogramDensity(series.values, 32),
		[series.values],
	);
	const mixture = useMemo(
		() => fitGaussianMixture(series.values, mixtureK),
		[series.values, mixtureK],
	);
	const density = useMemo(() => {
		const min = Math.min(...series.values);
		const max = Math.max(...series.values);
		return mixtureDensityCurve(mixture, min, max, 100);
	}, [series.values, mixture]);

	const overlay = useMemo(() => {
		return hist.map((bin) => {
			let nearest = density[0]!;
			let best = Infinity;
			for (const point of density) {
				const dist = Math.abs(point.x - bin.x);
				if (dist < best) {
					best = dist;
					nearest = point;
				}
			}
			return {
				...bin,
				fitDensity: nearest.density,
			};
		});
	}, [hist, density]);

	const qq = useMemo(() => qqNormalPlot(series.values), [series.values]);
	const ks = useMemo(
		() => kolmogorovSmirnovNormal(series.values),
		[series.values],
	);
	const boot = useMemo(
		() => bootstrapMeanDistribution(series.values, 350),
		[series.values],
	);
	const posterior = useMemo(
		() =>
			betaBinomialPosterior(
				Math.min(successes, trials),
				Math.max(1, trials),
				1,
				1,
			),
		[successes, trials],
	);
	const power = useMemo(() => monteCarloPowerCurve({ nPerArm: 80 }), []);
	const welch = useMemo(() => {
		const split = splitByMedian(series.values);
		return {
			...twoSampleWelchSummary(split.a, split.b),
			medianSplit: split.median,
		};
	}, [series.values]);

	const qqLine = useMemo(() => {
		if (qq.length < 2) return [];
		const minT = Math.min(...qq.map((row) => row.theoretical));
		const maxT = Math.max(...qq.map((row) => row.theoretical));
		return [
			{ theoretical: minT, sample: minT },
			{ theoretical: maxT, sample: maxT },
		];
	}, [qq]);

	return (
		<>
			<div className="sticky top-[4.25rem] z-40 border-b border-amber-200/80 bg-amber-50/95 backdrop-blur-sm">
				<div className="site-container flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm text-ink">
					<p>
						<span className="font-semibold text-amber-900">
							Synthetic demonstration only.
						</span>{" "}
						{DIST_DATASET_LABEL} — large mock measurement series (seed{" "}
						{DIST_SEED}).
					</p>
					<Link
						to="/research/survival-boosting"
						className="font-medium text-accent hover:underline"
					>
						Survival &amp; boosting →
					</Link>
				</div>
			</div>

			<PageHero
				eyebrow="Research Analytics Lab"
				title="Distributions & statistical inference"
				summary="Explore probability densities, mixture models, normality diagnostics, bootstrap sampling distributions, conjugate Bayesian posteriors and Monte Carlo power curves on large synthetic laboratory-style series."
				accent="Classical statistics playground — illustrative inference on invented measurements only."
			/>

			<section className="section-pad !pt-10">
				<div className="site-container space-y-10">
					<div className="border border-line bg-white px-5 py-5 sm:px-6">
						<p className="text-sm font-semibold text-ink">Series & controls</p>
						<div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
							<label className="block text-sm">
								<span className="font-semibold text-ink">Measurement series</span>
								<select
									className="input-field mt-2"
									value={seriesId}
									onChange={(event) => setSeriesId(event.target.value)}
								>
									{DIST_SERIES.map((row) => (
										<option key={row.id} value={row.id}>
											{row.label} (n={row.values.length})
										</option>
									))}
								</select>
							</label>
							<label className="block text-sm">
								<span className="font-semibold text-ink">
									Mixture components ({mixtureK})
								</span>
								<input
									type="range"
									min={2}
									max={4}
									step={1}
									className="mt-3 w-full accent-accent"
									value={mixtureK}
									onChange={(event) => setMixtureK(Number(event.target.value))}
								/>
							</label>
							<label className="block text-sm">
								<span className="font-semibold text-ink">
									Bayesian successes ({successes})
								</span>
								<input
									type="range"
									min={5}
									max={Math.max(10, trials)}
									step={1}
									className="mt-3 w-full accent-accent"
									value={successes}
									onChange={(event) => setSuccesses(Number(event.target.value))}
								/>
							</label>
							<label className="block text-sm">
								<span className="font-semibold text-ink">
									Bayesian trials ({trials})
								</span>
								<input
									type="range"
									min={40}
									max={300}
									step={10}
									className="mt-3 w-full accent-accent"
									value={trials}
									onChange={(event) => {
										const next = Number(event.target.value);
										setTrials(next);
										setSuccesses((current) => Math.min(current, next));
									}}
								/>
							</label>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Sample size</p>
							<p className="mt-1 font-display text-3xl text-ink">{moments.n}</p>
							<p className="mt-1 text-xs text-ink-muted">{series.unit}</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Mean ± SD</p>
							<p className="mt-1 font-display text-3xl text-ink">
								{moments.mean}
							</p>
							<p className="mt-1 text-xs text-ink-muted">SD {moments.stdDev}</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Skew / excess kurtosis</p>
							<p className="mt-1 font-display text-3xl text-ink">
								{moments.skewness}
							</p>
							<p className="mt-1 text-xs text-ink-muted">
								Kurtosis {moments.excessKurtosis}
							</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">KS vs normal</p>
							<p className="mt-1 font-display text-3xl text-ink">
								{ks.dStatistic}
							</p>
							<p className="mt-1 text-xs text-ink-muted">
								Approx. p={ks.pValueApprox}
							</p>
						</div>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						<ChartCard
							title="Histogram & fitted mixture density"
							explanation={`Empirical density of the selected synthetic series with a ${mixtureK}-component Gaussian mixture overlay (EM). Components capture multi-modality that a single normal cannot.`}
						>
							<div className="h-80 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<ComposedChart data={overlay}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											dataKey="x"
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
										/>
										<YAxis
											yAxisId="hist"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis
											yAxisId="fit"
											orientation="right"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Bar
											yAxisId="hist"
											dataKey="density"
											name="Empirical density"
											fill={CHART_ACCENT}
											fillOpacity={0.55}
											isAnimationActive={false}
										/>
										<Line
											yAxisId="fit"
											type="monotone"
											dataKey="fitDensity"
											name="Mixture fit"
											stroke={CHART_INK}
											strokeWidth={2}
											dot={false}
											isAnimationActive={false}
										/>
									</ComposedChart>
								</ResponsiveContainer>
							</div>
							<ul className="mt-2 space-y-1 px-2 text-sm text-ink-soft">
								{mixture.map((component, index) => (
									<li key={`${component.mu}-${index}`}>
										Component {index + 1}: weight {component.weight}, μ=
										{component.mu}, σ={component.sigma}
									</li>
								))}
							</ul>
						</ChartCard>

						<ChartCard
							title="Normal QQ plot"
							explanation="Sample quantiles against theoretical normal quantiles matched to the series mean and SD. Curvature away from the reference line signals non-normality — expected for mixture or skewed generators."
						>
							<div className="h-80 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<ScatterChart>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											type="number"
											dataKey="theoretical"
											name="Theoretical"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis
											type="number"
											dataKey="sample"
											name="Sample"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Scatter
											data={qq}
											fill={CHART_ACCENT}
											fillOpacity={0.65}
											name="Quantiles"
											isAnimationActive={false}
										/>
										<Line
											data={qqLine}
											type="linear"
											dataKey="sample"
											stroke={CHART_INK}
											strokeDasharray="4 4"
											dot={false}
											legendType="none"
											isAnimationActive={false}
										/>
									</ScatterChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						<ChartCard
							title="Bootstrap distribution of the mean"
							explanation="350 resamples with replacement. The histogram approximates the sampling distribution of the mean; the KPI strip below reports a percentile 95% interval."
						>
							<div className="h-72 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={boot.histogram}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											dataKey="x"
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
										/>
										<YAxis tick={{ fill: CHART_MUTED, fontSize: 12 }} />
										<Tooltip contentStyle={tooltipStyle} />
										<Bar
											dataKey="density"
											name="Density"
											fill={CHART_ACCENT}
											isAnimationActive={false}
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
							<p className="mt-2 px-2 text-sm text-ink-soft">
								Bootstrap mean {boot.meanOfMeans} · 95% CI {boot.ciLow}–
								{boot.ciHigh}
							</p>
						</ChartCard>

						<div className="border border-line bg-white px-5 py-6 sm:px-6">
							<h2 className="font-display text-2xl text-ink">
								Welch two-sample sketch
							</h2>
							<p className="mt-2 text-sm text-ink-soft">
								The selected series is randomly split into two equal arms for an
								illustrative Welch t comparison (not a randomised trial).
							</p>
							<dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
								<div>
									<dt className="text-ink-muted">Mean A / B</dt>
									<dd className="font-medium text-ink">
										{welch.meanA} / {welch.meanB}
									</dd>
								</div>
								<div>
									<dt className="text-ink-muted">Difference</dt>
									<dd className="font-medium text-ink">{welch.meanDiff}</dd>
								</div>
								<div>
									<dt className="text-ink-muted">t (approx.)</dt>
									<dd className="font-medium text-ink">{welch.tStatistic}</dd>
								</div>
								<div>
									<dt className="text-ink-muted">Approx. p</dt>
									<dd className="font-medium text-ink">
										{welch.pValueApprox}
									</dd>
								</div>
							</dl>
							<p className="mt-4 text-xs text-ink-muted">
								nₐ={welch.nA}, nᵦ={welch.nB}, df≈{welch.df}
							</p>
						</div>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						<ChartCard
							title="Beta–Binomial posterior (response rate)"
							explanation="Conjugate Bayesian update with a uniform Beta(1,1) prior. Adjust successes and trials to see the posterior concentrate. Shaded credible interval is equal-tailed on the discrete grid."
						>
							<div className="h-72 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<ComposedChart data={posterior.curve}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											dataKey="p"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis tick={{ fill: CHART_MUTED, fontSize: 12 }} />
										<Tooltip contentStyle={tooltipStyle} />
										<Area
											type="monotone"
											dataKey="density"
											stroke={CHART_ACCENT}
											fill={CHART_ACCENT}
											fillOpacity={0.25}
											name="Posterior density"
											isAnimationActive={false}
										/>
									</ComposedChart>
								</ResponsiveContainer>
							</div>
							<p className="mt-2 px-2 text-sm text-ink-soft">
								Posterior mean {posterior.mean} · 95% CrI {posterior.ciLow}–
								{posterior.ciHigh} (α={posterior.alpha}, β={posterior.beta})
							</p>
						</ChartCard>

						<ChartCard
							title="Monte Carlo power curve"
							explanation="Simulated two-sided normal tests (n=80 per arm, α=0.05) across standardised effect sizes. Power is the fraction of 250 draws that reject the null — a teaching view of study sensitivity on synthetic noise."
						>
							<div className="h-72 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={power}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											dataKey="effectSize"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
											label={{
												value: "Effect size (SD units)",
												position: "insideBottom",
												offset: -2,
												fill: CHART_MUTED,
												fontSize: 11,
											}}
										/>
										<YAxis
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Legend />
										<Line
											type="monotone"
											dataKey="power"
											stroke={CHART_ACCENT}
											strokeWidth={2}
											dot={{ r: 4 }}
											name="Estimated power"
											isAnimationActive={false}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>
					</div>

					<section className="border border-line bg-cream/40 px-5 py-7 sm:px-8">
						<p className="eyebrow">How to read this demo</p>
						<h2 className="mt-3 section-title">
							From densities to decisions
						</h2>
						<ul className="mt-6 space-y-3 text-[0.97rem] leading-relaxed text-ink-soft">
							<li className="border-l-2 border-accent pl-4">
								Mixture modelling and QQ/KS diagnostics ask whether a simple
								normal story fits the synthetic measurements.
							</li>
							<li className="border-l-2 border-accent pl-4">
								Bootstrap and Welch sketches show frequentist uncertainty;
								Beta–Binomial shows a full posterior for a rate parameter.
							</li>
							<li className="border-l-2 border-accent pl-4">
								Monte Carlo power connects distributional assumptions to study
								design — still on invented noise, never on real outcomes.
							</li>
						</ul>
					</section>

					<div className="border border-line bg-white">
						<button
							type="button"
							className="flex w-full items-center justify-between px-5 py-5 text-left sm:px-6"
							aria-expanded={methodologyOpen}
							onClick={() => setMethodologyOpen((value) => !value)}
						>
							<div>
								<p className="eyebrow">Transparency</p>
								<h2 className="mt-2 section-title">Data &amp; methodology</h2>
							</div>
							<span className="text-accent" aria-hidden="true">
								{methodologyOpen ? "−" : "+"}
							</span>
						</button>
						{methodologyOpen ? (
							<div className="space-y-4 border-t border-line px-5 py-6 text-[0.97rem] leading-relaxed text-ink-soft sm:px-6">
								<p>
									Series are generated from Gaussian mixtures or log-normal-like
									draws. No real laboratory or trial values are used.
								</p>
								<p>
									Inference routines (EM mixtures, KS, bootstrap, conjugate Bayes,
									Monte Carlo power) are implemented in TypeScript for teaching
									the analytics UI — not as a validated statistics package.
								</p>
							</div>
						) : null}
					</div>

					<div className="border border-line bg-white">
						<button
							type="button"
							className="flex w-full items-center justify-between px-5 py-5 text-left sm:px-6"
							aria-expanded={glossaryOpen}
							onClick={() => setGlossaryOpen((value) => !value)}
						>
							<div>
								<p className="eyebrow">Glossary</p>
								<h2 className="mt-2 section-title">Terms used here</h2>
							</div>
							<span className="text-accent" aria-hidden="true">
								{glossaryOpen ? "−" : "+"}
							</span>
						</button>
						{glossaryOpen ? (
							<dl className="space-y-4 border-t border-line px-5 py-6 sm:px-6">
								{DIST_GLOSSARY.map((entry) => (
									<div key={entry.term}>
										<dt className="font-semibold text-ink">{entry.term}</dt>
										<dd className="mt-1 text-[0.97rem] text-ink-soft">
											{entry.definition}
										</dd>
									</div>
								))}
							</dl>
						) : null}
					</div>
				</div>
			</section>
		</>
	);
}
