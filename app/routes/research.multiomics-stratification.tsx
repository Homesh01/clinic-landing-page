import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
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
	tooltipStyle,
} from "~/components/research/chart-theme";
import { PageHero } from "~/components/PageHero";
import {
	ALL_MULTIOMICS_PATIENTS,
	CANCER_TYPES,
	CLUSTER_COLORS,
	MARKER_KEYS,
	MARKER_META,
	MULTI_DATASET_LABEL,
	MULTI_GLOSSARY,
	MULTI_SEED,
	cancerByCluster,
	clusterHeatmapRows,
	computePca,
	ensembleMetrics,
	learningCurve,
	runKMeans,
	silhouetteScore,
	standardizerFromPatients,
	trainRandomForest,
	trainTestSplitPatients,
} from "~/data/synthetic-multiomics-ml";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Multi-omics stratification"),
		description:
			"Advanced synthetic machine-learning demonstrator: PCA, k-means clustering and random-forest response prediction on mock multi-omics patient profiles.",
		path: "/research/multiomics-stratification",
	});
};

function heatColor(value: number, min: number, max: number) {
	const span = max - min || 1;
	const t = Math.min(1, Math.max(0, (value - min) / span));
	// Teal → cream → ink (no purple)
	if (t < 0.5) {
		const u = t / 0.5;
		const r = Math.round(31 + (248 - 31) * u);
		const g = Math.round(111 + (247 - 111) * u);
		const b = Math.round(106 + (244 - 106) * u);
		return `rgb(${r},${g},${b})`;
	}
	const u = (t - 0.5) / 0.5;
	const r = Math.round(248 + (21 - 248) * u);
	const g = Math.round(247 + (32 - 247) * u);
	const b = Math.round(244 + (43 - 244) * u);
	return `rgb(${r},${g},${b})`;
}

export default function MultiomicsStratificationPage() {
	const [k, setK] = useState(3);
	const [nTrees, setNTrees] = useState(40);
	const [colorMode, setColorMode] = useState<"cluster" | "response" | "cancer">(
		"cluster",
	);
	const [methodologyOpen, setMethodologyOpen] = useState(false);
	const [glossaryOpen, setGlossaryOpen] = useState(false);

	const { train, test } = useMemo(
		() => trainTestSplitPatients(ALL_MULTIOMICS_PATIENTS, 0.72),
		[],
	);

	const clustering = useMemo(
		() => runKMeans(ALL_MULTIOMICS_PATIENTS, k),
		[k],
	);
	const silhouette = useMemo(
		() => silhouetteScore(ALL_MULTIOMICS_PATIENTS, clustering.assignments),
		[clustering.assignments],
	);
	const pca = useMemo(
		() => computePca(ALL_MULTIOMICS_PATIENTS, clustering.assignments),
		[clustering.assignments],
	);

	const forestBundle = useMemo(() => {
		const model = trainRandomForest(train, {
			nTrees,
			maxDepth: 5,
			seed: MULTI_SEED + nTrees,
		});
		const { means, stds } = standardizerFromPatients(train);
		const trainMetrics = ensembleMetrics(train, model, means, stds);
		const testMetrics = ensembleMetrics(test, model, means, stds);
		return { model, trainMetrics, testMetrics };
	}, [train, test, nTrees]);

	const curve = useMemo(() => learningCurve(train, test), [train, test]);
	const stacked = useMemo(
		() => cancerByCluster(ALL_MULTIOMICS_PATIENTS, clustering.assignments),
		[clustering.assignments],
	);
	const heatRows = useMemo(
		() => clusterHeatmapRows(clustering.summaries),
		[clustering.summaries],
	);

	const heatMinMax = useMemo(() => {
		const values = heatRows.flatMap((row) =>
			clustering.summaries.map((summary) => Number(row[`c${summary.cluster}`])),
		);
		return {
			min: Math.min(...values),
			max: Math.max(...values),
		};
	}, [heatRows, clustering.summaries]);

	const loadingBars = useMemo(
		() =>
			[...pca.loadings]
				.map((row) => ({
					...row,
					absPc1: Math.abs(row.pc1),
				}))
				.sort((a, b) => b.absPc1 - a.absPc1)
				.slice(0, 8),
		[pca.loadings],
	);

	const positiveRate = useMemo(() => {
		const positives = ALL_MULTIOMICS_PATIENTS.filter(
			(patient) => patient.highResponse === 1,
		).length;
		return Math.round((positives / ALL_MULTIOMICS_PATIENTS.length) * 1000) / 10;
	}, []);

	const scatterGroups = useMemo(() => {
		if (colorMode === "response") {
			return [
				{
					key: "high",
					label: "High response",
					color: CHART_ACCENT,
					data: pca.points.filter((point) => point.highResponse === 1),
				},
				{
					key: "low",
					label: "Low response",
					color: CHART_INK,
					data: pca.points.filter((point) => point.highResponse === 0),
				},
			];
		}
		if (colorMode === "cancer") {
			const palette = [
				CHART_ACCENT,
				CHART_INK,
				"#5D6B78",
				"#8FA0AB",
				"#155652",
			];
			return CANCER_TYPES.map((cancer, index) => ({
				key: cancer,
				label: cancer,
				color: palette[index % palette.length]!,
				data: pca.points.filter((point) => point.cancerType === cancer),
			}));
		}
		const clusterIds = [
			...new Set(pca.points.map((point) => point.cluster)),
		].sort((a, b) => a - b);
		return clusterIds.map((cluster) => ({
			key: `c${cluster}`,
			label: `Cluster ${cluster + 1}`,
			color: CLUSTER_COLORS[cluster % CLUSTER_COLORS.length]!,
			data: pca.points.filter((point) => point.cluster === cluster),
		}));
	}, [pca.points, colorMode]);

	const confusionCells = [
		{
			label: "True positive",
			value: forestBundle.testMetrics.tp,
			tone: "bg-accent-soft",
		},
		{
			label: "False negative",
			value: forestBundle.testMetrics.fn,
			tone: "bg-cream/60",
		},
		{
			label: "False positive",
			value: forestBundle.testMetrics.fp,
			tone: "bg-cream/60",
		},
		{
			label: "True negative",
			value: forestBundle.testMetrics.tn,
			tone: "bg-mist/50",
		},
	];

	return (
		<>
			<div className="sticky top-[4.25rem] z-40 border-b border-amber-200/80 bg-amber-50/95 backdrop-blur-sm">
				<div className="site-container flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm text-ink">
					<p>
						<span className="font-semibold text-amber-900">
							Synthetic demonstration only.
						</span>{" "}
						{MULTI_DATASET_LABEL} — invented multi-omics profiles, not real
						patients or assays.
					</p>
					<div className="flex flex-wrap gap-3">
						<Link
							to="/research/neoantigen-classifier"
							className="font-medium text-accent hover:underline"
						>
							Neoantigen classifier
						</Link>
						<Link
							to="/research/cancer-vaccine-analytics"
							className="font-medium text-accent hover:underline"
						>
							Vaccine analytics →
						</Link>
					</div>
				</div>
			</div>

			<PageHero
				eyebrow="Research Analytics Lab"
				title="Multi-omics patient stratification"
				summary="An unsupervised + ensemble learning playground: PCA projection, k-means molecular clusters, marker heatmaps and a random-forest model that predicts a synthetic high-response label."
				accent="Advanced illustrative ML on mock data — not a validated clinical stratification tool."
			/>

			<section className="section-pad !pt-10">
				<div className="site-container space-y-10">
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Synthetic patients</p>
							<p className="mt-1 font-display text-3xl text-ink">
								{ALL_MULTIOMICS_PATIENTS.length}
							</p>
							<p className="mt-1 text-xs text-ink-muted">
								{MARKER_KEYS.length} markers · seed {MULTI_SEED}
							</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">High-response label</p>
							<p className="mt-1 font-display text-3xl text-ink">
								{positiveRate}%
							</p>
							<p className="mt-1 text-xs text-ink-muted">
								Train {train.length} / test {test.length}
							</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Silhouette (k={k})</p>
							<p className="mt-1 font-display text-3xl text-ink">{silhouette}</p>
							<p className="mt-1 text-xs text-ink-muted">
								Inertia {clustering.inertia}
							</p>
						</div>
						<div className="border border-line bg-cream/40 px-4 py-4">
							<p className="text-sm text-ink-muted">Hold-out forest F1</p>
							<p className="mt-1 font-display text-3xl text-ink">
								{forestBundle.testMetrics.f1}
							</p>
							<p className="mt-1 text-xs text-ink-muted">
								Accuracy {forestBundle.testMetrics.accuracy} · {nTrees} trees
							</p>
						</div>
					</div>

					<div className="border border-line bg-white px-5 py-5 sm:px-6">
						<p className="text-sm font-semibold text-ink">Model controls</p>
						<div className="mt-4 grid gap-5 md:grid-cols-3">
							<label className="block text-sm">
								<span className="font-semibold text-ink">
									Clusters k ({k})
								</span>
								<input
									type="range"
									min={2}
									max={6}
									step={1}
									className="mt-3 w-full accent-accent"
									value={k}
									onChange={(event) => setK(Number(event.target.value))}
								/>
								<span className="mt-1 block text-ink-muted">
									Re-runs k-means on standardised markers and refreshes PCA
									colours when set to cluster mode.
								</span>
							</label>
							<label className="block text-sm">
								<span className="font-semibold text-ink">
									Forest size ({nTrees} trees)
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
								<span className="mt-1 block text-ink-muted">
									Retrains the bagged decision-tree ensemble on the training
									split.
								</span>
							</label>
							<div className="block text-sm">
								<span className="font-semibold text-ink">PCA colour mode</span>
								<div className="mt-2 flex flex-wrap gap-2">
									{(
										[
											["cluster", "Cluster"],
											["response", "Response"],
											["cancer", "Cancer type"],
										] as const
									).map(([value, label]) => (
										<button
											key={value}
											type="button"
											className={`filter-pill ${colorMode === value ? "filter-pill-active" : ""}`}
											aria-pressed={colorMode === value}
											onClick={() => setColorMode(value)}
										>
											{label}
										</button>
									))}
								</div>
							</div>
						</div>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						<ChartCard
							title="PCA patient map"
							explanation={`Each point is a synthetic patient in the plane of the first two principal components (≈${Math.round(
								(pca.varianceExplained[0] + pca.varianceExplained[1]) * 100,
							)}% combined variance). Colour encodes the selected overlay.`}
						>
							<div className="h-80 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											type="number"
											dataKey="pc1"
											name="PC1"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
											label={{
												value: `PC1 (${Math.round(pca.varianceExplained[0] * 100)}%)`,
												position: "insideBottom",
												offset: -2,
												fill: CHART_MUTED,
												fontSize: 11,
											}}
										/>
										<YAxis
											type="number"
											dataKey="pc2"
											name="PC2"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
											label={{
												value: `PC2 (${Math.round(pca.varianceExplained[1] * 100)}%)`,
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
										<Legend />
										{scatterGroups.map((group) => (
											<Scatter
												key={group.key}
												name={group.label}
												data={group.data}
												fill={group.color}
												fillOpacity={0.7}
												isAnimationActive={false}
											/>
										))}
									</ScatterChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>

						<ChartCard
							title="PC1 loadings (top markers)"
							explanation="How strongly each standardised marker contributes to the first principal axis. Large absolute loadings drive separation along PC1 in the map."
						>
							<div className="h-80 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={loadingBars}
										layout="vertical"
										margin={{ left: 8, right: 12 }}
									>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											type="number"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis
											type="category"
											dataKey="label"
											width={118}
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Bar dataKey="pc1" name="PC1 loading" isAnimationActive={false}>
											{loadingBars.map((row) => (
												<Cell
													key={row.marker}
													fill={row.pc1 >= 0 ? CHART_ACCENT : CHART_INK}
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
							title="Cancer mix within clusters"
							explanation="Stacked counts of synthetic cancer types inside each k-means cluster. Useful for seeing whether molecular neighbourhoods align with labelled disease groups on mock data."
						>
							<div className="h-72 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={stacked}>
										<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
										<XAxis
											dataKey="cluster"
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<YAxis
											allowDecimals={false}
											tick={{ fill: CHART_MUTED, fontSize: 12 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Legend />
										{CANCER_TYPES.map((cancer, index) => (
											<Bar
												key={cancer}
												dataKey={cancer}
												stackId="cancer"
												fill={
													CLUSTER_COLORS[index % CLUSTER_COLORS.length]
												}
												isAnimationActive={false}
											/>
										))}
									</BarChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>

						<div className="border border-line bg-white">
							<div className="border-b border-line px-5 py-4 sm:px-6">
								<h3 className="font-display text-xl text-ink sm:text-2xl">
									Cluster marker heatmap
								</h3>
								<p className="mt-1 text-sm text-ink-muted">
									Mean synthetic marker score by cluster
								</p>
							</div>
							<div className="overflow-x-auto px-4 py-4 sm:px-5">
								<table className="min-w-full border-collapse text-center text-xs sm:text-sm">
									<thead>
										<tr>
											<th className="px-2 py-2 text-left text-ink-muted">
												Marker
											</th>
											{clustering.summaries.map((summary) => (
												<th
													key={summary.cluster}
													className="px-2 py-2 font-semibold text-ink-muted"
												>
													C{summary.cluster + 1}
													<span className="mt-0.5 block text-[0.7rem] font-normal">
														n={summary.n}
													</span>
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{heatRows.map((row) => (
											<tr key={String(row.key)}>
												<th
													scope="row"
													className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-ink"
												>
													{row.marker}
												</th>
												{clustering.summaries.map((summary) => {
													const value = Number(row[`c${summary.cluster}`]);
													return (
														<td key={summary.cluster} className="px-1 py-1">
															<span
																className="inline-flex min-w-[3rem] justify-center rounded-sm px-2 py-2 tabular-nums text-ink"
																style={{
																	backgroundColor: heatColor(
																		value,
																		heatMinMax.min,
																		heatMinMax.max,
																	),
																}}
															>
																{value}
															</span>
														</td>
													);
												})}
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<p className="border-t border-line px-5 py-4 text-sm text-ink-soft sm:px-6">
								High-response rates by cluster:{" "}
								{clustering.summaries
									.map(
										(summary) =>
											`C${summary.cluster + 1} ${(summary.highResponseRate * 100).toFixed(0)}%`,
									)
									.join(" · ")}
								.
							</p>
						</div>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						<div className="border border-line bg-white px-5 py-6 sm:px-6">
							<h2 className="font-display text-2xl text-ink">
								Random forest (hold-out)
							</h2>
							<p className="mt-2 text-sm text-ink-soft">
								Bagged trees on standardised markers predicting the synthetic
								high-response label. Depth capped at 5; √p features tried at each
								split.
							</p>
							<div className="mt-5 grid grid-cols-2 gap-2 text-center text-sm">
								{confusionCells.map((cell) => (
									<div
										key={cell.label}
										className={`border border-line px-3 py-5 ${cell.tone}`}
									>
										<p className="text-xs text-ink-muted">{cell.label}</p>
										<p className="mt-1 font-display text-3xl text-ink">
											{cell.value}
										</p>
									</div>
								))}
							</div>
							<dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
								<div>
									<dt className="text-ink-muted">Precision</dt>
									<dd className="font-medium text-ink">
										{forestBundle.testMetrics.precision}
									</dd>
								</div>
								<div>
									<dt className="text-ink-muted">Recall</dt>
									<dd className="font-medium text-ink">
										{forestBundle.testMetrics.recall}
									</dd>
								</div>
								<div>
									<dt className="text-ink-muted">F1</dt>
									<dd className="font-medium text-ink">
										{forestBundle.testMetrics.f1}
									</dd>
								</div>
								<div>
									<dt className="text-ink-muted">Train acc.</dt>
									<dd className="font-medium text-ink">
										{forestBundle.trainMetrics.accuracy}
									</dd>
								</div>
							</dl>
						</div>

						<ChartCard
							title="Ensemble feature importance"
							explanation="Normalised split-frequency importance across trees (illustrative Mean Decrease in Impurity proxy). Higher bars are used more often when partitioning the synthetic training set."
						>
							<div className="h-72 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={forestBundle.model.importances.slice(0, 8)}
										layout="vertical"
										margin={{ left: 4, right: 12 }}
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
										<Tooltip contentStyle={tooltipStyle} />
										<Bar
											dataKey="importance"
											name="Importance"
											fill={CHART_ACCENT}
											isAnimationActive={false}
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>
					</div>

					<ChartCard
						title="Learning curve (forest size)"
						explanation="Train and hold-out accuracy as the number of trees grows. A widening gap would suggest overfitting on this synthetic split; a flat test curve suggests diminishing returns from larger forests."
					>
						<div className="h-72 w-full">
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={curve}>
									<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
									<XAxis
										dataKey="nTrees"
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
										label={{
											value: "Trees",
											position: "insideBottom",
											offset: -2,
											fill: CHART_MUTED,
											fontSize: 11,
										}}
									/>
									<YAxis
										domain={[0.4, 1]}
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
									/>
									<Tooltip contentStyle={tooltipStyle} />
									<Legend />
									<Line
										type="monotone"
										dataKey="trainAccuracy"
										name="Train accuracy"
										stroke={CHART_INK}
										strokeWidth={2}
										dot={{ r: 3 }}
										isAnimationActive={false}
									/>
									<Line
										type="monotone"
										dataKey="testAccuracy"
										name="Test accuracy"
										stroke={CHART_ACCENT}
										strokeWidth={2}
										dot={{ r: 3 }}
										isAnimationActive={false}
									/>
									<Line
										type="monotone"
										dataKey="testF1"
										name="Test F1"
										stroke="#8FA0AB"
										strokeWidth={2}
										strokeDasharray="4 4"
										dot={{ r: 3 }}
										isAnimationActive={false}
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					<section className="border border-line bg-cream/40 px-5 py-7 sm:px-8">
						<p className="eyebrow">How to read this demo</p>
						<h2 className="mt-3 section-title">Unsupervised map + supervised forest</h2>
						<ul className="mt-6 space-y-3 text-[0.97rem] leading-relaxed text-ink-soft">
							<li className="border-l-2 border-accent pl-4">
								Markers span immune, genomic, metabolic and stromal axes (
								{Object.values(MARKER_META)
									.map((meta) => meta.axis)
									.filter((axis, index, all) => all.indexOf(axis) === index)
									.join(", ")}
								).
							</li>
							<li className="border-l-2 border-accent pl-4">
								k-means discovers molecular neighbourhoods without using the
								response label; the forest then predicts that label from the same
								features on a held-out split.
							</li>
							<li className="border-l-2 border-accent pl-4">
								Move k and forest size to see clusters, silhouette and
								generalisation change — the same exploratory loop used when
								stress-testing analytics software before real assays exist.
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
									All patients and marker values are synthetic. No real omics,
									IHC, sequencing or clinical outcomes are used.
								</p>
								<p>
									Latent immune-hot / stromal / genomic subtypes generate
									correlated markers plus noise so both clustering and the forest
									have recoverable structure.
								</p>
								<p>
									<strong className="text-ink">Algorithms:</strong> covariance
									PCA via power iteration; k-means++ initialisation; random forest
									with bootstrap aggregation, √p random features and Gini splits.
									Implemented in-browser/TypeScript for demonstration — not a
									production ML stack.
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
								{MULTI_GLOSSARY.map((entry) => (
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
