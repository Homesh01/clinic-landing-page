# PDAC RNA neoantigen vaccine — processed aggregates

Derived from `data-analysis-raw/pancreatic/` for:

**RNA neoantigen vaccines prime long-lived CD8+ T cells in pancreatic cancer** (Sethna, Guasp, Balachandran et al.; Nature 2025; DOI 10.1038/s41586-024-08508-4).

## Methods (vs melanoma NeoVaxMI)

Unlike the melanoma NeoVaxMI reanalysis (leave-one-out clone expansion and mutation-landscape tallies), this PDAC pass emphasises longevity kinetics: bootstrap CIs, Wilcoxon signed-rank on paired prime/boost half-lives, and Spearman correlation between peak clonal frequency and predicted lifespan.

## Regenerate

```bash
python3 -m venv .venv-analysis
source .venv-analysis/bin/activate
pip install -r scripts/pancreatic/requirements.txt
python scripts/pancreatic/process.py
```
