/**
 * Synthetic multi-omics patient-stratification demonstration.
 * PCA + k-means + random forest on invented molecular profiles — no real patient data.
 */

export const MULTI_SEED = 20261017;
export const MULTI_DATASET_LABEL = "Synthetic demonstration data" as const;

export const MARKER_KEYS = [
	"pdL1",
	"tmbProxy",
	"ifnGamma",
	"cd8Infiltrate",
	"myeloidSuppress",
	"angiogenesis",
	"glycolysis",
	"dnaRepair",
	"tgfBeta",
	"proliferation",
	"stromalDensity",
	"neoantigenLoad",
] as const;

export type MarkerKey = (typeof MARKER_KEYS)[number];

export const MARKER_META: Record<MarkerKey, { label: string; axis: string }> = {
	pdL1: { label: "PD-L1 score", axis: "Immune checkpoint" },
	tmbProxy: { label: "TMB proxy", axis: "Genomic" },
	ifnGamma: { label: "IFN-γ signature", axis: "Immune" },
	cd8Infiltrate: { label: "CD8 infiltrate", axis: "Immune" },
	myeloidSuppress: { label: "Myeloid suppression", axis: "Immune" },
	angiogenesis: { label: "Angiogenesis", axis: "Microenvironment" },
	glycolysis: { label: "Glycolysis", axis: "Metabolic" },
	dnaRepair: { label: "DNA-repair score", axis: "Genomic" },
	tgfBeta: { label: "TGF-β signature", axis: "Microenvironment" },
	proliferation: { label: "Proliferation", axis: "Tumour" },
	stromalDensity: { label: "Stromal density", axis: "Microenvironment" },
	neoantigenLoad: { label: "Neoantigen load", axis: "Genomic" },
};

export const CANCER_TYPES = [
	"Melanoma",
	"Lung cancer",
	"Colorectal cancer",
	"Pancreatic cancer",
	"Renal cancer",
] as const;

export type MultiCancerType = (typeof CANCER_TYPES)[number];

export type MultiomicsPatient = {
	id: string;
	cancerType: MultiCancerType;
	/** Synthetic binary endpoint: high immune engagement. */
	highResponse: 0 | 1;
	markers: Record<MarkerKey, number>;
};

export type PcaResult = {
	points: {
		id: string;
		pc1: number;
		pc2: number;
		cancerType: MultiCancerType;
		highResponse: 0 | 1;
		cluster: number;
	}[];
	loadings: { marker: MarkerKey; label: string; pc1: number; pc2: number }[];
	varianceExplained: [number, number];
};

export type ClusterSummary = {
	cluster: number;
	n: number;
	highResponseRate: number;
	meanMarkers: Record<MarkerKey, number>;
};

export type RandomForestModel = {
	trees: DecisionTree[];
	featureKeys: readonly MarkerKey[];
	nTrees: number;
	maxDepth: number;
	importances: { key: MarkerKey; label: string; importance: number }[];
};

export type EnsembleMetrics = {
	n: number;
	accuracy: number;
	precision: number;
	recall: number;
	f1: number;
	tp: number;
	fp: number;
	tn: number;
	fn: number;
};

type DecisionNode =
	| {
			kind: "leaf";
			prediction: 0 | 1;
			samples: number;
	  }
	| {
			kind: "split";
			featureIndex: number;
			threshold: number;
			left: DecisionNode;
			right: DecisionNode;
			samples: number;
	  };

type DecisionTree = {
	root: DecisionNode;
	featureIndices: number[];
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
	if (values.length === 0) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]) {
	if (values.length < 2) return 0;
	const m = mean(values);
	const variance =
		values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length;
	return Math.sqrt(variance);
}

function generatePatients(rng: () => number, count = 260): MultiomicsPatient[] {
	const patients: MultiomicsPatient[] = [];
	for (let i = 0; i < count; i += 1) {
		const cancerType = CANCER_TYPES[Math.floor(rng() * CANCER_TYPES.length)]!;
		// Latent subtype drives correlated marker patterns.
		const subtype = rng();
		const immuneHot = subtype > 0.62;
		const stromal = subtype < 0.28;
		const genomic = !immuneHot && !stromal;

		const noise = () => (rng() - 0.5) * 18;
		const markers: Record<MarkerKey, number> = {
			pdL1: round(
				clamp(
					(immuneHot ? 68 : stromal ? 28 : 42) + noise() + (cancerType === "Melanoma" ? 8 : 0),
					5,
					98,
				),
				1,
			),
			tmbProxy: round(
				clamp(
					(genomic || cancerType === "Melanoma" || cancerType === "Lung cancer"
						? 22
						: 9) +
						rng() * 18 +
						noise() * 0.4,
					1,
					55,
				),
				1,
			),
			ifnGamma: round(
				clamp((immuneHot ? 72 : 30) + noise() + (stromal ? -12 : 0), 4, 96),
				1,
			),
			cd8Infiltrate: round(
				clamp((immuneHot ? 70 : 26) + noise() * 0.9, 3, 95),
				1,
			),
			myeloidSuppress: round(
				clamp((stromal ? 65 : immuneHot ? 28 : 40) + noise(), 5, 92),
				1,
			),
			angiogenesis: round(
				clamp((stromal ? 62 : 35) + noise() + (genomic ? 8 : 0), 8, 90),
				1,
			),
			glycolysis: round(
				clamp((stromal || genomic ? 58 : 34) + noise(), 10, 92),
				1,
			),
			dnaRepair: round(
				clamp((genomic ? 30 : 55) + noise() * 0.8, 8, 88),
				1,
			),
			tgfBeta: round(
				clamp((stromal ? 68 : 32) + noise(), 6, 94),
				1,
			),
			proliferation: round(
				clamp((genomic ? 64 : 44) + noise(), 12, 95),
				1,
			),
			stromalDensity: round(
				clamp((stromal ? 72 : 28) + noise(), 5, 96),
				1,
			),
			neoantigenLoad: round(
				clamp(
					(immuneHot || genomic ? 0.62 : 0.28) * 100 +
						noise() * 0.6 +
						(cancerType === "Melanoma" ? 10 : 0),
					4,
					98,
				),
				1,
			),
		};

		const latent =
			0.22 * (markers.ifnGamma / 100) +
			0.2 * (markers.cd8Infiltrate / 100) +
			0.18 * (markers.neoantigenLoad / 100) +
			0.12 * (markers.pdL1 / 100) +
			0.1 * (markers.tmbProxy / 55) -
			0.14 * (markers.myeloidSuppress / 100) -
			0.1 * (markers.tgfBeta / 100) +
			(rng() - 0.5) * 0.18;

		patients.push({
			id: `MO-${String(i + 1).padStart(3, "0")}`,
			cancerType,
			highResponse: latent > 0.42 ? 1 : 0,
			markers,
		});
	}
	return patients;
}

const rngRoot = createRng(MULTI_SEED);
export const ALL_MULTIOMICS_PATIENTS = generatePatients(rngRoot);

export function trainTestSplitPatients(
	patients: readonly MultiomicsPatient[],
	trainRatio = 0.7,
	seed = MULTI_SEED + 41,
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

function markerMatrix(patients: readonly MultiomicsPatient[]) {
	return patients.map((patient) => MARKER_KEYS.map((key) => patient.markers[key]));
}

function standardizeColumns(matrix: number[][]) {
	const cols = matrix[0]?.length ?? 0;
	const means = Array.from({ length: cols }, (_, c) =>
		mean(matrix.map((row) => row[c]!)),
	);
	const stds = Array.from({ length: cols }, (_, c) => {
		const sd = stdDev(matrix.map((row) => row[c]!));
		return sd === 0 ? 1 : sd;
	});
	const standardized = matrix.map((row) =>
		row.map((value, c) => (value - means[c]!) / stds[c]!),
	);
	return { standardized, means, stds };
}

/** Power-iteration PCA for the first two components (small feature count). */
export function computePca(
	patients: readonly MultiomicsPatient[],
	clusterById: Map<string, number>,
): PcaResult {
	const raw = markerMatrix(patients);
	const { standardized } = standardizeColumns(raw);
	const n = standardized.length;
	const d = MARKER_KEYS.length;
	if (n < 3) {
		return {
			points: [],
			loadings: [],
			varianceExplained: [0, 0],
		};
	}

	const cov: number[][] = Array.from({ length: d }, () =>
		Array.from({ length: d }, () => 0),
	);
	for (let i = 0; i < d; i += 1) {
		for (let j = i; j < d; j += 1) {
			let sum = 0;
			for (let r = 0; r < n; r += 1) {
				sum += standardized[r]![i]! * standardized[r]![j]!;
			}
			const value = sum / (n - 1);
			cov[i]![j] = value;
			cov[j]![i] = value;
		}
	}

	function powerIteration(matrix: number[][], exclude?: number[]) {
		let vector = Array.from({ length: d }, (_, i) => ((i % 3) + 1) / d);
		if (exclude) {
			// Orthogonalise initial guess against previous component.
			let dot = 0;
			for (let i = 0; i < d; i += 1) dot += vector[i]! * exclude[i]!;
			for (let i = 0; i < d; i += 1) vector[i]! -= dot * exclude[i]!;
		}
		for (let iter = 0; iter < 80; iter += 1) {
			const next = Array.from({ length: d }, () => 0);
			for (let i = 0; i < d; i += 1) {
				let sum = 0;
				for (let j = 0; j < d; j += 1) sum += matrix[i]![j]! * vector[j]!;
				next[i] = sum;
			}
			if (exclude) {
				let dot = 0;
				for (let i = 0; i < d; i += 1) dot += next[i]! * exclude[i]!;
				for (let i = 0; i < d; i += 1) next[i]! -= dot * exclude[i]!;
			}
			const norm = Math.sqrt(next.reduce((sum, value) => sum + value ** 2, 0)) || 1;
			vector = next.map((value) => value / norm);
		}
		let lambda = 0;
		for (let i = 0; i < d; i += 1) {
			let sum = 0;
			for (let j = 0; j < d; j += 1) sum += matrix[i]![j]! * vector[j]!;
			lambda += vector[i]! * sum;
		}
		return { vector, lambda };
	}

	const first = powerIteration(cov);
	const second = powerIteration(cov, first.vector);
	const totalVar = cov.reduce((sum, row, i) => sum + row[i]!, 0) || 1;

	const points = patients.map((patient, index) => {
		const row = standardized[index]!;
		let pc1 = 0;
		let pc2 = 0;
		for (let i = 0; i < d; i += 1) {
			pc1 += row[i]! * first.vector[i]!;
			pc2 += row[i]! * second.vector[i]!;
		}
		return {
			id: patient.id,
			pc1: round(pc1, 3),
			pc2: round(pc2, 3),
			cancerType: patient.cancerType,
			highResponse: patient.highResponse,
			cluster: clusterById.get(patient.id) ?? 0,
		};
	});

	const loadings = MARKER_KEYS.map((marker, index) => ({
		marker,
		label: MARKER_META[marker].label,
		pc1: round(first.vector[index]!, 3),
		pc2: round(second.vector[index]!, 3),
	}));

	return {
		points,
		loadings,
		varianceExplained: [
			round(first.lambda / totalVar, 3),
			round(second.lambda / totalVar, 3),
		],
	};
}

export function runKMeans(
	patients: readonly MultiomicsPatient[],
	k: number,
	seed = MULTI_SEED + 7,
): { assignments: Map<string, number>; summaries: ClusterSummary[]; inertia: number } {
	const local = createRng(seed);
	const { standardized } = standardizeColumns(markerMatrix(patients));
	const n = standardized.length;
	const d = MARKER_KEYS.length;
	const kSafe = Math.max(2, Math.min(k, Math.max(2, n)));

	// k-means++ style init
	const centroids: number[][] = [];
	const firstIdx = Math.floor(local() * n);
	centroids.push([...standardized[firstIdx]!]);
	while (centroids.length < kSafe) {
		const distances = standardized.map((row) => {
			let best = Infinity;
			for (const centroid of centroids) {
				let dist = 0;
				for (let i = 0; i < d; i += 1) {
					const diff = row[i]! - centroid[i]!;
					dist += diff * diff;
				}
				best = Math.min(best, dist);
			}
			return best;
		});
		const total = distances.reduce((sum, value) => sum + value, 0) || 1;
		let threshold = local() * total;
		let chosen = n - 1;
		for (let i = 0; i < n; i += 1) {
			threshold -= distances[i]!;
			if (threshold <= 0) {
				chosen = i;
				break;
			}
		}
		centroids.push([...standardized[chosen]!]);
	}

	const labels = Array.from({ length: n }, () => 0);
	for (let iter = 0; iter < 40; iter += 1) {
		let moved = false;
		for (let i = 0; i < n; i += 1) {
			let best = 0;
			let bestDist = Infinity;
			for (let c = 0; c < kSafe; c += 1) {
				let dist = 0;
				for (let j = 0; j < d; j += 1) {
					const diff = standardized[i]![j]! - centroids[c]![j]!;
					dist += diff * diff;
				}
				if (dist < bestDist) {
					bestDist = dist;
					best = c;
				}
			}
			if (labels[i] !== best) {
				labels[i] = best;
				moved = true;
			}
		}

		const sums = Array.from({ length: kSafe }, () =>
			Array.from({ length: d }, () => 0),
		);
		const counts = Array.from({ length: kSafe }, () => 0);
		for (let i = 0; i < n; i += 1) {
			const label = labels[i]!;
			counts[label]! += 1;
			for (let j = 0; j < d; j += 1) {
				sums[label]![j]! += standardized[i]![j]!;
			}
		}
		for (let c = 0; c < kSafe; c += 1) {
			if (counts[c] === 0) {
				centroids[c] = [...standardized[Math.floor(local() * n)]!];
				continue;
			}
			for (let j = 0; j < d; j += 1) {
				centroids[c]![j] = sums[c]![j]! / counts[c]!;
			}
		}
		if (!moved) break;
	}

	let inertia = 0;
	for (let i = 0; i < n; i += 1) {
		const c = labels[i]!;
		for (let j = 0; j < d; j += 1) {
			const diff = standardized[i]![j]! - centroids[c]![j]!;
			inertia += diff * diff;
		}
	}

	const assignments = new Map<string, number>();
	patients.forEach((patient, index) => {
		assignments.set(patient.id, labels[index]!);
	});

	const summaries: ClusterSummary[] = Array.from({ length: kSafe }, (_, cluster) => {
		const members = patients.filter((_, index) => labels[index] === cluster);
		const meanMarkers = Object.fromEntries(
			MARKER_KEYS.map((key) => [
				key,
				round(mean(members.map((patient) => patient.markers[key])), 1),
			]),
		) as Record<MarkerKey, number>;
		const high = members.filter((patient) => patient.highResponse === 1).length;
		return {
			cluster,
			n: members.length,
			highResponseRate: members.length
				? round(high / members.length, 3)
				: 0,
			meanMarkers,
		};
	}).filter((row) => row.n > 0);

	return { assignments, summaries, inertia: round(inertia, 1) };
}

export function silhouetteScore(
	patients: readonly MultiomicsPatient[],
	assignments: Map<string, number>,
) {
	const { standardized } = standardizeColumns(markerMatrix(patients));
	const labels = patients.map((patient) => assignments.get(patient.id) ?? 0);
	const n = standardized.length;
	if (n < 3) return 0;

	const clusters = [...new Set(labels)];
	if (clusters.length < 2) return 0;

	function dist(a: number[], b: number[]) {
		let sum = 0;
		for (let i = 0; i < a.length; i += 1) {
			const diff = a[i]! - b[i]!;
			sum += diff * diff;
		}
		return Math.sqrt(sum);
	}

	let total = 0;
	for (let i = 0; i < n; i += 1) {
		const own = labels[i]!;
		const same = standardized.filter((_, index) => labels[index] === own && index !== i);
		const a =
			same.length === 0
				? 0
				: mean(same.map((row) => dist(standardized[i]!, row)));
		let b = Infinity;
		for (const cluster of clusters) {
			if (cluster === own) continue;
			const other = standardized.filter((_, index) => labels[index] === cluster);
			if (other.length === 0) continue;
			b = Math.min(b, mean(other.map((row) => dist(standardized[i]!, row))));
		}
		if (!Number.isFinite(b)) continue;
		const s = (b - a) / Math.max(a, b, 1e-9);
		total += s;
	}
	return round(total / n, 3);
}

function giniImpurity(labels: number[]) {
	if (labels.length === 0) return 0;
	const positives = labels.filter((value) => value === 1).length;
	const p = positives / labels.length;
	return 1 - (p * p + (1 - p) * (1 - p));
}

function majorityLabel(labels: number[]): 0 | 1 {
	const positives = labels.filter((value) => value === 1).length;
	return positives * 2 >= labels.length ? 1 : 0;
}

function buildTree(
	matrix: number[][],
	labels: number[],
	featurePool: number[],
	depth: number,
	maxDepth: number,
	minLeaf: number,
	rng: () => number,
): DecisionNode {
	const samples = labels.length;
	if (
		depth >= maxDepth ||
		samples <= minLeaf ||
		labels.every((value) => value === labels[0])
	) {
		return { kind: "leaf", prediction: majorityLabel(labels), samples };
	}

	const mtry = Math.max(1, Math.floor(Math.sqrt(featurePool.length)));
	const shuffled = [...featurePool];
	for (let i = shuffled.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		const tmp = shuffled[i]!;
		shuffled[i] = shuffled[j]!;
		shuffled[j] = tmp;
	}
	const candidates = shuffled.slice(0, mtry);

	let bestGain = 0;
	let bestFeature = candidates[0]!;
	let bestThreshold = 0;
	let bestLeftIdx: number[] = [];
	let bestRightIdx: number[] = [];
	const parentImpurity = giniImpurity(labels);

	for (const featureIndex of candidates) {
		const values = matrix.map((row) => row[featureIndex]!);
		const unique = [...new Set(values.map((value) => round(value, 2)))].sort(
			(a, b) => a - b,
		);
		const step = Math.max(1, Math.floor(unique.length / 12));
		for (let t = step; t < unique.length; t += step) {
			const threshold = (unique[t - 1]! + unique[t]!) / 2;
			const leftIdx: number[] = [];
			const rightIdx: number[] = [];
			for (let i = 0; i < matrix.length; i += 1) {
				if (matrix[i]![featureIndex]! <= threshold) leftIdx.push(i);
				else rightIdx.push(i);
			}
			if (leftIdx.length < minLeaf || rightIdx.length < minLeaf) continue;
			const leftLabels = leftIdx.map((index) => labels[index]!);
			const rightLabels = rightIdx.map((index) => labels[index]!);
			const gain =
				parentImpurity -
				(leftLabels.length / samples) * giniImpurity(leftLabels) -
				(rightLabels.length / samples) * giniImpurity(rightLabels);
			if (gain > bestGain) {
				bestGain = gain;
				bestFeature = featureIndex;
				bestThreshold = threshold;
				bestLeftIdx = leftIdx;
				bestRightIdx = rightIdx;
			}
		}
	}

	if (bestGain <= 1e-6 || bestLeftIdx.length === 0) {
		return { kind: "leaf", prediction: majorityLabel(labels), samples };
	}

	return {
		kind: "split",
		featureIndex: bestFeature,
		threshold: bestThreshold,
		samples,
		left: buildTree(
			bestLeftIdx.map((index) => matrix[index]!),
			bestLeftIdx.map((index) => labels[index]!),
			featurePool,
			depth + 1,
			maxDepth,
			minLeaf,
			rng,
		),
		right: buildTree(
			bestRightIdx.map((index) => matrix[index]!),
			bestRightIdx.map((index) => labels[index]!),
			featurePool,
			depth + 1,
			maxDepth,
			minLeaf,
			rng,
		),
	};
}

function predictTree(node: DecisionNode, row: number[]): 0 | 1 {
	if (node.kind === "leaf") return node.prediction;
	if (row[node.featureIndex]! <= node.threshold) {
		return predictTree(node.left, row);
	}
	return predictTree(node.right, row);
}

function accumulateImportance(node: DecisionNode, scores: number[]) {
	if (node.kind === "leaf") return;
	const total = node.left.samples + node.right.samples || 1;
	// Approximate contribution by samples routed through the split.
	scores[node.featureIndex]! += total;
	accumulateImportance(node.left, scores);
	accumulateImportance(node.right, scores);
}

export function trainRandomForest(
	patients: readonly MultiomicsPatient[],
	options?: { nTrees?: number; maxDepth?: number; seed?: number },
): RandomForestModel {
	const nTrees = options?.nTrees ?? 45;
	const maxDepth = options?.maxDepth ?? 5;
	const local = createRng(options?.seed ?? MULTI_SEED + 99);
	const { standardized } = standardizeColumns(markerMatrix(patients));
	const labels = patients.map((patient) => patient.highResponse);
	const featurePool = MARKER_KEYS.map((_, index) => index);
	const trees: DecisionTree[] = [];
	const importanceRaw = Array.from({ length: MARKER_KEYS.length }, () => 0);

	for (let t = 0; t < nTrees; t += 1) {
		const bagMatrix: number[][] = [];
		const bagLabels: number[] = [];
		for (let i = 0; i < patients.length; i += 1) {
			const index = Math.floor(local() * patients.length);
			bagMatrix.push(standardized[index]!);
			bagLabels.push(labels[index]!);
		}
		const root = buildTree(
			bagMatrix,
			bagLabels,
			featurePool,
			0,
			maxDepth,
			4,
			local,
		);
		trees.push({ root, featureIndices: featurePool });
		accumulateImportance(root, importanceRaw);
	}

	const importanceSum = importanceRaw.reduce((sum, value) => sum + value, 0) || 1;
	const importances = MARKER_KEYS.map((key, index) => ({
		key,
		label: MARKER_META[key].label,
		importance: round(importanceRaw[index]! / importanceSum, 3),
	})).sort((a, b) => b.importance - a.importance);

	return {
		trees,
		featureKeys: MARKER_KEYS,
		nTrees,
		maxDepth,
		importances,
	};
}

export function predictForestProbability(
	patient: MultiomicsPatient,
	model: RandomForestModel,
	means: number[],
	stds: number[],
) {
	const row = MARKER_KEYS.map((key, index) => {
		const sd = stds[index] || 1;
		return (patient.markers[key] - means[index]!) / sd;
	});
	let votes = 0;
	for (const tree of model.trees) {
		votes += predictTree(tree.root, row);
	}
	return votes / model.trees.length;
}

export function standardizerFromPatients(patients: readonly MultiomicsPatient[]) {
	return standardizeColumns(markerMatrix(patients));
}

export function ensembleMetrics(
	patients: readonly MultiomicsPatient[],
	model: RandomForestModel,
	means: number[],
	stds: number[],
	threshold = 0.5,
): EnsembleMetrics {
	let tp = 0;
	let fp = 0;
	let tn = 0;
	let fn = 0;
	for (const patient of patients) {
		const score = predictForestProbability(patient, model, means, stds);
		const pred = score >= threshold ? 1 : 0;
		if (pred === 1 && patient.highResponse === 1) tp += 1;
		else if (pred === 1 && patient.highResponse === 0) fp += 1;
		else if (pred === 0 && patient.highResponse === 0) tn += 1;
		else fn += 1;
	}
	const n = patients.length;
	const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
	const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
	const f1 =
		precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
	return {
		n,
		accuracy: n === 0 ? 0 : round((tp + tn) / n, 3),
		precision: round(precision, 3),
		recall: round(recall, 3),
		f1: round(f1, 3),
		tp,
		fp,
		tn,
		fn,
	};
}

export function learningCurve(
	train: readonly MultiomicsPatient[],
	test: readonly MultiomicsPatient[],
	treeCounts: number[] = [5, 10, 20, 35, 50],
) {
	const { means, stds } = standardizerFromPatients(train);
	return treeCounts.map((nTrees) => {
		const model = trainRandomForest(train, {
			nTrees,
			maxDepth: 5,
			seed: MULTI_SEED + nTrees,
		});
		const trainMetrics = ensembleMetrics(train, model, means, stds);
		const testMetrics = ensembleMetrics(test, model, means, stds);
		return {
			nTrees,
			trainAccuracy: trainMetrics.accuracy,
			testAccuracy: testMetrics.accuracy,
			testF1: testMetrics.f1,
		};
	});
}

export function clusterHeatmapRows(summaries: ClusterSummary[]) {
	return MARKER_KEYS.map((key) => {
		const row: Record<string, string | number> = {
			marker: MARKER_META[key].label,
			key,
		};
		for (const summary of summaries) {
			row[`c${summary.cluster}`] = summary.meanMarkers[key];
		}
		return row;
	});
}

export function cancerByCluster(
	patients: readonly MultiomicsPatient[],
	assignments: Map<string, number>,
) {
	const clusterIds = [
		...new Set([...assignments.values()].sort((a, b) => a - b)),
	];
	return clusterIds.map((cluster) => {
		const members = patients.filter(
			(patient) => assignments.get(patient.id) === cluster,
		);
		const row: Record<string, string | number> = {
			cluster: `Cluster ${cluster + 1}`,
			n: members.length,
		};
		for (const cancer of CANCER_TYPES) {
			row[cancer] = members.filter((patient) => patient.cancerType === cancer)
				.length;
		}
		return row;
	});
}

export const CLUSTER_COLORS = [
	"#1F6F6A",
	"#2A3644",
	"#8FA0AB",
	"#5D6B78",
	"#155652",
	"#A3B1BC",
] as const;

export const MULTI_GLOSSARY = [
	{
		term: "PCA",
		definition:
			"Principal component analysis projects correlated marker scores onto a small number of axes that capture as much variance as possible — used here to visualise synthetic patient neighbourhoods.",
	},
	{
		term: "k-means clustering",
		definition:
			"An unsupervised algorithm that partitions patients into k groups by minimising within-cluster distance in standardised marker space.",
	},
	{
		term: "Silhouette score",
		definition:
			"A cohesion/separation summary for clustering (roughly −1 to 1). Higher values suggest clearer separation on this synthetic sample.",
	},
	{
		term: "Random forest",
		definition:
			"An ensemble of decision trees trained on bootstrap samples with random feature subsets. Votes are averaged to estimate the probability of high immune engagement.",
	},
] as const;
