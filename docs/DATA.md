# Data

Where every input comes from, and why the project depends on the INE alone.

Everything comes from the **INE** (Instituto Nacional de Estadística). There is **no IBESTAT
dependency**: IBESTAT only publishes the top-50 surnames per municipality, and from a per-town
top-50 you cannot recover the **national** frequencies that the endemism and origin axes need —
so it was dropped in favour of the full INE census. (How little per-town data the isonymy
*geometry* alone would actually need is quantified in the web's Methodology → "Robustness".)

> Elaboración propia con datos extraídos del sitio web del INE: www.ine.es

## Data sources (all INE, plus NGIB coordinates)

- **INE surname API** (operation APEL, "¿Cuántos se llaman…?"):
  - `mapaWidget&vista=muni` → per-municipality rate (‰) of each surname → the census.
  - `mapaWidget&tipo=1` → per-province rate → the origin axis (Catalan-domain concentration).
  - National first-surname totals (`freq_Apellidos*.csv`) → the Spain denominator.
  - "Apellidos por nacionalidad" (`nac_*.csv`, top-20/country) → the foreign screen.
- **INE padrón 2025** (operation 22, table 2860) → official municipal population
  (`muni_pop_padron.csv`), the exact denominator INE divides by to publish its rates
  (so `count = rate‰ × pop / 1000` is exact).
- **INE municipality contours** (CONTORNOS/19, `contornos19.svg`) → region-id → town map.
- **NGIB** (IDEIB) → town coordinates (`coords_muni.csv`).

The API is a **present-day stock** snapshot (registered residents); it carries no temporal
dimension, so there is no surname time series (see the web's Methodology). The only deep-time
comparison available is medieval (14th c., the sister repo) ↔ 2025.
