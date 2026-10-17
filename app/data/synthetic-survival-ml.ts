/**
 * Synthetic survival + gradient-boosting demonstration (large cohort).
 * Invented time-to-progression outcomes — no real patient or trial data.
 */

export const SURVIVAL_SEED = 20261017;
export const SURVIVAL_DATASET_LABEL = "Synthetic demonstration data" as const;

export const SURVIVAL_PLATFORMS = [
	"Personalised mRNA",
	"Neoantigen peptide",
	"Dendritic cell",
	"Other investigational",
] as const;

export type SurvivalPlatform = (typeof SURVIVAL_PLATFORMS)[number];

export const SURVIVAL_FEATURES = [
	"age",
	"tmb",
	"pdL1",
	"ldh",
	"neutrophilLymphocyte",
	"priorLines",
	"performanceStatus",
] as const;

export type SurvivalFeatureKey = (typeof SURVIVAL_FEATURES)[number];

export const SURVIVAL_FEATURE_META: Record<
	SurvivalFeatureKey,
	{ label: string; unit: string }
> = {
	age: { label: "Age", unit: "years" },
	tmb: { label: "TMB", unit: "mut/Mb" },
	pdL1: { label: "PD-L1", unit: "%" },
	ldh: { label: "LDH index", unit: "×ULN" },
	neutrophilLymphocyte: { label: "NLR", unit: "ratio" },
	priorLines: { label: "Prior lines", unit: "count" },
	performanceStatus: { label: "ECOG-like", unit: "0–2" },
};

export type SurvivalPatient = {
	id: string;
	platform: SurvivalPlatform;
	age: number;
	tmb: number;
	pdL1: number;
	ldh: number;
	neutrophilLymphocyte: number;
	priorLines: number;
	performanceStatus: number;
	/** Months to progression or censor. */
	timeMonths: number;
	event: 0 | 1;
	/** Binary landmark label used by the boosting model. */
	progressedBy12m: 0 | 1;
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

function stdDev(values: number[]) {
	if (values.length < 2) return 0;
	const m = mean(values);
	return Math.sqrt(
		values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length,
	);
}

/** Inverse CDF for exponential via -ln(U)/λ */
function sampleExp(rng: () => number, rate: number) {
	return -Math.log(Math.max(1e-12, rng())) / Math.max(1e-6, rate);
}

function generateCohort(rng: () => number, count = 1200): SurvivalPatient[] {
	const patients: SurvivalPatient[] = [];
	for (let i = 0; i < count; i += 1) {
		const platform =
			SURVIVAL_PLATFORMS[Math.floor(rng() * SURVIVAL_PLATFORMS.length)]!;
		const age = round(clamp(42 + rng() * 38 + (rng() - 0.5) * 6, 28, 85), 0);
		const tmb = round(clamp(3 + rng() * 28 + (rng() - 0.4) * 4, 0.8, 48), 1);
		const pdL1 = round(clamp(rng() * 90 + (rng() - 0.5) * 10, 0, 100), 0);
		const ldh = round(clamp(0.6 + rng() * 2.4, 0.5, 4.2), 2);
		const neutrophilLymphocyte = round(
			clamp(1.2 + rng() * 6.5, 0.8, 12),
			2,
		);
		const priorLines = Math.floor(rng() * 4);
		const performanceStatus = Math.floor(rng() * 3);

		const platformHazard =
			platform === "Personalised mRNA"
				? 0.78
				: platform === "Neoantigen peptide"
					? 0.92
					: platform === "Dendritic cell"
						? 1.05
						: 1.18;

		const linear =
			0.018 * (age - 55) +
			-0.035 * tmb +
			-0.008 * pdL1 +
			0.28 * (ldh - 1) +
			0.09 * (neutrophilLymphocyte - 3) +
			0.16 * priorLines +
			0.22 * performanceStatus +
			Math.log(platformHazard);

		const baseRate = 0.07 * Math.exp(clamp(linear, -1.8, 1.8));
		const eventTime = sampleExp(rng, baseRate);
		const censorTime = 6 + rng() * 30;
		const timeMonths = round(Math.min(eventTime, censorTime), 2);
		const event: 0 | 1 = eventTime <= censorTime ? 1 : 0;
		// Landmark label: progressed by 12 months if an event occurred at ≤ 12 months.
		const progressedBy12m: 0 | 1 = event === 1 && timeMonths <= 12 ? 1 : 0;

		patients.push({
			id: `SV-${String(i + 1).padStart(4, "0")}`,
			platform,
			age,
			tmb,
			pdL1,
			ldh,
			neutrophilLymphocyte,
			priorLines,
			performanceStatus,
			timeMonths,
			event,
			progressedBy12m,
		});
	}
	return patients;
}

const rootRng = createRng(SURVIVAL_SEED);
export const ALL_SURVIVAL_PATIENTS = generateCohort(rootRng);

export function trainTestSplitSurvival(
	patients: readonly SurvivalPatient[],
	trainRatio = 0.7,
	seed = SURVIVAL_SEED + 11,
) {
	const local = createRng(seed);
	const copy = [...patients];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(local() * (i + 1));
		const tmp = copy[i]!;
		copy[i] = copy[j]!;
		copy[j] = tmp;
	}
	const cut = Math.max(1, Math.floor(copy.length * trainRatio));
	return { train: copy.slice(0, cut), test: copy.slice(cut) };
}

export type KmPoint = {
	time: number;
	survival: number;
	ciLow: number;
	ciHigh: number;
	atRisk: number;
	events: number;
};

export function kaplanMeier(
	patients: readonly SurvivalPatient[],
): KmPoint[] {
	const times = [
		...new Set(
			patients
				.filter((patient) => patient.event === 1)
				.map((patient) => patient.timeMonths),
		),
	].sort((a, b) => a - b);

	let surviving = 1;
	let greenwood = 0;
	const points: KmPoint[] = [{ time: 0, survival: 1, ciLow: 1, ciHigh: 1, atRisk: patients.length, events: 0 }];

	for (const time of times) {
		const atRisk = patients.filter((patient) => patient.timeMonths >= time).length;
		const events = patients.filter(
			(patient) => patient.event === 1 && patient.timeMonths === time,
		).length;
		if (atRisk === 0) break;
		surviving *= 1 - events / atRisk;
		if (events > 0 && atRisk > events) {
			greenwood += events / (atRisk * (atRisk - events));
		}
		const se = surviving * Math.sqrt(greenwood);
		points.push({
			time: round(time, 2),
			survival: round(surviving, 4),
			ciLow: round(clamp(surviving - 1.96 * se, 0, 1), 4),
			ciHigh: round(clamp(surviving + 1.96 * se, 0, 1), 4),
			atRisk,
			events,
		});
	}
	return points;
}

export function kaplanMeierByPlatform(patients: readonly SurvivalPatient[]) {
	return SURVIVAL_PLATFORMS.map((platform) => ({
		platform,
		curve: kaplanMeier(patients.filter((patient) => patient.platform === platform)),
		n: patients.filter((patient) => patient.platform === platform).length,
	})).filter((row) => row.n > 0);
}

/** Two-sample log-rank (Mantel–Haenszel) between two platforms. */
export function logRankTest(
	patients: readonly SurvivalPatient[],
	groupA: SurvivalPlatform,
	groupB: SurvivalPlatform,
) {
	const a = patients.filter((patient) => patient.platform === groupA);
	const b = patients.filter((patient) => patient.platform === groupB);
	const times = [
		...new Set(
			[...a, ...b]
				.filter((patient) => patient.event === 1)
				.map((patient) => patient.timeMonths),
		),
	].sort((x, y) => x - y);

	let oMinusE = 0;
	let variance = 0;
	for (const time of times) {
		const n1 = a.filter((patient) => patient.timeMonths >= time).length;
		const n2 = b.filter((patient) => patient.timeMonths >= time).length;
		const d1 = a.filter(
			(patient) => patient.event === 1 && patient.timeMonths === time,
		).length;
		const d2 = b.filter(
			(patient) => patient.event === 1 && patient.timeMonths === time,
		).length;
		const n = n1 + n2;
		const d = d1 + d2;
		if (n <= 1 || d === 0) continue;
		const e1 = (n1 / n) * d;
		oMinusE += d1 - e1;
		variance += (n1 * n2 * d * (n - d)) / (n * n * (n - 1));
	}
	if (variance <= 0) return null;
	const z = oMinusE / Math.sqrt(variance);
	const p = approxNormalTwoTailed(Math.abs(z));
	return {
		groupA,
		groupB,
		nA: a.length,
		nB: b.length,
		z: round(z, 3),
		chiSquare: round(z * z, 3),
		pValueApprox: p,
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

type BoostNode =
	| { kind: "leaf"; value: number }
	| {
			kind: "split";
			featureIndex: number;
			threshold: number;
			left: BoostNode;
			right: BoostNode;
	  };

export type GradientBoostModel = {
	trees: BoostNode[];
	learningRate: number;
	initScore: number;
	featureKeys: readonly SurvivalFeatureKey[];
	means: number[];
	stds: number[];
	trainLoss: number[];
};

function featureRow(patient: SurvivalPatient): number[] {
	return SURVIVAL_FEATURES.map((key) => patient[key]);
}

function standardize(matrix: number[][]) {
	const d = matrix[0]?.length ?? 0;
	const means = Array.from({ length: d }, (_, c) =>
		mean(matrix.map((row) => row[c]!)),
	);
	const stds = Array.from({ length: d }, (_, c) => {
		const sd = stdDev(matrix.map((row) => row[c]!));
		return sd === 0 ? 1 : sd;
	});
	const standardized = matrix.map((row) =>
		row.map((value, c) => (value - means[c]!) / stds[c]!),
	);
	return { standardized, means, stds };
}

function sigmoid(z: number) {
	if (z > 20) return 1;
	if (z < -20) return 0;
	return 1 / (1 + Math.exp(-z));
}

function predictTree(node: BoostNode, row: number[]): number {
	if (node.kind === "leaf") return node.value;
	return row[node.featureIndex]! <= node.threshold
		? predictTree(node.left, row)
		: predictTree(node.right, row);
}

function buildRegressionTree(
	matrix: number[][],
	residuals: number[],
	depth: number,
	maxDepth: number,
	minLeaf: number,
): BoostNode {
	const n = residuals.length;
	if (depth >= maxDepth || n <= minLeaf) {
		return { kind: "leaf", value: mean(residuals) };
	}

	let bestGain = 0;
	let bestFeature = 0;
	let bestThreshold = 0;
	let bestLeft: number[] = [];
	let bestRight: number[] = [];
	const parentVar = (() => {
		const m = mean(residuals);
		return mean(residuals.map((value) => (value - m) ** 2));
	})();

	const d = matrix[0]?.length ?? 0;
	for (let f = 0; f < d; f += 1) {
		const values = matrix.map((row) => row[f]!);
		const unique = [...new Set(values.map((value) => round(value, 2)))].sort(
			(a, b) => a - b,
		);
		const step = Math.max(1, Math.floor(unique.length / 10));
		for (let t = step; t < unique.length; t += step) {
			const threshold = (unique[t - 1]! + unique[t]!) / 2;
			const leftIdx: number[] = [];
			const rightIdx: number[] = [];
			for (let i = 0; i < n; i += 1) {
				if (matrix[i]![f]! <= threshold) leftIdx.push(i);
				else rightIdx.push(i);
			}
			if (leftIdx.length < minLeaf || rightIdx.length < minLeaf) continue;
			const leftRes = leftIdx.map((index) => residuals[index]!);
			const rightRes = rightIdx.map((index) => residuals[index]!);
			const leftM = mean(leftRes);
			const rightM = mean(rightRes);
			const leftVar = mean(leftRes.map((value) => (value - leftM) ** 2));
			const rightVar = mean(rightRes.map((value) => (value - rightM) ** 2));
			const gain =
				parentVar -
				(leftRes.length / n) * leftVar -
				(rightRes.length / n) * rightVar;
			if (gain > bestGain) {
				bestGain = gain;
				bestFeature = f;
				bestThreshold = threshold;
				bestLeft = leftIdx;
				bestRight = rightIdx;
			}
		}
	}

	if (bestGain <= 1e-8 || bestLeft.length === 0) {
		return { kind: "leaf", value: mean(residuals) };
	}

	return {
		kind: "split",
		featureIndex: bestFeature,
		threshold: bestThreshold,
		left: buildRegressionTree(
			bestLeft.map((index) => matrix[index]!),
			bestLeft.map((index) => residuals[index]!),
			depth + 1,
			maxDepth,
			minLeaf,
		),
		right: buildRegressionTree(
			bestRight.map((index) => matrix[index]!),
			bestRight.map((index) => residuals[index]!),
			depth + 1,
			maxDepth,
			minLeaf,
		),
	};
}

/** Logistic gradient boosting for 12-month progression. */
export function trainGradientBoost(
	patients: readonly SurvivalPatient[],
	options?: { nTrees?: number; learningRate?: number; maxDepth?: number },
): GradientBoostModel {
	const nTrees = options?.nTrees ?? 40;
	const learningRate = options?.learningRate ?? 0.08;
	const maxDepth = options?.maxDepth ?? 3;
	const raw = patients.map(featureRow);
	const labels = patients.map((patient) => patient.progressedBy12m);
	const { standardized, means, stds } = standardize(raw);

	const positiveRate = mean(labels);
	const initScore = Math.log((positiveRate + 1e-6) / (1 - positiveRate + 1e-6));
	const scores = Array.from({ length: patients.length }, () => initScore);
	const trees: BoostNode[] = [];
	const trainLoss: number[] = [];

	for (let t = 0; t < nTrees; t += 1) {
		const residuals = labels.map((y, i) => y - sigmoid(scores[i]!));
		const tree = buildRegressionTree(standardized, residuals, 0, maxDepth, 12);
		trees.push(tree);
		for (let i = 0; i < patients.length; i += 1) {
			scores[i]! += learningRate * predictTree(tree, standardized[i]!);
		}
		let loss = 0;
		for (let i = 0; i < patients.length; i += 1) {
			const p = sigmoid(scores[i]!);
			const y = labels[i]!;
			loss += -(y * Math.log(p + 1e-9) + (1 - y) * Math.log(1 - p + 1e-9));
		}
		trainLoss.push(round(loss / patients.length, 4));
	}

	return {
		trees,
		learningRate,
		initScore: round(initScore, 4),
		featureKeys: SURVIVAL_FEATURES,
		means,
		stds,
		trainLoss,
	};
}

export function predictBoostProbability(
	patient: SurvivalPatient,
	model: GradientBoostModel,
) {
	const row = featureRow(patient).map(
		(value, index) => (value - model.means[index]!) / model.stds[index]!,
	);
	let score = model.initScore;
	for (const tree of model.trees) {
		score += model.learningRate * predictTree(tree, row);
	}
	return sigmoid(score);
}

export function rocAuc(
	patients: readonly SurvivalPatient[],
	model: GradientBoostModel,
) {
	const scored = patients
		.map((patient) => ({
			score: predictBoostProbability(patient, model),
			label: patient.progressedBy12m,
		}))
		.sort((a, b) => b.score - a.score);
	const positives = scored.filter((row) => row.label === 1).length;
	const negatives = scored.length - positives;
	if (!positives || !negatives) return 0.5;
	let tp = 0;
	let fp = 0;
	let prevTpr = 0;
	let prevFpr = 0;
	let auc = 0;
	let i = 0;
	while (i < scored.length) {
		const score = scored[i]!.score;
		while (i < scored.length && scored[i]!.score === score) {
			if (scored[i]!.label === 1) tp += 1;
			else fp += 1;
			i += 1;
		}
		const tpr = tp / positives;
		const fpr = fp / negatives;
		auc += ((fpr - prevFpr) * (tpr + prevTpr)) / 2;
		prevTpr = tpr;
		prevFpr = fpr;
	}
	return round(auc, 3);
}

export function rocCurvePoints(
	patients: readonly SurvivalPatient[],
	model: GradientBoostModel,
	steps = 40,
) {
	const points: { fpr: number; tpr: number; threshold: number }[] = [];
	for (let i = 0; i <= steps; i += 1) {
		const threshold = i / steps;
		let tp = 0;
		let fp = 0;
		let tn = 0;
		let fn = 0;
		for (const patient of patients) {
			const pred = predictBoostProbability(patient, model) >= threshold ? 1 : 0;
			if (pred === 1 && patient.progressedBy12m === 1) tp += 1;
			else if (pred === 1) fp += 1;
			else if (patient.progressedBy12m === 0) tn += 1;
			else fn += 1;
		}
		points.push({
			threshold: round(threshold, 2),
			fpr: tp + tn + fp + fn === 0 ? 0 : round(fp / Math.max(1, fp + tn), 3),
			tpr: round(tp / Math.max(1, tp + fn), 3),
		});
	}
	return points;
}

export function bootstrapAuc(
	patients: readonly SurvivalPatient[],
	model: GradientBoostModel,
	draws = 80,
	seed = SURVIVAL_SEED + 77,
) {
	const local = createRng(seed);
	const samples: number[] = [];
	for (let d = 0; d < draws; d += 1) {
		const bag: SurvivalPatient[] = [];
		for (let i = 0; i < patients.length; i += 1) {
			bag.push(patients[Math.floor(local() * patients.length)]!);
		}
		samples.push(rocAuc(bag, model));
	}
	samples.sort((a, b) => a - b);
	const lo = samples[Math.floor(0.025 * samples.length)] ?? samples[0]!;
	const hi =
		samples[Math.min(samples.length - 1, Math.floor(0.975 * samples.length))] ??
		samples[samples.length - 1]!;
	return {
		mean: round(mean(samples), 3),
		ciLow: round(lo, 3),
		ciHigh: round(hi, 3),
		samples: samples.map((value, index) => ({
			draw: index + 1,
			auc: value,
		})),
	};
}

export function calibrationCurve(
	patients: readonly SurvivalPatient[],
	model: GradientBoostModel,
	bins = 8,
) {
	const scored = patients.map((patient) => ({
		p: predictBoostProbability(patient, model),
		y: patient.progressedBy12m,
	}));
	return Array.from({ length: bins }, (_, index) => {
		const lo = index / bins;
		const hi = (index + 1) / bins;
		const slice = scored.filter((row) =>
			index === bins - 1 ? row.p >= lo && row.p <= hi : row.p >= lo && row.p < hi,
		);
		const meanPred = slice.length ? mean(slice.map((row) => row.p)) : (lo + hi) / 2;
		const meanObs = slice.length ? mean(slice.map((row) => row.y)) : 0;
		return {
			bin: `${round(lo, 2)}–${round(hi, 2)}`,
			meanPredicted: round(meanPred, 3),
			meanObserved: round(meanObs, 3),
			n: slice.length,
			ideal: round(meanPred, 3),
		};
	}).filter((row) => row.n > 0);
}

export function permutationImportance(
	test: readonly SurvivalPatient[],
	model: GradientBoostModel,
	seed = SURVIVAL_SEED + 19,
) {
	const local = createRng(seed);
	const baseline = rocAuc(test, model);
	return SURVIVAL_FEATURES.map((key) => {
		const shuffled = test.map((patient) => ({ ...patient }));
		for (let i = shuffled.length - 1; i > 0; i -= 1) {
			const j = Math.floor(local() * (i + 1));
			const left = shuffled[i]![key];
			shuffled[i] = { ...shuffled[i]!, [key]: shuffled[j]![key] };
			shuffled[j] = { ...shuffled[j]!, [key]: left };
		}
		const drop = baseline - rocAuc(shuffled, model);
		return {
			key,
			label: SURVIVAL_FEATURE_META[key].label,
			importance: round(Math.max(0, drop), 4),
			baseline,
		};
	}).sort((a, b) => b.importance - a.importance);
}

export function partialDependence(
	patients: readonly SurvivalPatient[],
	model: GradientBoostModel,
	feature: SurvivalFeatureKey,
	gridSize = 12,
) {
	const values = patients.map((patient) => patient[feature]);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	return Array.from({ length: gridSize }, (_, index) => {
		const x = min + (span * index) / (gridSize - 1);
		const preds = patients.map((patient) =>
			predictBoostProbability({ ...patient, [feature]: x }, model),
		);
		return {
			x: round(x, 2),
			meanProbability: round(mean(preds), 3),
		};
	});
}

export function medianSurvivalMonths(curve: KmPoint[]) {
	const hit = curve.find((point) => point.survival <= 0.5);
	return hit ? hit.time : null;
}

export const SURVIVAL_GLOSSARY = [
	{
		term: "Kaplan–Meier",
		definition:
			"Non-parametric estimate of the survival function from time-to-event data with right-censoring. Bands use a Greenwood-style normal approximation for demonstration.",
	},
	{
		term: "Log-rank test",
		definition:
			"Compares survival curves between two groups under a proportional-hazards null. Reported p-values use a normal approximation.",
	},
	{
		term: "Gradient boosting",
		definition:
			"An ensemble that sequentially fits shallow regression trees to logistic residuals, producing a calibrated-style risk score for 12-month progression on synthetic data.",
	},
	{
		term: "Bootstrap AUC CI",
		definition:
			"Resamples the hold-out set with replacement to approximate uncertainty in ROC AUC (percentile interval).",
	},
] as const;
