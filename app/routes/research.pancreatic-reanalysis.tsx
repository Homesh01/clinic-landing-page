import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { useMemo, useRef, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ErrorBar,
	Legend,
	Line,
	LineChart,
	ReferenceDot,
	ReferenceLine,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts";
import { ChartCard, exportSvgAsPng } from "~/components/research/ChartCard";
import {
	CHART_ACCENT,
	CHART_INK,
	CHART_LINE,
	CHART_MUTED,
	tooltipStyle,
} from "~/components/research/chart-theme";
import { PageHero } from "~/components/PageHero";
import {
	ALL_PDAC_CLONES,
	PDAC_FEATURE_KEYS,
	PDAC_LONGEVITY_THRESHOLD,
	PDAC_POSITIVE_RATE,
	classificationMetrics,
	featureImportances,
	leaveOneOutMetrics,
	rocCurve,
	trainLogisticRegression,
	trainTestSplit,
} from "~/data/pancreatic-ml";
import kinetics from "~/data/pancreatic/clone_kinetics.json";
import datasetMeta from "~/data/pancreatic/meta.json";
import persistence from "~/data/pancreatic/persistence.json";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("PDAC vaccine reanalysis"),
		description:
			"Interactive reanalysis of published pancreatic cancer mRNA neoantigen vaccine source data (Nature 2025): clone longevity kinetics and a priming-phase classifier for long-lived clones.",
		path: "/research/pancreatic-reanalysis",
	});
};

const DATASET = "PDAC autogene cevumeran / Nature 2025";
const paper = datasetMeta.paper;

function Stat({
	label,
	value,
	hint,
}: {
	label: string;
	value: string | number;
	hint?: string;
}) {
	return (
		<div className="border border-line border-l-2 border-l-accent bg-white px-4 py-4">
			<p className="text-sm text-ink-muted">{label}</p>
			<p className="mt-1 font-display text-3xl text-ink">{value}</p>
			{hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
		</div>
	);
}

function formatP(p: number | null | undefined): string {
	if (p == null) return "n/a";
	if (p === 0 || p < 1e-6) return "< 1×10⁻⁶";
	if (p < 0.001) return p.toExponential(2);
	return p.toFixed(3);
}

export default function PancreaticReanalysisPage() {
	const [mlThreshold, setMlThreshold] = useState(0.5);
	const halfLifeRef = useRef<HTMLDivElement>(null);
	const scatterRef = useRef<HTMLDivElement>(null);
	const persistRef = useRef<HTMLDivElement>(null);
	const originRef = useRef<HTMLDivElement>(null);
	const rocRef = useRef<HTMLDivElement>(null);
	const weightRef = useRef<HTMLDivElement>(null);

	const halfLifeBars = useMemo(() => {
		const prime = kinetics.primeHalfLifeDays.bootstrapMedianCI;
		const boost = kinetics.boostHalfLifeDays.bootstrapMedianCI;
		const primeEst = prime.estimate ?? 0;
		const boostEst = boost.estimate ?? 0;
		const primeCi = prime.ci95 ?? [primeEst, primeEst];
		const boostCi = boost.ci95 ?? [boostEst, boostEst];
		return [
			{
				phase: "Prime",
				medianDays: primeEst,
				error: [primeEst - primeCi[0], primeCi[1] - primeEst],
			},
			{
				phase: "Boost",
				medianDays: boostEst,
				error: [boostEst - boostCi[0], boostCi[1] - boostEst],
			},
		];
	}, []);

	const scatterPoints = useMemo(() => {
		return kinetics.sampleClones
			.filter(
				(c) =>
					c.peakFreqPrime != null &&
					(c.lifespanYearsBoost != null || c.lifespanYearsPrime != null),
			)
			.map((c) => ({
				peakPct: (c.peakFreqPrime ?? 0) * 100,
				lifespan: c.lifespanYearsBoost ?? c.lifespanYearsPrime ?? 0,
			}))
			.filter((p) => p.lifespan > 0 && p.lifespan < 80);
	}, []);

	const persistenceBars = useMemo(
		() =>
			persistence.patients
				.filter((p) => p.clonePersistenceFraction != null)
				.map((p) => ({
					patientId: p.patientId,
					persistencePct:
						Math.round((p.clonePersistenceFraction ?? 0) * 1000) / 10,
				})),
		[],
	);

	const originBars = useMemo(() => {
		const counts = persistence.tissueOrigin.cloneTrackOriginCounts;
		return Object.entries(counts).map(([label, value]) => ({
			label,
			clones: value,
		}));
	}, []);

	const { train: mlTrain, test: mlTest } = useMemo(
		() => trainTestSplit(ALL_PDAC_CLONES),
		[],
	);
	const mlModel = useMemo(
		() => trainLogisticRegression(mlTrain),
		[mlTrain],
	);
	const mlTrainMetrics = useMemo(
		() => classificationMetrics(mlTrain, mlModel, mlThreshold),
		[mlTrain, mlModel, mlThreshold],
	);
	const mlTestMetrics = useMemo(
		() => classificationMetrics(mlTest, mlModel, mlThreshold),
		[mlTest, mlModel, mlThreshold],
	);
	const mlLoocv = useMemo(
		() => leaveOneOutMetrics(ALL_PDAC_CLONES, mlThreshold),
		[mlThreshold],
	);
	const mlRoc = useMemo(() => rocCurve(mlTest, mlModel), [mlTest, mlModel]);
	const mlWeights = useMemo(
		() =>
			featureImportances(mlModel).sort((a, b) => b.absWeight - a.absWeight),
		[mlModel],
	);
	const mlOperating = useMemo(() => {
		const fpr =
			mlTestMetrics.fp + mlTestMetrics.tn === 0
				? 0
				: mlTestMetrics.fp / (mlTestMetrics.fp + mlTestMetrics.tn);
		const tpr =
			mlTestMetrics.tp + mlTestMetrics.fn === 0
				? 0
				: mlTestMetrics.tp / (mlTestMetrics.tp + mlTestMetrics.fn);
		return { fpr, tpr };
	}, [mlTestMetrics]);

	const wilcoxon = kinetics.wilcoxonHalfLifeBoostMinusPrime;
	const spearman = kinetics.spearmanPeakPrimeFreqVsLifespan;
	const persistSummary = persistence.persistenceFractionSummary;
	const persistCi = persistence.bootstrapMedianPersistenceCI;

	return (
		<>
			<PageHero
				tone="lab"
				eyebrow="Research Analytics Lab"
				title="PDAC vaccine reanalysis"
				summary="RNA neoantigen vaccines and long-lived CD8+ T cells in pancreatic cancer: clone half-life after prime versus boost, persistence years later, and a priming-phase model of longevity."
				accent={`${paper.authors}, ${paper.journal} ${paper.year}`}
			>
				<div className="mt-5 max-w-2xl space-y-2 text-sm leading-relaxed text-ink-soft">
					<p>
						<span className="font-semibold text-ink">Published trial data.</span>{" "}
						Aggregates from Nature {paper.year} source tables for{" "}
						{paper.vaccine}. De identified research IDs only, not PCC patient
						records.
					</p>
					<p>
						<a
							href={`https://doi.org/${paper.doi}`}
							target="_blank"
							rel="noopener noreferrer"
							className="font-medium text-accent hover:underline"
						>
							doi:{paper.doi} ↗
						</a>
						{" · "}
						<Link
							to="/research/neovaxmi-reanalysis"
							className="font-medium text-accent hover:underline"
						>
							NeoVaxMI melanoma lab
						</Link>
					</p>
				</div>
			</PageHero>

			<section className="section-pad !pt-10">
				<div className="site-container space-y-10">
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<Stat
							label="Responders with vaccine T cells"
							value={paper.nRespondersWithVaccineTcells}
							hint={`vs ${paper.nNonRespondersWithoutVaccineTcells} without vaccine-induced T cells`}
						/>
						<Stat
							label="Median post-boost half-life"
							value={`${Math.round(kinetics.boostHalfLifeDays.summary.median ?? 0)} d`}
							hint={`95% bootstrap CI ${kinetics.boostHalfLifeDays.bootstrapMedianCI.ci95?.[0].toFixed(0)}–${kinetics.boostHalfLifeDays.bootstrapMedianCI.ci95?.[1].toFixed(0)} days`}
						/>
						<Stat
							label="Median clone persistence"
							value={`${Math.round((persistSummary.median ?? 0) * 100)}%`}
							hint={
								persistCi.ci95
									? `95% CI ${Math.round(persistCi.ci95[0] * 100)}–${Math.round(persistCi.ci95[1] * 100)}%`
									: "Fig 2e last follow-up"
							}
						/>
						<Stat
							label="ML longevity LOOCV AUC"
							value={mlLoocv.auc}
							hint={`${ALL_PDAC_CLONES.length} clones · median label ≥ ${PDAC_LONGEVITY_THRESHOLD.toFixed(1)} yr`}
						/>
					</div>

					<p className="max-w-3xl text-sm leading-relaxed text-ink-soft">
						{paper.methodsNote} Half-lives and “lifespan” estimates come from
						the paper’s kinetic fits (some values are capped); they are
						extrapolations, not observed multi-decade survival of clones. Clone-level
						tests treat clones as independent even though several come from the
						same patient. The machine learning block asks whether priming-phase
						kinetics alone can flag clones with above-median post-boost lifespan —
						complementary to the melanoma lab’s peptide-pool expansion classifier.
					</p>

					<ChartCard
						title="Prime vs boost clone half-life"
						datasetLabel={DATASET}
						explanation="Median estimated half-life of vaccine-tracked clones after priming versus after boosting, with 95% bootstrap confidence intervals on the clone-level medians. A Wilcoxon signed-rank test on paired clones (clone-level, not patient-level) supports longer half-lives after boost."
						chartRef={halfLifeRef}
						onExportPng={() =>
							exportSvgAsPng(halfLifeRef.current, "pdac-half-life.png")
						}
					>
						<div className="grid gap-6 lg:grid-cols-5">
							<div className="h-80 lg:col-span-3">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={halfLifeBars} margin={{ left: 8, right: 8 }}>
										<CartesianGrid stroke={CHART_LINE} vertical={false} />
										<XAxis
											dataKey="phase"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
											label={{
												value: "Median half-life (days)",
												angle: -90,
												position: "insideLeft",
												fill: CHART_MUTED,
												fontSize: 11,
											}}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Bar
											dataKey="medianDays"
											name="Median half-life"
											fill={CHART_ACCENT}
										>
											<ErrorBar dataKey="error" width={6} stroke={CHART_INK} />
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
							<div className="space-y-3 text-sm text-ink-soft lg:col-span-2">
								<p>
									<span className="font-semibold text-ink">
										Wilcoxon signed-rank
									</span>{" "}
									(boost − prime half-life): n={wilcoxon.n}, W={wilcoxon.W}, p≈
									{formatP(wilcoxon.pApprox)}.
								</p>
								<p>
									Prime median{" "}
									{kinetics.primeHalfLifeDays.summary.median?.toFixed(1)} days
									vs boost median{" "}
									{kinetics.boostHalfLifeDays.summary.median?.toFixed(1)} days.
								</p>
							</div>
						</div>
					</ChartCard>

					<ChartCard
						title="Peak frequency vs estimated lifespan"
						datasetLabel={DATASET}
						explanation="Each point is a clone from the published kinetics table (sample shown; extreme capped estimates excluded from the plot). Horizontal axis is peak frequency during priming; vertical axis is model-estimated lifespan in years (post-boost when available, otherwise prime). Spearman ρ uses the same preference rule."
						chartRef={scatterRef}
						onExportPng={() =>
							exportSvgAsPng(scatterRef.current, "pdac-peak-vs-lifespan.png")
						}
					>
						<div className="grid gap-6 lg:grid-cols-5">
							<div className="h-80 lg:col-span-3">
								<ResponsiveContainer width="100%" height="100%">
									<ScatterChart margin={{ left: 8, right: 8, top: 8 }}>
										<CartesianGrid stroke={CHART_LINE} />
										<XAxis
											type="number"
											dataKey="peakPct"
											name="Peak %"
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
											label={{
												value: "Peak prime frequency (% of blood T cells)",
												position: "insideBottom",
												offset: -2,
												fill: CHART_MUTED,
												fontSize: 11,
											}}
										/>
										<YAxis
											type="number"
											dataKey="lifespan"
											name="Lifespan"
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
											label={{
												value: "Estimated lifespan (years)",
												angle: -90,
												position: "insideLeft",
												fill: CHART_MUTED,
												fontSize: 11,
											}}
										/>
										<ZAxis range={[40, 40]} />
										<Tooltip
											cursor={{ strokeDasharray: "3 3" }}
											contentStyle={tooltipStyle}
										/>
										<Scatter data={scatterPoints} fill={CHART_ACCENT} />
									</ScatterChart>
								</ResponsiveContainer>
							</div>
							<div className="space-y-3 text-sm text-ink-soft lg:col-span-2">
								<p>
									<span className="font-semibold text-ink">Spearman ρ</span> ={" "}
									{spearman.rho?.toFixed(3)} (n={spearman.n}, p≈
									{formatP(spearman.pApprox)}).
								</p>
								<p>
									Post-boost lifespan median{" "}
									{kinetics.boostLifespanYears.summary.median?.toFixed(1)} years
									(95% CI{" "}
									{kinetics.boostLifespanYears.bootstrapMedianCI.ci95?.[0].toFixed(
										1,
									)}
									–
									{kinetics.boostLifespanYears.bootstrapMedianCI.ci95?.[1].toFixed(
										1,
									)}
									).
								</p>
							</div>
						</div>
					</ChartCard>

					<ChartCard
						title="Clone persistence at last follow-up"
						datasetLabel={DATASET}
						explanation="For each responder with complete counts, the bar is the fraction of priming-expanded clones still detected at the last immunological blood draw (typically ~2–4 years after surgery)."
						chartRef={persistRef}
						onExportPng={() =>
							exportSvgAsPng(persistRef.current, "pdac-persistence.png")
						}
					>
						<div className="h-80">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={persistenceBars} margin={{ left: 8, right: 8 }}>
									<CartesianGrid stroke={CHART_LINE} vertical={false} />
									<XAxis
										dataKey="patientId"
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
									/>
									<YAxis
										domain={[0, 100]}
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
										label={{
											value: "% clones persisting",
											angle: -90,
											position: "insideLeft",
											fill: CHART_MUTED,
											fontSize: 11,
										}}
									/>
									<Tooltip contentStyle={tooltipStyle} />
									<Bar
										dataKey="persistencePct"
										name="Persistence %"
										fill={CHART_INK}
									/>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					<ChartCard
						title="CloneTrack tissue origin"
						datasetLabel={DATASET}
						explanation="Published origin tally for vaccine-tracked clones. Most are classified as de novo (not detected in pre-vaccination tumour, adjacent tissue, nodes, or blood)."
						chartRef={originRef}
						onExportPng={() =>
							exportSvgAsPng(originRef.current, "pdac-origin.png")
						}
					>
						<div className="h-72">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={originBars}
									layout="vertical"
									margin={{ left: 24 }}
								>
									<CartesianGrid stroke={CHART_LINE} horizontal={false} />
									<XAxis type="number" tick={{ fill: CHART_MUTED, fontSize: 11 }} />
									<YAxis
										type="category"
										dataKey="label"
										width={130}
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
									/>
									<Tooltip contentStyle={tooltipStyle} />
									<Legend />
									<Bar dataKey="clones" name="Clones" fill={CHART_ACCENT} />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					<section className="border border-line bg-white px-5 py-6 sm:px-6">
						<h3 className="font-display text-xl text-ink sm:text-2xl">
							Machine learning: long-lived clone classifier
						</h3>
						<p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
							Logistic regression on {ALL_PDAC_CLONES.length} clones with both
							prime and boost lifespan estimates. The label is whether
							post-boost estimated lifespan is at or above the cohort median (
							{PDAC_LONGEVITY_THRESHOLD.toFixed(1)} years). Features are only{" "}
							{PDAC_FEATURE_KEYS.length} non-redundant priming-phase measures
							(log peak frequency and prime half-life) — raw peak and prime
							lifespan were dropped as near-collinear. Positive rate{" "}
							{Math.round(PDAC_POSITIVE_RATE * 1000) / 10}%. Primary metric is
							leave-one-clone-out AUC; the hold-out ROC below is illustrative
							only (test n≈{mlTest.length}, so a single split can look
							perfect by chance). Splits are clone-level, not patient-grouped.
						</p>
						<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<Stat
								label="Leave-one-out AUC"
								value={mlLoocv.auc}
								hint={`LOOCV F1 ${mlLoocv.f1} · acc ${mlLoocv.accuracy}`}
							/>
							<Stat
								label="Hold out AUC (illustrative)"
								value={mlTestMetrics.auc}
								hint={`Train AUC ${mlTrainMetrics.auc} · n_test ${mlTest.length}`}
							/>
							<Stat
								label="Hold out F1"
								value={mlTestMetrics.f1}
								hint={`Precision ${mlTestMetrics.precision}, recall ${mlTestMetrics.recall}`}
							/>
							<Stat
								label="Majority baseline"
								value={mlLoocv.baselineAccuracy}
								hint={`Decision threshold ${mlThreshold.toFixed(2)}`}
							/>
						</div>
						<label className="mt-5 block max-w-md text-sm text-ink">
							Decision threshold ({mlThreshold.toFixed(2)})
							<input
								type="range"
								min={0.05}
								max={0.95}
								step={0.01}
								value={mlThreshold}
								onChange={(e) => setMlThreshold(Number(e.target.value))}
								className="mt-2 w-full accent-[var(--color-accent,#1F6F6A)]"
							/>
						</label>
					</section>

					<div className="grid gap-6 lg:grid-cols-2">
						<ChartCard
							title="ROC on held-out clones"
							datasetLabel={DATASET}
							explanation="Illustrative ROC on one random 25% hold-out (small n). Prefer the leave-one-out AUC above for a stabler estimate. The marked point is your chosen decision threshold."
							chartRef={rocRef}
							onExportPng={() =>
								exportSvgAsPng(rocRef.current, "pdac-ml-roc.png")
							}
						>
							<div className="h-80">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={mlRoc} margin={{ left: 8, right: 16 }}>
										<CartesianGrid stroke={CHART_LINE} />
										<XAxis
											type="number"
											dataKey="fpr"
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
											label={{
												value: "False positive rate",
												position: "insideBottom",
												offset: -2,
												fill: CHART_MUTED,
												fontSize: 11,
											}}
										/>
										<YAxis
											type="number"
											dataKey="tpr"
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
											label={{
												value: "True positive rate",
												angle: -90,
												position: "insideLeft",
												fill: CHART_MUTED,
												fontSize: 11,
											}}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<ReferenceLine
											segment={[
												{ x: 0, y: 0 },
												{ x: 1, y: 1 },
											]}
											stroke={CHART_MUTED}
											strokeDasharray="4 4"
										/>
										<Line
											type="monotone"
											dataKey="tpr"
											dot={false}
											stroke={CHART_ACCENT}
											strokeWidth={2}
											name="TPR"
										/>
										<ReferenceDot
											x={mlOperating.fpr}
											y={mlOperating.tpr}
											r={5}
											fill={CHART_INK}
											stroke={CHART_ACCENT}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>

						<ChartCard
							title="Which priming features the model uses"
							datasetLabel={DATASET}
							explanation="Standardised logistic weights on the train split. Positive bars favour the long-lived (above-median post-boost estimated lifespan) label. With only two features, treat magnitudes as descriptive, not causal."
							chartRef={weightRef}
							onExportPng={() =>
								exportSvgAsPng(weightRef.current, "pdac-ml-weights.png")
							}
						>
							<div className="h-80">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={mlWeights}
										layout="vertical"
										margin={{ left: 8, right: 16 }}
									>
										<CartesianGrid stroke={CHART_LINE} horizontal={false} />
										<XAxis type="number" tick={{ fill: CHART_MUTED, fontSize: 11 }} />
										<YAxis
											type="category"
											dataKey="label"
											width={160}
											tick={{ fill: CHART_MUTED, fontSize: 10 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Bar dataKey="weight" name="Weight">
											{mlWeights.map((row) => (
												<Cell
													key={row.key}
													fill={row.weight >= 0 ? CHART_ACCENT : CHART_INK}
												/>
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>
					</div>

					<p className="max-w-3xl text-sm text-ink-muted">
						{paper.source_note}{" "}
						<span className="text-ink-soft">{paper.trialContext}</span>
					</p>
				</div>
			</section>
		</>
	);
}
