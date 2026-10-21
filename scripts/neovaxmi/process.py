#!/usr/bin/env python3
"""
Process Blass & Keskin NeoVaxMI supplemental tables (Data S1–S5)
into compact aggregates for data-analysis-processed/ and the Research Lab UI.

Usage (from repo root):
  python scripts/neovaxmi/process.py
"""

from __future__ import annotations

import json
import math
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl
from pyxlsb import open_workbook

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data-analysis-raw"
OUT = ROOT / "data-analysis-processed"
APP = ROOT / "app" / "data" / "neovaxmi"

PAPER = {
    "title": "A multi-adjuvant personal neoantigen vaccine generates potent immunity in melanoma",
    "authors": "Blass, Keskin, Ott, Wu et al.",
    "journal": "Cell",
    "year": 2025,
    "doi": "10.1016/j.cell.2025.06.019",
    "pmcUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12351686/",
    "trial": "NCT03929029",
    "vaccine": "NeoVaxMI",
    "n_enrolled": 11,
    "n_vaccinated": 10,
    "n_fully_vaccinated": 9,
    "source_note": (
        "Aggregates derived from Cell supplemental Data S1–S5 "
        "(de-identified patient IDs P101–P111). Not clinical care data."
    ),
}

CODING_CLASSES = {
    "Missense_Mutation",
    "Nonsense_Mutation",
    "Frame_Shift_Del",
    "Frame_Shift_Ins",
    "In_Frame_Del",
    "In_Frame_Ins",
    "Splice_Site",
    "Translation_Start_Site",
    "Nonstop_Mutation",
    "START_CODON_SNP",
    "De_novo_Start_InFrame",
    "De_novo_Start_OutOfFrame",
}

# Heuristic “neoantigen-proxy” classes used without HLA binding scores in S1.
NEOANTIGEN_PROXY_CLASSES = {
    "Missense_Mutation",
    "Frame_Shift_Del",
    "Frame_Shift_Ins",
    "In_Frame_Del",
    "In_Frame_Ins",
    "Nonsense_Mutation",
}


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n")
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


def clean_str(value) -> str:
    if value is None:
        return ""
    return str(value).replace("\xa0", " ").strip()


def safe_float(value):
    if value is None or value == "" or value == "NA":
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def load_sheet_rows(path: Path, sheet_name: str):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        return [], []
    header = [clean_str(c) for c in rows[0]]
    data = rows[1:]
    return header, data


def process_s1() -> dict:
    path = RAW / "Blass & Keskin Data S1.xlsx"
    header, rows = load_sheet_rows(path, "S1A. Mutations")
    idx = {name: i for i, name in enumerate(header)}

    by_patient = defaultdict(
        lambda: {
            "patientId": "",
            "totalMutations": 0,
            "codingMutations": 0,
            "missense": 0,
            "silent": 0,
            "nonsense": 0,
            "frameshift": 0,
            "spliceSite": 0,
            "neoantigenProxy": 0,
            "variantClassCounts": Counter(),
            "topGenes": Counter(),
        }
    )
    global_class = Counter()
    global_genes = Counter()

    for row in rows:
        pid = clean_str(row[idx["Patient ID"]])
        if not pid:
            continue
        gene = clean_str(row[idx["Gene Symbol"]]) or "Unknown"
        vclass = clean_str(row[idx["Variant Classification"]])
        rec = by_patient[pid]
        rec["patientId"] = f"P{pid}" if not pid.startswith("P") else pid
        rec["totalMutations"] += 1
        rec["variantClassCounts"][vclass] += 1
        global_class[vclass] += 1
        if gene != "Unknown":
            rec["topGenes"][gene] += 1
            global_genes[gene] += 1
        if vclass in CODING_CLASSES:
            rec["codingMutations"] += 1
        if vclass == "Missense_Mutation":
            rec["missense"] += 1
        elif vclass == "Silent":
            rec["silent"] += 1
        elif vclass == "Nonsense_Mutation":
            rec["nonsense"] += 1
        elif vclass in {"Frame_Shift_Del", "Frame_Shift_Ins"}:
            rec["frameshift"] += 1
        elif vclass == "Splice_Site":
            rec["spliceSite"] += 1
        if vclass in NEOANTIGEN_PROXY_CLASSES:
            rec["neoantigenProxy"] += 1

    # CNV summary
    cnv_header, cnv_rows = load_sheet_rows(path, "S1B. Copy Number Variants (CNV)")
    cnv_idx = {name: i for i, name in enumerate(cnv_header)}
    cnv_by_patient = defaultdict(lambda: {"segments": 0, "lohSegments": 0, "meanAbsLog2": 0.0})
    abs_sums = defaultdict(float)
    for row in cnv_rows:
        pid = clean_str(row[cnv_idx["Patient"]])
        if not pid:
            continue
        key = f"P{pid}" if not pid.startswith("P") else pid
        loh = safe_float(row[cnv_idx["LOH"]]) or 0
        log2 = safe_float(row[cnv_idx["log2ratio"]]) or 0
        cnv_by_patient[key]["segments"] += 1
        if loh > 0:
            cnv_by_patient[key]["lohSegments"] += 1
        abs_sums[key] += abs(log2)

    patients = []
    for pid, rec in sorted(by_patient.items(), key=lambda x: x[1]["patientId"]):
        key = rec["patientId"]
        cnv = cnv_by_patient.get(key, {"segments": 0, "lohSegments": 0})
        mean_abs = (
            abs_sums[key] / cnv["segments"] if cnv.get("segments") else None
        )
        patients.append(
            {
                "patientId": key,
                "totalMutations": rec["totalMutations"],
                "codingMutations": rec["codingMutations"],
                "missense": rec["missense"],
                "silent": rec["silent"],
                "nonsense": rec["nonsense"],
                "frameshift": rec["frameshift"],
                "spliceSite": rec["spliceSite"],
                "neoantigenProxy": rec["neoantigenProxy"],
                "neoantigenProxyFraction": round(
                    rec["neoantigenProxy"] / rec["totalMutations"], 4
                )
                if rec["totalMutations"]
                else 0,
                "topGenes": [
                    {"gene": g, "count": c}
                    for g, c in rec["topGenes"].most_common(10)
                ],
                "variantClassCounts": dict(rec["variantClassCounts"]),
                "cnvSegments": cnv.get("segments", 0),
                "cnvLohSegments": cnv.get("lohSegments", 0),
                "cnvMeanAbsLog2": round(mean_abs, 4) if mean_abs is not None else None,
            }
        )

    coding_values = [p["codingMutations"] for p in patients]
    return {
        "paper": PAPER,
        "tier": "A+B",
        "nPatients": len(patients),
        "totalMutationRows": sum(p["totalMutations"] for p in patients),
        "globalVariantClasses": [
            {"class": k, "count": v} for k, v in global_class.most_common()
        ],
        "globalTopGenes": [
            {"gene": k, "count": v} for k, v in global_genes.most_common(25)
        ],
        "patients": patients,
        "cohort": {
            "medianCodingMutations": sorted(coding_values)[len(coding_values) // 2]
            if coding_values
            else None,
            "minCodingMutations": min(coding_values) if coding_values else None,
            "maxCodingMutations": max(coding_values) if coding_values else None,
        },
        "notes": [
            "neoantigenProxy counts missense/indel/nonsense without HLA binding scores (S1 has no NetMHC ranks).",
            "Paper reports median 134.5 high-quality coding mutations (range 35–2730) after WES+RNA filters; S1 includes broader call classes.",
        ],
    }


def process_s2() -> dict:
    path = RAW / "Blass & Keskin Data S2.xlsx"

    # QC / samples
    _, qc_rows = load_sheet_rows(path, "S2A. Sample-level QC")
    samples = []
    for row in qc_rows:
        if not row or row[0] is None:
            continue
        samples.append(
            {
                "sample": clean_str(row[0]),
                "patientId": clean_str(row[1]),
                "timepoint": clean_str(row[2]),
                "ipiCohort": clean_str(row[3]),
                "nCells": int(safe_float(row[4]) or 0),
                "medianNCount": safe_float(row[5]),
                "medianNFeature": safe_float(row[6]),
                "medianPercentMt": safe_float(row[7]),
            }
        )

    # Cluster annotations
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["S2B. Annotation and top markers"]
    ann_rows = list(ws.iter_rows(values_only=True))
    wb.close()
    cluster_ids = [clean_str(c) for c in ann_rows[0][1:]]
    annotations = [clean_str(c) for c in ann_rows[1][1:]]
    cell_classes = [clean_str(c) for c in ann_rows[2][1:]]
    cluster_meta = {
        cid: {"annotation": annotations[i], "cellClass": cell_classes[i]}
        for i, cid in enumerate(cluster_ids)
    }

    # Cell counts long
    header, count_rows = load_sheet_rows(path, "S2C. Cluster cell counts")
    sample_cols = header[2:]
    composition = []
    for row in count_rows:
        if not row or row[0] is None:
            continue
        cluster = clean_str(row[0])
        annotation = clean_str(row[1])
        for i, sample in enumerate(sample_cols):
            n = int(safe_float(row[2 + i]) or 0)
            # parse patient / timepoint / ipi from sample name
            # e.g. P101_Skin_Post3rd_2.5mgIpi
            parts = sample.split("_")
            patient = parts[0] if parts else ""
            timepoint = "Post3rd" if "Post3rd" in sample else "Pre3rd" if "Pre3rd" in sample else ""
            ipi = "5mgIpi" if "5mgIpi" in sample else "2.5mgIpi" if "2.5mgIpi" in sample else ""
            composition.append(
                {
                    "cluster": cluster,
                    "annotation": annotation,
                    "cellClass": cluster_meta.get(cluster, {}).get("cellClass", ""),
                    "sample": sample,
                    "patientId": patient,
                    "timepoint": timepoint,
                    "ipiCohort": ipi,
                    "nCells": n,
                }
            )

    # Patient×timepoint composition fractions by cell class
    totals = Counter()
    class_counts = Counter()
    for row in composition:
        key = (row["patientId"], row["timepoint"], row["ipiCohort"])
        totals[key] += row["nCells"]
        class_counts[(key[0], key[1], key[2], row["cellClass"] or row["annotation"])] += row[
            "nCells"
        ]

    composition_summary = []
    for (patient, tp, ipi, cell_class), n in sorted(class_counts.items()):
        total = totals[(patient, tp, ipi)] or 1
        composition_summary.append(
            {
                "patientId": patient,
                "timepoint": tp,
                "ipiCohort": ipi,
                "cellClass": cell_class,
                "nCells": n,
                "fraction": round(n / total, 4),
            }
        )

    # Ipi dose exploratory: mean Post-Pre delta in MonoMac / NK-T fractions
    def class_frac(patient, tp, ipi, classes):
        total = totals.get((patient, tp, ipi), 0) or 1
        n = sum(
            class_counts.get((patient, tp, ipi, c), 0) for c in classes
        )
        return n / total

    patients_ipi = {}
    for s in samples:
        patients_ipi[s["patientId"]] = s["ipiCohort"]

    ipi_deltas = []
    for patient, ipi in sorted(patients_ipi.items()):
        if (patient, "Pre3rd", ipi) not in totals or (patient, "Post3rd", ipi) not in totals:
            continue
        myeloid = {"Monocyte/Macrophage", "cDC", "DC"}
        # use exact cellClass labels from data
        pre_m = class_frac(patient, "Pre3rd", ipi, ["Monocyte/Macrophage"])
        post_m = class_frac(patient, "Post3rd", ipi, ["Monocyte/Macrophage"])
        pre_t = class_frac(patient, "Pre3rd", ipi, ["NK/T"])
        post_t = class_frac(patient, "Post3rd", ipi, ["NK/T"])
        ipi_deltas.append(
            {
                "patientId": patient,
                "ipiCohort": ipi,
                "monoMacDelta": round(post_m - pre_m, 4),
                "nkTDelta": round(post_t - pre_t, 4),
            }
        )

    # Top DE: keep padj.glb < 0.05 and |logFC| >= 1, top 40 overall by |stat|
    header, de_rows = load_sheet_rows(path, "S2D. Differential expression")
    de_idx = {name: i for i, name in enumerate(header)}
    significant = []
    for row in de_rows:
        padj = safe_float(row[de_idx["p_adj.glb"]])
        logfc = safe_float(row[de_idx["logFC"]])
        if padj is None or logfc is None or padj >= 0.05 or abs(logfc) < 1:
            continue
        significant.append(
            {
                "cluster": clean_str(row[de_idx["Cluster"]]),
                "annotation": clean_str(row[de_idx["Annotation"]]),
                "gene": clean_str(row[de_idx["Gene"]]),
                "logFC": round(logfc, 4),
                "pAdjGlobal": padj,
                "stat": safe_float(row[de_idx["stat"]]),
                "contrast": clean_str(row[de_idx["contrast"]]),
            }
        )
    significant.sort(key=lambda r: abs(r["stat"] or 0), reverse=True)
    top_de = significant[:80]

    # Interferon-ish gene hits for narrative
    isg_genes = {
        "ISG15",
        "IFI6",
        "IFIT1",
        "IFIT2",
        "IFIT3",
        "MX1",
        "OAS1",
        "OAS2",
        "STAT1",
        "CXCL10",
        "CXCL9",
        "IRF7",
    }
    isg_hits = [r for r in significant if r["gene"] in isg_genes][:40]

    # GSEA: keep top pathways by |NES| with padj < 0.05 per major annotation, capped
    header, gsea_rows = load_sheet_rows(path, "S2E. GSEA")
    gsea_idx = {name: i for i, name in enumerate(header)}
    gsea_keep = []
    for row in gsea_rows:
        padj = safe_float(row[gsea_idx["padj"]])
        nes = safe_float(row[gsea_idx["NES"]])
        if padj is None or nes is None or padj >= 0.05:
            continue
        pathway = clean_str(row[gsea_idx["pathway"]])
        # Prefer immune / interferon related names for compactness
        interesting = bool(
            re.search(
                r"INTERFERON|IFN|INFLAMMATORY|MYELOID|T_CELL|CD8|CD4|ANTIGEN|VACCINE|TLR",
                pathway,
                re.I,
            )
        )
        gsea_keep.append(
            {
                "cluster": clean_str(row[gsea_idx["Cluster"]]),
                "annotation": clean_str(row[gsea_idx["Annotation"]]),
                "pathway": pathway[:120],
                "NES": round(nes, 4),
                "padj": padj,
                "interesting": interesting,
            }
        )
    gsea_keep.sort(key=lambda r: (not r["interesting"], -abs(r["NES"])))
    top_gsea = gsea_keep[:60]
    for item in top_gsea:
        item.pop("interesting", None)

    return {
        "paper": PAPER,
        "tier": "A+B",
        "samples": samples,
        "clusters": [
            {"cluster": cid, **meta} for cid, meta in cluster_meta.items()
        ],
        "compositionByCellClass": composition_summary,
        "ipiDoseExploratory": {
            "note": "Descriptive Pre3rd→Post3rd fraction deltas by local ipilimumab dose; n is small.",
            "deltas": ipi_deltas,
            "meanMonoMacDeltaByDose": _mean_by(
                ipi_deltas, "ipiCohort", "monoMacDelta"
            ),
            "meanNkTDeltaByDose": _mean_by(ipi_deltas, "ipiCohort", "nkTDelta"),
        },
        "topDifferentialExpression": top_de,
        "interferonAssociatedDE": isg_hits,
        "topGSEA": top_gsea,
        "nSignificantDE": len(significant),
    }


def _mean_by(rows, key, value_key):
    buckets = defaultdict(list)
    for row in rows:
        buckets[row[key]].append(row[value_key])
    return {
        k: round(sum(v) / len(v), 4) if v else None for k, v in sorted(buckets.items())
    }


def process_s3() -> dict:
    path = RAW / "Blass & Keskin Data S3.xlsb"
    wb = open_workbook(path)

    # Patient-level summary (skip blank trailer rows)
    with wb.get_sheet("S3A. Patient-level summary") as sheet:
        raw_rows = [[c.v for c in row] for row in sheet.rows()]
    # Row 0 multi-header junk, row 1 column names, then patients
    col_names = [clean_str(c) for c in raw_rows[1]]
    patients = []
    for row in raw_rows[2:]:
        pid = clean_str(row[0]) if row else ""
        if not pid or pid == "Median" or not pid.startswith("P"):
            continue
        patients.append(
            {
                "patientId": pid,
                "expandedAfterNivolumab": int(safe_float(row[1]) or 0),
                "expandedAfterVaccine": int(safe_float(row[2]) or 0),
                "existingTCRb": int(safe_float(row[3]) or 0),
                "postNivolumabTCRb": int(safe_float(row[4]) or 0),
                "postVaccineTCRb": int(safe_float(row[5]) or 0),
                "totalCategorizedTCRb": int(safe_float(row[6]) or 0),
                "postVaccineSignificantlyExpanded": int(safe_float(row[7]) or 0),
                "pctPostVaccineSignificantlyExpanded": safe_float(row[8]),
                "pctPostVaccineOfCategorized": safe_float(row[9]),
                "impExpandedExisting": int(safe_float(row[13]) or 0),
                "impExpandedPostNivo": int(safe_float(row[14]) or 0),
                "impExpandedPostVaccine": int(safe_float(row[15]) or 0),
                "impExpandedTotal": int(safe_float(row[16]) or 0),
                "pctImpExpandedThatArePostVaccine": safe_float(row[17]),
            }
        )

    # In vitro: keep highly expanded clones only
    invitro_sheets = {
        "P101": "S3K. P101 in vitro",
        "P103": "S3L. P103 in vitro",
        "P104": "S3M. P104 in vitro",
        "P105": "S3N. P105 in vitro",
        "P106": "S3O. P106 in vitro",
        "P108": "S3P. P108 in vitro",
        "P109": "S3Q. P109 in vitro",
        "P110": "S3R. P110 in vitro",
        "P111": "S3S. P111 in vitro",
    }
    imp_expanded = []
    category_of_imp = Counter()
    for patient, sheet_name in invitro_sheets.items():
        with wb.get_sheet(sheet_name) as sheet:
            for i, row in enumerate(sheet.rows()):
                if i < 2:
                    continue
                vals = [c.v for c in row]
                if not vals or not vals[0]:
                    continue
                highly = vals[10]
                if highly is not True and highly != 1 and str(highly).lower() != "true":
                    continue
                cat = clean_str(vals[11])
                category_of_imp[cat] += 1
                imp_expanded.append(
                    {
                        "patientId": patient,
                        "tcrb": clean_str(vals[0]),
                        "poolA_UMI": safe_float(vals[1]),
                        "poolB_UMI": safe_float(vals[3]),
                        "dmso_UMI": safe_float(vals[5]),
                        "log2fcPoolA": safe_float(vals[7]),
                        "log2fcPoolB": safe_float(vals[8]),
                        "maxLog2fc": safe_float(vals[9]),
                        "category": cat,
                    }
                )

    # Ex vivo: stream category counts only (full tables are too large to store)
    exvivo_sheets = {
        "P101": "S3B. P101 ex vivo",
        "P103": "S3C. P103 ex vivo",
        "P104": "S3D. P104 ex vivo",
        "P105": "S3E. P105 ex vivo",
        "P106": "S3F. P106 ex vivo",
        "P108": "S3G. P108 ex vivo",
        "P109": "S3H. P109 ex vivo",
        "P110": "S3I. P110 ex vivo",
        "P111": "S3J. P111 ex vivo",
    }
    exvivo_category_counts = {}
    top_post_vaccine_clones = []
    for patient, sheet_name in exvivo_sheets.items():
        print(f"    scanning {sheet_name} …")
        cats = Counter()
        # Keep top post-vaccine clones by post-vax UMI among Post-Vaccine category
        candidates = []
        with wb.get_sheet(sheet_name) as sheet:
            header_row = None
            for i, row in enumerate(sheet.rows()):
                vals = [c.v for c in row]
                if i == 1:
                    header_row = [clean_str(v) for v in vals]
                    # find indices: TCRβ, pre UMI, post-nivo UMI, post-vax UMI, category
                    continue
                if i < 2:
                    continue
                if not vals or not vals[0]:
                    continue
                cat = clean_str(vals[-1])
                cats[cat or "Unknown"] += 1
                if cat in {"Post-Vaccine", "Post-vaccine", "Post Vaccine"}:
                    # columns: 0 tcr, 1 pre UMI, 3 nivo UMI, 5 vax UMI (standard layout)
                    pre = safe_float(vals[1]) or 0
                    nivo = safe_float(vals[3]) or 0
                    vax = safe_float(vals[5]) or 0
                    candidates.append((vax, pre, nivo, clean_str(vals[0])))
        candidates.sort(reverse=True)
        for vax, pre, nivo, tcr in candidates[:40]:
            top_post_vaccine_clones.append(
                {
                    "patientId": patient,
                    "tcrb": tcr,
                    "preUMI": pre,
                    "postNivoUMI": nivo,
                    "postVaxUMI": vax,
                }
            )
        exvivo_category_counts[patient] = dict(cats)

    # Cohort-level claim numbers
    med_nivo = sorted(p["expandedAfterNivolumab"] for p in patients)
    med_vax = sorted(p["expandedAfterVaccine"] for p in patients)

    return {
        "paper": PAPER,
        "tier": "A",
        "patients": patients,
        "cohort": {
            "medianExpandedAfterNivolumab": med_nivo[len(med_nivo) // 2],
            "medianExpandedAfterVaccine": med_vax[len(med_vax) // 2],
            "totalImpExpandedClones": len(imp_expanded),
            "impExpandedByCategory": dict(category_of_imp),
            "meanPctImpExpandedPostVaccine": round(
                sum(p["pctImpExpandedThatArePostVaccine"] or 0 for p in patients)
                / len(patients),
                2,
            )
            if patients
            else None,
        },
        "exvivoCategoryCounts": exvivo_category_counts,
        "topPostVaccineClones": top_post_vaccine_clones,
        "impExpandedClones": imp_expanded,
        "notes": [
            "Full ex vivo clonotype tables (>300k rows/patient) are not retained; category counts + top post-vaccine clones are stored.",
            "IMP-expanded clones are those marked highly expanded in vitro vs DMSO.",
        ],
    }


def process_s4_s5() -> dict:
    path4 = RAW / "Blass & Keskin Data S4.xlsx"
    path5 = RAW / "Blass & Keskin Data S5.xlsx"

    _, qc_rows = load_sheet_rows(path4, "S4A. Tumor Sample-level QC")
    tumor_samples = []
    for row in qc_rows:
        if not row or row[0] is None:
            continue
        tumor_samples.append(
            {
                "sample": clean_str(row[0]),
                "patientId": clean_str(row[1]),
                "timepoint": clean_str(row[2]),
                "ipiCohort": clean_str(row[4]),
                "nCells": int(safe_float(row[8]) or 0),
            }
        )

    header, count_rows = load_sheet_rows(path4, "S4C. Tumor cluster cell counts")
    sample_cols = header[2:]
    tumor_composition = []
    for row in count_rows:
        if not row or row[0] is None:
            continue
        annotation = clean_str(row[1])
        for i, sample in enumerate(sample_cols):
            n = int(safe_float(row[2 + i]) or 0)
            tumor_composition.append(
                {
                    "annotation": annotation,
                    "sample": sample,
                    "nCells": n,
                    "patientId": sample.split("_")[0],
                    "timepoint": (
                        "Pre-treatment"
                        if "Pre-treatment" in sample
                        else "Post-nivolumab"
                        if "Post-nivolumab" in sample
                        else "Post-vaccine"
                        if "Post-vaccine" in sample
                        else "PD"
                        if "_PD_" in sample
                        else ""
                    ),
                }
            )

    # Collapse to melanoma vs T vs other fractions per sample
    sample_totals = Counter()
    sample_groups = Counter()
    for row in tumor_composition:
        sample_totals[row["sample"]] += row["nCells"]
        ann = row["annotation"]
        if ann.startswith("Melanoma"):
            group = "Melanoma"
        elif ann.startswith("CD8") or ann.startswith("CD4") or ann.startswith("Treg") or ann.startswith("NK"):
            group = "T/NK"
        elif ann.startswith("B") or "Plasma" in ann:
            group = "B/Plasma"
        else:
            group = "Other"
        sample_groups[(row["sample"], group)] += row["nCells"]

    tumor_group_summary = []
    for (sample, group), n in sorted(sample_groups.items()):
        total = sample_totals[sample] or 1
        # recover patient/timepoint
        match = next(r for r in tumor_composition if r["sample"] == sample)
        tumor_group_summary.append(
            {
                "sample": sample,
                "patientId": match["patientId"],
                "timepoint": match["timepoint"],
                "group": group,
                "nCells": n,
                "fraction": round(n / total, 4),
            }
        )

    _, recon_rows = load_sheet_rows(path4, "S4G. TCRs reconstructed")
    reconstructed = []
    for row in recon_rows:
        if not row or row[0] is None:
            continue
        reconstructed.append(
            {
                "tcrId": clean_str(row[0]),
                "patientId": f"P{clean_str(row[1])}"
                if clean_str(row[1]) and not clean_str(row[1]).startswith("P")
                else clean_str(row[1]),
                "cdr3a": clean_str(row[4]),
                "cdr3b": clean_str(row[7]),
                "trav": clean_str(row[2]),
                "trbv": clean_str(row[5]),
            }
        )

    _, reactive_rows = load_sheet_rows(path4, "S4H. TCRs reactive")
    reactive = []
    for row in reactive_rows:
        if not row or row[0] is None:
            continue
        reactive.append(
            {
                "tcrId": clean_str(row[0]),
                "tcrb": clean_str(row[1]),
                "patientId": clean_str(row[2]),
                "seenPre": clean_str(row[3]),
                "seenPostNivo": clean_str(row[4]),
                "seenPostVax": clean_str(row[5]),
                "se": clean_str(row[6]),
                "type": clean_str(row[7]),
                "impExpanded": clean_str(row[8]),
                "reactive": clean_str(row[9]),
            }
        )

    _, s5a = load_sheet_rows(path5, "S5A. Sample level scTCR metrics")
    sctcr_qc = []
    for row in s5a:
        if not row or row[0] is None:
            continue
        sctcr_qc.append(
            {
                "sample": clean_str(row[0]),
                "patientId": clean_str(row[1]),
                "site": clean_str(row[2]),
                "clonesPassQC": int(safe_float(row[4]) or 0),
                "clonesMatchedRNA": int(safe_float(row[5]) or 0),
            }
        )

    header, s5b = load_sheet_rows(path5, "S5B. Tumor single cell clones")
    type_counts = Counter()
    patient_type = Counter()
    for row in s5b:
        if not row or row[0] is None:
            continue
        pid = clean_str(row[0])
        typ = clean_str(row[7]) or "NA"
        type_counts[typ] += 1
        patient_type[(pid, typ)] += 1

    tumor_clone_types = [
        {"patientId": pid, "type": typ, "nClones": n}
        for (pid, typ), n in sorted(patient_type.items())
    ]

    _, s5d = load_sheet_rows(path5, "S5D. Tumor and IE  PBMC clones")
    overlaps = []
    for row in s5d:
        if not row or row[0] is None:
            continue
        overlaps.append(
            {
                "patientId": clean_str(row[0]),
                "tcrb": clean_str(row[1]),
                "pbmcType": clean_str(row[2]),
                "tumorType": clean_str(row[3]),
            }
        )

    reactive_by_type = Counter(r["type"] for r in reactive)
    first_seen = Counter()
    for r in reactive:
        if r["seenPre"] == "Yes":
            first_seen["pre-treatment"] += 1
        elif r["seenPostNivo"] == "Yes":
            first_seen["post-nivolumab"] += 1
        elif r["seenPostVax"] == "Yes":
            first_seen["post-vaccine"] += 1
        else:
            first_seen["unknown"] += 1

    return {
        "paper": PAPER,
        "tier": "A",
        "tumorSamples": tumor_samples,
        "tumorGroupComposition": tumor_group_summary,
        "reconstructedTcrs": reconstructed,
        "reactiveTcrs": reactive,
        "reactiveSummary": {
            "nReactive": len(reactive),
            "nReconstructed": len(reconstructed),
            "byType": dict(reactive_by_type),
            "firstDetected": dict(first_seen),
            "impExpandedCount": sum(
                1 for r in reactive if "IMP" in (r["impExpanded"] or "")
            ),
        },
        "scTcrQc": sctcr_qc,
        "tumorCloneTypeCounts": tumor_clone_types,
        "tumorCloneTypesGlobal": dict(type_counts),
        "bloodTumorOverlaps": overlaps,
    }


def build_cross_layer(s1, s3, s45) -> dict:
    """Join mutation burden, TCR expansion, and reactive TIL evidence per patient."""
    mut = {p["patientId"]: p for p in s1["patients"]}
    tcr = {p["patientId"]: p for p in s3["patients"]}
    reactive = Counter(r["patientId"] for r in s45["reactiveTcrs"])
    overlaps = Counter(r["patientId"] for r in s45["bloodTumorOverlaps"])

    rows = []
    for pid in sorted(set(mut) | set(tcr) | set(reactive) | set(overlaps)):
        m = mut.get(pid, {})
        t = tcr.get(pid, {})
        rows.append(
            {
                "patientId": pid,
                "codingMutations": m.get("codingMutations"),
                "neoantigenProxy": m.get("neoantigenProxy"),
                "expandedAfterNivolumab": t.get("expandedAfterNivolumab"),
                "expandedAfterVaccine": t.get("expandedAfterVaccine"),
                "impExpandedTotal": t.get("impExpandedTotal"),
                "pctImpExpandedPostVaccine": t.get("pctImpExpandedThatArePostVaccine"),
                "nReactiveTcrs": reactive.get(pid, 0),
                "nBloodTumorOverlaps": overlaps.get(pid, 0),
            }
        )

    return {
        "paper": PAPER,
        "tier": "A",
        "narrative": (
            "Mutation load → circulating TCR expansion after vaccine (distinct from PD-1) "
            "→ IMP-expanded / reactive clonotypes detectable in tumor."
        ),
        "patients": rows,
    }


def build_claim_checks(s1, s3, s45) -> dict:
    """Tier B: lightweight reproducibility checks against paper summary statements."""
    patients = s3["patients"]
    checks = []

    # Paper: vaccination induced hundreds of circulating TCR clonotypes distinct from PD-1
    all_have_vax_expansion = all(p["expandedAfterVaccine"] > 0 for p in patients)
    checks.append(
        {
            "claim": "All fully vaccinated patients with bulk TCR data show post-vaccine expanded clonotypes",
            "paperHint": "Vaccination induced circulating TCR clonotypes distinct from PD-1 inhibition",
            "observed": {
                "nPatients": len(patients),
                "minExpandedAfterVaccine": min(p["expandedAfterVaccine"] for p in patients),
                "medianExpandedAfterVaccine": s3["cohort"]["medianExpandedAfterVaccine"],
                "medianExpandedAfterNivolumab": s3["cohort"]["medianExpandedAfterNivolumab"],
            },
            "pass": all_have_vax_expansion
            and s3["cohort"]["medianExpandedAfterVaccine"]
            >= s3["cohort"]["medianExpandedAfterNivolumab"],
        }
    )

    # Paper: majority of IMP-expanded clones are post-vaccine
    mean_pct = s3["cohort"]["meanPctImpExpandedPostVaccine"]
    checks.append(
        {
            "claim": "Most IMP-expanded TCRβ clones are post-vaccine category (cohort mean > 75%)",
            "paperHint": "Neoantigen vaccination reshapes distinct TCR repertoires; IMP-expanded clones enriched post-vaccine",
            "observed": {"meanPctImpExpandedPostVaccine": mean_pct},
            "pass": mean_pct is not None and mean_pct >= 75,
        }
    )

    # Paper: reconstructed/reactive TIL post vaccine
    reactive = s45["reactiveTcrs"]
    post_vax_type = sum(1 for r in reactive if r["type"] == "Post-Vaccine")
    checks.append(
        {
            "claim": "Reactive tumor-associated TCRs are predominantly post-vaccine type",
            "paperHint": "TCR reconstruction and antigen screening reveals vaccine-specific TIL post vaccine",
            "observed": {
                "nReactive": len(reactive),
                "nPostVaccineType": post_vax_type,
                "firstDetected": s45["reactiveSummary"]["firstDetected"],
            },
            "pass": post_vax_type >= len(reactive) * 0.5 if reactive else False,
        }
    )

    # Mutation landscape present for enrolled set
    checks.append(
        {
            "claim": "Mutation tables cover enrolled patient IDs P101–P111",
            "paperHint": "Data S1 related to Figure 1 / vaccine generation",
            "observed": {
                "nPatients": s1["nPatients"],
                "patientIds": [p["patientId"] for p in s1["patients"]],
                "medianCodingInS1": s1["cohort"]["medianCodingMutations"],
            },
            "pass": s1["nPatients"] >= 10,
        }
    )

    return {
        "paper": PAPER,
        "tier": "B",
        "checks": checks,
        "nPassed": sum(1 for c in checks if c["pass"]),
        "nChecks": len(checks),
        "limitations": [
            "ELISpot / % IMP immunogenicity figures are not in Data S1–S5 and cannot be rechecked here.",
            "Single-arm, small n; exploratory ipi-dose contrasts are descriptive only.",
            "S1 coding counts are broader than the paper’s ‘high-quality coding mutations’ filter.",
        ],
    }


def build_manifest(paths: dict) -> dict:
    return {
        "paper": PAPER,
        "tiers": {
            "A": [
                "mutations_summary.json",
                "vaccine_site.json",
                "tcr_repertoire.json",
                "tumor_tcr.json",
                "cross_layer.json",
            ],
            "B": [
                "mutations_summary.json (neoantigenProxy)",
                "vaccine_site.json (ipiDoseExploratory)",
                "claim_checks.json",
            ],
            "C_skipped": [
                "Full scRNA re-clustering (no count matrices in supplements)",
                "Uploading raw S3 ex vivo clonotype tables",
                "Clinical efficacy / survival modeling (single-arm, small n)",
            ],
        },
        "files": paths,
        "uiBundle": "app/data/neovaxmi/",
    }


def main():
    assert RAW.exists(), f"Missing raw folder: {RAW}"
    OUT.mkdir(parents=True, exist_ok=True)
    APP.mkdir(parents=True, exist_ok=True)

    print("Processing S1 (mutations)…")
    s1 = process_s1()
    write_json(OUT / "mutations_summary.json", s1)

    print("Processing S2 (vaccine site)…")
    s2 = process_s2()
    write_json(OUT / "vaccine_site.json", s2)

    print("Processing S3 (bulk TCR) — may take a few minutes…")
    s3 = process_s3()
    write_json(OUT / "tcr_repertoire.json", s3)

    print("Processing S4–S5 (tumor / reactivity)…")
    s45 = process_s4_s5()
    write_json(OUT / "tumor_tcr.json", s45)

    print("Building cross-layer + claim checks…")
    cross = build_cross_layer(s1, s3, s45)
    write_json(OUT / "cross_layer.json", cross)
    claims = build_claim_checks(s1, s3, s45)
    write_json(OUT / "claim_checks.json", claims)

    # Compact UI bundle (drop bulky clone lists where needed)
    ui_mutations = {
        "paper": s1["paper"],
        "patients": [
            {
                k: p[k]
                for k in (
                    "patientId",
                    "totalMutations",
                    "codingMutations",
                    "missense",
                    "neoantigenProxy",
                    "neoantigenProxyFraction",
                    "cnvSegments",
                    "cnvLohSegments",
                )
            }
            for p in s1["patients"]
        ],
        "globalVariantClasses": s1["globalVariantClasses"][:12],
        "globalTopGenes": s1["globalTopGenes"][:15],
        "cohort": s1["cohort"],
    }
    ui_site = {
        "paper": s2["paper"],
        "compositionByCellClass": s2["compositionByCellClass"],
        "ipiDoseExploratory": s2["ipiDoseExploratory"],
        "interferonAssociatedDE": s2["interferonAssociatedDE"][:20],
        "topDifferentialExpression": s2["topDifferentialExpression"][:30],
        "topGSEA": s2["topGSEA"][:20],
        "samples": s2["samples"],
    }
    ui_tcr = {
        "paper": s3["paper"],
        "patients": s3["patients"],
        "cohort": s3["cohort"],
        "impExpandedByCategory": s3["cohort"]["impExpandedByCategory"],
        # Full clone lists stay in data-analysis-processed/tcr_repertoire.json only
    }

    ml_rows = []
    for i, c in enumerate(s3["impExpandedClones"]):
        a = c.get("log2fcPoolA") or 0
        b = c.get("log2fcPoolB") or 0
        mx = c.get("maxLog2fc") or 0
        pa = c.get("poolA_UMI") or 0
        pb = c.get("poolB_UMI") or 0
        total = pa + pb
        ml_rows.append(
            {
                "id": f"{c['patientId']}-{i}",
                "patientId": c["patientId"],
                "category": c["category"],
                "y": 1 if c["category"] == "Post-Vaccine" else 0,
                "log2fcPoolA": round(a, 4),
                "log2fcPoolB": round(b, 4),
                "maxLog2fc": round(mx, 4),
                "poolDelta": round(a - b, 4),
                "poolAShare": round(pa / total, 4) if total > 0 else 0.5,
            }
        )
    ml_clones = {
        "task": (
            "Predict whether an IMP-expanded TCRβ clone arose in the post-vaccine "
            "repertoire category (vs existing / post-nivolumab), from in vitro "
            "peptide-pool expansion features."
        ),
        "labelPositive": "Post-Vaccine",
        "n": len(ml_rows),
        "classCounts": dict(Counter(r["category"] for r in ml_rows)),
        "positiveRate": round(sum(r["y"] for r in ml_rows) / len(ml_rows), 4)
        if ml_rows
        else 0,
        "featureKeys": [
            "log2fcPoolA",
            "log2fcPoolB",
            "maxLog2fc",
            "poolDelta",
            "poolAShare",
        ],
        "featureLabels": {
            "log2fcPoolA": "log2FC Pool A vs DMSO",
            "log2fcPoolB": "log2FC Pool B vs DMSO",
            "maxLog2fc": "Max log2FC (A or B)",
            "poolDelta": "Pool A − Pool B log2FC",
            "poolAShare": "Pool A UMI share",
        },
        "clones": ml_rows,
    }
    write_json(OUT / "ml_clones.json", ml_clones)
    # Compact JSON for the browser bundle
    (APP / "ml_clones.json").write_text(
        json.dumps(ml_clones, separators=(",", ":")) + "\n"
    )
    print(f"  wrote app/data/neovaxmi/ml_clones.json ({(APP / 'ml_clones.json').stat().st_size // 1024} KB)")
    ui_tumor = {
        "paper": s45["paper"],
        "tumorGroupComposition": s45["tumorGroupComposition"],
        "reactiveSummary": s45["reactiveSummary"],
        "reactiveTcrs": s45["reactiveTcrs"],
        "tumorCloneTypeCounts": s45["tumorCloneTypeCounts"],
        "bloodTumorOverlaps": s45["bloodTumorOverlaps"],
        "reconstructedCount": len(s45["reconstructedTcrs"]),
    }

    ui_files = {
        "mutations.json": ui_mutations,
        "vaccine_site.json": ui_site,
        "tcr.json": ui_tcr,
        "tumor.json": ui_tumor,
        "cross_layer.json": cross,
        "claim_checks.json": claims,
        "meta.json": {"paper": PAPER, "datasetLabel": "NeoVaxMI / Cell 2025 Data S1–S5"},
    }
    for name, payload in ui_files.items():
        write_json(APP / name, payload)

    paths = {p.name: f"{p.stat().st_size} bytes" for p in sorted(OUT.glob("*.json"))}
    write_json(OUT / "manifest.json", build_manifest(paths))

    readme = f"""# NeoVaxMI processed aggregates

Derived from `data-analysis-raw/` supplemental tables for:

**{PAPER['title']}** ({PAPER['authors']}; {PAPER['journal']} {PAPER['year']}; DOI {PAPER['doi']}; {PAPER['trial']}).

## Tier coverage

- **A** — mutation landscape, vaccine-site composition/DE/GSEA, TCR dynamics, tumor TIL + reactivity, cross-layer patient table
- **B** — neoantigen-proxy mutation counts, ipilimumab-dose exploratory deltas, paper claim checks
- **C (skipped)** — full scRNA re-clustering; raw S3 ex vivo dumps; efficacy modeling

## Regenerate

```bash
python3 -m venv .venv-neovaxmi
source .venv-neovaxmi/bin/activate
pip install -r scripts/neovaxmi/requirements.txt
python scripts/neovaxmi/process.py
```

UI-facing copies live in `app/data/neovaxmi/`.
"""
    (OUT / "README.md").write_text(readme)
    print("Done.")


if __name__ == "__main__":
    main()
