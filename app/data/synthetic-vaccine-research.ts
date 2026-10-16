/**
 * Synthetic cancer-vaccine research demonstration dataset.
 * Fixed seed → reproducible values. No real patient or trial data.
 */

export const DATASET_LABEL = "Synthetic demonstration data" as const;
export const SYNTHETIC_SEED = 20261016;

export const CANCER_TYPES = [
	"Melanoma",
	"Pancreatic cancer",
	"Colorectal cancer",
	"Lung cancer",
	"Renal cancer",
] as const;

export const VACCINE_PLATFORMS = [
	"Personalised mRNA",
	"Neoantigen peptide",
	"Dendritic cell",
	"Other investigational",
] as const;

export type CancerType = (typeof CANCER_TYPES)[number];
export type VaccinePlatform = (typeof VACCINE_PLATFORMS)[number];

export type ResearchRecord = {
	id: string;
	cancerType: CancerType;
	vaccinePlatform: VaccinePlatform;
	/** Simulated ELISpot-style measurement (spots / 10⁶ PBMC). */
	immuneResponseScore: number;
	/** Simulated tumour mutational burden (mutations / Mb). */
	tumourMutationalBurden: number;
	week: 0 | 4 | 8 | 12;
};

export type NeoantigenCandidate = {
	id: string;
	cancerType: CancerType;
	/** Illustrative predicted binding affinity (nM); lower = stronger in this demo. */
	predictedAffinityNm: number;
	/** Illustrative expression score (arbitrary units 0–100). */
	expressionScore: number;
	/** Illustrative prioritisation score (0–1). */
	prioritisationScore: number;
};

export type DashboardFilters = {
	cancerTypes: CancerType[];
	platforms: VaccinePlatform[];
	tmbMin: number;
	tmbMax: number;
	immuneMin: number;
	immuneMax: number;
	search: string;
};

export type DescriptiveStats = {
	n: number;
	mean: number;
	median: number;
	stdDev: number;
	unit: string;
};

/** Mulberry32 — deterministic PRNG for reproducible synthetic data. */
function createRng(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pick<T>(rng: () => number, items: readonly T[]): T {
	return items[Math.floor(rng() * items.length)]!;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 1) {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

function generateRecords(rng: () => number, count = 180): ResearchRecord[] {
	const records: ResearchRecord[] = [];
	const weeks: Array<0 | 4 | 8 | 12> = [0, 4, 8, 12];

	for (let i = 0; i < count; i += 1) {
		const cancerType = pick(rng, CANCER_TYPES);
		const vaccinePlatform = pick(rng, VACCINE_PLATFORMS);
		const week = pick(rng, weeks);

		const platformBoost =
			vaccinePlatform === "Personalised mRNA"
				? 18
				: vaccinePlatform === "Neoantigen peptide"
					? 12
					: vaccinePlatform === "Dendritic cell"
						? 8
						: 4;
		const weekBoost = week * 1.8;
		const cancerBase =
			cancerType === "Melanoma"
				? 42
				: cancerType === "Lung cancer"
					? 36
					: cancerType === "Colorectal cancer"
						? 30
						: cancerType === "Renal cancer"
							? 28
							: 24;

		const immuneResponseScore = round(
			clamp(cancerBase + platformBoost + weekBoost + (rng() - 0.5) * 28, 5, 160),
			1,
		);
		const tumourMutationalBurden = round(
			clamp(
				(cancerType === "Melanoma" || cancerType === "Lung cancer" ? 12 : 5) +
					rng() * 18 +
					(rng() - 0.4) * 6,
				0.5,
				45,
			),
			1,
		);

		records.push({
			id: `SYN-${String(i + 1).padStart(3, "0")}`,
			cancerType,
			vaccinePlatform,
			immuneResponseScore,
			tumourMutationalBurden,
			week,
		});
	}

	return records;
}

function generateNeoantigens(
	rng: () => number,
	count = 40,
): NeoantigenCandidate[] {
	const candidates: NeoantigenCandidate[] = [];
	for (let i = 0; i < count; i += 1) {
		const cancerType = pick(rng, CANCER_TYPES);
		const predictedAffinityNm = round(clamp(8 + rng() * 420, 5, 500), 1);
		const expressionScore = round(clamp(15 + rng() * 80, 5, 100), 1);
		// Illustrative score: favour stronger affinity + higher expression.
		const prioritisationScore = round(
			clamp(
				0.15 * (expressionScore / 100) +
					0.55 * (1 - predictedAffinityNm / 500) +
					0.15 * rng(),
				0.05,
				0.98,
			),
			3,
		);
		candidates.push({
			id: `NA-${String(i + 1).padStart(3, "0")}`,
			cancerType,
			predictedAffinityNm,
			expressionScore,
			prioritisationScore,
		});
	}
	return candidates.sort((a, b) => b.prioritisationScore - a.prioritisationScore);
}

const rng = createRng(SYNTHETIC_SEED);
export const ALL_RESEARCH_RECORDS = generateRecords(rng);
export const ALL_NEOANTIGEN_CANDIDATES = generateNeoantigens(rng);

export const DEFAULT_FILTERS: DashboardFilters = {
	cancerTypes: [...CANCER_TYPES],
	platforms: [...VACCINE_PLATFORMS],
	tmbMin: 0,
	tmbMax: 50,
	immuneMin: 0,
	immuneMax: 200,
	search: "",
};

export function filterResearchRecords(
	records: readonly ResearchRecord[],
	filters: DashboardFilters,
): ResearchRecord[] {
	const query = filters.search.trim().toLowerCase();
	return records.filter((record) => {
		if (!filters.cancerTypes.includes(record.cancerType)) return false;
		if (!filters.platforms.includes(record.vaccinePlatform)) return false;
		if (
			record.tumourMutationalBurden < filters.tmbMin ||
			record.tumourMutationalBurden > filters.tmbMax
		) {
			return false;
		}
		if (
			record.immuneResponseScore < filters.immuneMin ||
			record.immuneResponseScore > filters.immuneMax
		) {
			return false;
		}
		if (!query) return true;
		return (
			record.id.toLowerCase().includes(query) ||
			record.cancerType.toLowerCase().includes(query) ||
			record.vaccinePlatform.toLowerCase().includes(query)
		);
	});
}

export function filterNeoantigens(
	candidates: readonly NeoantigenCandidate[],
	cancerTypes: readonly CancerType[],
): NeoantigenCandidate[] {
	return candidates.filter((candidate) =>
		cancerTypes.includes(candidate.cancerType),
	);
}

function mean(values: number[]) {
	if (values.length === 0) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return (sorted[mid - 1]! + sorted[mid]!) / 2;
	}
	return sorted[mid]!;
}

function stdDev(values: number[]) {
	if (values.length < 2) return 0;
	const avg = mean(values);
	const variance =
		values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
		(values.length - 1);
	return Math.sqrt(variance);
}

export function descriptiveStats(
	values: number[],
	unit: string,
): DescriptiveStats {
	return {
		n: values.length,
		mean: round(mean(values), 2),
		median: round(median(values), 2),
		stdDev: round(stdDev(values), 2),
		unit,
	};
}

export function cancerTypeCounts(records: readonly ResearchRecord[]) {
	return CANCER_TYPES.map((cancerType) => ({
		cancerType,
		count: records.filter((record) => record.cancerType === cancerType).length,
	}));
}

export function platformByCancerStacked(records: readonly ResearchRecord[]) {
	return CANCER_TYPES.map((cancerType) => {
		const row: Record<string, string | number> = { cancerType };
		for (const platform of VACCINE_PLATFORMS) {
			row[platform] = records.filter(
				(record) =>
					record.cancerType === cancerType &&
					record.vaccinePlatform === platform,
			).length;
		}
		return row;
	});
}

export function immuneResponseByWeek(
	records: readonly ResearchRecord[],
	platforms: readonly VaccinePlatform[],
) {
	const weeks: Array<0 | 4 | 8 | 12> = [0, 4, 8, 12];
	return weeks.map((week) => {
		const point: Record<string, string | number> = { week: `Week ${week}` };
		for (const platform of platforms) {
			const values = records
				.filter(
					(record) =>
						record.week === week && record.vaccinePlatform === platform,
				)
				.map((record) => record.immuneResponseScore);
			point[platform] = values.length ? round(mean(values), 1) : 0;
			point[`${platform} n`] = values.length;
		}
		return point;
	});
}

export const NUMERIC_FEATURES = [
	{
		key: "immuneResponseScore",
		label: "Immune score",
		unit: "spots / 10⁶ PBMC",
	},
	{
		key: "tumourMutationalBurden",
		label: "TMB",
		unit: "mutations / Mb",
	},
	{
		key: "week",
		label: "Week",
		unit: "weeks",
	},
] as const;

export type NumericFeatureKey = (typeof NUMERIC_FEATURES)[number]["key"];

export type StatsGroupKey = "vaccinePlatform" | "cancerType";

export function numericFeatureLabel(key: NumericFeatureKey) {
	return NUMERIC_FEATURES.find((feature) => feature.key === key)?.label ?? key;
}

export function numericFeatureUnit(key: NumericFeatureKey) {
	return NUMERIC_FEATURES.find((feature) => feature.key === key)?.unit ?? "";
}

export function groupLabels(
	records: readonly ResearchRecord[],
	groupKey: StatsGroupKey,
): string[] {
	const labels =
		groupKey === "vaccinePlatform"
			? [...VACCINE_PLATFORMS]
			: [...CANCER_TYPES];
	return labels.filter((label) =>
		records.some((record) => record[groupKey] === label),
	);
}

/** Pearson correlation for illustrative association summaries. */
export function pearsonCorrelation(xs: number[], ys: number[]) {
	const n = Math.min(xs.length, ys.length);
	if (n < 3) return null;
	const x = xs.slice(0, n);
	const y = ys.slice(0, n);
	const mx = mean(x);
	const my = mean(y);
	let num = 0;
	let dx = 0;
	let dy = 0;
	for (let i = 0; i < n; i += 1) {
		const a = x[i]! - mx;
		const b = y[i]! - my;
		num += a * b;
		dx += a * a;
		dy += b * b;
	}
	if (dx === 0 || dy === 0) return null;
	return round(num / Math.sqrt(dx * dy), 3);
}

/** Spearman rank correlation (Pearson on mid-ranks). */
export function spearmanCorrelation(xs: number[], ys: number[]) {
	const n = Math.min(xs.length, ys.length);
	if (n < 3) return null;
	return pearsonCorrelation(rankValues(xs.slice(0, n)), rankValues(ys.slice(0, n)));
}

function rankValues(values: number[]) {
	const indexed = values
		.map((value, index) => ({ value, index }))
		.sort((a, b) => a.value - b.value);
	const ranks = new Array<number>(values.length);
	let i = 0;
	while (i < indexed.length) {
		let j = i;
		while (
			j + 1 < indexed.length &&
			indexed[j + 1]!.value === indexed[i]!.value
		) {
			j += 1;
		}
		const avgRank = (i + j) / 2 + 1;
		for (let k = i; k <= j; k += 1) {
			ranks[indexed[k]!.index] = avgRank;
		}
		i = j + 1;
	}
	return ranks;
}

function quantile(sorted: number[], q: number) {
	if (sorted.length === 0) return 0;
	const pos = (sorted.length - 1) * q;
	const base = Math.floor(pos);
	const rest = pos - base;
	const next = sorted[base + 1];
	if (next === undefined) return sorted[base]!;
	return sorted[base]! + rest * (next - sorted[base]!);
}

export function histogramBins(
	values: number[],
	binCount = 12,
): { binLabel: string; count: number; midpoint: number }[] {
	if (values.length === 0) return [];
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const width = span / binCount;
	const bins = Array.from({ length: binCount }, (_, index) => {
		const start = min + index * width;
		const end = start + width;
		return {
			binLabel: `${round(start, 0)}–${round(end, 0)}`,
			count: 0,
			midpoint: round(start + width / 2, 1),
		};
	});
	for (const value of values) {
		const index = Math.min(binCount - 1, Math.floor((value - min) / width));
		bins[index]!.count += 1;
	}
	return bins;
}

export function boxSummaryByCancer(records: readonly ResearchRecord[]) {
	return CANCER_TYPES.map((cancerType) => {
		const values = records
			.filter((record) => record.cancerType === cancerType)
			.map((record) => record.immuneResponseScore)
			.sort((a, b) => a - b);
		if (values.length === 0) {
			return {
				cancerType,
				n: 0,
				min: 0,
				q1: 0,
				median: 0,
				q3: 0,
				max: 0,
				iqrLow: 0,
				iqrSize: 0,
			};
		}
		const q1 = round(quantile(values, 0.25), 1);
		const q3 = round(quantile(values, 0.75), 1);
		return {
			cancerType,
			n: values.length,
			min: round(values[0]!, 1),
			q1,
			median: round(quantile(values, 0.5), 1),
			q3,
			max: round(values[values.length - 1]!, 1),
			iqrLow: q1,
			iqrSize: round(q3 - q1, 1),
		};
	}).filter((row) => row.n > 0);
}

export function featureCorrelationMatrix(records: readonly ResearchRecord[]) {
	const features = [
		{
			key: "immuneResponseScore",
			label: "Immune score",
			values: records.map((record) => record.immuneResponseScore),
		},
		{
			key: "tumourMutationalBurden",
			label: "TMB",
			values: records.map((record) => record.tumourMutationalBurden),
		},
		{
			key: "week",
			label: "Week",
			values: records.map((record) => record.week),
		},
	] as const;

	return features.map((row) => ({
		feature: row.label,
		cells: features.map((column) => ({
			feature: column.label,
			value: pearsonCorrelation(row.values, column.values),
		})),
	}));
}

/** Cohen's d for each platform vs overall synthetic mean (illustrative effect size). */
export function platformEffectSizes(records: readonly ResearchRecord[]) {
	const overall = records.map((record) => record.immuneResponseScore);
	const overallMean = mean(overall);
	const overallSd = stdDev(overall) || 1;
	return VACCINE_PLATFORMS.map((platform) => {
		const values = records
			.filter((record) => record.vaccinePlatform === platform)
			.map((record) => record.immuneResponseScore);
		const platformMean = mean(values);
		const d = values.length
			? round((platformMean - overallMean) / overallSd, 2)
			: 0;
		return {
			platform,
			n: values.length,
			mean: round(platformMean, 1),
			cohensD: d,
		};
	}).filter((row) => row.n > 0);
}

export function outlierSummary(records: readonly ResearchRecord[]) {
	const scores = records.map((record) => record.immuneResponseScore);
	const avg = mean(scores);
	const sd = stdDev(scores);
	if (scores.length < 3 || sd === 0) {
		return { n: records.length, outliers: 0, threshold: 0 };
	}
	const threshold = 2 * sd;
	const outliers = records.filter(
		(record) => Math.abs(record.immuneResponseScore - avg) > threshold,
	).length;
	return {
		n: records.length,
		outliers,
		threshold: round(threshold, 1),
	};
}

/** Approximate two-tailed p-value from a standard normal |z| (for demo reporting). */
function approxNormalPValue(absZ: number) {
	// Abramowitz & Stegun 7.1.26 erfc approximation via normal CDF tail.
	const t = 1 / (1 + 0.2316419 * absZ);
	const d = 0.3989423 * Math.exp((-absZ * absZ) / 2);
	const p =
		d *
		t *
		(0.3193815 +
			t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
	return round(Math.min(1, Math.max(0, 2 * p)), 4);
}

export type WelchTTestResult = {
	groupA: string;
	groupB: string;
	nA: number;
	nB: number;
	meanA: number;
	meanB: number;
	meanDiff: number;
	tStatistic: number;
	degreesOfFreedom: number;
	pValueApprox: number;
	cohensD: number;
};

function welchFromSamples(
	a: number[],
	b: number[],
	groupA: string,
	groupB: string,
): WelchTTestResult | null {
	if (a.length < 2 || b.length < 2) return null;

	const meanA = mean(a);
	const meanB = mean(b);
	const varA = stdDev(a) ** 2;
	const varB = stdDev(b) ** 2;
	const se = Math.sqrt(varA / a.length + varB / b.length);
	if (se === 0) return null;

	const tStatistic = (meanA - meanB) / se;
	const dfNum = (varA / a.length + varB / b.length) ** 2;
	const dfDen =
		(varA / a.length) ** 2 / (a.length - 1) +
		(varB / b.length) ** 2 / (b.length - 1);
	const degreesOfFreedom = dfDen === 0 ? 1 : dfNum / dfDen;
	const pooled = Math.sqrt(
		((a.length - 1) * varA + (b.length - 1) * varB) /
			(a.length + b.length - 2),
	);
	const cohensD = pooled === 0 ? 0 : (meanA - meanB) / pooled;

	return {
		groupA,
		groupB,
		nA: a.length,
		nB: b.length,
		meanA: round(meanA, 2),
		meanB: round(meanB, 2),
		meanDiff: round(meanA - meanB, 2),
		tStatistic: round(tStatistic, 3),
		degreesOfFreedom: round(degreesOfFreedom, 1),
		pValueApprox: approxNormalPValue(Math.abs(tStatistic)),
		cohensD: round(cohensD, 3),
	};
}

/** Welch’s t-test on immune-response scores between two platforms (synthetic demo). */
export function welchTTestImmuneByPlatform(
	records: readonly ResearchRecord[],
	groupA: VaccinePlatform,
	groupB: VaccinePlatform,
): WelchTTestResult | null {
	return welchTTestByGroup(
		records,
		"vaccinePlatform",
		groupA,
		groupB,
		"immuneResponseScore",
	);
}

/** Welch’s t-test for any categorical grouping and numeric outcome (synthetic demo). */
export function welchTTestByGroup(
	records: readonly ResearchRecord[],
	groupKey: StatsGroupKey,
	groupA: string,
	groupB: string,
	outcomeKey: NumericFeatureKey,
): WelchTTestResult | null {
	const a = records
		.filter((record) => record[groupKey] === groupA)
		.map((record) => record[outcomeKey] as number);
	const b = records
		.filter((record) => record[groupKey] === groupB)
		.map((record) => record[outcomeKey] as number);
	return welchFromSamples(a, b, groupA, groupB);
}

export type LinearRegressionResult = {
	n: number;
	slope: number;
	intercept: number;
	rSquared: number;
	pearsonR: number | null;
	spearmanR: number | null;
	residualStdErr: number;
};

/** Ordinary least-squares regression on paired numeric series (illustrative). */
export function linearRegressionXY(
	xs: number[],
	ys: number[],
): LinearRegressionResult | null {
	const n = Math.min(xs.length, ys.length);
	if (n < 3) return null;
	const x = xs.slice(0, n);
	const y = ys.slice(0, n);
	const mx = mean(x);
	const my = mean(y);
	let sxx = 0;
	let sxy = 0;
	for (let i = 0; i < n; i += 1) {
		const dx = x[i]! - mx;
		sxx += dx * dx;
		sxy += dx * (y[i]! - my);
	}
	if (sxx === 0) return null;
	const slope = sxy / sxx;
	const intercept = my - slope * mx;
	const residuals = y.map((value, i) => value - (intercept + slope * x[i]!));
	const ssRes = residuals.reduce((sum, value) => sum + value ** 2, 0);
	const ssTot = y.reduce((sum, value) => sum + (value - my) ** 2, 0);
	const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
	const residualStdErr =
		n > 2 ? Math.sqrt(ssRes / (n - 2)) : Math.sqrt(ssRes / n);

	return {
		n,
		slope: round(slope, 4),
		intercept: round(intercept, 3),
		rSquared: round(rSquared, 3),
		pearsonR: pearsonCorrelation(x, y),
		spearmanR: spearmanCorrelation(x, y),
		residualStdErr: round(residualStdErr, 3),
	};
}

/** Ordinary least-squares regression: immune score ~ TMB (illustrative). */
export function linearRegressionTmbImmune(
	records: readonly ResearchRecord[],
): LinearRegressionResult | null {
	return linearRegressionXY(
		records.map((record) => record.tumourMutationalBurden),
		records.map((record) => record.immuneResponseScore),
	);
}

export function linearRegressionOnFeatures(
	records: readonly ResearchRecord[],
	xKey: NumericFeatureKey,
	yKey: NumericFeatureKey,
): LinearRegressionResult | null {
	if (xKey === yKey) return null;
	return linearRegressionXY(
		records.map((record) => record[xKey] as number),
		records.map((record) => record[yKey] as number),
	);
}

export type ResidualPoint = {
	id: string;
	x: number;
	y: number;
	fitted: number;
	residual: number;
};

export function regressionResidualPoints(
	records: readonly ResearchRecord[],
	xKey: NumericFeatureKey,
	yKey: NumericFeatureKey,
): ResidualPoint[] {
	const model = linearRegressionOnFeatures(records, xKey, yKey);
	if (!model) return [];
	return records.map((record) => {
		const x = record[xKey] as number;
		const y = record[yKey] as number;
		const fitted = model.intercept + model.slope * x;
		return {
			id: record.id,
			x,
			y,
			fitted: round(fitted, 2),
			residual: round(y - fitted, 2),
		};
	});
}

export function groupMeanConfidenceIntervals(
	records: readonly ResearchRecord[],
	groupKey: StatsGroupKey,
	outcomeKey: NumericFeatureKey,
) {
	const labels =
		groupKey === "vaccinePlatform"
			? [...VACCINE_PLATFORMS]
			: [...CANCER_TYPES];
	return labels
		.map((label) => {
			const values = records
				.filter((record) => record[groupKey] === label)
				.map((record) => record[outcomeKey] as number);
			return {
				group: label,
				...meanWithCi95(values),
				unit: numericFeatureUnit(outcomeKey),
			};
		})
		.filter((row) => row.n > 0);
}

export function meanWithCi95(values: number[]) {
	if (values.length === 0) {
		return { n: 0, mean: 0, ciLow: 0, ciHigh: 0, se: 0 };
	}
	const m = mean(values);
	const se = stdDev(values) / Math.sqrt(values.length);
	// 1.96 ≈ 95% normal approximation for demonstration reporting.
	const margin = 1.96 * se;
	return {
		n: values.length,
		mean: round(m, 2),
		ciLow: round(m - margin, 2),
		ciHigh: round(m + margin, 2),
		se: round(se, 3),
	};
}

export function platformMeanConfidenceIntervals(
	records: readonly ResearchRecord[],
) {
	return VACCINE_PLATFORMS.map((platform) => {
		const values = records
			.filter((record) => record.vaccinePlatform === platform)
			.map((record) => record.immuneResponseScore);
		return {
			platform,
			...meanWithCi95(values),
			unit: "spots / 10⁶ PBMC",
		};
	}).filter((row) => row.n > 0);
}

export function buildInsights(records: readonly ResearchRecord[]): string[] {
	if (records.length === 0) {
		return [
			"No synthetic records match the current filters. Reset filters to restore the demonstration dataset.",
		];
	}

	const insights: string[] = [];
	const counts = cancerTypeCounts(records).sort((a, b) => b.count - a.count);
	const top = counts[0];
	if (top && top.count > 0) {
		insights.push(
			`Among the current synthetic records (n=${records.length}), ${top.cancerType} accounts for the largest share (${top.count} records).`,
		);
	}

	const platformCounts = VACCINE_PLATFORMS.map((platform) => ({
		platform,
		count: records.filter((record) => record.vaccinePlatform === platform)
			.length,
	})).sort((a, b) => b.count - a.count);
	const topPlatform = platformCounts[0];
	if (topPlatform && topPlatform.count > 0) {
		insights.push(
			`The most frequent illustrative vaccine platform in this filtered view is ${topPlatform.platform} (${topPlatform.count} records). Platform counts are synthetic and do not imply comparative clinical evidence.`,
		);
	}

	const immune = descriptiveStats(
		records.map((record) => record.immuneResponseScore),
		"spots / 10⁶ PBMC",
	);
	const tmb = descriptiveStats(
		records.map((record) => record.tumourMutationalBurden),
		"mutations / Mb",
	);
	insights.push(
		`Simulated immune-response scores in this view have mean ${immune.mean} and median ${immune.median} ${immune.unit} (SD ${immune.stdDev}; n=${immune.n}).`,
	);
	insights.push(
		`Simulated tumour mutational burden values have mean ${tmb.mean} and median ${tmb.median} ${tmb.unit} (SD ${tmb.stdDev}; n=${tmb.n}).`,
	);

	const correlation = pearsonCorrelation(
		records.map((record) => record.tumourMutationalBurden),
		records.map((record) => record.immuneResponseScore),
	);
	if (correlation === null) {
		insights.push(
			"There are too few paired synthetic measurements to summarise an association between tumour mutational burden and immune-response score.",
		);
	} else if (Math.abs(correlation) < 0.15) {
		insights.push(
			`In this synthetic sample, tumour mutational burden and immune-response score show little linear association (Pearson r=${correlation}). This is illustrative only and does not establish causation.`,
		);
	} else if (correlation > 0) {
		insights.push(
			`In this synthetic sample, higher tumour mutational burden tends to coincide with higher immune-response scores (Pearson r=${correlation}). Correlation in synthetic data does not imply causation or clinical effect.`,
		);
	} else {
		insights.push(
			`In this synthetic sample, higher tumour mutational burden tends to coincide with lower immune-response scores (Pearson r=${correlation}). Correlation in synthetic data does not imply causation or clinical effect.`,
		);
	}

	return insights;
}

export function recordsToCsv(records: readonly ResearchRecord[]) {
	const header = [
		"id",
		"cancerType",
		"vaccinePlatform",
		"week",
		"immuneResponseScore_spots_per_1e6_PBMC",
		"tumourMutationalBurden_mutations_per_Mb",
		"dataset",
	];
	const rows = records.map((record) =>
		[
			record.id,
			record.cancerType,
			record.vaccinePlatform,
			String(record.week),
			String(record.immuneResponseScore),
			String(record.tumourMutationalBurden),
			DATASET_LABEL,
		]
			.map((cell) => `"${cell.replaceAll('"', '""')}"`)
			.join(","),
	);
	return [header.join(","), ...rows].join("\n");
}

export const GLOSSARY = [
	{
		term: "Neoantigen",
		definition:
			"A tumour-specific peptide that may be recognised by the immune system. In personalised vaccine research, candidate neoantigens are typically inferred computationally from tumour sequencing.",
	},
	{
		term: "Tumour mutational burden",
		definition:
			"A measure of the number of mutations present in a tumour genome, often expressed as mutations per megabase. It is studied as a biomarker in immuno-oncology research.",
	},
	{
		term: "mRNA cancer vaccine",
		definition:
			"An investigational approach in which messenger RNA instructs cells to produce selected tumour-associated antigens, with the aim of stimulating an immune response.",
	},
	{
		term: "Immune response",
		definition:
			"In this demonstration, a simulated laboratory-style readout representing antigen-specific immune activity. It is not a measured patient outcome.",
	},
	{
		term: "Biomarker",
		definition:
			"A measurable characteristic that may relate to a biological process or disease state. Biomarkers used here are synthetic and illustrative only.",
	},
	{
		term: "Therapeutic cancer vaccine",
		definition:
			"A treatment intended to stimulate the immune system against cancer cells in people who already have cancer. This differs from preventive vaccines used to reduce cancer risk.",
	},
] as const;

export const PUBLIC_RESEARCH_LINKS = [
	{
		label: "ClinicalTrials.gov",
		href: "https://clinicaltrials.gov/",
		note: "Registry of clinical studies.",
	},
	{
		label: "ClinicalTrials.gov Data API",
		href: "https://clinicaltrials.gov/data-api/api",
		note: "Public API documentation for trial metadata.",
	},
	{
		label: "National Cancer Institute — Cancer Treatment Vaccines",
		href: "https://www.cancer.gov/about-cancer/treatment/types/immunotherapy/cancer-treatment-vaccines",
		note: "Authoritative overview of therapeutic cancer vaccines.",
	},
	{
		label: "PubMed",
		href: "https://pubmed.ncbi.nlm.nih.gov/",
		note: "Biomedical literature search.",
	},
] as const;
