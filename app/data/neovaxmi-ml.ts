/**
 * Client-side logistic regression on NeoVaxMI IMP-expanded TCR clones (Data S3).
 * Predicts post-vaccine repertoire category from in vitro peptide-pool expansion features.
 */

import mlClones from "~/data/neovaxmi/ml_clones.json";

export const NEOVAXMI_ML_SEED = 20261021;
export const NEOVAXMI_FEATURE_KEYS = mlClones.featureKeys as readonly string[];
export const NEOVAXMI_FEATURE_LABELS = mlClones.featureLabels as Record<
	string,
	string
>;
export const NEOVAXMI_ML_TASK = mlClones.task;
export const NEOVAXMI_POSITIVE_RATE = mlClones.positiveRate;
export const NEOVAXMI_CLASS_COUNTS = mlClones.classCounts as Record<
	string,
	number
>;

export type NeoVaxmiCloneExample = {
	id: string;
	patientId: string;
	category: string;
	y: 0 | 1;
	log2fcPoolA: number;
	log2fcPoolB: number;
	maxLog2fc: number;
	poolDelta: number;
	poolAShare: number;
};

export const ALL_NEOVAXMI_CLONES =
	mlClones.clones as unknown as NeoVaxmiCloneExample[];

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

export function featureVector(example: NeoVaxmiCloneExample): number[] {
	return NEOVAXMI_FEATURE_KEYS.map(
		(key) => example[key as keyof NeoVaxmiCloneExample] as number,
	);
}

export function trainTestSplit(
	examples: readonly NeoVaxmiCloneExample[],
	trainRatio = 0.75,
	seed = NEOVAXMI_ML_SEED,
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

/** Class-weighted L2 logistic regression (handles ~89% post-vaccine base rate). */
export function trainLogisticRegression(
	train: readonly NeoVaxmiCloneExample[],
	options?: { epochs?: number; learningRate?: number; l2?: number },
): LogisticModel {
	const epochs = options?.epochs ?? 500;
	const learningRate = options?.learningRate ?? 0.4;
	const l2 = options?.l2 ?? 0.03;
	const raw = train.map(featureVector);
	const labels = train.map((example) => example.y);
	const nPos = labels.filter((y) => y === 1).length || 1;
	const nNeg = labels.filter((y) => y === 0).length || 1;
	const wPos = train.length / (2 * nPos);
	const wNeg = train.length / (2 * nNeg);

	const standardizer = fitStandardizer(raw);
	const X = raw.map((row) => standardizeRow(row, standardizer));
	const dims = NEOVAXMI_FEATURE_KEYS.length;
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
		featureKeys: NEOVAXMI_FEATURE_KEYS,
		standardizer,
		trainLoss: round(trainLoss, 4),
		epochs,
		learningRate,
		l2,
	};
}

export function predictProbability(
	example: NeoVaxmiCloneExample,
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
	examples: readonly NeoVaxmiCloneExample[],
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
		precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
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
		label: NEOVAXMI_FEATURE_LABELS[key] ?? key,
		weight: model.weights[index]!,
		absWeight: Math.abs(model.weights[index]!),
	}));
}

export function rocCurve(
	examples: readonly NeoVaxmiCloneExample[],
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

/** Leave-one-patient-out: does mutation burden help predict vaccine TCR expansion? */
export function patientLoocvExpansion(patients: readonly {
	patientId: string;
	codingMutations: number | null;
	neoantigenProxy: number | null;
	expandedAfterVaccine: number | null;
}[]) {
	const rows = patients.filter(
		(p) =>
			p.codingMutations != null &&
			p.neoantigenProxy != null &&
			p.expandedAfterVaccine != null,
	) as {
		patientId: string;
		codingMutations: number;
		neoantigenProxy: number;
		expandedAfterVaccine: number;
	}[];

	if (rows.length < 3) {
		return {
			n: rows.length,
			corr: null as number | null,
			mae: null as number | null,
			points: [] as {
				patientId: string;
				actual: number;
				predicted: number;
				residual: number;
			}[],
		};
	}

	const points = rows.map((holdout) => {
		const train = rows.filter((r) => r.patientId !== holdout.patientId);
		// Simple multiple linear regression via normal equations (2 features + bias)
		const n = train.length;
		let sxx = 0;
		let sxy = 0;
		let sxz = 0;
		let syy = 0;
		let syz = 0;
		let szz = 0;
		let sx = 0;
		let sy = 0;
		let sz = 0;
		for (const r of train) {
			const x = r.codingMutations;
			const y = r.neoantigenProxy;
			const z = r.expandedAfterVaccine;
			sx += x;
			sy += y;
			sz += z;
			sxx += x * x;
			syy += y * y;
			szz += z * z;
			sxy += x * y;
			sxz += x * z;
			syz += y * z;
		}
		// Solve [n sx sy; sx sxx sxy; sy sxy syy] [b0;b1;b2] = [sz;sxz;syz]
		const A = [
			[n, sx, sy],
			[sx, sxx, sxy],
			[sy, sxy, syy],
		];
		const b = [sz, sxz, syz];
		const coef = solve3(A, b);
		const predicted =
			coef[0]! +
			coef[1]! * holdout.codingMutations +
			coef[2]! * holdout.neoantigenProxy;
		return {
			patientId: holdout.patientId,
			actual: holdout.expandedAfterVaccine,
			predicted: round(predicted, 1),
			residual: round(holdout.expandedAfterVaccine - predicted, 1),
		};
	});

	const actuals = points.map((p) => p.actual);
	const preds = points.map((p) => p.predicted);
	const meanA = actuals.reduce((s, v) => s + v, 0) / actuals.length;
	const meanP = preds.reduce((s, v) => s + v, 0) / preds.length;
	let num = 0;
	let denA = 0;
	let denP = 0;
	for (let i = 0; i < points.length; i += 1) {
		num += (actuals[i]! - meanA) * (preds[i]! - meanP);
		denA += (actuals[i]! - meanA) ** 2;
		denP += (preds[i]! - meanP) ** 2;
	}
	const corr =
		denA === 0 || denP === 0 ? null : round(num / Math.sqrt(denA * denP), 3);
	const mae = round(
		points.reduce((s, p) => s + Math.abs(p.residual), 0) / points.length,
		1,
	);
	return { n: points.length, corr, mae, points };
}

function solve3(A: number[][], b: number[]) {
	const M = A.map((row, i) => [...row, b[i]!]);
	const n = 3;
	for (let col = 0; col < n; col += 1) {
		let pivot = col;
		for (let r = col + 1; r < n; r += 1) {
			if (Math.abs(M[r]![col]!) > Math.abs(M[pivot]![col]!)) pivot = r;
		}
		const tmp = M[col]!;
		M[col] = M[pivot]!;
		M[pivot] = tmp;
		const div = M[col]![col]! || 1e-12;
		for (let c = col; c <= n; c += 1) M[col]![c]! /= div;
		for (let r = 0; r < n; r += 1) {
			if (r === col) continue;
			const factor = M[r]![col]!;
			for (let c = col; c <= n; c += 1) {
				M[r]![c]! -= factor * M[col]![c]!;
			}
		}
	}
	return [M[0]![3]!, M[1]![3]!, M[2]![3]!];
}
