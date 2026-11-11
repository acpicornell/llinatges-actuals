# llinatges-actuals — modern Mallorcan surname isonymy (INE census, 2025)

[![Deploy](https://github.com/acpicornell/llinatges-actuals/actions/workflows/deploy.yml/badge.svg)](https://github.com/acpicornell/llinatges-actuals/actions/workflows/deploy.yml)

Population-genetics view of **present-day** Mallorcan surnames: spatial isonymy across the
51 municipalities, an **endemism** axis (which surnames are concentrated on the island) and,
kept strictly apart, a descriptive **origin** axis (Catalan vs Castilian vs foreign). Sister
project to the 14th-century corpus work (`llinatges-medievals`), kept **separate** because it
outgrew being an exploration.

Deployed at **<https://llinatges.corpusbalear.org/>** (Cloudflare Worker, auto-deployed
from `main`). All sources are open (INE), so unlike the medieval sibling this one is
publishable. Part of [Corpus Balear](https://corpusbalear.org).

## What's in it

- A reconstructed census of **7,975 surnames × 51 municipalities** (≈73 % population
  coverage), plus the second surname: **5,669 surnames × 51 municipalities** (≈66 %).
- **Isolation by distance holds** for the Mallorca-endemic surnames (Mantel **r ≈ 0.30,
  p = 0.0001**), and the paternal- and maternal-line geographies agree at **r ≈ 0.91**.
- Endemic set = 997 surnames; **~40 % of the population carries a Mallorca-endemic surname.**
- Origin by population: ≈ **46 % català · 49 % castellà · 3.6 % foreign · 1.1 % undetermined**.
- A viewer with map, municipalities, endemism, origin, isonymy, MDS, conclusions and methodology.

## How it was made

Everything comes from the INE surname API and padrón 2025, with NGIB coordinates; there is
no IBESTAT dependency. Each surname's per-municipality rate is turned back into exact counts
(`rate‰ × padrón / 1000`), endemism is a location quotient against Spain, and the isonymy
statistics (Lasker, Mantel, MDS, UPGMA) run on the endemic subset alone. Origin is a
descriptive, layered label that feeds no statistic.

## Run / build locally

```sh
nix develop                              # Python + numpy/pandas/scipy, pinned
python src/<script>.py                   # pipeline steps, from the repo root
npx wrangler dev                         # preview web/ with the real headers, :8787
```

## Documentation

- [docs/DATA.md](docs/DATA.md) — the INE and NGIB sources, and why IBESTAT was dropped.
- [docs/PIPELINE.md](docs/PIPELINE.md) — the scripts step by step, the second-surname
  twins, the web viewer and its CSP, and project notes.
- [docs/ANALYSIS.md](docs/ANALYSIS.md) — the two orthogonal axes, the key results for
  2025, and the caveats.
- [CLAUDE.md](CLAUDE.md) — conventions and backlog.

## Licence and citation

The surname and population data come from the INE and are credited:

> Elaboración propia con datos extraídos del sitio web del INE: www.ine.es
