import type { MetaFunction } from "@remix-run/cloudflare";
import { useMemo, useRef, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ComposedChart,
	ErrorBar,
	Legend,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ChartCard, exportSvgAsPng } from "~/components/research/ChartCard";
import {
	CHART_ACCENT,
	CHART_INK,
	CHART_LINE,
	CHART_MUTED,
	PLATFORM_COLORS,
	tooltipStyle,
} from "~/components/research/chart-theme";
import { PageHero } from "~/components/PageHero";
import {
	ALL_NEOANTIGEN_CANDIDATES,
	ALL_RESEARCH_RECORDS,
	CANCER_TYPES,
	DATASET_LABEL,
	DEFAULT_FILTERS,
	GLOSSARY,
	NUMERIC_FEATURES,
	PUBLIC_RESEARCH_LINKS,
	SYNTHETIC_SEED,
	VACCINE_PLATFORMS,
	boxSummaryByCancer,
	buildInsights,
	cancerTypeCounts,
	descriptiveStats,
	featureCorrelationMatrix,
	filterNeoantigens,
	filterResearchRecords,
	groupLabels,
	groupMeanConfidenceIntervals,
	histogramBins,
	immuneResponseByWeek,
	linearRegressionOnFeatures,
	numericFeatureLabel,
	numericFeatureUnit,
	outlierSummary,
	pearsonCorrelation,
	platformByCancerStacked,
	platformEffectSizes,
	recordsToCsv,
	regressionResidualPoints,
	spearmanCorrelation,
	welchTTestByGroup,
	type DashboardFilters,
	type NumericFeatureKey,
	type ResearchRecord,
	type StatsGroupKey,
	type VaccinePlatform,
} from "~/data/synthetic-vaccine-research";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("Cancer vaccine analytics"),
		description:
			"Interactive demonstration of biomedical data analytics for personalised cancer vaccine research using entirely synthetic data.",
		path: "/research/cancer-vaccine-analytics",
		noIndex: true,
	});
};

type SortKey = keyof ResearchRecord;

function roundHalf(value: number) {
	return Math.round(value * 100) / 100;
}

function correlationCellColor(value: number | null) {
	if (value === null) return "bg-mist text-ink-muted";
	const intensity = Math.min(1, Math.abs(value));
	if (value >= 0) {
		return intensity > 0.6
			? "bg-accent text-white"
			: intensity > 0.3
				? "bg-accent-soft text-accent-deep"
				: "bg-cream text-ink";
	}
	return intensity > 0.6
		? "bg-ink text-white"
		: intensity > 0.3
			? "bg-mist text-ink"
			: "bg-cream text-ink";
}

function toggleItem<T extends string>(list: T[], item: T): T[] {
	return list.includes(item)
		? list.filter((value) => value !== item)
		: [...list, item];
}

function downloadText(filename: string, contents: string, mime: string) {
	const blob = new Blob([contents], { type: mime });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function StatBlock({
	label,
	stats,
}: {
	label: string;
	stats: ReturnType<typeof descriptiveStats>;
}) {
	return (
		<div className="border border-line bg-cream/40 px-4 py-4">
			<p className="text-sm font-semibold text-ink">{label}</p>
			<dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-ink-soft">
				<div>
					<dt className="text-ink-muted">n</dt>
					<dd className="font-medium text-ink">{stats.n}</dd>
				</div>
				<div>
					<dt className="text-ink-muted">Unit</dt>
					<dd className="font-medium text-ink">{stats.unit}</dd>
				</div>
				<div>
					<dt className="text-ink-muted">Mean</dt>
					<dd className="font-medium text-ink">{stats.mean}</dd>
				</div>
				<div>
					<dt className="text-ink-muted">Median</dt>
					<dd className="font-medium text-ink">{stats.median}</dd>
				</div>
				<div className="col-span-2">
					<dt className="text-ink-muted">Standard deviation</dt>
					<dd className="font-medium text-ink">{stats.stdDev}</dd>
				</div>
			</dl>
		</div>
	);
}

function FilterChip({
	active,
	label,
	onClick,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			className={`filter-pill ${active ? "filter-pill-active" : ""}`}
			onClick={onClick}
		>
			{label}
		</button>
	);
}

export default function CancerVaccineAnalyticsPage() {
	const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
	const [selectedPlatforms, setSelectedPlatforms] = useState<VaccinePlatform[]>([
		...VACCINE_PLATFORMS,
	]);
	const [exploreOpen, setExploreOpen] = useState(true);
	const [methodologyOpen, setMethodologyOpen] = useState(false);
	const [glossaryOpen, setGlossaryOpen] = useState(false);
	const [sortKey, setSortKey] = useState<SortKey>("id");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
	const [statsGroupKey, setStatsGroupKey] =
		useState<StatsGroupKey>("vaccinePlatform");
	const [statsOutcome, setStatsOutcome] =
		useState<NumericFeatureKey>("immuneResponseScore");
	const [statsPredictor, setStatsPredictor] =
		useState<NumericFeatureKey>("tumourMutationalBurden");
	const [statsResponse, setStatsResponse] =
		useState<NumericFeatureKey>("immuneResponseScore");
	const [histBins, setHistBins] = useState(12);
	const [welchA, setWelchA] = useState<string>(VACCINE_PLATFORMS[0]);
	const [welchB, setWelchB] = useState<string>(VACCINE_PLATFORMS[1]);
	const [residualView, setResidualView] = useState<"scatter" | "residuals">(
		"scatter",
	);

	const cancerChartRef = useRef<HTMLDivElement>(null);
	const platformChartRef = useRef<HTMLDivElement>(null);
	const immuneChartRef = useRef<HTMLDivElement>(null);
	const biomarkerChartRef = useRef<HTMLDivElement>(null);
	const neoantigenChartRef = useRef<HTMLDivElement>(null);

	const filtered = useMemo(
		() => filterResearchRecords(ALL_RESEARCH_RECORDS, filters),
		[filters],
	);

	const neoantigens = useMemo(
		() => filterNeoantigens(ALL_NEOANTIGEN_CANDIDATES, filters.cancerTypes),
		[filters.cancerTypes],
	);

	const overview = useMemo(() => {
		const cancerSet = new Set(filtered.map((record) => record.cancerType));
		const platformSet = new Set(
			filtered.map((record) => record.vaccinePlatform),
		);
		return {
			records: filtered.length,
			cancerTypes: cancerSet.size,
			platforms: platformSet.size,
			immuneMeasurements: filtered.length,
			biomarkerMeasurements: filtered.length,
		};
	}, [filtered]);

	const cancerBars = useMemo(() => cancerTypeCounts(filtered), [filtered]);
	const stacked = useMemo(() => platformByCancerStacked(filtered), [filtered]);
	const immuneSeries = useMemo(
		() => immuneResponseByWeek(filtered, selectedPlatforms),
		[filtered, selectedPlatforms],
	);
	const immuneStats = useMemo(
		() =>
			descriptiveStats(
				filtered.map((record) => record.immuneResponseScore),
				"spots / 10⁶ PBMC",
			),
		[filtered],
	);
	const tmbStats = useMemo(
		() =>
			descriptiveStats(
				filtered.map((record) => record.tumourMutationalBurden),
				"mutations / Mb",
			),
		[filtered],
	);
	const correlation = useMemo(
		() =>
			pearsonCorrelation(
				filtered.map((record) => record.tumourMutationalBurden),
				filtered.map((record) => record.immuneResponseScore),
			),
		[filtered],
	);
	const insights = useMemo(() => buildInsights(filtered), [filtered]);
	const availableGroups = useMemo(
		() => groupLabels(filtered, statsGroupKey),
		[filtered, statsGroupKey],
	);

	const immuneHistogram = useMemo(
		() =>
			histogramBins(
				filtered.map((record) => record[statsOutcome] as number),
				histBins,
			),
		[filtered, statsOutcome, histBins],
	);
	const boxSummaries = useMemo(() => boxSummaryByCancer(filtered), [filtered]);
	const correlations = useMemo(
		() => featureCorrelationMatrix(filtered),
		[filtered],
	);
	const effectSizes = useMemo(() => platformEffectSizes(filtered), [filtered]);
	const groupCis = useMemo(
		() => groupMeanConfidenceIntervals(filtered, statsGroupKey, statsOutcome),
		[filtered, statsGroupKey, statsOutcome],
	);
	const outliers = useMemo(() => outlierSummary(filtered), [filtered]);
	const interactiveRegression = useMemo(
		() => linearRegressionOnFeatures(filtered, statsPredictor, statsResponse),
		[filtered, statsPredictor, statsResponse],
	);
	const interactivePearson = useMemo(() => {
		if (statsPredictor === statsResponse) return null;
		return pearsonCorrelation(
			filtered.map((record) => record[statsPredictor] as number),
			filtered.map((record) => record[statsResponse] as number),
		);
	}, [filtered, statsPredictor, statsResponse]);
	const interactiveSpearman = useMemo(() => {
		if (statsPredictor === statsResponse) return null;
		return spearmanCorrelation(
			filtered.map((record) => record[statsPredictor] as number),
			filtered.map((record) => record[statsResponse] as number),
		);
	}, [filtered, statsPredictor, statsResponse]);
	const residualPoints = useMemo(
		() => regressionResidualPoints(filtered, statsPredictor, statsResponse),
		[filtered, statsPredictor, statsResponse],
	);
	const safeWelchA = availableGroups.includes(welchA)
		? welchA
		: (availableGroups[0] ?? "");
	const safeWelchB =
		availableGroups.includes(welchB) && welchB !== safeWelchA
			? welchB
			: (availableGroups.find((label) => label !== safeWelchA) ??
				availableGroups[0] ??
				"");
	const welchTest = useMemo(() => {
		if (!safeWelchA || !safeWelchB || safeWelchA === safeWelchB) return null;
		return welchTTestByGroup(
			filtered,
			statsGroupKey,
			safeWelchA,
			safeWelchB,
			statsOutcome,
		);
	}, [filtered, statsGroupKey, safeWelchA, safeWelchB, statsOutcome]);
	const groupCiChart = useMemo(
		() =>
			groupCis.map((row) => ({
				group: row.group,
				mean: row.mean,
				errorHalf: roundHalf((row.ciHigh - row.ciLow) / 2),
				ciLow: row.ciLow,
				ciHigh: row.ciHigh,
				n: row.n,
			})),
		[groupCis],
	);
	const interactiveTrend = useMemo(() => {
		if (!interactiveRegression || residualPoints.length < 2) return null;
		const xs = residualPoints.map((point) => point.x);
		const xMin = Math.min(...xs);
		const xMax = Math.max(...xs);
		return [
			{
				x: xMin,
				trend:
					interactiveRegression.intercept + interactiveRegression.slope * xMin,
			},
			{
				x: xMax,
				trend:
					interactiveRegression.intercept + interactiveRegression.slope * xMax,
			},
		];
	}, [interactiveRegression, residualPoints]);

	const trendLine = useMemo(() => {
		if (filtered.length < 2 || correlation === null) return null;
		const xs = filtered.map((record) => record.tumourMutationalBurden);
		const ys = filtered.map((record) => record.immuneResponseScore);
		const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
		const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
		let num = 0;
		let den = 0;
		for (let i = 0; i < xs.length; i += 1) {
			const dx = xs[i]! - xMean;
			num += dx * (ys[i]! - yMean);
			den += dx * dx;
		}
		if (den === 0) return null;
		const slope = num / den;
		const intercept = yMean - slope * xMean;
		const xMin = Math.min(...xs);
		const xMax = Math.max(...xs);
		return [
			{ tumourMutationalBurden: xMin, trend: intercept + slope * xMin },
			{ tumourMutationalBurden: xMax, trend: intercept + slope * xMax },
		];
	}, [filtered, correlation]);

	const sortedRows = useMemo(() => {
		const rows = [...filtered];
		rows.sort((a, b) => {
			const left = a[sortKey];
			const right = b[sortKey];
			if (typeof left === "number" && typeof right === "number") {
				return sortDir === "asc" ? left - right : right - left;
			}
			return sortDir === "asc"
				? String(left).localeCompare(String(right))
				: String(right).localeCompare(String(left));
		});
		return rows;
	}, [filtered, sortKey, sortDir]);

	const neoantigenHeat = useMemo(() => {
		return neoantigens.slice(0, 16).map((candidate) => ({
			...candidate,
			label: candidate.id,
		}));
	}, [neoantigens]);

	function resetFilters() {
		setFilters(DEFAULT_FILTERS);
		setSelectedPlatforms([...VACCINE_PLATFORMS]);
		setSortKey("id");
		setSortDir("asc");
	}

	function setSort(next: SortKey) {
		if (sortKey === next) {
			setSortDir((current) => (current === "asc" ? "desc" : "asc"));
			return;
		}
		setSortKey(next);
		setSortDir("asc");
	}

	return (
		<>
			<PageHero
				eyebrow="Research Analytics Lab"
				title="Cancer Vaccine Research Analytics"
				summary="Exploring personalised cancer vaccine research through interactive data analysis and visualisation."
				accent="An interactive demonstration of biomedical data analytics using entirely synthetic research data."
			>
				<div className="mt-6 flex flex-wrap items-center gap-3">
					<span className="inline-flex items-center rounded-sm border border-accent/30 bg-accent-soft px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-accent">
						Synthetic data demonstration
					</span>
					<span className="text-sm text-ink-muted">Dataset: {DATASET_LABEL}</span>
				</div>
				<p className="mt-5 max-w-2xl text-[0.97rem] leading-relaxed text-ink-soft">
					Personalised therapeutic cancer vaccines are an active area of oncology
					research. This page demonstrates how structured biomedical datasets can
					be explored with interactive charts, filters and descriptive statistics.
					It does not report PCC clinical trial results or provide medical advice.
				</p>
			</PageHero>

			<div className="sticky top-[4.25rem] z-40 border-b border-amber-200/80 bg-amber-50/95 backdrop-blur-sm">
				<div className="site-container py-3">
					<p className="text-sm leading-relaxed text-amber-950">
						<strong className="font-semibold">Disclaimer:</strong> This dashboard
						uses entirely synthetic data for demonstration purposes. It does not
						contain patient information, represent clinical trial findings or
						provide medical advice.
					</p>
				</div>
			</div>

			<section className="content-section">
				<div className="site-container space-y-12">
					{/* Overview */}
					<div>
						<p className="eyebrow">Research overview</p>
						<h2 className="mt-3 section-title">Demonstration summary</h2>
						<div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
							{[
								{
									label: "Simulated research records",
									value: overview.records,
								},
								{
									label: "Cancer types represented",
									value: overview.cancerTypes,
								},
								{
									label: "Vaccine technology categories",
									value: overview.platforms,
								},
								{
									label: "Immune-response measurements",
									value: overview.immuneMeasurements,
								},
								{
									label: "Biomarker measurements",
									value: overview.biomarkerMeasurements,
								},
							].map((card) => (
								<div
									key={card.label}
									className="border border-line bg-cream/40 px-4 py-5"
								>
									<p className="text-3xl font-display text-ink">{card.value}</p>
									<p className="mt-2 text-sm text-ink-muted">{card.label}</p>
								</div>
							))}
						</div>
					</div>

					{/* Global filter strip */}
					<div className="border border-line bg-white px-5 py-5 sm:px-6">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="eyebrow">Filters</p>
								<p className="mt-2 text-sm text-ink-soft">
									All charts and statistics update from the same filtered
									synthetic dataset.
								</p>
							</div>
							<button
								type="button"
								className="btn-secondary !px-4 !py-2 text-sm"
								onClick={resetFilters}
							>
								Reset demonstration
							</button>
						</div>
						<div className="mt-5">
							<p className="text-sm font-semibold text-ink">Cancer type</p>
							<div className="mt-2 flex flex-wrap gap-2">
								{CANCER_TYPES.map((cancerType) => (
									<FilterChip
										key={cancerType}
										label={cancerType}
										active={filters.cancerTypes.includes(cancerType)}
										onClick={() =>
											setFilters((current) => ({
												...current,
												cancerTypes: toggleItem(
													current.cancerTypes,
													cancerType,
												),
											}))
										}
									/>
								))}
							</div>
						</div>
						<div className="mt-5">
							<p className="text-sm font-semibold text-ink">Vaccine platform</p>
							<div className="mt-2 flex flex-wrap gap-2">
								{VACCINE_PLATFORMS.map((platform) => (
									<FilterChip
										key={platform}
										label={platform}
										active={filters.platforms.includes(platform)}
										onClick={() =>
											setFilters((current) => ({
												...current,
												platforms: toggleItem(current.platforms, platform),
											}))
										}
									/>
								))}
							</div>
						</div>
					</div>

					{/* Cancer distribution */}
					<ChartCard
						title="Cancer type distribution"
						explanation="Counts of synthetic research records by cancer type in the current filter selection. Use the cancer-type filters above to focus the view."
						chartRef={cancerChartRef}
						onExportPng={() =>
							exportSvgAsPng(
								cancerChartRef.current,
								"pcc-synthetic-cancer-type-distribution.png",
							)
						}
					>
						<div className="h-72 w-full sm:h-80">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={cancerBars} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
									<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
									<XAxis
										dataKey="cancerType"
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
										interval={0}
										angle={-18}
										textAnchor="end"
										height={70}
									/>
									<YAxis
										allowDecimals={false}
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
										label={{
											value: "Record count",
											angle: -90,
											position: "insideLeft",
											fill: CHART_MUTED,
											fontSize: 12,
										}}
									/>
									<Tooltip contentStyle={tooltipStyle} />
									<Bar dataKey="count" name="Synthetic records" fill={CHART_ACCENT} />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					{/* Platform stacked */}
					<ChartCard
						title="Vaccine platform analysis"
						explanation="Illustrative distribution of synthetic records by cancer type and vaccine platform. Platform categories are shown for demonstration only and are not presented as having equivalent clinical evidence."
						chartRef={platformChartRef}
						onExportPng={() =>
							exportSvgAsPng(
								platformChartRef.current,
								"pcc-synthetic-vaccine-platform-analysis.png",
							)
						}
					>
						<div className="h-80 w-full">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={stacked} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
									<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
									<XAxis
										dataKey="cancerType"
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
										interval={0}
										angle={-18}
										textAnchor="end"
										height={70}
									/>
									<YAxis
										allowDecimals={false}
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
										label={{
											value: "Record count",
											angle: -90,
											position: "insideLeft",
											fill: CHART_MUTED,
											fontSize: 12,
										}}
									/>
									<Tooltip contentStyle={tooltipStyle} />
									<Legend />
									{VACCINE_PLATFORMS.map((platform) => (
										<Bar
											key={platform}
											dataKey={platform}
											stackId="platforms"
											fill={PLATFORM_COLORS[platform]}
										/>
									))}
								</BarChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					{/* Immune response */}
					<ChartCard
						title="Immune response analysis"
						explanation="Mean simulated immune-response scores by study week and vaccine platform. The metric is an illustrative ELISpot-style readout (spots / 10⁶ PBMC), not a measured patient outcome."
						chartRef={immuneChartRef}
						onExportPng={() =>
							exportSvgAsPng(
								immuneChartRef.current,
								"pcc-synthetic-immune-response.png",
							)
						}
						actions={
							<div className="flex flex-wrap gap-2">
								{VACCINE_PLATFORMS.map((platform) => (
									<FilterChip
										key={platform}
										label={platform}
										active={selectedPlatforms.includes(platform)}
										onClick={() =>
											setSelectedPlatforms((current) =>
												toggleItem(current, platform),
											)
										}
									/>
								))}
							</div>
						}
					>
						<div className="h-80 w-full">
							<ResponsiveContainer width="100%" height="100%">
								<LineChart
									data={immuneSeries}
									margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
								>
									<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
									<XAxis dataKey="week" tick={{ fill: CHART_MUTED, fontSize: 12 }} />
									<YAxis
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
										label={{
											value: "Mean spots / 10⁶ PBMC",
											angle: -90,
											position: "insideLeft",
											fill: CHART_MUTED,
											fontSize: 12,
										}}
									/>
									<Tooltip contentStyle={tooltipStyle} />
									<Legend />
									{selectedPlatforms.map((platform) => (
										<Line
											key={platform}
											type="monotone"
											dataKey={platform}
											stroke={PLATFORM_COLORS[platform]}
											strokeWidth={2}
											dot={{ r: 3 }}
											isAnimationActive={false}
										/>
									))}
								</LineChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					{/* Biomarker scatter */}
					<ChartCard
						title="Biomarker explorer"
						explanation="Scatter comparison of simulated tumour mutational burden and immune-response score. An observed association in synthetic data does not establish causation."
						chartRef={biomarkerChartRef}
						onExportPng={() =>
							exportSvgAsPng(
								biomarkerChartRef.current,
								"pcc-synthetic-biomarker-explorer.png",
							)
						}
					>
						<div className="mb-3 grid gap-3 sm:grid-cols-2">
							<StatBlock label="Immune-response score" stats={immuneStats} />
							<StatBlock label="Tumour mutational burden" stats={tmbStats} />
						</div>
						<p className="mb-3 px-2 text-sm text-ink-muted">
							Pearson correlation (illustrative):{" "}
							<span className="font-medium text-ink">
								{correlation === null ? "n/a" : correlation}
							</span>
						</p>
						<div className="h-80 w-full">
							<ResponsiveContainer width="100%" height="100%">
								<ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
									<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
									<XAxis
										type="number"
										dataKey="tumourMutationalBurden"
										name="TMB"
										unit=" mut/Mb"
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
										label={{
											value: "Tumour mutational burden (mutations / Mb)",
											position: "insideBottom",
											offset: -2,
											fill: CHART_MUTED,
											fontSize: 12,
										}}
									/>
									<YAxis
										type="number"
										dataKey="immuneResponseScore"
										name="Immune response"
										unit=" spots"
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
										label={{
											value: "Immune-response score (spots / 10⁶ PBMC)",
											angle: -90,
											position: "insideLeft",
											fill: CHART_MUTED,
											fontSize: 12,
										}}
									/>
									<Tooltip
										cursor={{ strokeDasharray: "3 3" }}
										contentStyle={tooltipStyle}
									/>
									<Scatter
										name="Synthetic records"
										data={filtered}
										fill={CHART_ACCENT}
										isAnimationActive={false}
									>
										{filtered.map((record) => (
											<Cell
												key={record.id}
												fill={PLATFORM_COLORS[record.vaccinePlatform]}
											/>
										))}
									</Scatter>
									{trendLine ? (
										<Scatter
											name="Trend line"
											data={trendLine}
											line={{ stroke: CHART_INK, strokeWidth: 1.5 }}
											shape={() => <circle r={0} />}
											legendType="line"
											isAnimationActive={false}
										/>
									) : null}
								</ScatterChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					{/* Neoantigen */}
					<ChartCard
						title="Neoantigen analytics"
						explanation="Ranked illustrative neoantigen candidates with predicted binding affinity, expression and prioritisation scores. This is a computational demonstration only — not a validated neoantigen selection pipeline, and no candidate is suggested for clinical use."
						chartRef={neoantigenChartRef}
						onExportPng={() =>
							exportSvgAsPng(
								neoantigenChartRef.current,
								"pcc-synthetic-neoantigen-analytics.png",
							)
						}
					>
						<div className="h-96 w-full">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									layout="vertical"
									data={neoantigenHeat}
									margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
								>
									<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
									<XAxis
										type="number"
										domain={[0, 1]}
										tick={{ fill: CHART_MUTED, fontSize: 12 }}
										label={{
											value: "Illustrative prioritisation score",
											position: "insideBottom",
											offset: -2,
											fill: CHART_MUTED,
											fontSize: 12,
										}}
									/>
									<YAxis
										type="category"
										dataKey="label"
										width={70}
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
									/>
									<Tooltip
										contentStyle={tooltipStyle}
										formatter={(value, name, item) => {
											if (name === "prioritisationScore") {
												return [value, "Prioritisation score"];
											}
											return [value, name];
										}}
										labelFormatter={(label) => {
											const row = neoantigenHeat.find((item) => item.label === label);
											if (!row) return label;
											return `${row.id} · ${row.cancerType} · affinity ${row.predictedAffinityNm} nM · expression ${row.expressionScore}`;
										}}
									/>
									<Bar
										dataKey="prioritisationScore"
										name="Prioritisation score"
										fill={CHART_ACCENT}
										isAnimationActive={false}
									/>
									<ReferenceLine x={0.5} stroke={CHART_LINE} strokeDasharray="4 4" />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					{/* Statistical analysis */}
					<section className="space-y-6">
						<div>
							<p className="eyebrow">Statistical analysis</p>
							<h2 className="mt-3 section-title">
								Interactive inferential lab
							</h2>
							<p className="mt-3 max-w-3xl text-[0.97rem] text-ink-soft">
								Choose variables, groupings and binning below. All calculations
								run on the currently filtered synthetic records only — for
								demonstration, not clinical inference.
							</p>
						</div>

						<div className="border border-line bg-white px-5 py-5 sm:px-6">
							<p className="text-sm font-semibold text-ink">Analysis controls</p>
							<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								<label className="block text-sm">
									<span className="font-semibold text-ink">Group by</span>
									<select
										className="input-field mt-2"
										value={statsGroupKey}
										onChange={(event) => {
											const next = event.target.value as StatsGroupKey;
											setStatsGroupKey(next);
											const labels = groupLabels(filtered, next);
											setWelchA(labels[0] ?? "");
											setWelchB(labels[1] ?? labels[0] ?? "");
										}}
									>
										<option value="vaccinePlatform">Vaccine platform</option>
										<option value="cancerType">Cancer type</option>
									</select>
								</label>
								<label className="block text-sm">
									<span className="font-semibold text-ink">
										Outcome (histogram / CI / t-test)
									</span>
									<select
										className="input-field mt-2"
										value={statsOutcome}
										onChange={(event) =>
											setStatsOutcome(event.target.value as NumericFeatureKey)
										}
									>
										{NUMERIC_FEATURES.map((feature) => (
											<option key={feature.key} value={feature.key}>
												{feature.label}
											</option>
										))}
									</select>
								</label>
								<label className="block text-sm">
									<span className="font-semibold text-ink">Histogram bins</span>
									<input
										type="range"
										min={6}
										max={20}
										step={1}
										className="mt-3 w-full accent-accent"
										value={histBins}
										onChange={(event) =>
											setHistBins(Number(event.target.value))
										}
										aria-valuetext={`${histBins} bins`}
									/>
									<span className="mt-1 block text-ink-muted">{histBins} bins</span>
								</label>
								<label className="block text-sm">
									<span className="font-semibold text-ink">
										Regression predictor (X)
									</span>
									<select
										className="input-field mt-2"
										value={statsPredictor}
										onChange={(event) =>
											setStatsPredictor(event.target.value as NumericFeatureKey)
										}
									>
										{NUMERIC_FEATURES.map((feature) => (
											<option key={feature.key} value={feature.key}>
												{feature.label}
											</option>
										))}
									</select>
								</label>
								<label className="block text-sm">
									<span className="font-semibold text-ink">
										Regression response (Y)
									</span>
									<select
										className="input-field mt-2"
										value={statsResponse}
										onChange={(event) =>
											setStatsResponse(event.target.value as NumericFeatureKey)
										}
									>
										{NUMERIC_FEATURES.map((feature) => (
											<option key={feature.key} value={feature.key}>
												{feature.label}
											</option>
										))}
									</select>
								</label>
								<div className="block text-sm">
									<span className="font-semibold text-ink">Fit view</span>
									<div className="mt-2 flex flex-wrap gap-2">
										<button
											type="button"
											className={`filter-pill ${residualView === "scatter" ? "filter-pill-active" : ""}`}
											aria-pressed={residualView === "scatter"}
											onClick={() => setResidualView("scatter")}
										>
											Scatter + fit
										</button>
										<button
											type="button"
											className={`filter-pill ${residualView === "residuals" ? "filter-pill-active" : ""}`}
											aria-pressed={residualView === "residuals"}
											onClick={() => setResidualView("residuals")}
										>
											Residuals
										</button>
									</div>
								</div>
							</div>
						</div>

						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<div className="border border-line bg-cream/40 px-4 py-4">
								<p className="text-sm text-ink-muted">Sample size (n)</p>
								<p className="mt-1 font-display text-3xl text-ink">
									{filtered.length}
								</p>
							</div>
							<div className="border border-line bg-cream/40 px-4 py-4">
								<p className="text-sm text-ink-muted">Outliers (|z| &gt; 2)</p>
								<p className="mt-1 font-display text-3xl text-ink">
									{outliers.outliers}
								</p>
								<p className="mt-1 text-xs text-ink-muted">
									Threshold ±{outliers.threshold} spots / 10⁶ PBMC
								</p>
							</div>
							<div className="border border-line bg-cream/40 px-4 py-4">
								<p className="text-sm text-ink-muted">
									OLS R² ({numericFeatureLabel(statsResponse)} ~{" "}
									{numericFeatureLabel(statsPredictor)})
								</p>
								<p className="mt-1 font-display text-3xl text-ink">
									{interactiveRegression
										? interactiveRegression.rSquared
										: "n/a"}
								</p>
								<p className="mt-1 text-xs text-ink-muted">
									{interactiveRegression
										? `slope ${interactiveRegression.slope} · residual SE ${interactiveRegression.residualStdErr}`
										: "Choose distinct X/Y with ≥3 records"}
								</p>
							</div>
							<div className="border border-line bg-cream/40 px-4 py-4">
								<p className="text-sm text-ink-muted">Pearson / Spearman r</p>
								<p className="mt-1 font-display text-3xl text-ink">
									{interactivePearson === null ? "n/a" : interactivePearson}
								</p>
								<p className="mt-1 text-xs text-ink-muted">
									Spearman{" "}
									{interactiveSpearman === null ? "n/a" : interactiveSpearman}
								</p>
							</div>
						</div>

						<div className="grid gap-6 lg:grid-cols-2">
							<ChartCard
								title={`${numericFeatureLabel(statsOutcome)} distribution`}
								explanation={`Histogram of ${numericFeatureLabel(statsOutcome).toLowerCase()} (${numericFeatureUnit(statsOutcome)}) in the current filter set. Adjust bins in the controls above.`}
							>
								<div className="h-64 w-full">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart data={immuneHistogram}>
											<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
											<XAxis
												dataKey="binLabel"
												tick={{ fill: CHART_MUTED, fontSize: 10 }}
												interval={1}
												angle={-25}
												textAnchor="end"
												height={60}
											/>
											<YAxis
												allowDecimals={false}
												tick={{ fill: CHART_MUTED, fontSize: 12 }}
											/>
											<Tooltip contentStyle={tooltipStyle} />
											<Bar
												dataKey="count"
												name="Records"
												fill={CHART_ACCENT}
												isAnimationActive={false}
											/>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</ChartCard>

							<ChartCard
								title="IQR summary by cancer type"
								explanation="Interquartile range (Q1–Q3) and median of simulated immune-response scores by cancer type. Useful for comparing spread without implying clinical superiority."
							>
								<div className="h-64 w-full">
									<ResponsiveContainer width="100%" height="100%">
										<ComposedChart data={boxSummaries}>
											<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
											<XAxis
												dataKey="cancerType"
												tick={{ fill: CHART_MUTED, fontSize: 11 }}
												interval={0}
												angle={-18}
												textAnchor="end"
												height={60}
											/>
											<YAxis tick={{ fill: CHART_MUTED, fontSize: 12 }} />
											<Tooltip contentStyle={tooltipStyle} />
											<Bar
												dataKey="iqrLow"
												stackId="iqr"
												fill="transparent"
												isAnimationActive={false}
											/>
											<Bar
												dataKey="iqrSize"
												name="IQR (Q1–Q3)"
												stackId="iqr"
												fill={CHART_ACCENT}
												isAnimationActive={false}
											/>
											<Line
												type="monotone"
												dataKey="median"
												name="Median"
												stroke={CHART_INK}
												strokeWidth={2}
												dot={{ r: 3 }}
												isAnimationActive={false}
											/>
										</ComposedChart>
									</ResponsiveContainer>
								</div>
							</ChartCard>
						</div>

						<div className="grid gap-6 lg:grid-cols-2">
							<ChartCard
								title={`Group means with 95% CI (${numericFeatureLabel(statsOutcome)})`}
								explanation="Mean of the selected outcome by the chosen grouping, with approximate 95% confidence intervals (normal approximation). Intervals describe the synthetic sample, not clinical efficacy."
							>
								<div className="h-72 w-full">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart data={groupCiChart}>
											<CartesianGrid stroke={CHART_LINE} strokeDasharray="3 3" />
											<XAxis
												dataKey="group"
												tick={{ fill: CHART_MUTED, fontSize: 11 }}
												interval={0}
												angle={-15}
												textAnchor="end"
												height={70}
											/>
											<YAxis tick={{ fill: CHART_MUTED, fontSize: 12 }} />
											<Tooltip
												contentStyle={tooltipStyle}
												formatter={(value, name, item) => {
													if (name === "mean") {
														const row = item?.payload as {
															ciLow?: number;
															ciHigh?: number;
															n?: number;
														};
														return [
															`${value} (95% CI ${row.ciLow}–${row.ciHigh}; n=${row.n})`,
															"Mean",
														];
													}
													return [value, name];
												}}
											/>
											<Bar
												dataKey="mean"
												name="mean"
												fill={CHART_ACCENT}
												isAnimationActive={false}
											>
												{groupCiChart.map((row) => (
													<Cell
														key={row.group}
														fill={
															statsGroupKey === "vaccinePlatform"
																? PLATFORM_COLORS[row.group as VaccinePlatform]
																: CHART_ACCENT
														}
													/>
												))}
												<ErrorBar
													dataKey="errorHalf"
													width={5}
													strokeWidth={1.5}
													stroke={CHART_INK}
												/>
											</Bar>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</ChartCard>

							<div className="border border-line bg-white">
								<div className="border-b border-line px-5 py-4 sm:px-6">
									<h3 className="font-display text-xl text-ink sm:text-2xl">
										Feature correlation matrix
									</h3>
									<p className="mt-1 text-sm text-ink-muted">
										Click a cell to set regression X → Y
									</p>
								</div>
								<div className="overflow-x-auto px-5 py-5 sm:px-6">
									<table className="min-w-full border-collapse text-center text-sm">
										<thead>
											<tr>
												<th className="px-2 py-2 text-left text-ink-muted" />
												{correlations[0]?.cells.map((cell) => (
													<th
														key={cell.feature}
														className="px-2 py-2 font-semibold text-ink-muted"
													>
														{cell.feature}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{correlations.map((row) => (
												<tr key={row.feature}>
													<th
														scope="row"
														className="px-2 py-2 text-left font-semibold text-ink"
													>
														{row.feature}
													</th>
													{row.cells.map((cell) => {
														const xKey = NUMERIC_FEATURES.find(
															(feature) => feature.label === cell.feature,
														)?.key;
														const yKey = NUMERIC_FEATURES.find(
															(feature) => feature.label === row.feature,
														)?.key;
														const selected =
															xKey === statsPredictor && yKey === statsResponse;
														return (
															<td key={cell.feature} className="px-1 py-1">
																<button
																	type="button"
																	disabled={!xKey || !yKey || xKey === yKey}
																	className={`inline-flex min-w-[3.5rem] justify-center rounded-sm px-2 py-2 tabular-nums transition ${correlationCellColor(cell.value)} ${selected ? "ring-2 ring-accent ring-offset-1" : ""} disabled:cursor-default`}
																	onClick={() => {
																		if (!xKey || !yKey || xKey === yKey) return;
																		setStatsPredictor(xKey);
																		setStatsResponse(yKey);
																	}}
																	aria-label={
																		xKey && yKey && xKey !== yKey
																			? `Set regression ${cell.feature} predicting ${row.feature}`
																			: undefined
																	}
																>
																	{cell.value === null ? "—" : cell.value}
																</button>
															</td>
														);
													})}
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<p className="border-t border-line px-5 py-4 text-sm text-ink-soft sm:px-6">
									Correlation does not imply causation. Values refresh with the
									current filter selection.
								</p>
							</div>
						</div>

						<div className="grid gap-6 lg:grid-cols-2">
							<div className="border border-line bg-white px-5 py-6 sm:px-6">
								<h3 className="font-display text-xl text-ink">
									Welch’s t-test
								</h3>
								<p className="mt-2 text-sm text-ink-soft">
									Compare mean {numericFeatureLabel(statsOutcome).toLowerCase()}{" "}
									between two groups in the current filter set.
								</p>
								<div className="mt-4 grid gap-3 sm:grid-cols-2">
									<label className="block text-sm">
										<span className="font-semibold text-ink">Group A</span>
										<select
											className="input-field mt-2"
											value={safeWelchA}
											onChange={(event) => setWelchA(event.target.value)}
										>
											{availableGroups.map((label) => (
												<option key={label} value={label}>
													{label}
												</option>
											))}
										</select>
									</label>
									<label className="block text-sm">
										<span className="font-semibold text-ink">Group B</span>
										<select
											className="input-field mt-2"
											value={safeWelchB}
											onChange={(event) => setWelchB(event.target.value)}
										>
											{availableGroups.map((label) => (
												<option key={label} value={label}>
													{label}
												</option>
											))}
										</select>
									</label>
								</div>
								{welchTest ? (
									<dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
										<div>
											<dt className="text-ink-muted">nₐ / nᵦ</dt>
											<dd className="font-medium text-ink">
												{welchTest.nA} / {welchTest.nB}
											</dd>
										</div>
										<div>
											<dt className="text-ink-muted">Mean difference</dt>
											<dd className="font-medium text-ink">
												{welchTest.meanDiff}
											</dd>
										</div>
										<div>
											<dt className="text-ink-muted">t statistic</dt>
											<dd className="font-medium text-ink">
												{welchTest.tStatistic}
											</dd>
										</div>
										<div>
											<dt className="text-ink-muted">df (Welch)</dt>
											<dd className="font-medium text-ink">
												{welchTest.degreesOfFreedom}
											</dd>
										</div>
										<div>
											<dt className="text-ink-muted">Approx. p-value</dt>
											<dd className="font-medium text-ink">
												{welchTest.pValueApprox}
											</dd>
										</div>
										<div>
											<dt className="text-ink-muted">Cohen’s d</dt>
											<dd className="font-medium text-ink">
												{welchTest.cohensD}
											</dd>
										</div>
									</dl>
								) : (
									<p className="mt-4 text-sm text-ink-muted">
										Select two different groups with ≥2 records each.
									</p>
								)}
								<p className="mt-4 text-xs leading-relaxed text-ink-muted">
									P-values use a normal approximation for demonstration reporting
									on synthetic data — not a clinical significance claim.
								</p>
							</div>

							<div className="border border-line bg-white px-5 py-6 sm:px-6">
								<h3 className="font-display text-xl text-ink">
									Effect sizes (platforms)
								</h3>
								<ul className="mt-4 space-y-2 text-sm text-ink-soft">
									{effectSizes.map((row) => (
										<li
											key={row.platform}
											className="flex items-center justify-between gap-3 border-b border-line/70 py-2"
										>
											<span>{row.platform}</span>
											<span className="tabular-nums font-medium text-ink">
												d={row.cohensD} · mean {row.mean} · n={row.n}
											</span>
										</li>
									))}
								</ul>
								{interactiveRegression && statsPredictor !== statsResponse ? (
									<p className="mt-4 text-sm leading-relaxed text-ink-soft">
										Linear model{" "}
										<span className="font-medium text-ink">
											{numericFeatureLabel(statsResponse)} ≈{" "}
											{interactiveRegression.intercept} +{" "}
											{interactiveRegression.slope} ×{" "}
											{numericFeatureLabel(statsPredictor)}
										</span>{" "}
										(R²={interactiveRegression.rSquared}, n=
										{interactiveRegression.n}). Residual SE{" "}
										{interactiveRegression.residualStdErr}{" "}
										{numericFeatureUnit(statsResponse)}.
									</p>
								) : (
									<p className="mt-4 text-sm text-ink-muted">
										Pick distinct predictor and response variables to fit OLS.
									</p>
								)}
							</div>
						</div>

						<ChartCard
							title={
								residualView === "scatter"
									? `OLS fit: ${numericFeatureLabel(statsResponse)} ~ ${numericFeatureLabel(statsPredictor)}`
									: `Residuals vs fitted (${numericFeatureLabel(statsResponse)})`
							}
							explanation={
								residualView === "scatter"
									? "Interactive scatter of the selected Y against X with the ordinary least-squares trend line. Toggle to residuals to inspect model fit."
									: "Residuals (observed − fitted) against fitted values. A structureless cloud is consistent with a simple linear model on this synthetic sample."
							}
						>
							<div className="h-80 w-full">
								{statsPredictor === statsResponse ||
								residualPoints.length < 3 ? (
									<p className="flex h-full items-center justify-center text-sm text-ink-muted">
										Select two different numeric variables with enough filtered
										records to plot the fit.
									</p>
								) : (
									<ResponsiveContainer width="100%" height="100%">
										{residualView === "scatter" ? (
											<ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
												<CartesianGrid
													stroke={CHART_LINE}
													strokeDasharray="3 3"
												/>
												<XAxis
													type="number"
													dataKey="x"
													name={numericFeatureLabel(statsPredictor)}
													tick={{ fill: CHART_MUTED, fontSize: 12 }}
												/>
												<YAxis
													type="number"
													dataKey="y"
													name={numericFeatureLabel(statsResponse)}
													tick={{ fill: CHART_MUTED, fontSize: 12 }}
												/>
												<Tooltip contentStyle={tooltipStyle} />
												<Scatter
													data={residualPoints}
													fill={CHART_ACCENT}
													fillOpacity={0.55}
													name="Records"
													isAnimationActive={false}
												/>
												{interactiveTrend ? (
													<Scatter
														name="OLS fit"
														data={interactiveTrend.map((point) => ({
															x: point.x,
															y: point.trend,
														}))}
														line={{ stroke: CHART_INK, strokeWidth: 1.5 }}
														shape={() => <circle r={0} />}
														legendType="line"
														isAnimationActive={false}
													/>
												) : null}
											</ScatterChart>
										) : (
											<ScatterChart data={residualPoints}>
												<CartesianGrid
													stroke={CHART_LINE}
													strokeDasharray="3 3"
												/>
												<XAxis
													type="number"
													dataKey="fitted"
													name="Fitted"
													tick={{ fill: CHART_MUTED, fontSize: 12 }}
												/>
												<YAxis
													type="number"
													dataKey="residual"
													name="Residual"
													tick={{ fill: CHART_MUTED, fontSize: 12 }}
												/>
												<Tooltip contentStyle={tooltipStyle} />
												<ReferenceLine y={0} stroke={CHART_INK} />
												<Scatter
													fill={CHART_ACCENT}
													fillOpacity={0.55}
													name="Residual"
													isAnimationActive={false}
												/>
											</ScatterChart>
										)}
									</ResponsiveContainer>
								)}
							</div>
						</ChartCard>
					</section>

					{/* Explore the data */}
					<div className="border border-line bg-white">
						<button
							type="button"
							className="flex w-full items-center justify-between px-5 py-5 text-left sm:px-6"
							aria-expanded={exploreOpen}
							onClick={() => setExploreOpen((open) => !open)}
						>
							<div>
								<p className="eyebrow">Explore the data</p>
								<h2 className="mt-2 section-title">Filter, inspect and export</h2>
							</div>
							<span className="text-accent" aria-hidden="true">
								{exploreOpen ? "−" : "+"}
							</span>
						</button>
						{exploreOpen ? (
							<div className="space-y-6 border-t border-line px-5 py-6 sm:px-6">
								<div className="grid gap-4 md:grid-cols-2">
									<label className="block text-sm">
										<span className="font-semibold text-ink">
											TMB range (mutations / Mb)
										</span>
										<div className="mt-2 flex gap-2">
											<input
												type="number"
												min={0}
												max={50}
												step={0.5}
												className="input-field"
												value={filters.tmbMin}
												onChange={(event) =>
													setFilters((current) => ({
														...current,
														tmbMin: Number(event.target.value),
													}))
												}
												aria-label="Minimum tumour mutational burden"
											/>
											<input
												type="number"
												min={0}
												max={50}
												step={0.5}
												className="input-field"
												value={filters.tmbMax}
												onChange={(event) =>
													setFilters((current) => ({
														...current,
														tmbMax: Number(event.target.value),
													}))
												}
												aria-label="Maximum tumour mutational burden"
											/>
										</div>
									</label>
									<label className="block text-sm">
										<span className="font-semibold text-ink">
											Immune-response range (spots / 10⁶ PBMC)
										</span>
										<div className="mt-2 flex gap-2">
											<input
												type="number"
												min={0}
												max={200}
												step={1}
												className="input-field"
												value={filters.immuneMin}
												onChange={(event) =>
													setFilters((current) => ({
														...current,
														immuneMin: Number(event.target.value),
													}))
												}
												aria-label="Minimum immune-response score"
											/>
											<input
												type="number"
												min={0}
												max={200}
												step={1}
												className="input-field"
												value={filters.immuneMax}
												onChange={(event) =>
													setFilters((current) => ({
														...current,
														immuneMax: Number(event.target.value),
													}))
												}
												aria-label="Maximum immune-response score"
											/>
										</div>
									</label>
								</div>

								<label className="block text-sm">
									<span className="font-semibold text-ink">
										Search research records
									</span>
									<input
										type="search"
										className="input-field mt-2"
										placeholder="Search by ID, cancer type or platform"
										value={filters.search}
										onChange={(event) =>
											setFilters((current) => ({
												...current,
												search: event.target.value,
											}))
										}
									/>
								</label>

								<div className="flex flex-wrap gap-3">
									<button
										type="button"
										className="btn-primary"
										onClick={() =>
											downloadText(
												"pcc-synthetic-vaccine-research.csv",
												recordsToCsv(sortedRows),
												"text/csv;charset=utf-8",
											)
										}
									>
										Export filtered CSV
									</button>
									<button
										type="button"
										className="btn-secondary"
										onClick={resetFilters}
									>
										Reset filters
									</button>
								</div>

								<div className="rounded-sm border border-line">
									<table className="w-full table-fixed border-collapse text-left text-sm">
										<caption className="sr-only">
											Sortable table of filtered synthetic research records
										</caption>
										<colgroup>
											<col className="w-[12%]" />
											<col className="w-[22%]" />
											<col className="w-[24%]" />
											<col className="w-[10%]" />
											<col className="w-[16%]" />
											<col className="w-[16%]" />
										</colgroup>
										<thead className="bg-white">
											<tr className="border-b border-line text-ink-muted">
												{(
													[
														["id", "ID"],
														["cancerType", "Cancer type"],
														["vaccinePlatform", "Platform"],
														["week", "Week"],
														["immuneResponseScore", "Immune score"],
														["tumourMutationalBurden", "TMB"],
													] as const
												).map(([key, label]) => (
													<th
														key={key}
														scope="col"
														className="px-3 py-3 font-semibold"
													>
														<button
															type="button"
															className="hover:text-accent"
															onClick={() => setSort(key)}
														>
															{label}
															{sortKey === key
																? sortDir === "asc"
																	? " ↑"
																	: " ↓"
																: ""}
														</button>
													</th>
												))}
											</tr>
										</thead>
									</table>
									<div className="max-h-72 overflow-y-auto">
										<table className="w-full table-fixed border-collapse text-left text-sm">
											<colgroup>
												<col className="w-[12%]" />
												<col className="w-[22%]" />
												<col className="w-[24%]" />
												<col className="w-[10%]" />
												<col className="w-[16%]" />
												<col className="w-[16%]" />
											</colgroup>
											<tbody>
												{sortedRows.map((row) => (
													<tr
														key={row.id}
														className="border-b border-line/70 text-ink-soft"
													>
														<td className="px-3 py-2 font-medium text-ink">
															{row.id}
														</td>
														<td className="px-3 py-2">{row.cancerType}</td>
														<td className="px-3 py-2">
															{row.vaccinePlatform}
														</td>
														<td className="px-3 py-2">{row.week}</td>
														<td className="px-3 py-2">
															{row.immuneResponseScore}
														</td>
														<td className="px-3 py-2">
															{row.tumourMutationalBurden}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
								<p className="text-sm text-ink-muted">
									Scroll to browse all {sortedRows.length} filtered synthetic
									records. Export CSV for offline analysis.
								</p>
							</div>
						) : null}
					</div>

					{/* Insights */}
					<section className="border border-line bg-cream/40 px-5 py-7 sm:px-8">
						<p className="eyebrow">Automated Descriptive Analytics</p>
						<h2 className="mt-3 section-title">Understanding the visualisations</h2>
						<p className="mt-3 max-w-3xl text-[0.97rem] text-ink-soft">
							Rule-based summaries of the currently filtered synthetic dataset.
							These statements are generated deterministically from the data
							above — not by an external AI service — and are not clinical
							predictions or treatment recommendations.
						</p>
						<ul className="mt-6 space-y-3 text-[0.97rem] leading-relaxed text-ink-soft">
							{insights.map((insight) => (
								<li key={insight} className="border-l-2 border-accent pl-4">
									{insight}
								</li>
							))}
						</ul>
					</section>

					{/* Methodology */}
					<div className="border border-line bg-white">
						<button
							type="button"
							className="flex w-full items-center justify-between px-5 py-5 text-left sm:px-6"
							aria-expanded={methodologyOpen}
							onClick={() => setMethodologyOpen((open) => !open)}
						>
							<div>
								<p className="eyebrow">Transparency</p>
								<h2 className="mt-2 section-title">Data Sources &amp; Methodology</h2>
							</div>
							<span className="text-accent" aria-hidden="true">
								{methodologyOpen ? "−" : "+"}
							</span>
						</button>
						{methodologyOpen ? (
							<div className="space-y-4 border-t border-line px-5 py-6 text-[0.97rem] leading-relaxed text-ink-soft sm:px-6">
								<p>
									All dashboard observations are synthetic. No real patient
									information is used. Values are generated solely to demonstrate
									software capability for biomedical analytics presentation.
								</p>
								<p>
									Synthetic values are not estimates of real-world treatment
									efficacy. The dashboard is not validated for clinical
									decision-making. Statistical associations are illustrative.
								</p>
								<p>
									<strong className="text-ink">Schema:</strong> each research
									record includes an identifier, cancer type, vaccine platform,
									study week, simulated immune-response score (spots / 10⁶ PBMC)
									and simulated tumour mutational burden (mutations / Mb).
									Neoantigen candidates include predicted affinity (nM),
									expression score and an illustrative prioritisation score.
								</p>
								<p>
									<strong className="text-ink">Generation:</strong> a seeded
									pseudo-random generator (seed {SYNTHETIC_SEED}) produces a
									fixed demonstration dataset so the same values appear on each
									page load.
								</p>
								<p>
									<strong className="text-ink">Statistics:</strong> means,
									medians and sample standard deviations are calculated from the
									currently filtered records. The interactive lab supports
									Pearson and Spearman correlation, OLS regression with residual
									plots, Welch’s t-tests, Cohen’s d, histograms and approximate
									95% confidence intervals on synthetic fields you select.
								</p>
								<p>
									<strong className="text-ink">Limitations:</strong> distributions
									are invented for UX demonstration; platform categories are not
									evidence-weighted; neoantigen ranking is not a validated
									pipeline; and no clinical conclusions should be drawn.
								</p>
							</div>
						) : null}
					</div>

					{/* Public research */}
					<section>
						<p className="eyebrow">External resources</p>
						<h2 className="mt-3 section-title">Explore Public Research</h2>
						<p className="mt-3 max-w-3xl text-[0.97rem] text-ink-soft">
							These links lead to authoritative external research resources.
							The synthetic dashboard data were not obtained from these sources.
						</p>
						<ul className="mt-6 grid gap-3 md:grid-cols-2">
							{PUBLIC_RESEARCH_LINKS.map((link) => (
								<li key={link.href} className="border border-line bg-white px-5 py-5">
									<a
										href={link.href}
										target="_blank"
										rel="noreferrer"
										className="font-semibold text-ink transition-colors hover:text-accent"
									>
										{link.label}
									</a>
									<p className="mt-2 text-sm text-ink-muted">{link.note}</p>
								</li>
							))}
						</ul>
					</section>

					{/* Capabilities */}
					<section className="border border-line bg-cream/40 px-5 py-7 sm:px-8">
						<p className="eyebrow">Capability demonstration</p>
						<h2 className="mt-3 section-title">Our Data Analytics Capabilities</h2>
						<p className="mt-3 max-w-3xl text-[0.97rem] text-ink-soft">
							This page demonstrates technical approaches Personalised Cancer Care
							can apply when presenting structured biomedical information. It does
							not claim that PCC has conducted cancer vaccine clinical trials,
							developed an approved vaccine, validated a clinical prediction model,
							demonstrated treatment effectiveness, or established a commercial
							bioinformatics service.
						</p>
						<ul className="mt-6 grid gap-3 sm:grid-cols-2">
							{[
								"Biomedical data processing",
								"Interactive visualisation",
								"Exploratory statistical analysis",
								"Data filtering and comparison",
								"Research data presentation",
								"Reproducible analytical workflows",
							].map((item) => (
								<li
									key={item}
									className="border border-line bg-white px-4 py-3 text-[0.97rem] text-ink"
								>
									{item}
								</li>
							))}
						</ul>
					</section>

					{/* Glossary */}
					<div className="border border-line bg-white">
						<button
							type="button"
							className="flex w-full items-center justify-between px-5 py-5 text-left sm:px-6"
							aria-expanded={glossaryOpen}
							onClick={() => setGlossaryOpen((open) => !open)}
						>
							<div>
								<p className="eyebrow">Reference</p>
								<h2 className="mt-2 section-title">Research glossary</h2>
							</div>
							<span className="text-accent" aria-hidden="true">
								{glossaryOpen ? "−" : "+"}
							</span>
						</button>
						{glossaryOpen ? (
							<dl className="space-y-5 border-t border-line px-5 py-6 sm:px-6">
								{GLOSSARY.map((entry) => (
									<div key={entry.term}>
										<dt className="font-semibold text-ink">{entry.term}</dt>
										<dd className="mt-1 text-[0.97rem] leading-relaxed text-ink-soft">
											{entry.definition}
										</dd>
									</div>
								))}
							</dl>
						) : null}
					</div>

					<p className="text-sm text-ink-muted">
						Dataset: {DATASET_LABEL}. Seed {SYNTHETIC_SEED}. No visitor health
						information is collected on this page.
					</p>
				</div>
			</section>
		</>
	);
}
