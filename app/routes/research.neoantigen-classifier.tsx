import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	ReferenceDot,
	ReferenceLine,
	ResponsiveContainer,
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
	ALL_NEOANTIGEN_EXAMPLES,
	FEATURE_META,
	ML_DATASET_LABEL,
	ML_GLOSSARY,
	ML_SEED,
	classificationMetrics,
	featureImportances,
	precisionRecallCurve,
	probabilityBins,
	rocCurve,
	scoredExamples,
	trainLogisticRegression,
	trainTestSplit,
} from "~/data/synthetic-neoantigen-ml";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Neoantigen Priority Classifier"),
		description:
			"Supervised machine-learning demonstration: logistic regression for synthetic neoantigen prioritisation with ROC curves and interactive thresholds.",
		path: "/research/neoantigen-classifier",
		noIndex: true,
	});
};

export default function NeoantigenClassifierPage() {
	const [threshold, setThreshold] = useState(0.5);
	const [splitRatio, setSplitRatio] = useState(0.7);
	const [showOnlyErrors, setShowOnlyErrors] = useState(false);
	const [methodologyOpen, setMethodologyOpen] = useState(false);
	const [glossaryOpen, setGlossaryOpen] = useState(false);

	const { train, test } = useMemo(
		() => trainTestSplit(ALL_NEOANTIGEN_EXAMPLES, splitRatio),
		[splitRatio],
	);

	const model = useMemo(() => trainLogisticRegression(train), [train]);
	const trainMetrics = useMemo(
		() => classificationMetrics(train, model, threshold),
		[train, model, threshold],
	);
	const testMetrics = useMemo(
		() => classificationMetrics(test, model, threshold),
		[test, model, threshold],
	);
	const importances = useMemo(() => featureImportances(model), [model]);
	const roc = useMemo(() => rocCurve(test, model), [test, model]);
	const pr = useMemo(() => precisionRecallCurve(test, model), [test, model]);
	const bins = useMemo(() => probabilityBins(test, model), [test, model]);
	const ranked = useMemo(
		() => scoredExamples(test, model, threshold),
		[test, model, threshold],
	);
	const tableRows = useMemo(
		() =>
			(showOnlyErrors ? ranked.filter((row) => !row.correct) : ranked).slice(
				0,
				40,
			),
		[ranked, showOnlyErrors],
	);

	const operatingPoint = useMemo(() => {
		const fpr =
			testMetrics.fp + testMetrics.tn === 0
				? 0
				: testMetrics.fp / (testMetrics.fp + testMetrics.tn);
		const tpr =
			testMetrics.tp + testMetrics.fn === 0
				? 0
				: testMetrics.tp / (testMetrics.tp + testMetrics.fn);
		return { fpr, tpr };
	}, [testMetrics]);

	const positiveRate = useMemo(() => {
		const positives = ALL_NEOANTIGEN_EXAMPLES.filter(
			(example) => example.priority === 1,
		).length;
		return Math.round((positives / ALL_NEOANTIGEN_EXAMPLES.length) * 1000) / 10;
	}, []);

	return (
		<>
			<div className="sticky top-[4.25rem] z-40 border-b border-amber-200/80 bg-amber-50/95 backdrop-blur-sm">
				<div className="site-container flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm text-ink">
					<p>
						<span className="font-semibold text-amber-900">
							Synthetic demonstration only.
						</span>{" "}
						{ML_DATASET_LABEL} — not real patient, trial or HLA typing results.
					</p>
					<Link
						to="/research/cancer-vaccine-analytics"
						className="font-medium text-accent hover:underline"
					>
						Cancer vaccine analytics →
					</Link>
				</div>
			</div>

			<PageHero
				eyebrow="Research Analytics Lab"
				title="Neoantigen priority classifier"
				summary="A supervised learning demonstrator that trains logistic regression on synthetic neoantigen features, then lets you inspect hold-out performance, feature weights and the effect of the decision threshold."
				accent="Machine-learning illustration for personalised vaccine design workflows — exploratory software capability, not a validated selection tool."
			/>

			<section className="section-pad !pt-10">
				<div className="site-container space-y-10">
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Synthetic peptides</p>
							<p className="mt-1 font-display text-3xl text-ink">
								{ALL_NEOANTIGEN_EXAMPLES.length}
							</p>
							<p className="mt-1 text-xs text-ink-muted">
								{positiveRate}% labelled priority
							</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Train / test split</p>
							<p className="mt-1 font-display text-3xl text-ink">
								{train.length}/{test.length}
							</p>
							<p className="mt-1 text-xs text-ink-muted">
								Seed {ML_SEED} · {Math.round(splitRatio * 100)}% train
							</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Hold-out AUC</p>
							<p className="mt-1 font-display text-3xl text-ink">
								{testMetrics.auc}
							</p>
							<p className="mt-1 text-xs text-ink-muted">
								Train AUC {trainMetrics.auc}
							</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Hold-out F1 @ threshold</p>
							<p className="mt-1 font-display text-3xl text-ink">
								{testMetrics.f1}
							</p>
							<p className="mt-1 text-xs text-ink-muted">
								Accuracy {testMetrics.accuracy}
							</p>
						</div>
					</div>

					<div className="border border-line bg-white px-5 py-5 sm:px-6">
						<p className="text-sm font-semibold text-ink">Model controls</p>
						<div className="mt-4 grid gap-5 md:grid-cols-2">
							<label className="block text-sm">
								<span className="font-semibold text-ink">
									Decision threshold ({threshold.toFixed(2)})
								</span>
								<input
									type="range"
									min={0.05}
									max={0.95}
									step={0.01}
									className="mt-3 w-full accent-accent"
									value={threshold}
									onChange={(event) =>
										setThreshold(Number(event.target.value))
									}
								/>
								<span className="mt-1 block text-ink-muted">
									Lower → more peptides called priority (higher recall). Higher
									→ stricter calls (higher precision).
								</span>
							</label>
							<label className="block text-sm">
								<span className="font-semibold text-ink">
									Train fraction ({Math.round(splitRatio * 100)}%)
								</span>
								<input
									type="range"
									min={0.55}
									max={0.85}
									step={0.05}
									className="mt-3 w-full accent-accent"
									value={splitRatio}
									onChange={(event) =>
										setSplitRatio(Number(event.target.value))
									}
								/>
								<span className="mt-1 block text-ink-muted">
									Retrains logistic regression on the new split. Metrics below
									update immediately.
								</span>
							</label>
						</div>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						<div className="border border-line bg-white px-5 py-6 sm:px-6">
							<h2 className="font-display text-2xl text-ink">
								Confusion matrix (hold-out)
							</h2>
							<p className="mt-2 text-sm text-ink-soft">
								Predicted priority vs synthetic ground-truth labels at the
								current threshold.
							</p>
							<div className="mt-5 grid grid-cols-[auto_1fr_1fr] gap-2 text-center text-sm">
								<div />
								<div className="text-ink-muted">Pred priority</div>
								<div className="text-ink-muted">Pred not priority</div>
								<div className="flex items-center justify-end pr-2 text-ink-muted">
									True priority
								</div>
								<div className="border border-accent bg-accent-soft px-3 py-6">
									<p className="text-xs text-ink-muted">True positive</p>
									<p className="mt-1 font-display text-3xl text-ink">
										{testMetrics.tp}
									</p>
								</div>
								<div className="border border-line bg-cream/50 px-3 py-6">
									<p className="text-xs text-ink-muted">False negative</p>
									<p className="mt-1 font-display text-3xl text-ink">
										{testMetrics.fn}
									</p>
								</div>
								<div className="flex items-center justify-end pr-2 text-ink-muted">
									True not
								</div>
								<div className="border border-line bg-cream/50 px-3 py-6">
									<p className="text-xs text-ink-muted">False positive</p>
									<p className="mt-1 font-display text-3xl text-ink">
										{testMetrics.fp}
									</p>
								</div>
								<div className="border border-line bg-mist/40 px-3 py-6">
									<p className="text-xs text-ink-muted">True negative</p>
									<p className="mt-1 font-display text-3xl text-ink">
										{testMetrics.tn}
									</p>
								</div>
							</div>
							<dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
								<div>
									<dt className="text-ink-muted">Precision</dt>
									<dd className="font-medium text-ink">
										{testMetrics.precision}
									</dd>
								</div>
								<div>
									<dt className="text-ink-muted">Recall</dt>
									<dd className="font-medium text-ink">{testMetrics.recall}</dd>
								</div>
								<div>
									<dt className="text-ink-muted">Specificity</dt>
									<dd className="font-medium text-ink">
										{testMetrics.specificity}
									</dd>
								</div>
								<div>
									<dt className="text-ink-muted">F1</dt>
									<dd className="font-medium text-ink">{testMetrics.f1}</dd>
								</div>
							</dl>
						</div>

						<ChartCard
							title="Feature weights (standardised)"
							explanation="Absolute logistic-regression coefficients after z-scoring features on the training split. Direction indicates whether a higher feature value increases or decreases predicted priority odds in this synthetic model."
						>
							<div className="h-72 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={importances}
										layout="vertical"
										margin={{ left: 8, right: 16 }}
									>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											type="number"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis
											type="category"
											dataKey="label"
											width={120}
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
										/>
										<Tooltip
											contentStyle={tooltipStyle}
											formatter={(value, _name, item) => {
												const row = item?.payload as {
													weight?: number;
													direction?: string;
												};
												return [
													`${value} (${row.direction}; coef ${row.weight})`,
													"|weight|",
												];
											}}
										/>
										<Bar
											dataKey="absWeight"
											name="|weight|"
											isAnimationActive={false}
										>
											{importances.map((row) => (
												<Cell
													key={row.key}
													fill={
														row.weight >= 0 ? CHART_ACCENT : CHART_INK
													}
												/>
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						<ChartCard
							title="ROC curve (hold-out)"
							explanation="True-positive rate versus false-positive rate as the decision threshold sweeps from 1 → 0. The marker shows the current operating point."
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
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<ReferenceLine
											segment={[
												{ x: 0, y: 0 },
												{ x: 1, y: 1 },
											]}
											stroke={CHART_LINE}
											strokeDasharray="4 4"
										/>
										<Line
											type="monotone"
											dataKey="tpr"
											stroke={CHART_ACCENT}
											strokeWidth={2}
											dot={false}
											name="TPR"
											isAnimationActive={false}
										/>
										<ReferenceDot
											x={operatingPoint.fpr}
											y={operatingPoint.tpr}
											r={5}
											fill={CHART_INK}
											stroke="#fff"
											strokeWidth={2}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>

						<ChartCard
							title="Precision–recall curve"
							explanation="How precision and recall trade off across thresholds on the synthetic hold-out set. Useful when priority peptides are the minority class."
						>
							<div className="h-72 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={pr}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											type="number"
											dataKey="recall"
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis
											type="number"
											dataKey="precision"
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Line
											type="monotone"
											dataKey="precision"
											stroke={CHART_ACCENT}
											strokeWidth={2}
											dot={false}
											name="Precision"
											isAnimationActive={false}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>
					</div>

					<ChartCard
						title="Predicted probability distribution"
						explanation="Hold-out peptides binned by model score. Bars show count; the line shows the observed positive rate within each bin — a simple calibration check on synthetic labels."
					>
						<div className="h-72 w-full">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={bins}>
									<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
									<XAxis
										dataKey="binLabel"
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
									/>
									<YAxis
										yAxisId="count"
										allowDecimals={false}
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
									/>
									<YAxis
										yAxisId="rate"
										orientation="right"
										domain={[0, 1]}
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
									/>
									<Tooltip contentStyle={tooltipStyle} />
									<Bar
										yAxisId="count"
										dataKey="count"
										name="Count"
										fill={CHART_ACCENT}
										isAnimationActive={false}
									/>
									<Line
										yAxisId="rate"
										type="monotone"
										dataKey="positiveRate"
										name="Positive rate"
										stroke={CHART_INK}
										strokeWidth={2}
										dot={{ r: 3 }}
										isAnimationActive={false}
									/>
									<ReferenceLine
										yAxisId="rate"
										x={undefined}
										y={threshold}
										stroke={CHART_MUTED}
										strokeDasharray="4 4"
									/>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					<div className="border border-line bg-white">
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
							<div>
								<h2 className="font-display text-2xl text-ink">
									Ranked hold-out predictions
								</h2>
								<p className="mt-1 text-sm text-ink-muted">
									Top 40 by predicted probability · threshold {threshold.toFixed(2)}
								</p>
							</div>
							<button
								type="button"
								className={`filter-pill ${showOnlyErrors ? "filter-pill-active" : ""}`}
								aria-pressed={showOnlyErrors}
								onClick={() => setShowOnlyErrors((value) => !value)}
							>
								{showOnlyErrors ? "Showing errors only" : "Show all / errors"}
							</button>
						</div>
						<div className="rounded-sm">
							<table className="w-full table-fixed border-collapse text-left text-sm">
								<colgroup>
									<col className="w-[12%]" />
									<col className="w-[18%]" />
									<col className="w-[12%]" />
									<col className="w-[12%]" />
									<col className="w-[14%]" />
									<col className="w-[16%]" />
									<col className="w-[16%]" />
								</colgroup>
								<thead className="bg-white">
									<tr className="border-b border-line text-ink-muted">
										<th className="px-3 py-3 font-semibold">ID</th>
										<th className="px-3 py-3 font-semibold">Cancer</th>
										<th className="px-3 py-3 font-semibold">Affinity</th>
										<th className="px-3 py-3 font-semibold">Expr.</th>
										<th className="px-3 py-3 font-semibold">P(priority)</th>
										<th className="px-3 py-3 font-semibold">Predicted</th>
										<th className="px-3 py-3 font-semibold">Label</th>
									</tr>
								</thead>
							</table>
							<div className="max-h-80 overflow-y-auto">
								<table className="w-full table-fixed border-collapse text-left text-sm">
									<colgroup>
										<col className="w-[12%]" />
										<col className="w-[18%]" />
										<col className="w-[12%]" />
										<col className="w-[12%]" />
										<col className="w-[14%]" />
										<col className="w-[16%]" />
										<col className="w-[16%]" />
									</colgroup>
									<tbody>
										{tableRows.map((row) => (
											<tr
												key={row.id}
												className={`border-b border-line/70 ${
													row.correct ? "text-ink-soft" : "bg-amber-50/60 text-ink"
												}`}
											>
												<td className="px-3 py-2 font-medium text-ink">
													{row.id}
												</td>
												<td className="px-3 py-2">{row.cancerType}</td>
												<td className="px-3 py-2">{row.affinityNm}</td>
												<td className="px-3 py-2">{row.expressionScore}</td>
												<td className="px-3 py-2 tabular-nums">
													{row.probability}
												</td>
												<td className="px-3 py-2">
													{row.predicted === 1 ? "Priority" : "Not"}
												</td>
												<td className="px-3 py-2">
													{row.priority === 1 ? "Priority" : "Not"}
													{row.correct ? "" : " · miss"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>

					<section className="border border-line bg-cream/40 px-5 py-7 sm:px-8">
						<p className="eyebrow">How to read this demo</p>
						<h2 className="mt-3 section-title">What the model is doing</h2>
						<ul className="mt-6 space-y-3 text-[0.97rem] leading-relaxed text-ink-soft">
							<li className="border-l-2 border-accent pl-4">
								Features ({Object.values(FEATURE_META)
									.map((meta) => meta.label.toLowerCase())
									.join(", ")}
								) are z-scored on the training split, then a logistic regression
								is fit with L2 regularisation (λ={model.l2}).
							</li>
							<li className="border-l-2 border-accent pl-4">
								Final training loss {model.trainLoss} after {model.epochs}{" "}
								epochs. Hold-out AUC {testMetrics.auc} summarises ranking quality
								independent of the threshold you choose.
							</li>
							<li className="border-l-2 border-accent pl-4">
								Move the threshold to see precision and recall trade off in the
								confusion matrix and ranked table — the same pattern used when
								tuning classifiers in exploratory research software.
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
									All peptides, affinities and priority labels are synthetic.
									No real HLA typing, mass-spectrometry or clinical vaccine
									panel data are used.
								</p>
								<p>
									Labels are generated from a latent scoring rule plus noise so
									the classifier has a recoverable signal. Performance metrics
									therefore illustrate the analytics UI, not real-world
									neoantigen selection accuracy.
								</p>
								<p>
									<strong className="text-ink">Model:</strong> binary logistic
									regression with batch gradient descent, feature
									standardisation and L2 weight decay. Not a deep learning
									model; chosen for interpretability in a public demonstrator.
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
								<h2 className="mt-2 section-title">ML terms used here</h2>
							</div>
							<span className="text-accent" aria-hidden="true">
								{glossaryOpen ? "−" : "+"}
							</span>
						</button>
						{glossaryOpen ? (
							<dl className="space-y-4 border-t border-line px-5 py-6 sm:px-6">
								{ML_GLOSSARY.map((entry) => (
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
