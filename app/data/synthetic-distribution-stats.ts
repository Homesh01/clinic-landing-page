/**
 * Synthetic probability-distribution & classical-inference demonstration.
 * Large mock measurement series — no real patient laboratory values.
 */

export const DIST_SEED = 20261018;
export const DIST_DATASET_LABEL = "Synthetic demonstration data" as const;

export type DistSeries = {
	id: string;
	label: string;
	unit: string;
	values: number[];
};

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

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 3) {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

function mean(values: number[]) {
	if (!values.length) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]) {
	if (values.length < 2) return 0;
	const m = mean(values);
	return values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length;
}

function stdDev(values: number[]) {
	return Math.sqrt(variance(values));
}

function quantile(sorted: number[], q: number) {
	if (!sorted.length) return 0;
	const pos = (sorted.length - 1) * q;
	const base = Math.floor(pos);
	const rest = pos - base;
	const next = sorted[base + 1];
	if (next === undefined) return sorted[base]!;
	return sorted[base]! + rest * (next - sorted[base]!);
}

/** Box–Muller */
function sampleNormal(rng: () => number, mu: number, sigma: number) {
	const u1 = Math.max(1e-12, rng());
	const u2 = rng();
	const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	return mu + sigma * z;
}

function generateMixtureSeries(rng: () => number, n = 1800): number[] {
	const values: number[] = [];
	for (let i = 0; i < n; i += 1) {
		const component = rng();
		if (component < 0.42) {
			values.push(round(clamp(sampleNormal(rng, 38, 7), 5, 120), 1));
		} else if (component < 0.78) {
			values.push(round(clamp(sampleNormal(rng, 62, 9), 5, 140), 1));
		} else {
			values.push(round(clamp(sampleNormal(rng, 88, 11), 10, 160), 1));
		}
	}
	return values;
}

function generateSkewedSeries(rng: () => number, n = 1400): number[] {
	const values: number[] = [];
	for (let i = 0; i < n; i += 1) {
		// Log-normal-ish TMB proxy
		const z = sampleNormal(rng, 2.1, 0.55);
		values.push(round(clamp(Math.exp(z), 0.4, 80), 2));
	}
	return values;
}

const rng = createRng(DIST_SEED);

export const DIST_SERIES: DistSeries[] = [
	{
		id: "immune",
		label: "Immune-response score",
		unit: "spots / 10⁶ PBMC",
		values: generateMixtureSeries(rng),
	},
	{
		id: "tmb",
		label: "TMB proxy",
		unit: "mutations / Mb",
		values: generateSkewedSeries(rng),
	},
];

export function descriptiveMoments(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b);
	const m = mean(values);
	const sd = stdDev(values);
	const skew =
		sd === 0
			? 0
			: mean(values.map((value) => ((value - m) / sd) ** 3));
	const kurtosis =
		sd === 0
			? 0
			: mean(values.map((value) => ((value - m) / sd) ** 4)) - 3;
	return {
		n: values.length,
		mean: round(m, 3),
		median: round(quantile(sorted, 0.5), 3),
		stdDev: round(sd, 3),
		skewness: round(skew, 3),
		excessKurtosis: round(kurtosis, 3),
		q05: round(quantile(sorted, 0.05), 3),
		q95: round(quantile(sorted, 0.95), 3),
		min: round(sorted[0]!, 3),
		max: round(sorted[sorted.length - 1]!, 3),
	};
}

export function histogramDensity(
	values: number[],
	binCount = 30,
): { x: number; density: number; count: number; binLabel: string }[] {
	if (!values.length) return [];
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const width = span / binCount;
	const bins = Array.from({ length: binCount }, (_, index) => {
		const start = min + index * width;
		return {
			x: round(start + width / 2, 2),
			count: 0,
			density: 0,
			binLabel: `${round(start, 1)}–${round(start + width, 1)}`,
		};
	});
	for (const value of values) {
		const index = Math.min(binCount - 1, Math.floor((value - min) / width));
		bins[index]!.count += 1;
	}
	const n = values.length;
	return bins.map((bin) => ({
		...bin,
		density: round(bin.count / (n * width), 5),
	}));
}

export type GaussianComponent = {
	weight: number;
	mu: number;
	sigma: number;
};

/** 1-D Gaussian mixture via EM. */
export function fitGaussianMixture(
	values: number[],
	k = 3,
	iters = 40,
	seed = DIST_SEED + 3,
): GaussianComponent[] {
	const local = createRng(seed);
	const sorted = [...values].sort((a, b) => a - b);
	const components: GaussianComponent[] = Array.from({ length: k }, (_, index) => ({
		weight: 1 / k,
		mu: quantile(sorted, (index + 0.5) / k),
		sigma: Math.max(1, stdDev(values) / Math.sqrt(k)),
	}));

	const n = values.length;
	for (let iter = 0; iter < iters; iter += 1) {
		const resp = values.map((value) => {
			const dens = components.map(
				(component) =>
					component.weight *
					normalPdf(value, component.mu, component.sigma),
			);
			const sum = dens.reduce((total, valueDensity) => total + valueDensity, 0) || 1;
			return dens.map((valueDensity) => valueDensity / sum);
		});

		for (let c = 0; c < k; c += 1) {
			const nk = resp.reduce((sum, row) => sum + row[c]!, 0) || 1e-9;
			components[c]!.weight = nk / n;
			components[c]!.mu =
				resp.reduce((sum, row, i) => sum + row[c]! * values[i]!, 0) / nk;
			const varC =
				resp.reduce(
					(sum, row, i) =>
						sum + row[c]! * (values[i]! - components[c]!.mu) ** 2,
					0,
				) / nk;
			components[c]!.sigma = Math.max(0.5, Math.sqrt(varC));
		}
		// Tiny jitter if a component collapses
		for (const component of components) {
			if (!Number.isFinite(component.mu)) {
				component.mu = sorted[Math.floor(local() * sorted.length)]!;
			}
		}
	}

	return components.map((component) => ({
		weight: round(component.weight, 3),
		mu: round(component.mu, 2),
		sigma: round(component.sigma, 2),
	}));
}

function normalPdf(x: number, mu: number, sigma: number) {
	const z = (x - mu) / sigma;
	return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

export function mixtureDensityCurve(
	components: GaussianComponent[],
	min: number,
	max: number,
	steps = 80,
) {
	return Array.from({ length: steps }, (_, index) => {
		const x = min + ((max - min) * index) / (steps - 1);
		const density = components.reduce(
			(sum, component) =>
				sum + component.weight * normalPdf(x, component.mu, component.sigma),
			0,
		);
		return { x: round(x, 2), density: round(density, 5) };
	});
}

export function qqNormalPlot(values: number[], points = 60) {
	const sorted = [...values].sort((a, b) => a - b);
	const m = mean(values);
	const sd = stdDev(values) || 1;
	const step = Math.max(1, Math.floor(sorted.length / points));
	const rows: { theoretical: number; sample: number }[] = [];
	for (let i = 0; i < sorted.length; i += step) {
		const p = (i + 0.5) / sorted.length;
		const z = approxInvNorm(p);
		rows.push({
			theoretical: round(m + sd * z, 2),
			sample: round(sorted[i]!, 2),
		});
	}
	return rows;
}

/** Beasley-Springer/Moro-ish inverse normal approximation. */
function approxInvNorm(p: number) {
	const clamped = clamp(p, 1e-6, 1 - 1e-6);
	const a = [
		-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
		1.383577459672113e2, -3.066479806614716e1, 2.506628277459239,
	];
	const b = [
		-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
		6.680131188771972e1, -1.328068155288572e1,
	];
	const c = [
		-7.784894002430293e-3, -3.223726362721393e-1, -2.400758277161838,
		-2.549732539343734, 4.374664141464968, 2.938163982698783,
	];
	const d = [
		7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
		3.754408661907416,
	];
	const plow = 0.02425;
	const phigh = 1 - plow;
	if (clamped < plow) {
		const q = Math.sqrt(-2 * Math.log(clamped));
		return (
			(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
				c[5]!) /
			((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
		);
	}
	if (clamped > phigh) {
		const q = Math.sqrt(-2 * Math.log(1 - clamped));
		return -(
			(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
				c[5]!) /
			((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
		);
	}
	const q = clamped - 0.5;
	const r = q * q;
	return (
		((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r +
			a[5]!) *
			q) /
		(((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
	);
}

export function kolmogorovSmirnovNormal(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b);
	const m = mean(values);
	const sd = stdDev(values) || 1;
	let d = 0;
	for (let i = 0; i < sorted.length; i += 1) {
		const empiric = (i + 1) / sorted.length;
		const z = (sorted[i]! - m) / sd;
		const theoretical = normalCdf(z);
		d = Math.max(d, Math.abs(empiric - theoretical));
	}
	// Rough p-value via Marsaglia-style asymptotic (demo only)
	const n = sorted.length;
	const sqrtN = Math.sqrt(n);
	const lam = (sqrtN + 0.12 + 0.11 / sqrtN) * d;
	let p = 0;
	for (let k = 1; k <= 50; k += 1) {
		p += 2 * (-1) ** (k - 1) * Math.exp(-2 * k * k * lam * lam);
	}
	return {
		dStatistic: round(d, 4),
		pValueApprox: round(clamp(p, 0, 1), 4),
		n,
	};
}

function normalCdf(z: number) {
	return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(x: number) {
	const sign = x < 0 ? -1 : 1;
	const ax = Math.abs(x);
	const t = 1 / (1 + 0.3275911 * ax);
	const y =
		1 -
		(((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
			t +
			0.254829592) *
			t *
			Math.exp(-ax * ax));
	return sign * y;
}

export function bootstrapMeanDistribution(
	values: number[],
	draws = 400,
	seed = DIST_SEED + 21,
) {
	const local = createRng(seed);
	const samples: number[] = [];
	for (let d = 0; d < draws; d += 1) {
		let sum = 0;
		for (let i = 0; i < values.length; i += 1) {
			sum += values[Math.floor(local() * values.length)]!;
		}
		samples.push(sum / values.length);
	}
	samples.sort((a, b) => a - b);
	const hist = histogramDensity(samples, 24);
	return {
		means: samples,
		histogram: hist,
		ciLow: round(samples[Math.floor(0.025 * samples.length)]!, 3),
		ciHigh: round(
			samples[Math.min(samples.length - 1, Math.floor(0.975 * samples.length))]!,
			3,
		),
		meanOfMeans: round(mean(samples), 3),
	};
}

export function betaBinomialPosterior(successes: number, trials: number, a0 = 1, b0 = 1) {
	const a = a0 + successes;
	const b = b0 + (trials - successes);
	const meanPost = a / (a + b);
	const grid = Array.from({ length: 80 }, (_, index) => {
		const p = index / 79;
		const density = Math.exp(logBetaPdf(p, a, b));
		return { p: round(p, 3), density: round(density, 4) };
	});
	// Equal-tail credible interval via incomplete beta quantile approx (grid)
	let cum = 0;
	const width = 1 / 79;
	let lo = 0;
	let hi = 1;
	const total = grid.reduce((sum, row) => sum + row.density, 0) || 1;
	for (const row of grid) {
		cum += row.density / total;
		if (cum >= 0.025 && lo === 0) lo = row.p;
		if (cum >= 0.975) {
			hi = row.p;
			break;
		}
	}
	return {
		alpha: round(a, 2),
		beta: round(b, 2),
		mean: round(meanPost, 4),
		ciLow: lo,
		ciHigh: hi,
		curve: grid,
		successes,
		trials,
	};
}

function logBetaPdf(p: number, a: number, b: number) {
	if (p <= 0 || p >= 1) return -Infinity;
	return (
		(a - 1) * Math.log(p) +
		(b - 1) * Math.log(1 - p) -
		logBeta(a, b)
	);
}

function logBeta(a: number, b: number) {
	return lgamma(a) + lgamma(b) - lgamma(a + b);
}

/** Lanczos approximation for log-gamma */
function lgamma(z: number): number {
	const g = 7;
	const c = [
		0.99999999999980993, 676.5203681218851, -1259.1392167224028,
		771.32342877765313, -176.61502916214059, 12.507343278686905,
		-0.13857109526572012, 9.984369654078691e-6, 1.5056327351493116e-7,
	];
	if (z < 0.5) {
		return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
	}
	z -= 1;
	let x = c[0]!;
	for (let i = 1; i < g + 2; i += 1) x += c[i]! / (z + i);
	const t = z + g + 0.5;
	return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export function monteCarloPowerCurve(
	options?: {
		effectSizes?: number[];
		nPerArm?: number;
		alpha?: number;
		draws?: number;
		seed?: number;
	},
) {
	const effectSizes = options?.effectSizes ?? [0, 0.1, 0.2, 0.3, 0.4, 0.5];
	const n = options?.nPerArm ?? 80;
	const alpha = options?.alpha ?? 0.05;
	const draws = options?.draws ?? 250;
	const local = createRng(options?.seed ?? DIST_SEED + 55);
	const zCrit = approxInvNorm(1 - alpha / 2);

	return effectSizes.map((delta) => {
		let rejects = 0;
		for (let d = 0; d < draws; d += 1) {
			const a: number[] = [];
			const b: number[] = [];
			for (let i = 0; i < n; i += 1) {
				a.push(sampleNormal(local, 50, 12));
				b.push(sampleNormal(local, 50 + delta * 12, 12));
			}
			const se = Math.sqrt(variance(a) / n + variance(b) / n) || 1e-6;
			const z = (mean(b) - mean(a)) / se;
			if (Math.abs(z) > zCrit) rejects += 1;
		}
		return {
			effectSize: delta,
			power: round(rejects / draws, 3),
			nPerArm: n,
		};
	});
}

export function twoSampleWelchSummary(a: number[], b: number[]) {
	const meanA = mean(a);
	const meanB = mean(b);
	const varA = variance(a);
	const varB = variance(b);
	const se = Math.sqrt(varA / a.length + varB / b.length) || 1e-9;
	const t = (meanA - meanB) / se;
	const dfNum = (varA / a.length + varB / b.length) ** 2;
	const dfDen =
		(varA / a.length) ** 2 / Math.max(1, a.length - 1) +
		(varB / b.length) ** 2 / Math.max(1, b.length - 1);
	const df = dfDen === 0 ? 1 : dfNum / dfDen;
	return {
		meanA: round(meanA, 3),
		meanB: round(meanB, 3),
		meanDiff: round(meanA - meanB, 3),
		tStatistic: round(t, 3),
		df: round(df, 1),
		pValueApprox: approxNormalTwoTailed(Math.abs(t)),
		nA: a.length,
		nB: b.length,
	};
}

function approxNormalTwoTailed(absZ: number) {
	const t = 1 / (1 + 0.2316419 * absZ);
	const d = 0.3989423 * Math.exp((-absZ * absZ) / 2);
	const p =
		d *
		t *
		(0.3193815 +
			t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
	return round(Math.min(1, Math.max(0, 2 * p)), 4);
}

/** Split a series into synthetic arm A/B by median for Welch demo. */
export function splitByMedian(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = quantile(sorted, 0.5);
	// Independent arms: first/second halves after shuffle for illustration
	const local = createRng(DIST_SEED + 90);
	const copy = [...values];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(local() * (i + 1));
		const tmp = copy[i]!;
		copy[i] = copy[j]!;
		copy[j] = tmp;
	}
	const cut = Math.floor(copy.length / 2);
	return {
		a: copy.slice(0, cut),
		b: copy.slice(cut),
		median: round(mid, 3),
	};
}

export const DIST_GLOSSARY = [
	{
		term: "Gaussian mixture (EM)",
		definition:
			"Models a density as a weighted sum of normal components. Expectation–maximisation estimates weights, means and variances from the synthetic sample.",
	},
	{
		term: "QQ plot",
		definition:
			"Compares sample quantiles with theoretical normal quantiles. Systematic curvature suggests departure from normality.",
	},
	{
		term: "Bootstrap",
		definition:
			"Resamples the observed values with replacement to approximate the sampling distribution of a statistic (here, the mean).",
	},
	{
		term: "Beta–Binomial posterior",
		definition:
			"Conjugate Bayesian update for a binomial response rate with a Beta prior, yielding a full posterior density and credible interval.",
	},
] as const;
