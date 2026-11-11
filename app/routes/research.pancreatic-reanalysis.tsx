import type { MetaFunction } from "@remix-run/cloudflare";
import { useMemo, useState } from "react";
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
import { ChartCard } from "~/components/research/ChartCard";
import {
	CHART_ACCENT,
	CHART_INK,
	CHART_LINE,
	CHART_MUTED,
	CHART_SERIES,
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
			"Open reanalysis of published pancreatic cancer mRNA neoantigen vaccine data (Nature 2025): how long vaccine trained T cells last, and what early responses may tell us about durability.",
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
		const labelMap: Record<string, string> = {
			Tumor: "Tumour",
			Adjacent: "Adjacent tissue",
			"Malignant DLN": "Malignant draining lymph node",
			"Benign DLN": "Benign draining lymph node",
			"Pre-treatment blood": "Blood before vaccine",
			"De novo": "New after vaccine",
		};
		return Object.entries(counts).map(([label, value]) => ({
			label: labelMap[label] ?? label,
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
				summary="How long vaccine trained T cells last after an mRNA neoantigen vaccine in pancreatic cancer, and what early responses may tell us about durability."
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
							label="Median half life after boost"
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
						{paper.methodsNote} Lifespan numbers are model estimates from the
						published kinetics, not proof that every clone lasts for decades in
						a patient. Several clones can come from the same person, so treat
						clone tallies as educational rather than as independent patient
						counts.
					</p>

					<ChartCard
						title="Prime vs boost clone half life"
						datasetLabel={DATASET}
						explanation="After the booster, vaccine tracked T cell clones tend to last much longer than after the first dose. That is one reason booster schedules matter for personalised cancer vaccines: the second and subsequent doses help maintain the durability of useful clones."
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
												value: "Median half life (days)",
												angle: -90,
												position: "insideLeft",
												fill: CHART_MUTED,
												fontSize: 11,
											}}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Bar dataKey="medianDays" name="Median half life">
											{halfLifeBars.map((row) => (
												<Cell
													key={row.phase}
													fill={
														row.phase === "Prime"
															? CHART_SERIES[0]
															: CHART_SERIES[1]
													}
												/>
											))}
											<ErrorBar dataKey="error" width={6} stroke={CHART_INK} />
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
							<div className="space-y-3 text-sm text-ink-soft lg:col-span-2">
								<p>
									Prime median about{" "}
									{kinetics.primeHalfLifeDays.summary.median?.toFixed(0)} days;
									boost median about{" "}
									{kinetics.boostHalfLifeDays.summary.median?.toFixed(0)} days.
									The paired comparison supports a longer half life after boost
									(p≈{formatP(wilcoxon.pApprox)}).
								</p>
							</div>
						</div>
					</ChartCard>

					<ChartCard
						title="Peak frequency vs estimated lifespan"
						datasetLabel={DATASET}
						explanation="Each point is one vaccine tracked T cell clone. Clones that expand more strongly early on often have longer estimated lifespans later. For vaccine design, a strong early response is not only about short term control; it may also mark clones that endure."
					>
						<div className="grid gap-6 lg:grid-cols-5">
							<div className="h-80 lg:col-span-3">
								<ResponsiveContainer width="100%" height="100%">
									<ScatterChart
										margin={{ left: 16, right: 16, top: 12, bottom: 40 }}
									>
										<CartesianGrid stroke={CHART_LINE} />
										<XAxis
											type="number"
											dataKey="peakPct"
											name="Peak %"
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
											label={{
												value: "Peak prime frequency (% of blood T cells)",
												position: "insideBottom",
												offset: -18,
												fill: CHART_MUTED,
												fontSize: 12,
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
										<ZAxis range={[56, 56]} />
										<Tooltip
											cursor={{ strokeDasharray: "3 3" }}
											contentStyle={tooltipStyle}
										/>
										<Scatter data={scatterPoints} fill={CHART_SERIES[2]}>
											{scatterPoints.map((point, index) => (
												<Cell
													key={`${point.peakPct}-${point.lifespan}-${index}`}
													fill={CHART_SERIES[index % CHART_SERIES.length]}
												/>
											))}
										</Scatter>
									</ScatterChart>
								</ResponsiveContainer>
							</div>
							<div className="space-y-3 text-sm text-ink-soft lg:col-span-2">
								<p>
									Association strength (Spearman ρ) ≈{" "}
									{spearman.rho?.toFixed(2)} across {spearman.n} clones
									(p≈{formatP(spearman.pApprox)}).
								</p>
								<p>
									After boost, median estimated lifespan is about{" "}
									{kinetics.boostLifespanYears.summary.median?.toFixed(1)} years
									in this published sample.
								</p>
							</div>
						</div>
					</ChartCard>

					<ChartCard
						title="Clone persistence at last follow-up"
						datasetLabel={DATASET}
						explanation="Years after treatment, a large share of the vaccine expanded clones can still be found in blood for many responders. That persistence is a practical signal that personalised vaccines can leave a durable immune footprint, not only a brief spike."
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
									<Bar dataKey="persistencePct" name="Persistence %">
										{persistenceBars.map((row, index) => (
											<Cell
												key={row.patientId}
												fill={CHART_SERIES[index % CHART_SERIES.length]}
											/>
										))}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					<ChartCard
						title="Where vaccine tracked clones come from"
						datasetLabel={DATASET}
						explanation="Almost all tracked clones look new after vaccination, rather than copies of cells already in the tumour, nearby tissue, draining lymph nodes (DLN: lymph nodes that drain the tumour area) or blood beforehand. That supports the idea that the vaccine helps raise fresh, useful T cell responses."
					>
						<div className="h-72">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={originBars}
									layout="vertical"
									margin={{ left: 8, right: 12 }}
								>
									<CartesianGrid stroke={CHART_LINE} horizontal={false} />
									<XAxis type="number" tick={{ fill: CHART_MUTED, fontSize: 11 }} />
									<YAxis
										type="category"
										dataKey="label"
										width={210}
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
									/>
									<Tooltip contentStyle={tooltipStyle} />
									<Bar dataKey="clones" name="Clones">
										{originBars.map((row, index) => (
											<Cell
												key={row.label}
												fill={CHART_SERIES[index % CHART_SERIES.length]}
											/>
										))}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					<section className="border border-line bg-white px-5 py-6 sm:px-6">
						<h3 className="font-display text-xl text-ink sm:text-2xl">
							Can early vaccine signals flag long lived clones?
						</h3>
						<p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
							Here we ask a practical vaccine question: if we only look at how a
							clone behaves after the first dose, can we spot which clones later
							last longest after the booster? A simple model trained on those
							early measurements reaches a leave one out score of {mlLoocv.auc}.
							That is better than guessing from the majority class (
							{mlLoocv.baselineAccuracy}), which means early kinetics carry some
							real signal about durability. Treat this as educational analysis of
							published data, not a clinical decision tool.
						</p>
						<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<Stat
								label="Leave one out AUC"
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
							title="How well early signals separate long lived clones"
							datasetLabel={DATASET}
							explanation={`This curve shows a trade off: as we call more clones long lived, we also risk including shorter lived ones. A curve above the diagonal means the early signals rank clones better than chance. The leave one out score above (${mlLoocv.auc}) is the fairer summary across all clones; this plot uses one small hold out split only, so the shape can look uneven. The marked point is the threshold you set.`}
						>
							<div className="h-80">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={mlRoc} margin={{ left: 8, right: 16, bottom: 24 }}>
										<CartesianGrid stroke={CHART_LINE} />
										<XAxis
											type="number"
											dataKey="fpr"
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
											label={{
												value: "Share of shorter lived clones wrongly flagged",
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
												value: "Share of long lived clones found",
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
											type="stepAfter"
											dataKey="tpr"
											dot={{ r: 3, fill: CHART_SERIES[1], strokeWidth: 0 }}
											stroke={CHART_SERIES[0]}
											strokeWidth={2.5}
											name="Long lived clones found"
										/>
										<ReferenceDot
											x={mlOperating.fpr}
											y={mlOperating.tpr}
											r={6}
											fill={CHART_SERIES[2]}
											stroke={CHART_INK}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>

						<ChartCard
							title="Which priming features the model uses"
							datasetLabel={DATASET}
							explanation="These bars show which early (prime) measurements the model leans on when it flags a clone as likely to last longer after the booster. Larger bars matter more in this simple two input model; treat them as a guide to what the published kinetics emphasise, not as proof of cause."
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
											{mlWeights.map((row, index) => (
												<Cell
													key={row.key}
													fill={CHART_SERIES[index % CHART_SERIES.length]}
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
