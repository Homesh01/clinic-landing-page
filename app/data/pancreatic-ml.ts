/**
 * Client-side logistic regression on PDAC vaccine CloneTrack kinetics.
 * Predicts above-median post-boost lifespan from priming-phase features only.
 */

import mlClones from "~/data/pancreatic/ml_clones.json";

export const PDAC_ML_SEED = 20251101;
export const PDAC_FEATURE_KEYS = mlClones.featureKeys as readonly string[];
export const PDAC_FEATURE_LABELS = mlClones.featureLabels as Record<string, string>;
export const PDAC_ML_TASK = mlClones.task;
export const PDAC_POSITIVE_RATE = mlClones.positiveRate;
export const PDAC_LONGEVITY_THRESHOLD = mlClones.longevityThresholdYears;

export type PdacCloneExample = {
	id: string;
	y: 0 | 1;
	label: string;
	logPeakPrime: number;
	peakFreqPrime: number;
	halfLifeDaysPrime: number;
	lifespanYearsPrime: number;
	lifespanYearsBoost: number;
};

export const ALL_PDAC_CLONES = mlClones.clones as unknown as PdacCloneExample[];

export type Standardizer = { means: number[]; stds: number[] };

export type LogisticModel = {
	weights: number[];
	bias: number;
	featureKeys: readonly string[];
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
	baselineAccuracy: number;
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

function round(value: number, digits = 3) {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

function sigmoid(z: number) {
	if (z >= 20) return 1;
	if (z <= -20) return 0;
	return 1 / (1 + Math.exp(-z));
}

export function featureVector(example: PdacCloneExample): number[] {
	return PDAC_FEATURE_KEYS.map(
		(key) => example[key as keyof PdacCloneExample] as number,
	);
}

export function trainTestSplit(
	examples: readonly PdacCloneExample[],
	trainRatio = 0.75,
	seed = PDAC_ML_SEED,
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
	return { train: copy.slice(0, cut), test: copy.slice(cut) };
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
	return row.map(
		(value, index) =>
			(value - standardizer.means[index]!) / standardizer.stds[index]!,
	);
}

export function trainLogisticRegression(
	train: readonly PdacCloneExample[],
	options?: { epochs?: number; learningRate?: number; l2?: number },
): LogisticModel {
	const epochs = options?.epochs ?? 600;
	const learningRate = options?.learningRate ?? 0.35;
	const l2 = options?.l2 ?? 0.04;
	const raw = train.map(featureVector);
	const labels = train.map((example) => example.y);
	const nPos = labels.filter((y) => y === 1).length || 1;
	const nNeg = labels.filter((y) => y === 0).length || 1;
	const wPos = train.length / (2 * nPos);
	const wNeg = train.length / (2 * nNeg);

	const standardizer = fitStandardizer(raw);
	const X = raw.map((row) => standardizeRow(row, standardizer));
	const dims = PDAC_FEATURE_KEYS.length;
	const weights = Array.from({ length: dims }, () => 0);
	let bias = 0;
	let trainLoss = 0;

	for (let epoch = 0; epoch < epochs; epoch += 1) {
		const gradW = Array.from({ length: dims }, () => 0);
		let gradB = 0;
		let loss = 0;
		let weightSum = 0;
		for (let i = 0; i < X.length; i += 1) {
			const row = X[i]!;
			let z = bias;
			for (let d = 0; d < dims; d += 1) z += weights[d]! * row[d]!;
			const pred = sigmoid(z);
			const y = labels[i]!;
			const sampleW = y === 1 ? wPos : wNeg;
			weightSum += sampleW;
			const err = sampleW * (pred - y);
			loss +=
				sampleW *
				-(y * Math.log(pred + 1e-9) + (1 - y) * Math.log(1 - pred + 1e-9));
			for (let d = 0; d < dims; d += 1) {
				gradW[d]! += err * row[d]!;
			}
			gradB += err;
		}
		const n = weightSum || 1;
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
		featureKeys: PDAC_FEATURE_KEYS,
		standardizer,
		trainLoss: round(trainLoss, 4),
		epochs,
		learningRate,
		l2,
	};
}

export function predictProbability(
	example: PdacCloneExample,
	model: LogisticModel,
) {
	const row = standardizeRow(featureVector(example), model.standardizer);
	let z = model.bias;
	for (let d = 0; d < row.length; d += 1) {
		z += model.weights[d]! * row[d]!;
	}
	return sigmoid(z);
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
	return auc;
}

export function classificationMetrics(
	examples: readonly PdacCloneExample[],
	model: LogisticModel,
	threshold: number,
): ClassMetrics {
	let tp = 0;
	let fp = 0;
	let tn = 0;
	let fn = 0;
	const scores: { score: number; label: 0 | 1 }[] = [];
	for (const example of examples) {
		const score = predictProbability(example, model);
		const pred = score >= threshold ? 1 : 0;
		scores.push({ score, label: example.y });
		if (pred === 1 && example.y === 1) tp += 1;
		else if (pred === 1 && example.y === 0) fp += 1;
		else if (pred === 0 && example.y === 0) tn += 1;
		else fn += 1;
	}
	const n = examples.length;
	const positives = tp + fn;
	const negatives = tn + fp;
	const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
	const recall = positives === 0 ? 0 : tp / positives;
	const specificity = negatives === 0 ? 0 : tn / negatives;
	const f1 =
		precision + recall === 0
			? 0
			: (2 * precision * recall) / (precision + recall);
	const majority = Math.max(positives, negatives) / (n || 1);
	return {
		n,
		positives,
		negatives,
		tp,
		fp,
		tn,
		fn,
		accuracy: round((tp + tn) / (n || 1), 3),
		precision: round(precision, 3),
		recall: round(recall, 3),
		f1: round(f1, 3),
		specificity: round(specificity, 3),
		auc: round(trapzAuc(scores), 3),
		baselineAccuracy: round(majority, 3),
	};
}

export function featureImportances(model: LogisticModel) {
	return model.featureKeys.map((key, index) => ({
		key,
		label: PDAC_FEATURE_LABELS[key] ?? key,
		weight: model.weights[index]!,
		absWeight: Math.abs(model.weights[index]!),
	}));
}

export function rocCurve(
	examples: readonly PdacCloneExample[],
	model: LogisticModel,
) {
	const scores = examples
		.map((example) => ({
			score: predictProbability(example, model),
			label: example.y,
		}))
		.sort((a, b) => b.score - a.score);
	const positives = scores.filter((row) => row.label === 1).length;
	const negatives = scores.length - positives;
	const points: { fpr: number; tpr: number }[] = [{ fpr: 0, tpr: 0 }];
	let tp = 0;
	let fp = 0;
	for (const row of scores) {
		if (row.label === 1) tp += 1;
		else fp += 1;
		points.push({
			fpr: negatives === 0 ? 0 : fp / negatives,
			tpr: positives === 0 ? 0 : tp / positives,
		});
	}
	return points;
}

/**
 * Leave-one-clone-out AUC / accuracy. Prefer this over a single hold-out split when
 * n is small (hold-out AUC can hit 1.0 by chance on ~15 clones).
 */
export function leaveOneOutMetrics(
	examples: readonly PdacCloneExample[],
	threshold = 0.5,
): Pick<ClassMetrics, "n" | "accuracy" | "auc" | "f1" | "baselineAccuracy"> {
	if (examples.length < 5) {
		return {
			n: examples.length,
			accuracy: 0,
			auc: 0.5,
			f1: 0,
			baselineAccuracy: 0.5,
		};
	}
	const scores: { score: number; label: 0 | 1 }[] = [];
	let tp = 0;
	let fp = 0;
	let tn = 0;
	let fn = 0;
	for (let i = 0; i < examples.length; i += 1) {
		const holdout = examples[i]!;
		const train = examples.filter((_, j) => j !== i);
		const model = trainLogisticRegression(train);
		const score = predictProbability(holdout, model);
		scores.push({ score, label: holdout.y });
		const pred = score >= threshold ? 1 : 0;
		if (pred === 1 && holdout.y === 1) tp += 1;
		else if (pred === 1 && holdout.y === 0) fp += 1;
		else if (pred === 0 && holdout.y === 0) tn += 1;
		else fn += 1;
	}
	const n = examples.length;
	const positives = tp + fn;
	const negatives = tn + fp;
	const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
	const recall = positives === 0 ? 0 : tp / positives;
	const f1 =
		precision + recall === 0
			? 0
			: (2 * precision * recall) / (precision + recall);
	return {
		n,
		accuracy: round((tp + tn) / (n || 1), 3),
		auc: round(trapzAuc(scores), 3),
		f1: round(f1, 3),
		baselineAccuracy: round(Math.max(positives, negatives) / (n || 1), 3),
	};
}
