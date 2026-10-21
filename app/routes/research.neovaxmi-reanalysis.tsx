import type { MetaFunction } from "@remix-run/cloudflare";
import { useMemo, useRef, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	ReferenceDot,
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
	tooltipStyle,
} from "~/components/research/chart-theme";
import { PageHero } from "~/components/PageHero";
import {
	ALL_NEOVAXMI_CLONES,
	NEOVAXMI_CLASS_COUNTS,
	NEOVAXMI_ML_TASK,
	NEOVAXMI_POSITIVE_RATE,
	classificationMetrics,
	featureImportances,
	patientLoocvExpansion,
	rocCurve,
	trainLogisticRegression,
	trainTestSplit,
} from "~/data/neovaxmi-ml";
import crossLayer from "~/data/neovaxmi/cross_layer.json";
import datasetMeta from "~/data/neovaxmi/meta.json";
import mutations from "~/data/neovaxmi/mutations.json";
import tcr from "~/data/neovaxmi/tcr.json";
import tumor from "~/data/neovaxmi/tumor.json";
import vaccineSite from "~/data/neovaxmi/vaccine_site.json";
import { buildPageMeta, clinicPageTitle } from "~/utils/seo";

export const meta: MetaFunction = () => {
	return buildPageMeta({
		title: clinicPageTitle("NeoVaxMI reanalysis"),
		description:
			"Interactive reanalysis of published NeoVaxMI melanoma neoantigen vaccine supplemental data (Cell 2025 Data S1–S5): mutations, vaccine-site immunity, TCR dynamics and tumour reactivity.",
		path: "/research/neovaxmi-reanalysis",
	});
};

const DATASET = datasetMeta.datasetLabel;
const COLORS = {
	existing: "#5D6B78",
	nivo: "#2A3644",
	vax: "#1F6F6A",
	melanoma: "#8B4513",
	tnk: "#1F6F6A",
	other: "#8FA0AB",
	mono: "#C45C26",
	nkt: "#1F6F6A",
};

type TimeFilter = "all" | "Pre3rd" | "Post3rd";

function Stat({
	label,
	value,
	hint,
}: {
	label: string;
	value: string | number;
	hint?: string;
}) {
	return (
		<div className="border border-line bg-cream/40 px-4 py-4">
			<p className="text-sm text-ink-muted">{label}</p>
			<p className="mt-1 font-display text-3xl text-ink">{value}</p>
			{hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
		</div>
	);
}

export default function NeoVaxmiReanalysisPage() {
	const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
	const [selectedPatient, setSelectedPatient] = useState<string>("all");
	const [mlThreshold, setMlThreshold] = useState(0.5);
	const mutRef = useRef<HTMLDivElement>(null);
	const siteRef = useRef<HTMLDivElement>(null);
	const tcrRef = useRef<HTMLDivElement>(null);
	const tumorRef = useRef<HTMLDivElement>(null);
	const crossRef = useRef<HTMLDivElement>(null);
	const rocRef = useRef<HTMLDivElement>(null);
	const weightRef = useRef<HTMLDivElement>(null);
	const loocvRef = useRef<HTMLDivElement>(null);

	const mutationBars = useMemo(
		() =>
			mutations.patients.map((p) => ({
				patientId: p.patientId,
				coding: p.codingMutations,
				proxy: p.neoantigenProxy,
				missense: p.missense,
			})),
		[],
	);

	const variantClasses = mutations.globalVariantClasses;

	const siteComposition = useMemo(() => {
		const rows = vaccineSite.compositionByCellClass.filter((row) => {
			if (timeFilter !== "all" && row.timepoint !== timeFilter) return false;
			if (selectedPatient !== "all" && row.patientId !== selectedPatient)
				return false;
			return row.cellClass === "Monocyte/Macrophage" || row.cellClass === "NK/T";
		});
		const byKey = new Map<
			string,
			{ label: string; mono: number; nkt: number; patientId: string; timepoint: string }
		>();
		for (const row of rows) {
			const key = `${row.patientId}|${row.timepoint}`;
			const cur = byKey.get(key) ?? {
				label: `${row.patientId} ${row.timepoint === "Post3rd" ? "post" : "pre"}`,
				mono: 0,
				nkt: 0,
				patientId: row.patientId,
				timepoint: row.timepoint,
			};
			if (row.cellClass === "Monocyte/Macrophage") cur.mono = row.fraction * 100;
			if (row.cellClass === "NK/T") cur.nkt = row.fraction * 100;
			byKey.set(key, cur);
		}
		return [...byKey.values()].sort((a, b) =>
			a.patientId === b.patientId
				? a.timepoint.localeCompare(b.timepoint)
				: a.patientId.localeCompare(b.patientId),
		);
	}, [timeFilter, selectedPatient]);

	const tcrExpansion = useMemo(
		() =>
			tcr.patients.map((p) => ({
				patientId: p.patientId,
				afterNivo: p.expandedAfterNivolumab,
				afterVax: p.expandedAfterVaccine,
			})),
		[],
	);

	const impCategories = useMemo(() => {
		const entries = Object.entries(tcr.impExpandedByCategory ?? {});
		return entries.map(([name, count]) => ({ name, count }));
	}, []);

	const reactiveByType = useMemo(
		() =>
			Object.entries(tumor.reactiveSummary.byType).map(([name, count]) => ({
				name,
				count,
			})),
		[],
	);

	const tumorStack = useMemo(() => {
		const samples = new Map<
			string,
			{
				label: string;
				Melanoma: number;
				"T/NK": number;
				Other: number;
				"B/Plasma": number;
			}
		>();
		for (const row of tumor.tumorGroupComposition) {
			const cur = samples.get(row.sample) ?? {
				label: `${row.patientId} · ${row.timepoint}`,
				Melanoma: 0,
				"T/NK": 0,
				Other: 0,
				"B/Plasma": 0,
			};
			if (row.group in cur) {
				(cur as Record<string, number | string>)[row.group] = row.fraction * 100;
			}
			samples.set(row.sample, cur);
		}
		return [...samples.values()];
	}, []);

	const crossScatter = useMemo(
		() =>
			crossLayer.patients
				.filter(
					(p) =>
						p.codingMutations != null &&
						p.expandedAfterVaccine != null &&
						p.nReactiveTcrs != null,
				)
				.map((p) => ({
					patientId: p.patientId,
					coding: p.codingMutations as number,
					expanded: p.expandedAfterVaccine as number,
					reactive: p.nReactiveTcrs as number,
					imp: p.impExpandedTotal ?? 0,
				})),
		[],
	);

	const sitePatients = useMemo(() => {
		const ids = new Set(vaccineSite.samples.map((s) => s.patientId));
		return ["all", ...[...ids].sort()];
	}, []);

	const paper = datasetMeta.paper;

	const { train: mlTrain, test: mlTest } = useMemo(
		() => trainTestSplit(ALL_NEOVAXMI_CLONES, 0.75),
		[],
	);
	const mlModel = useMemo(() => trainLogisticRegression(mlTrain), [mlTrain]);
	const mlTrainMetrics = useMemo(
		() => classificationMetrics(mlTrain, mlModel, mlThreshold),
		[mlTrain, mlModel, mlThreshold],
	);
	const mlTestMetrics = useMemo(
		() => classificationMetrics(mlTest, mlModel, mlThreshold),
		[mlTest, mlModel, mlThreshold],
	);
	const mlWeights = useMemo(
		() =>
			[...featureImportances(mlModel)].sort(
				(a, b) => b.absWeight - a.absWeight,
			),
		[mlModel],
	);
	const mlRoc = useMemo(() => rocCurve(mlTest, mlModel), [mlTest, mlModel]);
	const mlOperating = useMemo(() => {
		const fpr =
			mlTestMetrics.fp + mlTestMetrics.tn === 0
				? 0
				: mlTestMetrics.fp / (mlTestMetrics.fp + mlTestMetrics.tn);
		const tpr =
			mlTestMetrics.tp + mlTestMetrics.fn === 0
				? 0
				: mlTestMetrics.tp / (mlTestMetrics.tp + mlTestMetrics.fn);
		return { fpr, tpr };
	}, [mlTestMetrics]);
	const patientMl = useMemo(
		() => patientLoocvExpansion(crossLayer.patients),
		[],
	);

	return (
		<>
			<PageHero
				eyebrow="Research Analytics Lab"
				title="NeoVaxMI reanalysis"
				summary="A multi-adjuvant personal neoantigen vaccine (NeoVaxMI) in melanoma: mutation fuel, vaccine-site immune remodeling, circulating TCR expansion beyond PD-1 blockade, and vaccine-linked T cells in tumour."
				accent={`${paper.authors} · ${paper.journal} ${paper.year}`}
			>
				<div className="mt-5 max-w-2xl space-y-2 text-sm leading-relaxed text-ink-soft">
					<p>
						<span className="font-semibold text-ink">Published trial data.</span>{" "}
						Aggregates from {paper.journal} {paper.year} supplemental Data S1–S5
						({paper.trial}). De-identified research IDs only — not PCC patient
						records.
					</p>
					<p>
						<a
							href={paper.pmcUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="font-medium text-accent hover:underline"
						>
							PMC12351686 ↗
						</a>
					</p>
				</div>
			</PageHero>

			<section className="section-pad !pt-10">
				<div className="site-container space-y-10">
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<Stat
							label="Fully vaccinated (TCR set)"
							value={tcr.patients.length}
							hint={`Trial enrolled ${paper.n_enrolled}; vaccinated ${paper.n_vaccinated}`}
						/>
						<Stat
							label="Median post-vaccine TCR expansions"
							value={tcr.cohort.medianExpandedAfterVaccine}
							hint={`vs ${tcr.cohort.medianExpandedAfterNivolumab} after nivolumab`}
						/>
						<Stat
							label="IMP-expanded clones retained"
							value={tcr.cohort.totalImpExpandedClones}
							hint={`${tcr.cohort.meanPctImpExpandedPostVaccine}% mean post-vaccine category`}
						/>
						<Stat
							label="Reactive tumour TCRs"
							value={tumor.reactiveSummary.nReactive}
							hint={`${tumor.reactiveSummary.byType["Post-Vaccine"] ?? 0} typed post-vaccine`}
						/>
					</div>

					<p className="max-w-3xl text-sm leading-relaxed text-ink-soft">
						{crossLayer.narrative} Below, a class-weighted logistic model asks
						whether in vitro peptide-pool expansion features distinguish
						post-vaccine TCR clones from pre-existing / post-nivolumab clones.
					</p>

					{/* Tier A: mutations */}
					<ChartCard
						title="Mutation landscape (Data S1)"
						datasetLabel={DATASET}
						explanation="Coding and neoantigen-proxy mutation counts per patient from whole-exome call tables. The proxy tallies missense/indel/nonsense without HLA binding ranks (those scores are not in S1)."
						chartRef={mutRef}
						onExportPng={() =>
							exportSvgAsPng(mutRef.current, "neovaxmi-mutations.png")
						}
					>
						<div className="grid gap-6 lg:grid-cols-5">
							<div className="h-80 lg:col-span-3">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={mutationBars} margin={{ left: 8, right: 8 }}>
										<CartesianGrid stroke={CHART_LINE} vertical={false} />
										<XAxis dataKey="patientId" tick={{ fill: CHART_MUTED, fontSize: 11 }} />
										<YAxis tick={{ fill: CHART_MUTED, fontSize: 11 }} />
										<Tooltip contentStyle={tooltipStyle} />
										<Legend />
										<Bar dataKey="coding" name="Coding" fill={CHART_INK} />
										<Bar
											dataKey="proxy"
											name="Neoantigen proxy"
											fill={CHART_ACCENT}
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
							<div className="h-80 lg:col-span-2">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={variantClasses}
										layout="vertical"
										margin={{ left: 8, right: 16 }}
									>
										<CartesianGrid stroke={CHART_LINE} horizontal={false} />
										<XAxis type="number" tick={{ fill: CHART_MUTED, fontSize: 11 }} />
										<YAxis
											type="category"
											dataKey="class"
											width={110}
											tick={{ fill: CHART_MUTED, fontSize: 10 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Bar dataKey="count" fill={COLORS.nivo} />
									</BarChart>
								</ResponsiveContainer>
							</div>
						</div>
					</ChartCard>

					{/* Tier A+B: vaccine site */}
					<div className="flex flex-wrap items-end gap-4 border border-line bg-white px-5 py-4 sm:px-6">
						<div>
							<p className="text-sm font-semibold text-ink">
								Vaccine-site filters (Data S2)
							</p>
							<p className="text-xs text-ink-muted">
								Pre3rd vs Post3rd injection-site scRNA composition
							</p>
						</div>
						<label className="text-sm text-ink">
							Timepoint{" "}
							<select
								className="ml-2 border border-line bg-cream/30 px-2 py-1"
								value={timeFilter}
								onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
							>
								<option value="all">All</option>
								<option value="Pre3rd">Pre 3rd dose</option>
								<option value="Post3rd">Post 3rd dose</option>
							</select>
						</label>
						<label className="text-sm text-ink">
							Patient{" "}
							<select
								className="ml-2 border border-line bg-cream/30 px-2 py-1"
								value={selectedPatient}
								onChange={(e) => setSelectedPatient(e.target.value)}
							>
								{sitePatients.map((id) => (
									<option key={id} value={id}>
										{id === "all" ? "All patients" : id}
									</option>
								))}
							</select>
						</label>
						<p className="text-xs text-ink-muted">
							Ipi exploratory — mean MonoMac Δ:{" "}
							{Object.entries(
								vaccineSite.ipiDoseExploratory.meanMonoMacDeltaByDose,
							)
								.map(([dose, v]) => `${dose} ${v ?? "—"}`)
								.join(" · ")}
						</p>
					</div>

					<ChartCard
						title="Vaccine-site myeloid vs T/NK fractions"
						datasetLabel={DATASET}
						explanation="Share of Monocyte/Macrophage and NK/T cells at the vaccine site before and after the third vaccination. The paper highlights dynamic myeloid remodeling at injection sites."
						chartRef={siteRef}
						onExportPng={() =>
							exportSvgAsPng(siteRef.current, "neovaxmi-vaccine-site.png")
						}
					>
						<div className="h-96">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={siteComposition} margin={{ bottom: 48 }}>
									<CartesianGrid stroke={CHART_LINE} vertical={false} />
									<XAxis
										dataKey="label"
										interval={0}
										angle={-35}
										textAnchor="end"
										height={60}
										tick={{ fill: CHART_MUTED, fontSize: 10 }}
									/>
									<YAxis
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
										unit="%"
									/>
									<Tooltip contentStyle={tooltipStyle} />
									<Legend />
									<Bar dataKey="mono" name="Mono/Mac %" fill={COLORS.mono} />
									<Bar dataKey="nkt" name="NK/T %" fill={COLORS.nkt} />
								</BarChart>
							</ResponsiveContainer>
						</div>
						{vaccineSite.interferonAssociatedDE.length > 0 ? (
							<div className="mt-4 overflow-x-auto border-t border-line px-1 pt-4">
								<p className="mb-2 text-sm font-semibold text-ink">
									Interferon-associated DE (Post3rd − Pre3rd)
								</p>
								<table className="min-w-full text-left text-sm">
									<thead className="text-ink-muted">
										<tr>
											<th className="py-1 pr-4">Gene</th>
											<th className="py-1 pr-4">Cluster</th>
											<th className="py-1 pr-4">logFC</th>
											<th className="py-1">pAdj</th>
										</tr>
									</thead>
									<tbody>
										{vaccineSite.interferonAssociatedDE.slice(0, 8).map((row) => (
											<tr key={`${row.gene}-${row.cluster}`} className="border-t border-line/70">
												<td className="py-1.5 pr-4 font-medium text-ink">
													{row.gene}
												</td>
												<td className="py-1.5 pr-4 text-ink-soft">
													{row.annotation}
												</td>
												<td className="py-1.5 pr-4">{row.logFC}</td>
												<td className="py-1.5">
													{row.pAdjGlobal.toExponential(2)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : null}
					</ChartCard>

					{/* Tier A: TCR */}
					<ChartCard
						title="Circulating TCR expansion after nivolumab vs vaccine (Data S3)"
						datasetLabel={DATASET}
						explanation="Significantly expanded TCRβ clonotypes after PD-1 blockade versus after NeoVaxMI. Median post-vaccine expansions exceed post-nivolumab expansions in this supplemental summary — the paper’s core repertoire claim."
						chartRef={tcrRef}
						onExportPng={() =>
							exportSvgAsPng(tcrRef.current, "neovaxmi-tcr-expansion.png")
						}
					>
						<div className="grid gap-6 lg:grid-cols-5">
							<div className="h-80 lg:col-span-3">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={tcrExpansion}>
										<CartesianGrid stroke={CHART_LINE} vertical={false} />
										<XAxis
											dataKey="patientId"
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
										/>
										<YAxis tick={{ fill: CHART_MUTED, fontSize: 11 }} />
										<Tooltip contentStyle={tooltipStyle} />
										<Legend />
										<Bar
											dataKey="afterNivo"
											name="After nivolumab"
											fill={COLORS.nivo}
										/>
										<Bar
											dataKey="afterVax"
											name="After vaccine"
											fill={COLORS.vax}
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
							<div className="h-80 lg:col-span-2">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={impCategories}>
										<CartesianGrid stroke={CHART_LINE} vertical={false} />
										<XAxis
											dataKey="name"
											tick={{ fill: CHART_MUTED, fontSize: 10 }}
										/>
										<YAxis tick={{ fill: CHART_MUTED, fontSize: 11 }} />
										<Tooltip contentStyle={tooltipStyle} />
										<Bar dataKey="count" name="IMP-expanded" fill={CHART_ACCENT}>
											{impCategories.map((entry) => (
												<Cell
													key={entry.name}
													fill={
														entry.name.includes("Vaccine")
															? COLORS.vax
															: entry.name.includes("Nivo")
																? COLORS.nivo
																: COLORS.existing
													}
												/>
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
								<p className="mt-2 text-center text-xs text-ink-muted">
									In vitro IMP-expanded clones by repertoire category
								</p>
							</div>
						</div>
					</ChartCard>

					{/* Tier A: tumor */}
					<ChartCard
						title="Tumour composition & reactive TCRs (Data S4–S5)"
						datasetLabel={DATASET}
						explanation="Single-cell tumour fractions (melanoma vs T/NK vs other) across available timepoints, plus reconstructed TCRs scored as neoantigen-reactive. Most reactive clonotypes are classified as post-vaccine."
						chartRef={tumorRef}
						onExportPng={() =>
							exportSvgAsPng(tumorRef.current, "neovaxmi-tumor.png")
						}
					>
						<div className="grid gap-6 lg:grid-cols-2">
							<div className="h-80">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={tumorStack} margin={{ bottom: 56 }}>
										<CartesianGrid stroke={CHART_LINE} vertical={false} />
										<XAxis
											dataKey="label"
											interval={0}
											angle={-30}
											textAnchor="end"
											height={70}
											tick={{ fill: CHART_MUTED, fontSize: 9 }}
										/>
										<YAxis tick={{ fill: CHART_MUTED, fontSize: 11 }} unit="%" />
										<Tooltip contentStyle={tooltipStyle} />
										<Legend />
										<Bar dataKey="Melanoma" stackId="a" fill={COLORS.melanoma} />
										<Bar dataKey="T/NK" stackId="a" fill={COLORS.tnk} />
										<Bar dataKey="B/Plasma" stackId="a" fill="#B8956C" />
										<Bar dataKey="Other" stackId="a" fill={COLORS.other} />
									</BarChart>
								</ResponsiveContainer>
							</div>
							<div className="h-80">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={reactiveByType}>
										<CartesianGrid stroke={CHART_LINE} vertical={false} />
										<XAxis
											dataKey="name"
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
										/>
										<YAxis tick={{ fill: CHART_MUTED, fontSize: 11 }} />
										<Tooltip contentStyle={tooltipStyle} />
										<Bar dataKey="count" name="Reactive TCRs" fill={COLORS.vax} />
									</BarChart>
								</ResponsiveContainer>
								<p className="mt-2 text-center text-xs text-ink-muted">
									{tumor.reactiveSummary.nReactive} reactive /{" "}
									{tumor.reconstructedCount} reconstructed ·{" "}
									{tumor.bloodTumorOverlaps.length} blood–tumour overlaps in S5D
								</p>
							</div>
						</div>
					</ChartCard>

					{/* Cross-layer */}
					<ChartCard
						title="Cross-layer patient view"
						datasetLabel={DATASET}
						explanation="Each point is a patient with bulk TCR data: coding mutation burden versus post-vaccine expanded clonotype count. Point size scales with the number of reactive tumour TCRs reported for that patient."
						chartRef={crossRef}
						onExportPng={() =>
							exportSvgAsPng(crossRef.current, "neovaxmi-cross-layer.png")
						}
					>
						<div className="h-96">
							<ResponsiveContainer width="100%" height="100%">
								<ScatterChart margin={{ left: 8, right: 16, top: 8 }}>
									<CartesianGrid stroke={CHART_LINE} />
									<XAxis
										type="number"
										dataKey="coding"
										name="Coding mutations"
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
										label={{
											value: "Coding mutations (S1)",
											position: "insideBottom",
											offset: -2,
											fill: CHART_MUTED,
											fontSize: 11,
										}}
									/>
									<YAxis
										type="number"
										dataKey="expanded"
										name="Post-vaccine expansions"
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
										label={{
											value: "Expanded after vaccine",
											angle: -90,
											position: "insideLeft",
											fill: CHART_MUTED,
											fontSize: 11,
										}}
									/>
									<Tooltip
										cursor={{ strokeDasharray: "3 3" }}
										contentStyle={tooltipStyle}
										formatter={(value: number, name: string) => [value, name]}
										labelFormatter={(_, payload) =>
											payload?.[0]?.payload?.patientId ?? ""
										}
									/>
									<Scatter
										data={crossScatter}
										fill={CHART_ACCENT}
										name="Patients"
									/>
								</ScatterChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					{/* Machine learning on IMP-expanded clones */}
					<section className="border border-line bg-white px-5 py-5 sm:px-6">
						<h3 className="font-display text-xl text-ink sm:text-2xl">
							Machine learning · post-vaccine clone classifier
						</h3>
						<p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
							{NEOVAXMI_ML_TASK}{" "}
							{ALL_NEOVAXMI_CLONES.length.toLocaleString()} IMP-expanded clones
							({NEOVAXMI_CLASS_COUNTS["Post-Vaccine"]?.toLocaleString()}{" "}
							post-vaccine · base rate{" "}
							{Math.round(NEOVAXMI_POSITIVE_RATE * 1000) / 10}%). Class-weighted
							L2 logistic regression, 75/25 hold-out.
						</p>
						<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<Stat
								label="Hold-out AUC"
								value={mlTestMetrics.auc}
								hint={`Train AUC ${mlTrainMetrics.auc}`}
							/>
							<Stat
								label="Hold-out F1"
								value={mlTestMetrics.f1}
								hint={`Precision ${mlTestMetrics.precision} · recall ${mlTestMetrics.recall}`}
							/>
							<Stat
								label="Hold-out accuracy"
								value={mlTestMetrics.accuracy}
								hint={`Majority baseline ${mlTestMetrics.baselineAccuracy}`}
							/>
							<Stat
								label="Train / test clones"
								value={`${mlTrain.length}/${mlTest.length}`}
								hint={`Threshold ${mlThreshold.toFixed(2)}`}
							/>
						</div>
						<label className="mt-5 block max-w-md text-sm text-ink">
							Decision threshold ({mlThreshold.toFixed(2)})
							<input
								type="range"
								min={0.05}
								max={0.95}
								step={0.01}
								value={mlThreshold}
								onChange={(e) => setMlThreshold(Number(e.target.value))}
								className="mt-2 w-full accent-[var(--color-accent,#1F6F6A)]"
							/>
						</label>
					</section>

					<div className="grid gap-6 lg:grid-cols-2">
						<ChartCard
							title="ROC · hold-out clones"
							datasetLabel={DATASET}
							explanation="Receiver-operating curve for predicting post-vaccine repertoire category from peptide-pool log-fold changes. The marked point is the current decision threshold. AUC above the majority baseline is the useful signal under class imbalance."
							chartRef={rocRef}
							onExportPng={() =>
								exportSvgAsPng(rocRef.current, "neovaxmi-ml-roc.png")
							}
						>
							<div className="h-80">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={mlRoc} margin={{ left: 8, right: 16 }}>
										<CartesianGrid stroke={CHART_LINE} />
										<XAxis
											type="number"
											dataKey="fpr"
											domain={[0, 1]}
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
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
											tick={{ fill: CHART_MUTED, fontSize: 11 }}
											label={{
												value: "True positive rate",
												angle: -90,
												position: "insideLeft",
												fill: CHART_MUTED,
												fontSize: 11,
											}}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<ReferenceLine
											segment={[
												{ x: 0, y: 0 },
												{ x: 1, y: 1 },
											]}
											stroke={CHART_MUTED}
											strokeDasharray="4 4"
										/>
										<Line
											type="monotone"
											dataKey="tpr"
											dot={false}
											stroke={CHART_ACCENT}
											strokeWidth={2}
											name="TPR"
										/>
										<ReferenceDot
											x={mlOperating.fpr}
											y={mlOperating.tpr}
											r={5}
											fill={CHART_INK}
											stroke={CHART_ACCENT}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>

						<ChartCard
							title="Standardised feature weights"
							datasetLabel={DATASET}
							explanation="Signed logistic coefficients after z-scoring. Positive weights push toward a post-vaccine label; negative toward existing / post-nivolumab. Interpret cautiously — features are correlated (max log2FC is derived from the pool-specific folds)."
							chartRef={weightRef}
							onExportPng={() =>
								exportSvgAsPng(weightRef.current, "neovaxmi-ml-weights.png")
							}
						>
							<div className="h-80">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={mlWeights}
										layout="vertical"
										margin={{ left: 8, right: 16 }}
									>
										<CartesianGrid stroke={CHART_LINE} horizontal={false} />
										<XAxis type="number" tick={{ fill: CHART_MUTED, fontSize: 11 }} />
										<YAxis
											type="category"
											dataKey="label"
											width={150}
											tick={{ fill: CHART_MUTED, fontSize: 10 }}
										/>
										<Tooltip contentStyle={tooltipStyle} />
										<Bar dataKey="weight" name="Weight">
											{mlWeights.map((row) => (
												<Cell
													key={row.key}
													fill={row.weight >= 0 ? CHART_ACCENT : CHART_INK}
												/>
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</ChartCard>
					</div>

					<ChartCard
						title="Patient-level LOO · mutation burden → vaccine TCR expansion"
						datasetLabel={DATASET}
						explanation={`Leave-one-patient-out linear model predicting post-vaccine expanded clonotype count from coding mutations and neoantigen-proxy count (n=${patientMl.n}). Small-n exploratory only — correlation of hold-out predictions vs actual is ${patientMl.corr ?? "n/a"} (MAE ${patientMl.mae ?? "n/a"}).`}
						chartRef={loocvRef}
						onExportPng={() =>
							exportSvgAsPng(loocvRef.current, "neovaxmi-ml-loocv.png")
						}
					>
						<div className="h-80">
							<ResponsiveContainer width="100%" height="100%">
								<ScatterChart margin={{ left: 8, right: 16 }}>
									<CartesianGrid stroke={CHART_LINE} />
									<XAxis
										type="number"
										dataKey="actual"
										name="Actual"
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
										label={{
											value: "Actual expansions after vaccine",
											position: "insideBottom",
											offset: -2,
											fill: CHART_MUTED,
											fontSize: 11,
										}}
									/>
									<YAxis
										type="number"
										dataKey="predicted"
										name="Predicted"
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
										label={{
											value: "LOO predicted",
											angle: -90,
											position: "insideLeft",
											fill: CHART_MUTED,
											fontSize: 11,
										}}
									/>
									<Tooltip
										contentStyle={tooltipStyle}
										labelFormatter={(_, payload) =>
											payload?.[0]?.payload?.patientId ?? ""
										}
									/>
									<Scatter data={patientMl.points} fill={CHART_ACCENT} />
								</ScatterChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

				</div>
			</section>
		</>
	);
}
