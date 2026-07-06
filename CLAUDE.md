# CLAUDE.md — guide for the agent (llinatges-actuals)

**Modern Mallorcan surname isonymy** from the **full INE surname census (2025)**. Population
genetics on present-day surname distribution across the 51 Mallorca municipalities. Sister
project to the 14th-century corpus (`llinatges-balears`); kept **separate** on purpose.
Read `README.md` first (sources + pipeline + results).

## Conventions (respect them)

- **Language:** repo content (code, comments, docs, UI, commits) in **English**.
  **Toponyms and surnames stay in their original Catalan** — they are data / proper nouns
  (`Sóller`, `Montuïri`, `Cañellas`), never translated.
- **Surgical, iterative edits.** No massive rewrites, no over-engineering.
- **Epistemic honesty:** document methodological choices and caveats next to the code.
  Don't invent data; verify, don't assert.

## Hard constraints (from the user)

- **INE only.** IBESTAT is dropped — its top-50-per-municipality truncation is useless for
  structure. Everything comes from INE (surname API + padrón) or NGIB (coords). Do not
  reintroduce IBESTAT.
- **INE attribution is required** wherever data is shown/redistributed:
  *"Elaboración propia con datos extraídos del sitio web del INE: www.ine.es"*.
- **Do NOT deploy** (no Cloudflare, no push) unless explicitly asked.
- Git identity: `Antonio Picornell <git@tramuntana.xyz>`, SSH-signed (FIDO tap). The tap
  fails through the non-interactive shell → stage the commit and let the user run
  `git commit -F <msgfile>` themselves.
- Don't commit the user's other emails or any private keys.

## Architecture (INE-only)

- **Population** = INE padrón 2025 (`data/muni_pop_padron.csv`, operation 22 / table 2860).
  The exact denominator INE divides by to publish its per-mil rates, so `count = rate‰ ×
  pop / 1000` is exact.
- **Surname × municipality counts** = `data/census_muni_2025.csv` (`build_census.py`): every
  INE national ≥20 surname present in Mallorca, from the surname API `mapaWidget&vista=muni`.
  **7,975 surnames × 51 munis, ≈73 % population coverage.** INE's <5-per-town secrecy is
  intrinsic (every published rate reconstructs to ≥5).
- **Two orthogonal axes** (keep separate):
  - **ENDEMISM** = LQ of a surname in Mallorca vs Spain (drives the isonymy filter). A mass
    floor (freq ≥ 20) removes the tiny-count tail the full census surfaces.
  - **ORIGIN** = Catalan-domain concentration from per-province INE rates (`census_prov.csv`,
    `mapaWidget&tipo=1`): LQ_Cat/Bal/Val. Plus a foreign screen = INE "Apellidos por
    nacionalidad" (`nac_*.csv`, top-20/country) + a conservative hand `FOREIGN_MANUAL`
    gazetteer in `build_modern.py` for the rare recent-immigrant surnames the top-20 misses.
    The gazetteer EXCLUDES centuries-old Andalusi-Mallorcan stock (Bennàssar, Binimelis,
    Bibiloni). LQ measures endemism, NOT etymology.

## Pipeline (INE → JSON → web)

`fetch_ine_endemic_scan.py` (national scan → `ine_endemic_scan.csv`) → `build_census.py`
→ `fetch_ine_census_prov.py` (province rates) → `build_modern.py` (endemism + origin +
isonymy via the vendored `isonymy.py` → `web/site_data/modern_2025.json`).
Helpers: `muni_ids.py` (INE contour region-id → town), `screen_foreign_candidates.py`
(gazetteer review), `fetch_coords_muni.py` (NGIB coords).

## Key results (2025)

- Isolation by distance holds for the autochthonous (Mallorca-endemic) surnames:
  Mantel **r ≈ 0.30, p = 0.0001**, stable across LQ thresholds; full/non-endemic sets ns.
- Origin by population: **≈ 47 % català · 48 % castellà · 4.5 % foreign**.
- Endemic set = 997 surnames (LQ ≥ 1.3, ≥ 20 bearers, non-foreign).

## Status / backlog

- **Web copy rewrite pending:** `web/` still narrates the old IBESTAT/top-50 framing; the
  data (`modern_2025.json`) is already the INE census. Rewrite the copy, drop "top-50",
  put in the new numbers.
- Optional: surname spelling-variant merging (e.g. `Matemalas`≈`Matamalas`) — a normalization
  issue, not origin. The medieval repo has a `normalize.py` for the analogous problem.
- The project was split out of `llinatges-balears/explore/ibestat_modern/` on 2026-07-06;
  that old copy may still exist as a backup until confirmed removable.
