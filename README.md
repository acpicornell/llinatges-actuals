# llinatges-actuals — modern Mallorcan surname isonymy (INE census, 2025)

Population-genetics view of **present-day** Mallorcan surnames: spatial isonymy across the
51 municipalities, an **endemism** axis (which surnames are concentrated on the island) and
an **origin** axis (Catalan vs Castilian vs foreign). Sister project to the 14th-century
corpus work (`llinatges-balears`), kept **separate** because it outgrew being an exploration.

Everything comes from the **INE** (Instituto Nacional de Estadística). There is **no IBESTAT
dependency**: IBESTAT only publishes the top-50 surnames per municipality (a data-protection
truncation, useless for structure), so it was dropped in favour of the full INE census.

> Elaboración propia con datos extraídos del sitio web del INE: www.ine.es

Exploratory. **Not deployed** anywhere.

## Data sources (all INE, plus NGIB coordinates)

- **INE surname API** (operation APEL, "¿Cuántos se llaman…?"):
  - `mapaWidget&vista=muni` → per-municipality rate (‰) of each surname → the census.
  - `mapaWidget&tipo=1` → per-province rate → the origin axis (Catalan-domain concentration).
  - National first-surname totals (`freq_Apellidos*.csv`) → the Spain denominator.
  - "Apellidos por nacionalidad" (`nac_*.csv`, top-20/country) → the foreign screen.
- **INE padrón 2025** (operation 22, table 2860) → official municipal population
  (`muni_pop_padron.csv`), the exact denominator INE divides by to publish its rates.
- **INE municipality contours** (CONTORNOS/19, `contornos19.svg`) → region-id → town map.
- **NGIB** (IDEIB) → town coordinates (`coords_muni.csv`).

## Pipeline

Dev environment is pinned with **Nix**: `nix develop` gives Python + `numpy`/`pandas`/`scipy`
(`flake.nix`, locked to a nixpkgs rev in `flake.lock` — the same rev as `llinatges-balears`).
`requirements.txt` is a pip fallback for non-Nix setups. The fetchers use only the standard library.

All scripts live in `src/` and are run from the repo root (`nix develop -c python src/<script>.py`);
they read `data/` and write `web/site_data/` relative to the repo root, so the invocation directory does not matter.

1. `src/fetch_ine_endemic_scan.py` — scan every INE national ≥20 surname through the municipality
   view; keep those present in Mallorca with `mall_json = {town: rate‰}`. → `ine_endemic_scan.csv`
2. `src/build_census.py` — reconstruct counts (`rate‰ × padrón / 1000`) → `census_muni_2025.csv`
   (**7,975 surnames × 51 municipalities**, ≈73 % population coverage).
3. `src/fetch_ine_census_prov.py` — per-province rates for every present surname → `census_prov.csv`.
4. `src/build_modern.py` — endemism (LQ vs Spain), origin (Catalan-domain LQ + nationality screen +
   `FOREIGN_MANUAL` gazetteer), and the spatial isonymy (Rii, Lasker, Mantel, MDS, dendrogram)
   → `web/site_data/modern_2025.json`. Uses the vendored `src/isonymy.py`.
5. `src/screen_foreign_candidates.py` — review helper: surface rare surnames that may be foreign
   (to extend the gazetteer by hand; `foreign_review.csv`).
6. `src/muni_ids.py` — INE contour region-id → Mallorca town resolver (shared by the harvesters).

## Key results (2025)

- **Isolation by distance holds** for the autochthonous (Mallorca-endemic) surnames:
  Mantel **r ≈ 0.30, p = 0.0001**; monotone and stable across LQ thresholds (0.30 → 0.33).
  The full and non-endemic sets show no such signal (r ≈ 0.04–0.07, ns) — the structure lives
  specifically in the island-concentrated stock.
- **Origin by population:** ≈ **47 % català · 48 % castellà · 4.5 % foreign**.
- Endemic set = 997 surnames (LQ ≥ 1.3, ≥ 20 bearers, non-foreign).

## Caveats (kept in view)

- Census = surnames in the INE national ≥20 file; the rarer tail and INE's <5-per-town secrecy
  are the residual (≈27 % of the population's first surnames). Rii = Σp² is head-dominated, so
  this is a defensible approximation of the true distribution.
- **LQ measures endemism, not etymology** — it will not split Andalusi from Catalan stock.
- A rare recent-immigrant surname concentrated in Mallorca is, by frequency/geography,
  indistinguishable from a native endemic; only onomastics separates them. The conservative
  hand `FOREIGN_MANUAL` gazetteer in `build_modern.py` patches that gap, explicitly excluding
  centuries-old Andalusi-Mallorcan stock (Bennàssar, Binimelis, Bibiloni).

## Notes

- `web/` is a standalone Leaflet + d3 viewer of `site_data/modern_2025.json`. Its narrative
  copy is mid-migration from the old IBESTAT framing.
- Language: repo content in English; Catalan toponyms/surnames kept as data.
