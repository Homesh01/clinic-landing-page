#!/usr/bin/env python3
"""
Process Nature 2025 PDAC RNA neoantigen vaccine source data
(Sethna, Guasp, Balachandran et al.) into compact aggregates.

Statistical emphasis (intentionally different from NeoVaxMI / melanoma):
  - Bootstrap confidence intervals for clone half-life and lifespan
  - Wilcoxon signed-rank (prime vs boost half-life on paired clones)
  - Spearman correlation (peak frequency vs estimated lifespan)
  - Patient-level persistence fractions at last immunological follow-up

Usage (from repo root):
  python scripts/pancreatic/process.py
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data-analysis-raw" / "pancreatic"
OUT = ROOT / "data-analysis-processed" / "pancreatic"
APP = ROOT / "app" / "data" / "pancreatic"

PAPER = {
    "title": "RNA neoantigen vaccines prime long-lived CD8+ T cells in pancreatic cancer",
    "authors": "Sethna, Guasp, Balachandran et al.",
    "journal": "Nature",
    "year": 2025,
    "doi": "10.1038/s41586-024-08508-4",
    "pdf": "s41586-024-08508-4.pdf",
    "vaccine": "Autogene cevumeran (individualized mRNA–lipoplex neoantigen vaccine)",
    "indication": "Pancreatic ductal adenocarcinoma (PDAC)",
    "trialContext": (
        "Phase 1: surgery, atezolizumab (anti–PD-L1), autogene cevumeran, mFOLFIRINOX; "
        "extended ~3.2-year median follow-up"
    ),
    "nRespondersWithVaccineTcells": 8,
    "nNonRespondersWithoutVaccineTcells": 8,
    "source_note": (
        "Aggregates from Nature supplemental source tables (MOESM5–15). "
        "De-identified published patient IDs. Not Personalised Cancer Care clinical data."
    ),
    "methodsNote": (
        "Unlike the melanoma NeoVaxMI reanalysis (leave-one-out clone expansion and "
        "mutation-landscape tallies), this PDAC pass emphasises longevity kinetics: "
        "bootstrap CIs, Wilcoxon signed-rank on paired prime/boost half-lives, and "
        "Spearman correlation between peak clonal frequency and predicted lifespan."
    ),
}

RNG = random.Random(20250327)


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n")
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")


def clean_str(value) -> str:
    if value is None:
        return ""
    return str(value).replace("\xa0", " ").replace("\n", " ").strip()


def safe_float(value):
    if value is None or value == "" or value == "-" or value == "NA":
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return float("nan")
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    return sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f)


def summarise(values: list[float]) -> dict:
    vals = sorted(v for v in values if v is not None and not math.isnan(v))
    if not vals:
        return {"n": 0}
    mean = sum(vals) / len(vals)
    return {
        "n": len(vals),
        "min": round(vals[0], 6),
        "median": round(percentile(vals, 0.5), 6),
        "mean": round(mean, 6),
        "p25": round(percentile(vals, 0.25), 6),
        "p75": round(percentile(vals, 0.75), 6),
        "max": round(vals[-1], 6),
    }


def bootstrap_ci(
    values: list[float],
    *,
    statistic: str = "median",
    n_boot: int = 2000,
    alpha: float = 0.05,
) -> dict:
    vals = [v for v in values if v is not None and not math.isnan(v)]
    if len(vals) < 2:
        return {"n": len(vals), "statistic": statistic, "estimate": None, "ci95": None}

    def stat(sample: list[float]) -> float:
        s = sorted(sample)
        if statistic == "mean":
            return sum(s) / len(s)
        return percentile(s, 0.5)

    estimate = stat(vals)
    boots = []
    n = len(vals)
    for _ in range(n_boot):
        sample = [vals[RNG.randrange(n)] for _ in range(n)]
        boots.append(stat(sample))
    boots.sort()
    lo = percentile(boots, alpha / 2)
    hi = percentile(boots, 1 - alpha / 2)
    return {
        "n": n,
        "statistic": statistic,
        "estimate": round(estimate, 6),
        "ci95": [round(lo, 6), round(hi, 6)],
        "nBoot": n_boot,
    }


def spearman(xs: list[float], ys: list[float]) -> dict:
    pairs = [
        (x, y)
        for x, y in zip(xs, ys)
        if x is not None and y is not None and not math.isnan(x) and not math.isnan(y)
    ]
    n = len(pairs)
    if n < 3:
        return {"n": n, "rho": None, "note": "too few paired observations"}

    def ranks(vals: list[float]) -> list[float]:
        order = sorted(range(len(vals)), key=lambda i: vals[i])
        out = [0.0] * len(vals)
        i = 0
        while i < len(vals):
            j = i
            while j + 1 < len(vals) and vals[order[j + 1]] == vals[order[i]]:
                j += 1
            avg = (i + j) / 2 + 1
            for k in range(i, j + 1):
                out[order[k]] = avg
            i = j + 1
        return out

    rx = ranks([p[0] for p in pairs])
    ry = ranks([p[1] for p in pairs])
    mx = sum(rx) / n
    my = sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    denx = math.sqrt(sum((a - mx) ** 2 for a in rx))
    deny = math.sqrt(sum((b - my) ** 2 for b in ry))
    rho = num / (denx * deny) if denx and deny else 0.0
    # Approximate two-sided p via Fisher z for n>=10; else omit.
    p = None
    if n >= 10 and abs(rho) < 0.999:
        z = 0.5 * math.log((1 + rho) / (1 - rho)) * math.sqrt(n - 3)
        # erfc-based two-sided normal p
        p = math.erfc(abs(z) / math.sqrt(2))
    return {
        "n": n,
        "rho": round(rho, 6),
        "pApprox": None if p is None else round(p, 6),
        "method": "Spearman rank correlation",
    }


def wilcoxon_signed_rank(diffs: list[float]) -> dict:
    """Two-sided Wilcoxon signed-rank on non-zero differences (no continuity correction)."""
    d = [x for x in diffs if x is not None and not math.isnan(x) and x != 0]
    n = len(d)
    if n < 5:
        return {
            "n": n,
            "W": None,
            "pApprox": None,
            "note": "too few non-zero paired differences",
            "method": "Wilcoxon signed-rank",
        }

    abs_d = [abs(x) for x in d]
    order = sorted(range(n), key=lambda i: abs_d[i])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and abs_d[order[j + 1]] == abs_d[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1

    w_pos = sum(ranks[i] for i in range(n) if d[i] > 0)
    w_neg = sum(ranks[i] for i in range(n) if d[i] < 0)
    w = min(w_pos, w_neg)
    # Normal approximation with tie-ignored variance n(n+1)(2n+1)/24
    mu = n * (n + 1) / 4
    sigma = math.sqrt(n * (n + 1) * (2 * n + 1) / 24)
    z = (w - mu) / sigma if sigma else 0.0
    p = math.erfc(abs(z) / math.sqrt(2))
    return {
        "n": n,
        "W": round(w, 4),
        "Wpositive": round(w_pos, 4),
        "Wnegative": round(w_neg, 4),
        "zApprox": round(z, 4),
        "pApprox": round(p, 6),
        "alternative": "two-sided",
        "method": "Wilcoxon signed-rank (normal approximation)",
        "hypothesis": "boost half-life − prime half-life differs from 0",
    }


def load_sheet(path: Path, sheet: str):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    return rows


def parse_clone_kinetics() -> list[dict]:
    """Paired prime/boost kinetics from ED Figure 4f."""
    path = RAW / "41586_2024_8508_MOESM11_ESM.xlsx"
    rows = load_sheet(path, "Fig ED4f")
    clones = []
    for row in rows[4:]:
        if not row:
            continue
        peak_p = safe_float(row[0] if len(row) > 0 else None)
        hl_p = safe_float(row[1] if len(row) > 1 else None)
        life_p = safe_float(row[2] if len(row) > 2 else None)
        peak_b = safe_float(row[4] if len(row) > 4 else None)
        hl_b = safe_float(row[5] if len(row) > 5 else None)
        life_b = safe_float(row[6] if len(row) > 6 else None)
        if peak_p is None and hl_p is None and life_p is None:
            continue
        clones.append(
            {
                "peakFreqPrime": peak_p,
                "halfLifeDaysPrime": hl_p,
                "lifespanYearsPrime": life_p,
                "peakFreqBoost": peak_b,
                "halfLifeDaysBoost": hl_b,
                "lifespanYearsBoost": life_b,
            }
        )
    return clones


def parse_patient_persistence() -> list[dict]:
    path = RAW / "41586_2024_8508_MOESM5_ESM.xlsx"
    rows = load_sheet(path, "Figure 2e")
    patients = []
    for row in rows[3:]:
        if not row or row[0] in (None, ""):
            break
        pid = clean_str(row[0])
        if not pid.isdigit():
            continue
        n_prime = safe_float(row[2])
        n_last = safe_float(row[4])
        peak = safe_float(row[3])
        last_pct = safe_float(row[5])
        follow = safe_float(row[1])
        persist = None
        if n_prime and n_last is not None and n_prime > 0:
            persist = n_last / n_prime
        patients.append(
            {
                "patientId": f"P{pid}",
                "followUpYears": None if follow is None else round(follow, 4),
                "clonesAtPriming": None if n_prime is None else int(n_prime),
                "peakPctBloodAtPriming": None if peak is None else round(peak, 6),
                "clonesAtLastFollowUp": None if n_last is None else int(n_last),
                "pctBloodAtLastFollowUp": None if last_pct is None else round(last_pct, 6),
                "clonePersistenceFraction": None
                if persist is None
                else round(persist, 6),
            }
        )
    return patients


def parse_patient_lifespan_summary() -> list[dict]:
    path = RAW / "41586_2024_8508_MOESM8_ESM.xlsx"
    rows = load_sheet(path, "Figure 5a")
    out = []
    for row in rows[4:]:
        if not row or row[0] in (None, ""):
            break
        pid = clean_str(row[0])
        if not pid.isdigit():
            continue
        life = safe_float(row[1])
        onset = safe_float(row[2])
        cumul = safe_float(row[3]) if safe_float(row[3]) is not None else safe_float(
            row[4] if len(row) > 4 else None
        )
        out.append(
            {
                "patientId": f"P{pid}",
                "lifespanYearsAfterSurgery": None if life is None else round(life, 4),
                "onsetWeeksAfterSurgery": None if onset is None else round(onset, 4),
                "cumulativeTcellsPctObs": None if cumul is None else round(cumul, 6),
            }
        )
    return out


def parse_long_lived_boost_clones() -> dict:
    """Fig 2d: clones with multi-decade post-boost lifespan estimates."""
    path = RAW / "41586_2024_8508_MOESM5_ESM.xlsx"
    rows = load_sheet(path, "Figure 2d")
    lifespans = []
    persistence_by_patient = []
    for row in rows[4:]:
        if not row:
            continue
        pid = clean_str(row[1]) if len(row) > 1 else ""
        life = safe_float(row[2]) if len(row) > 2 else None
        if pid.isdigit() and life is not None:
            lifespans.append({"patientId": f"P{pid}", "lifespanYearsPostBoost": round(life, 4)})
        pid_r = clean_str(row[5]) if len(row) > 5 else ""
        pct = safe_float(row[6]) if len(row) > 6 else None
        if pid_r.isdigit() and pct is not None:
            persistence_by_patient.append(
                {
                    "patientId": f"P{pid_r}",
                    "pctPrimedClonesPersisting": round(pct, 4),
                }
            )
    return {
        "longLivedBoostClones": lifespans,
        "primedClonePersistenceByPatient": persistence_by_patient,
    }


def tissue_origin_summary() -> dict:
    path = RAW / "41586_2024_8508_MOESM5_ESM.xlsx"
    rows = load_sheet(path, "Figure 2g")
    # Bottom panel counts for CloneTrack clones
    bottom = {}
    for row in rows:
        label = clean_str(row[1]) if row and len(row) > 1 else ""
        val = safe_float(row[2]) if row and len(row) > 2 else None
        if label in {
            "Tumor",
            "Adjacent",
            "Malignant DLN",
            "Benign DLN",
            "Pre-treatment blood",
            "De novo",
        } and val is not None:
            bottom[label] = int(val)
    return {
        "cloneTrackOriginCounts": bottom,
        "interpretation": (
            "Published CloneTrack origin tally: vaccine-induced clones are largely "
            "de novo (undetectable in pre-vaccination tissues)."
        ),
    }


def build_claim_checks(patients: list[dict], clones: list[dict], long_lived: dict) -> list[dict]:
    persist_fracs = [
        p["clonePersistenceFraction"]
        for p in patients
        if p.get("clonePersistenceFraction") is not None
    ]
    median_persist = percentile(sorted(persist_fracs), 0.5) if persist_fracs else None
    boost_lives = [
        c["lifespanYearsBoost"]
        for c in clones
        if c.get("lifespanYearsBoost") is not None
    ]
    mean_boost = sum(boost_lives) / len(boost_lives) if boost_lives else None
    decade_plus = sum(1 for v in boost_lives if v is not None and v >= 10)
    checks = [
        {
            "id": "clone_persistence_high",
            "claim": (
                "A large share of primed vaccine clones remain detectable years later "
                "(paper reports ~86% of clones per patient at ~3 years)."
            ),
            "metric": "median clonePersistenceFraction (Fig 2e)",
            "value": None if median_persist is None else round(median_persist, 4),
            "passes": median_persist is not None and median_persist >= 0.7,
        },
        {
            "id": "boost_extends_half_life",
            "claim": "Post-boost clone half-lives are longer than post-prime half-lives.",
            "metric": "Wilcoxon signed-rank on paired half-life differences",
            "value": "see kinetics.wilcoxonHalfLifeBoostMinusPrime",
            "passes": True,  # filled after tests
        },
        {
            "id": "multi_year_lifespan",
            "claim": "Estimated post-boost lifespans commonly span multiple years.",
            "metric": "mean post-boost lifespan (years) among modelled clones",
            "value": None if mean_boost is None else round(mean_boost, 3),
            "passes": mean_boost is not None and mean_boost >= 3,
        },
        {
            "id": "decade_scale_clones",
            "claim": "A subset of clones has decade-scale estimated lifespans.",
            "metric": "count of clones with post-boost lifespan ≥ 10 years",
            "value": decade_plus,
            "n": len(boost_lives),
            "passes": decade_plus >= 1,
        },
        {
            "id": "largely_de_novo",
            "claim": "Vaccine-induced CloneTrack clones are largely absent from pre-vaccine tissues.",
            "metric": "De novo count in Fig 2g CloneTrack origin panel",
            "value": tissue_origin_summary()["cloneTrackOriginCounts"].get("De novo"),
            "passes": tissue_origin_summary()["cloneTrackOriginCounts"].get("De novo", 0)
            >= 50,
        },
    ]
    return checks


def main() -> None:
    print("Parsing pancreatic vaccine source tables…")
    clones = parse_clone_kinetics()
    patients = parse_patient_persistence()
    patient_life = parse_patient_lifespan_summary()
    long_lived = parse_long_lived_boost_clones()
    tissue = tissue_origin_summary()

    prime_hl = [c["halfLifeDaysPrime"] for c in clones if c.get("halfLifeDaysPrime")]
    boost_hl = [c["halfLifeDaysBoost"] for c in clones if c.get("halfLifeDaysBoost")]
    prime_life = [c["lifespanYearsPrime"] for c in clones if c.get("lifespanYearsPrime")]
    boost_life = [c["lifespanYearsBoost"] for c in clones if c.get("lifespanYearsBoost")]

    paired_hl_diffs = []
    for c in clones:
        if c.get("halfLifeDaysPrime") is not None and c.get("halfLifeDaysBoost") is not None:
            paired_hl_diffs.append(c["halfLifeDaysBoost"] - c["halfLifeDaysPrime"])

    wilcoxon = wilcoxon_signed_rank(paired_hl_diffs)

    # Spearman: peak prime frequency vs post-boost lifespan (where both exist)
    spearman_peak_life = spearman(
        [c["peakFreqPrime"] for c in clones],
        [
            c["lifespanYearsBoost"]
            if c.get("lifespanYearsBoost") is not None
            else c.get("lifespanYearsPrime")
            for c in clones
        ],
    )

    # Compact sample for scatter plots + full ML table (prime features → long-lived boost).
    sample_clones = [
        {
            "peakFreqPrime": c["peakFreqPrime"],
            "halfLifeDaysPrime": c["halfLifeDaysPrime"],
            "lifespanYearsPrime": c["lifespanYearsPrime"],
            "peakFreqBoost": c["peakFreqBoost"],
            "halfLifeDaysBoost": c["halfLifeDaysBoost"],
            "lifespanYearsBoost": c["lifespanYearsBoost"],
        }
        for c in clones[:40]
    ]

    boost_lives_for_label = [
        c["lifespanYearsBoost"]
        for c in clones
        if c.get("lifespanYearsBoost") is not None
    ]
    longevity_threshold = (
        percentile(sorted(boost_lives_for_label), 0.5) if boost_lives_for_label else 7.7
    )
    ml_rows = []
    for i, c in enumerate(clones):
        if c.get("lifespanYearsBoost") is None or c.get("halfLifeDaysPrime") is None:
            continue
        if c.get("peakFreqPrime") is None or c.get("lifespanYearsPrime") is None:
            continue
        peak = c["peakFreqPrime"]
        y = 1 if c["lifespanYearsBoost"] >= longevity_threshold else 0
        ml_rows.append(
            {
                "id": f"clone-{i + 1}",
                "y": y,
                "label": "long-lived" if y == 1 else "shorter-lived",
                "logPeakPrime": round(math.log10(peak + 1e-6), 6),
                "peakFreqPrime": round(peak, 8),
                "halfLifeDaysPrime": round(c["halfLifeDaysPrime"], 6),
                "lifespanYearsPrime": round(c["lifespanYearsPrime"], 6),
                "lifespanYearsBoost": round(c["lifespanYearsBoost"], 6),
            }
        )
    ml_clones = {
        "task": (
            "Predict whether a vaccine-tracked clone has above-median post-boost "
            "estimated lifespan, using only priming-phase kinetics (no boost features)."
        ),
        "labelPositive": "long-lived",
        "longevityThresholdYears": round(longevity_threshold, 4),
        "n": len(ml_rows),
        "positiveRate": round(sum(r["y"] for r in ml_rows) / len(ml_rows), 4)
        if ml_rows
        else 0,
        # Keep non-redundant priming features only: raw peak and prime lifespan are
        # near-deterministic transforms of log-peak and half-life (r≈0.89 / r≈1.0).
        "featureKeys": [
            "logPeakPrime",
            "halfLifeDaysPrime",
        ],
        "featureLabels": {
            "logPeakPrime": "log10 peak prime frequency",
            "halfLifeDaysPrime": "Prime half-life (days)",
        },
        "featureNote": (
            "Dropped peakFreqPrime and lifespanYearsPrime as near-collinear with "
            "logPeakPrime and halfLifeDaysPrime."
        ),
        "clones": ml_rows,
        "limitations": [
            "Lifespan values are kinetic-model extrapolations from the paper (some capped), not observed clone survival.",
            "Clone-level splits are not patient-grouped; clones from the same patient can appear in train and test.",
            "n is small; a single hold-out AUC is unstable — prefer leave-one-out AUC on the page.",
        ],
    }

    kinetics = {
        "paper": PAPER,
        "nClonesParsed": len(clones),
        "primeHalfLifeDays": {
            "summary": summarise(prime_hl),
            "bootstrapMedianCI": bootstrap_ci(prime_hl, statistic="median"),
        },
        "boostHalfLifeDays": {
            "summary": summarise(boost_hl),
            "bootstrapMedianCI": bootstrap_ci(boost_hl, statistic="median"),
        },
        "primeLifespanYears": {
            "summary": summarise(prime_life),
            "bootstrapMedianCI": bootstrap_ci(prime_life, statistic="median"),
        },
        "boostLifespanYears": {
            "summary": summarise(boost_life),
            "bootstrapMedianCI": bootstrap_ci(boost_life, statistic="median"),
        },
        "wilcoxonHalfLifeBoostMinusPrime": wilcoxon,
        "spearmanPeakPrimeFreqVsLifespan": spearman_peak_life,
        "sampleClones": sample_clones,
    }

    persistence = {
        "paper": {"title": PAPER["title"], "doi": PAPER["doi"]},
        "patients": patients,
        "persistenceFractionSummary": summarise(
            [p["clonePersistenceFraction"] for p in patients]
        ),
        "followUpYearsSummary": summarise([p["followUpYears"] for p in patients]),
        "bootstrapMedianPersistenceCI": bootstrap_ci(
            [p["clonePersistenceFraction"] for p in patients if p.get("clonePersistenceFraction") is not None],
            statistic="median",
        ),
        "patientLifespanSummaryFig5a": patient_life,
        "longLivedBoost": long_lived,
        "tissueOrigin": tissue,
    }

    claims = build_claim_checks(patients, clones, long_lived)
    # Fill Wilcoxon pass flag from actual test
    for c in claims:
        if c["id"] == "boost_extends_half_life":
            c["value"] = {
                "pApprox": wilcoxon.get("pApprox"),
                "W": wilcoxon.get("W"),
                "n": wilcoxon.get("n"),
            }
            c["passes"] = (
                wilcoxon.get("pApprox") is not None
                and wilcoxon["pApprox"] < 0.05
                and (wilcoxon.get("Wpositive") or 0) > (wilcoxon.get("Wnegative") or 0)
            )

    claim_payload = {
        "paper": {"title": PAPER["title"], "doi": PAPER["doi"]},
        "methodsContrastWithMelanoma": PAPER["methodsNote"],
        "checks": claims,
    }

    meta = {
        "paper": PAPER,
        "datasetLabel": "PDAC autogene cevumeran / Nature 2025 source data",
        "rawFolder": "data-analysis-raw/pancreatic",
        "processedFolder": "data-analysis-processed/pancreatic",
        "filesUsed": [
            "41586_2024_8508_MOESM5_ESM.xlsx",
            "41586_2024_8508_MOESM8_ESM.xlsx",
            "41586_2024_8508_MOESM11_ESM.xlsx",
            "s41586-024-08508-4.pdf",
        ],
        "stats": [
            "bootstrap median 95% CI (half-life, lifespan, persistence)",
            "Wilcoxon signed-rank (paired prime vs boost half-life)",
            "Spearman correlation (peak frequency vs lifespan)",
        ],
    }

    write_json(OUT / "meta.json", meta)
    write_json(OUT / "clone_kinetics.json", kinetics)
    write_json(OUT / "persistence.json", persistence)
    write_json(OUT / "claim_checks.json", claim_payload)
    write_json(OUT / "ml_clones.json", ml_clones)

    APP.mkdir(parents=True, exist_ok=True)
    for name, payload in {
        "meta.json": meta,
        "clone_kinetics.json": kinetics,
        "persistence.json": persistence,
        "claim_checks.json": claim_payload,
        "ml_clones.json": ml_clones,
    }.items():
        write_json(APP / name, payload)

    paths = {p.name: f"{p.stat().st_size} bytes" for p in sorted(OUT.glob("*.json"))}
    manifest = {
        "paper": PAPER,
        "tiers": {
            "A": [
                "clone_kinetics.json",
                "persistence.json",
                "claim_checks.json",
            ],
            "B": [
                "bootstrap CIs",
                "Wilcoxon signed-rank prime vs boost half-life",
                "Spearman peak frequency vs lifespan",
            ],
            "C_skipped": [
                "Full PhenoTrack single-cell phenotype graphs",
                "Per-clone TCR sequence tables",
                "Clinical RFS modeling beyond published responder/non-responder summary",
            ],
        },
        "files": paths,
        "methodsContrastWithMelanoma": PAPER["methodsNote"],
        "uiBundle": "app/data/pancreatic/",
    }
    write_json(OUT / "manifest.json", manifest)

    readme = f"""# PDAC RNA neoantigen vaccine — processed aggregates

Derived from `data-analysis-raw/pancreatic/` for:

**{PAPER['title']}** ({PAPER['authors']}; {PAPER['journal']} {PAPER['year']}; DOI {PAPER['doi']}).

## Methods (vs melanoma NeoVaxMI)

{PAPER['methodsNote']}

## Regenerate

```bash
python3 -m venv .venv-analysis
source .venv-analysis/bin/activate
pip install -r scripts/pancreatic/requirements.txt
python scripts/pancreatic/process.py
```
"""
    (OUT / "README.md").write_text(readme)
    print("Done.")


if __name__ == "__main__":
    main()
