# NeoVaxMI processed aggregates

Derived from `data-analysis-raw/` supplemental tables for:

**A multi-adjuvant personal neoantigen vaccine generates potent immunity in melanoma** (Blass, Keskin, Ott, Wu et al.; Cell 2025; DOI 10.1016/j.cell.2025.06.019; NCT03929029).

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
