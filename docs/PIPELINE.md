# Pipeline and web viewer

How the census is harvested and analysed, and how the static viewer is built and previewed.

## Pipeline

Dev environment is pinned with **Nix**: `nix develop` gives Python + `numpy`/`pandas`/`scipy`
(`flake.nix`, locked to a nixpkgs rev in `flake.lock` — the same rev as `llinatges-medievals`).
`requirements.txt` is a pip fallback for non-Nix setups. The fetchers use only the standard library;
only `build_modern.py`/`isonymy.py` need the scientific stack.

All scripts live in `src/` and are run from the repo root (`nix develop -c python src/<script>.py`);
they read `data/` and write `web/site_data/` relative to the repo root, so the invocation directory does not matter.

1. `src/fetch_ine_endemic_scan.py` — scan every INE national ≥20 surname through the municipality
   view; keep those present in Mallorca with `mall_json = {town: rate‰}`. → `ine_endemic_scan.csv`
2. `src/build_census.py` — reconstruct counts (`rate‰ × padrón / 1000`) → `census_muni_2025.csv`
   (**7,975 surnames × 51 municipalities**, ≈73 % population coverage).
3. `src/fetch_ine_census_prov.py` — per-province rates for every present surname → `census_prov.csv`.
4. `src/build_modern.py` — endemism (LQ vs Spain), the 3-layer origin stack, and the spatial
   isonymy (Rii, Lasker, Mantel, MDS, UPGMA dendrogram, region clustering, top-N robustness curve)
   → `web/site_data/modern_2025.json`. Uses the vendored `src/isonymy.py`.
5. `src/screen_foreign_candidates.py` — review helper: surface rare surnames that may be foreign
   (to extend the gazetteer by hand; `foreign_review.csv`).
6. `src/muni_ids.py` — INE contour region-id → Mallorca town resolver (shared by the harvesters).

**Second surname (biparental).** `src/fetch_ine_endemic_scan_2n.py` and `src/build_census_2n.py` are
`tipo=2` twins of steps 1–2 (the *second* surname = maternal-grandfather line) → `census_muni_2025_2n.csv`
(**5,669 surnames × 51 municipalities**, ≈66 % coverage). `build_modern.py` reads it, when present, to add
the biparental isonymy block; without the file it is simply skipped and the single-surname results are unchanged.

## Web viewer and notes

- `web/` is a standalone viewer of `site_data/modern_2025.json` (tabs: map, municipalities,
  endemism, origin, isonymy, MDS, conclusions, methodology): vendored Leaflet for the map, hand-built SVG
  for the charts. Self-contained, no build step. Light and dark themes (follows the system; the header
  button overrides it, applied before first paint by `theme.js`).
- `web/_headers` sets caching (assets revalidate by ETag; vendored Leaflet cached 30 days) and the
  security headers. The CSP is strict on scripts — **no inline `<script>`/handlers and no third-party
  origins** except the OpenStreetMap tiles; inline `style=""` attributes are allowed. New web code must
  respect it. Preview locally with the real headers: `npx wrangler dev` from the repo root
  (<http://127.0.0.1:8787>).
- Language: repo content in English; Catalan toponyms/surnames kept as data.
- Possible future extension to the rest of the Balearics (Menorca / Eivissa / Formentera) is scoped in
  `CLAUDE.md`'s backlog — feasible but INE-re-harvest-gated, and deferred.
