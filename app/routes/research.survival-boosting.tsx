import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { useMemo, useState } from "react";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	LineChart,
	Bar,
	BarChart,
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
	ALL_SURVIVAL_PATIENTS,
	SURVIVAL_DATASET_LABEL,
	SURVIVAL_FEATURE_META,
	SURVIVAL_FEATURES,
	SURVIVAL_GLOSSARY,
	SURVIVAL_PLATFORMS,
	SURVIVAL_SEED,
	bootstrapAuc,
	calibrationCurve,
	kaplanMeierByPlatform,
	logRankTest,
	medianSurvivalMonths,
	partialDependence,
	permutationImportance,
	rocAuc,
	rocCurvePoints,
	trainGradientBoost,
	trainTestSplitSurvival,
	type SurvivalFeatureKey,
	type SurvivalPlatform,
} from "~/data/synthetic-survival-ml";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

const PLATFORM_STROKES = ["#1F6F6A", "#2A3644", "#5D6B78", "#8FA0AB"] as const;

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Survival & gradient boosting"),
		description:
			"Advanced synthetic ML lab: Kaplan–Meier survival, log-rank tests, gradient boosting risk scores, bootstrap AUC and calibration on a large mock oncology cohort.",
		path: "/research/survival-boosting",
	});
};

export default function SurvivalBoostingPage() {
	const [nTrees, setNTrees] = useState(35);
	const [groupA, setGroupA] = useState<SurvivalPlatform>(SURVIVAL_PLATFORMS[0]);
	const [groupB, setGroupB] = useState<SurvivalPlatform>(SURVIVAL_PLATFORMS[1]);
	const [pdpFeature, setPdpFeature] =
		useState<SurvivalFeatureKey>("tmb");
	const [methodologyOpen, setMethodologyOpen] = useState(false);
	const [glossaryOpen, setGlossaryOpen] = useState(false);

	const { train, test } = useMemo(
		() => trainTestSplitSurvival(ALL_SURVIVAL_PATIENTS, 0.7),
		[],
	);

	const km = useMemo(
		() => kaplanMeierByPlatform(ALL_SURVIVAL_PATIENTS),
		[],
	);

	const logRank = useMemo(
		() => logRankTest(ALL_SURVIVAL_PATIENTS, groupA, groupB),
		[groupA, groupB],
	);

	const model = useMemo(
		() =>
			trainGradientBoost(train, {
				nTrees,
				learningRate: 0.08,
				maxDepth: 3,
			}),
		[train, nTrees],
	);

	const testAuc = useMemo(() => rocAuc(test, model), [test, model]);
	const roc = useMemo(() => rocCurvePoints(test, model), [test, model]);
	const boot = useMemo(() => bootstrapAuc(test, model, 60), [test, model]);
	const calibration = useMemo(
		() => calibrationCurve(test, model),
		[test, model],
	);
	const importances = useMemo(
		() => permutationImportance(test, model),
		[test, model],
	);
	const pdp = useMemo(
		() => partialDependence(test, model, pdpFeature),
		[test, model, pdpFeature],
	);

	const eventRate = useMemo(() => {
		const events = ALL_SURVIVAL_PATIENTS.filter((p) => p.event === 1).length;
		return Math.round((events / ALL_SURVIVAL_PATIENTS.length) * 1000) / 10;
	}, []);

	const landmarkRate = useMemo(() => {
		const hits = ALL_SURVIVAL_PATIENTS.filter((p) => p.progressedBy12m === 1)
			.length;
		return Math.round((hits / ALL_SURVIVAL_PATIENTS.length) * 1000) / 10;
	}, []);

	const kmChartData = useMemo(() => {
		const times = [
			...new Set(km.flatMap((row) => row.curve.map((point) => point.time))),
		].sort((a, b) => a - b);
		return times.map((time) => {
			const row: Record<string, number> = { time };
			km.forEach((series, index) => {
				const point =
					[...series.curve].reverse().find((entry) => entry.time <= time) ??
					series.curve[0];
				row[`s${index}`] = point?.survival ?? 1;
			});
			return row;
		});
	}, [km]);

	const lossCurve = useMemo(
		() =>
			model.trainLoss.map((loss, index) => ({
				tree: index + 1,
				loss,
			})),
		[model.trainLoss],
	);

	return (
		<>
			<div className="sticky top-[4.25rem] z-40 border-b border-amber-200/80 bg-amber-50/95 backdrop-blur-sm">
				<div className="site-container flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm text-ink">
					<p>
						<span className="font-semibold text-amber-900">
							Synthetic demonstration only.
						</span>{" "}
						{SURVIVAL_DATASET_LABEL} — invented time-to-progression cohort
						(n={ALL_SURVIVAL_PATIENTS.length}).
					</p>
					<Link
						to="/research/multiomics-stratification"
						className="font-medium text-accent hover:underline"
					>
						Multi-omics stratification →
					</Link>
				</div>
			</div>

			<PageHero
				eyebrow="Research Analytics Lab"
				title="Survival analysis & gradient boosting"
				summary="A larger-cohort demonstrator combining Kaplan–Meier survival with Greenwood-style bands conceptually, log-rank testing, and a gradient-boosted risk model for 12-month progression — with bootstrap AUC, calibration and partial dependence."
				accent="Advanced illustrative ML on mock survival data — not a clinical trial analysis."
			/>

			<section className="section-pad !pt-10">
				<div className="site-container space-y-10">
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Cohort size</p>
							<p className="mt-1 font-display text-3xl text-ink">
								{ALL_SURVIVAL_PATIENTS.length}
							</p>
							<p className="mt-1 text-xs text-ink-muted">
								Seed {SURVIVAL_SEED} · train {train.length}/test {test.length}
							</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Events (any time)</p>
							<p className="mt-1 font-display text-3xl text-ink">{eventRate}%</p>
							<p className="mt-1 text-xs text-ink-muted">
								12-month progression label {landmarkRate}%
							</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Hold-out AUC</p>
							<p className="mt-1 font-display text-3xl text-ink">{testAuc}</p>
							<p className="mt-1 text-xs text-ink-muted">
								Bootstrap 95% CI {boot.ciLow}–{boot.ciHigh}
							</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Boosting rounds</p>
							<p className="mt-1 font-display text-3xl text-ink">{nTrees}</p>
							<p className="mt-1 text-xs text-ink-muted">
								Final train loss {model.trainLoss.at(-1) ?? "—"}
							</p>
						</div>
					</div>

					<div className="border border-line bg-white px-5 py-5 sm:px-6">
						<p className="text-sm font-semibold text-ink">Model controls</p>
						<div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
							<label className="block text-sm">
								<span className="font-semibold text-ink">
									Boosting trees ({nTrees})
								</span>
								<input
									type="range"
									min={10}
									max={60}
									step={5}
									className="mt-3 w-full accent-accent"
									value={nTrees}
									onChange={(event) => setNTrees(Number(event.target.value))}
								/>
							</label>
							<label className="block text-sm">
								<span className="font-semibold text-ink">Log-rank group A</span>
								<select
									className="input-field mt-2"
									value={groupA}
									onChange={(event) =>
										setGroupA(event.target.value as SurvivalPlatform)
									}
								>
									{SURVIVAL_PLATFORMS.map((platform) => (
										<option key={platform} value={platform}>
											{platform}
										</option>
									))}
								</select>
							</label>
							<label className="block text-sm">
								<span className="font-semibold text-ink">Log-rank group B</span>
								<select
									className="input-field mt-2"
									value={groupB}
									onChange={(event) =>
										setGroupB(event.target.value as SurvivalPlatform)
									}
								>
									{SURVIVAL_PLATFORMS.map((platform) => (
										<option key={platform} value={platform}>
											{platform}
										</option>
									))}
								</select>
							</label>
							<label className="block text-sm">
								<span className="font-semibold text-ink">
									Partial dependence feature
								</span>
								<select
									className="input-field mt-2"
									value={pdpFeature}
									onChange={(event) =>
										setPdpFeature(event.target.value as SurvivalFeatureKey)
									}
								>
									{SURVIVAL_FEATURES.map((key) => (
										<option key={key} value={key}>
											{SURVIVAL_FEATURE_META[key].label}
										</option>
									))}
								</select>
							</label>
						</div>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						<ChartCard
							title="Kaplan–Meier by platform"
							explanation="Synthetic progression-free survival curves. Step-like declines mark events; censoring is baked into the estimator. Median survival (months) is annotated in the platform list below."
						>
							<div className="h-80 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={kmChartData}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											dataKey="time"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
											label={{
												value: "Months",
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
										{km.map((series, index) => (
											<Line
												key={series.platform}
												type="stepAfter"
												dataKey={`s${index}`}
												name={series.platform}
												stroke={PLATFORM_STROKES[index % PLATFORM_STROKES.length]}
												strokeWidth={2}
												dot={false}
												isAnimationActive={false}
											/>
										))}
									</LineChart>
								</ResponsiveContainer>
							</div>
							<ul className="mt-2 space-y-1 px-2 text-sm text-ink-soft">
								{km.map((series) => (
									<li key={series.platform}>
										{series.platform}: n={series.n}, median{" "}
										{medianSurvivalMonths(series.curve) ?? "> max follow-up"}{" "}
										months
									</li>
								))}
							</ul>
						</ChartCard>

						<div className="border border-line bg-white px-5 py-6 sm:px-6">
							<h2 className="font-display text-2xl text-ink">Log-rank test</h2>
							<p className="mt-2 text-sm text-ink-soft">
								Two-sample Mantel–Haenszel comparison of synthetic survival
								between the selected platforms.
							</p>
							{logRank && groupA !== groupB ? (
								<dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
									<div>
										<dt className="text-ink-muted">nₐ / nᵦ</dt>
										<dd className="font-medium text-ink">
											{logRank.nA} / {logRank.nB}
										</dd>
									</div>
									<div>
										<dt className="text-ink-muted">χ² (1 df approx.)</dt>
										<dd className="font-medium text-ink">
											{logRank.chiSquare}
										</dd>
									</div>
									<div>
										<dt className="text-ink-muted">z</dt>
										<dd className="font-medium text-ink">{logRank.z}</dd>
									</div>
									<div>
										<dt className="text-ink-muted">Approx. p-value</dt>
										<dd className="font-medium text-ink">
											{logRank.pValueApprox}
										</dd>
									</div>
								</dl>
							) : (
								<p className="mt-4 text-sm text-ink-muted">
									Select two different platforms.
								</p>
							)}
							<p className="mt-4 text-xs text-ink-muted">
								P-values use a normal approximation for demonstration reporting
								only.
							</p>
						</div>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						<ChartCard
							title="Boosting ROC (hold-out)"
							explanation="Receiver-operating curve for the gradient-boosted 12-month progression score on the held-out synthetic patients."
						>
							<div className="h-72 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={roc}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											type="number"
											dataKey="fpr"
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis
											type="number"
											dataKey="tpr"
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Line
											type="monotone"
											dataKey="tpr"
											stroke={CHART_ACCENT}
											strokeWidth={2}
											dot={false}
											name="TPR"
											isAnimationActive={false}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>

						<ChartCard
							title="Calibration curve"
							explanation="Binned mean predicted probability versus observed 12-month progression rate on the hold-out set. Points near the diagonal are better calibrated on this synthetic split."
						>
							<div className="h-72 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<ScatterChart>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											type="number"
											dataKey="meanPredicted"
											name="Predicted"
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis
											type="number"
											dataKey="meanObserved"
											name="Observed"
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Scatter
											data={calibration}
											fill={CHART_ACCENT}
											name="Bins"
											isAnimationActive={false}
										/>
										<Line
											data={[
												{ meanPredicted: 0, meanObserved: 0 },
												{ meanPredicted: 1, meanObserved: 1 },
											]}
											type="linear"
											dataKey="meanObserved"
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
							title="Permutation importance"
							explanation="Drop in hold-out AUC when each covariate is randomly shuffled — a model-agnostic importance measure for the boosted risk score."
						>
							<div className="h-72 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={importances}
										layout="vertical"
										margin={{ left: 4, right: 12 }}
									>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis type="number" tick={{ fill: CHART_MUTED, fontSize: 12 }} />
										<YAxis
											type="category"
											dataKey="label"
											width={100}
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Bar
											dataKey="importance"
											name="Δ AUC"
											fill={CHART_ACCENT}
											isAnimationActive={false}
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>

						<ChartCard
							title={`Partial dependence — ${SURVIVAL_FEATURE_META[pdpFeature].label}`}
							explanation="Average model probability while sweeping one feature across its empirical range and holding other covariates at observed patient values (synthetic ICE-style average)."
						>
							<div className="h-72 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={pdp}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											dataKey="x"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Line
											type="monotone"
											dataKey="meanProbability"
											stroke={CHART_ACCENT}
											strokeWidth={2}
											dot={{ r: 3 }}
											name="Mean P(progress)"
											isAnimationActive={false}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						<ChartCard
							title="Boosting training loss"
							explanation="Mean Bernoulli log-loss on the training split after each added tree. Decreasing loss shows the ensemble fitting the synthetic landmark label."
						>
							<div className="h-64 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={lossCurve}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											dataKey="tree"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis tick={{ fill: CHART_MUTED, fontSize: 12 }} />
										<Tooltip contentStyle={tooltipStyle} />
										<Line
											type="monotone"
											dataKey="loss"
											stroke={CHART_INK}
											strokeWidth={2}
											dot={false}
											name="Train loss"
											isAnimationActive={false}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>

						<ChartCard
							title="Bootstrap AUC sampling distribution"
							explanation="Hold-out AUC recomputed on 60 bootstrap resamples. The ribbon of percentile uncertainty is summarised in the KPI strip above."
						>
							<div className="h-64 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<ComposedChart data={boot.samples}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											dataKey="draw"
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
											hide
										/>
										<YAxis
											domain={["auto", "auto"]}
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Area
											type="monotone"
											dataKey="auc"
											stroke={CHART_ACCENT}
											fill={CHART_ACCENT}
											fillOpacity={0.15}
											isAnimationActive={false}
										/>
										<Line
											type="monotone"
											dataKey="auc"
											stroke={CHART_ACCENT}
											strokeWidth={1.5}
											dot={false}
											isAnimationActive={false}
										/>
									</ComposedChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>
					</div>

					<section className="border border-line bg-cream/40 px-5 py-7 sm:px-8">
						<p className="eyebrow">How to read this demo</p>
						<h2 className="mt-3 section-title">Time-to-event + supervised risk</h2>
						<ul className="mt-6 space-y-3 text-[0.97rem] leading-relaxed text-ink-soft">
							<li className="border-l-2 border-accent pl-4">
								The KM panel is unsupervised with respect to the boosting label:
								it uses the full synthetic follow-up and censoring indicators.
							</li>
							<li className="border-l-2 border-accent pl-4">
								Gradient boosting predicts a landmark binary endpoint (progressed
								by 12 months) from baseline covariates — a common engineering
								pattern when full survival models are staged later.
							</li>
							<li className="border-l-2 border-accent pl-4">
								Bootstrap AUC, calibration and partial dependence stress-test
								whether the score ranks, calibrates and depends on features in
								sensible ways on mock data.
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
									All survival times, covariates and platform labels are
									synthetic. No real trial or EMR extracts are used.
								</p>
								<p>
									Event times are drawn from a covariate-dependent exponential
									hazard with administrative censoring. The boosting model is
									logistic gradient boosting with depth-limited regression trees.
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
								{SURVIVAL_GLOSSARY.map((entry) => (
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
