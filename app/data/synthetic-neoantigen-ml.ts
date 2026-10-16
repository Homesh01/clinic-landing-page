/**
 * Synthetic neoantigen priority-classifier demonstration.
 * Seeded logistic regression on invented peptide features — no real patient data.
 */

export const ML_DATASET_LABEL = "Synthetic demonstration data" as const;
export const ML_SEED = 20261016;

export const FEATURE_KEYS = [
	"affinityNm",
	"expressionScore",
	"allelePresentation",
	"cleavability",
	"hydrophobicity",
	"agretopicity",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_META: Record<
	FeatureKey,
	{ label: string; unit: string; higherIsBetter: boolean }
> = {
	affinityNm: {
		label: "Predicted affinity",
		unit: "nM (lower stronger)",
		higherIsBetter: false,
	},
	expressionScore: {
		label: "Expression score",
		unit: "0–100",
		higherIsBetter: true,
	},
	allelePresentation: {
		label: "Allele presentation",
		unit: "0–1",
		higherIsBetter: true,
	},
	cleavability: {
		label: "Cleavability",
		unit: "0–1",
		higherIsBetter: true,
	},
	hydrophobicity: {
		label: "Hydrophobicity index",
		unit: "arbitrary",
		higherIsBetter: false,
	},
	agretopicity: {
		label: "Agretopicity",
		unit: "ratio",
		higherIsBetter: true,
	},
};

export type NeoantigenExample = {
	id: string;
	cancerType: string;
	peptideLength: number;
	affinityNm: number;
	expressionScore: number;
	allelePresentation: number;
	cleavability: number;
	hydrophobicity: number;
	agretopicity: number;
	/** Ground-truth synthetic label: selected for vaccine panel. */
	priority: 0 | 1;
};

export type Standardizer = {
	means: number[];
	stds: number[];
};

export type LogisticModel = {
	weights: number[];
	bias: number;
	featureKeys: readonly FeatureKey[];
	standardizer: Standardizer;
	trainLoss: number;
	epochs: number;
	learningRate: number;
	l2: number;
};

export type ClassMetrics = {
	n: number;
	positives: number;
	negatives: number;
	tp: number;
	fp: number;
	tn: number;
	fn: number;
	accuracy: number;
	precision: number;
	recall: number;
	f1: number;
	specificity: number;
	auc: number;
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

function sigmoid(z: number) {
	if (z >= 20) return 1;
	if (z <= -20) return 0;
	return 1 / (1 + Math.exp(-z));
}

const CANCER_TYPES = [
	"Melanoma",
	"Lung cancer",
	"Colorectal cancer",
	"Pancreatic cancer",
	"Renal cancer",
] as const;

function generateExamples(rng: () => number, count = 320): NeoantigenExample[] {
	const examples: NeoantigenExample[] = [];
	for (let i = 0; i < count; i += 1) {
		const cancerType = CANCER_TYPES[Math.floor(rng() * CANCER_TYPES.length)]!;
		const peptideLength = 8 + Math.floor(rng() * 4);
		const affinityNm = round(clamp(4 + rng() * 480, 3, 520), 1);
		const expressionScore = round(clamp(8 + rng() * 90, 5, 100), 1);
		const allelePresentation = round(clamp(rng() * 0.95 + 0.03, 0.02, 0.99), 3);
		const cleavability = round(clamp(rng() * 0.9 + 0.05, 0.05, 0.98), 3);
		const hydrophobicity = round(clamp((rng() - 0.45) * 4.2, -2.5, 2.8), 2);
		const agretopicity = round(clamp(0.35 + rng() * 1.8 + (rng() - 0.5) * 0.4, 0.2, 2.6), 3);

		// Latent score: stronger binders + expression + presentation favoured.
		const latent =
			1.35 * (1 - affinityNm / 520) +
			0.9 * (expressionScore / 100) +
			1.1 * allelePresentation +
			0.55 * cleavability +
			0.7 * Math.min(agretopicity / 2, 1) -
			0.35 * Math.max(hydrophobicity, 0) +
			(cancerType === "Melanoma" || cancerType === "Lung cancer" ? 0.15 : 0) +
			(rng() - 0.5) * 0.55;

		const priority: 0 | 1 = latent > 1.55 ? 1 : 0;

		examples.push({
			id: `NA-ML-${String(i + 1).padStart(3, "0")}`,
			cancerType,
			peptideLength,
			affinityNm,
			expressionScore,
			allelePresentation,
			cleavability,
			hydrophobicity,
			agretopicity,
			priority,
		});
	}
	return examples;
}

const rng = createRng(ML_SEED);
export const ALL_NEOANTIGEN_EXAMPLES = generateExamples(rng);

export function featureVector(example: NeoantigenExample): number[] {
	return FEATURE_KEYS.map((key) => example[key]);
}

export function trainTestSplit(
	examples: readonly NeoantigenExample[],
	trainRatio = 0.7,
	seed = ML_SEED + 17,
) {
	const local = createRng(seed);
	const copy = [...examples];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(local() * (i + 1));
		const tmp = copy[i]!;
		copy[i] = copy[j]!;
		copy[j] = tmp;
	}
	const cut = Math.max(1, Math.floor(copy.length * trainRatio));
	return {
		train: copy.slice(0, cut),
		test: copy.slice(cut),
	};
}

function fitStandardizer(matrix: number[][]): Standardizer {
	const dims = matrix[0]?.length ?? 0;
	const means = Array.from({ length: dims }, () => 0);
	const stds = Array.from({ length: dims }, () => 1);
	if (matrix.length === 0) return { means, stds };
	for (let d = 0; d < dims; d += 1) {
		let sum = 0;
		for (const row of matrix) sum += row[d]!;
		means[d] = sum / matrix.length;
		let varSum = 0;
		for (const row of matrix) {
			const diff = row[d]! - means[d]!;
			varSum += diff * diff;
		}
		stds[d] = Math.sqrt(varSum / matrix.length) || 1;
	}
	return { means, stds };
}

function standardizeRow(row: number[], standardizer: Standardizer) {
	return row.map((value, index) => (value - standardizer.means[index]!) / standardizer.stds[index]!);
}

export function trainLogisticRegression(
	train: readonly NeoantigenExample[],
	options?: { epochs?: number; learningRate?: number; l2?: number },
): LogisticModel {
	const epochs = options?.epochs ?? 400;
	const learningRate = options?.learningRate ?? 0.35;
	const l2 = options?.l2 ?? 0.02;
	const raw = train.map(featureVector);
	const labels = train.map((example) => example.priority);
	const standardizer = fitStandardizer(raw);
	const X = raw.map((row) => standardizeRow(row, standardizer));
	const dims = FEATURE_KEYS.length;
	const weights = Array.from({ length: dims }, () => 0);
	let bias = 0;
	let trainLoss = 0;

	for (let epoch = 0; epoch < epochs; epoch += 1) {
		const gradW = Array.from({ length: dims }, () => 0);
		let gradB = 0;
		let loss = 0;
		for (let i = 0; i < X.length; i += 1) {
			const row = X[i]!;
			let z = bias;
			for (let d = 0; d < dims; d += 1) z += weights[d]! * row[d]!;
			const pred = sigmoid(z);
			const y = labels[i]!;
			const err = pred - y;
			loss += -(y * Math.log(pred + 1e-9) + (1 - y) * Math.log(1 - pred + 1e-9));
			for (let d = 0; d < dims; d += 1) {
				gradW[d]! += err * row[d]!;
			}
			gradB += err;
		}
		const n = X.length || 1;
		loss = loss / n;
		for (let d = 0; d < dims; d += 1) {
			loss += 0.5 * l2 * weights[d]! * weights[d]!;
			weights[d]! -= learningRate * (gradW[d]! / n + l2 * weights[d]!);
		}
		bias -= learningRate * (gradB / n);
		trainLoss = loss;
	}

	return {
		weights: weights.map((value) => round(value, 4)),
		bias: round(bias, 4),
		featureKeys: FEATURE_KEYS,
		standardizer,
		trainLoss: round(trainLoss, 4),
		epochs,
		learningRate,
		l2,
	};
}

export function predictProbability(
	example: NeoantigenExample,
	model: LogisticModel,
) {
	const row = standardizeRow(featureVector(example), model.standardizer);
	let z = model.bias;
	for (let d = 0; d < row.length; d += 1) {
		z += model.weights[d]! * row[d]!;
	}
	return sigmoid(z);
}

export function predictLabel(
	example: NeoantigenExample,
	model: LogisticModel,
	threshold: number,
) {
	return predictProbability(example, model) >= threshold ? 1 : 0;
}

function trapzAuc(scores: { score: number; label: 0 | 1 }[]) {
	const ordered = [...scores].sort((a, b) => b.score - a.score);
	const positives = ordered.filter((row) => row.label === 1).length;
	const negatives = ordered.length - positives;
	if (positives === 0 || negatives === 0) return 0.5;
	let tp = 0;
	let fp = 0;
	let prevTpr = 0;
	let prevFpr = 0;
	let auc = 0;
	let i = 0;
	while (i < ordered.length) {
		const score = ordered[i]!.score;
		while (i < ordered.length && ordered[i]!.score === score) {
			if (ordered[i]!.label === 1) tp += 1;
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

export function classificationMetrics(
	examples: readonly NeoantigenExample[],
	model: LogisticModel,
	threshold: number,
): ClassMetrics {
	let tp = 0;
	let fp = 0;
	let tn = 0;
	let fn = 0;
	const scored: { score: number; label: 0 | 1 }[] = [];
	for (const example of examples) {
		const score = predictProbability(example, model);
		const pred = score >= threshold ? 1 : 0;
		scored.push({ score, label: example.priority });
		if (pred === 1 && example.priority === 1) tp += 1;
		else if (pred === 1 && example.priority === 0) fp += 1;
		else if (pred === 0 && example.priority === 0) tn += 1;
		else fn += 1;
	}
	const n = examples.length;
	const positives = tp + fn;
	const negatives = tn + fp;
	const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
	const recall = positives === 0 ? 0 : tp / positives;
	const specificity = negatives === 0 ? 0 : tn / negatives;
	const f1 =
		precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
	return {
		n,
		positives,
		negatives,
		tp,
		fp,
		tn,
		fn,
		accuracy: n === 0 ? 0 : round((tp + tn) / n, 3),
		precision: round(precision, 3),
		recall: round(recall, 3),
		f1: round(f1, 3),
		specificity: round(specificity, 3),
		auc: trapzAuc(scored),
	};
}

export function rocCurve(
	examples: readonly NeoantigenExample[],
	model: LogisticModel,
	steps = 40,
) {
	const points: { threshold: number; fpr: number; tpr: number }[] = [];
	for (let i = 0; i <= steps; i += 1) {
		const threshold = i / steps;
		const metrics = classificationMetrics(examples, model, threshold);
		const fpr =
			metrics.fp + metrics.tn === 0
				? 0
				: metrics.fp / (metrics.fp + metrics.tn);
		const tpr =
			metrics.tp + metrics.fn === 0
				? 0
				: metrics.tp / (metrics.tp + metrics.fn);
		points.push({
			threshold: round(threshold, 2),
			fpr: round(fpr, 3),
			tpr: round(tpr, 3),
		});
	}
	return points;
}

export function precisionRecallCurve(
	examples: readonly NeoantigenExample[],
	model: LogisticModel,
	steps = 40,
) {
	const points: { threshold: number; precision: number; recall: number }[] = [];
	for (let i = 0; i <= steps; i += 1) {
		const threshold = i / steps;
		const metrics = classificationMetrics(examples, model, threshold);
		points.push({
			threshold: round(threshold, 2),
			precision: metrics.precision,
			recall: metrics.recall,
		});
	}
	return points;
}

export function featureImportances(model: LogisticModel) {
	return model.featureKeys.map((key, index) => ({
		key,
		label: FEATURE_META[key].label,
		weight: model.weights[index]!,
		absWeight: round(Math.abs(model.weights[index]!), 4),
		direction: model.weights[index]! >= 0 ? "increases priority" : "decreases priority",
	})).sort((a, b) => b.absWeight - a.absWeight);
}

export function probabilityBins(
	examples: readonly NeoantigenExample[],
	model: LogisticModel,
	binCount = 10,
) {
	const bins = Array.from({ length: binCount }, (_, index) => ({
		binLabel: `${round(index / binCount, 1)}–${round((index + 1) / binCount, 1)}`,
		count: 0,
		positives: 0,
		midpoint: round((index + 0.5) / binCount, 2),
	}));
	for (const example of examples) {
		const p = predictProbability(example, model);
		const index = Math.min(binCount - 1, Math.floor(p * binCount));
		bins[index]!.count += 1;
		if (example.priority === 1) bins[index]!.positives += 1;
	}
	return bins.map((bin) => ({
		...bin,
		positiveRate:
			bin.count === 0 ? 0 : round(bin.positives / bin.count, 3),
	}));
}

export function scoredExamples(
	examples: readonly NeoantigenExample[],
	model: LogisticModel,
	threshold: number,
) {
	return examples
		.map((example) => {
			const probability = round(predictProbability(example, model), 3);
			const predicted = probability >= threshold ? 1 : 0;
			return {
				...example,
				probability,
				predicted: predicted as 0 | 1,
				correct: predicted === example.priority,
			};
		})
		.sort((a, b) => b.probability - a.probability);
}

export const ML_GLOSSARY = [
	{
		term: "Logistic regression",
		definition:
			"A linear model that estimates the probability of a binary outcome. Coefficients show how each standardised feature shifts the log-odds of neoantigen priority in this synthetic demo.",
	},
	{
		term: "Decision threshold",
		definition:
			"The probability cut-off used to turn a score into a yes/no priority call. Lower thresholds increase recall; higher thresholds increase precision.",
	},
	{
		term: "ROC AUC",
		definition:
			"Area under the receiver-operating-characteristic curve. Summarises ranking quality across thresholds (0.5 ≈ chance, 1.0 ≈ perfect separation on the synthetic hold-out set).",
	},
	{
		term: "Precision / recall",
		definition:
			"Precision is the fraction of predicted priorities that are truly labelled priority; recall is the fraction of true priorities recovered.",
	},
] as const;
