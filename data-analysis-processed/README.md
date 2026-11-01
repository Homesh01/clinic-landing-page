# Processed research aggregates

Mirrors `data-analysis-raw/` study folders. Raw inputs are gitignored; these reduced JSON summaries are committed.

| Folder | Study |
|--------|--------|
| `melanoma/` | NeoVaxMI / Cell 2025 (Blass & Keskin) — mutation/TCR/vaccine-site aggregates + LOO-style checks |
| `pancreatic/` | Autogene cevumeran / Nature 2025 (Sethna, Guasp, Balachandran) — longevity kinetics (bootstrap, Wilcoxon, Spearman) |

## Regenerate

```bash
# Melanoma
python scripts/neovaxmi/process.py

# Pancreatic
python scripts/pancreatic/process.py
```

See each subfolder `README.md` for dependency setup.
