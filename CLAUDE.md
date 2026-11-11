# CLAUDE.md — guide for the agent (llinatges-actuals)

**Modern Mallorcan surname isonymy** from the **full INE surname census (2025)**. Population
genetics on present-day surname distribution across the 51 Mallorca municipalities. Sister
project to the 14th-century corpus (`llinatges-medievals`); kept **separate** on purpose.
Read `README.md` first (sources + pipeline + results).

## Conventions (respect them)

- **Language:** repo content (code, comments, docs, commits) in **English**; the web UI copy
  is in **Catalan** (`web/index.html` is `lang="ca"`).
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
- **Second surname (biparental)** = `data/census_muni_2025_2n.csv` (`build_census_2n.py` from
  `fetch_ine_endemic_scan_2n.py`, the `tipo=2` twins): the maternal-grandfather surname line,
  **5,669 surnames × 51 munis, ≈66 % coverage**. `build_modern.py` reads it when present to emit the
  `biparental` JSON block (skipped if the file is absent → single-surname results unchanged). Population
  isonymy runs on per-municipality **marginals**, so the two censuses suffice — NO person-level 1st×2nd
  pairing is needed/claimed. Endemism (the surname *set*) is defined on the first surname and borrowed
  (the national ≥20 file is first-surname); the municipal `tipo=2` rates are genuine INE data.
- **Two orthogonal axes** (keep separate):
  - **ENDEMISM** = LQ of a surname in Mallorca vs Spain (drives the isonymy filter). A mass
    floor (freq ≥ 20) removes the tiny-count tail the full census surfaces.
  - **ORIGIN** = a **3-layer epistemic stack** (in `build_modern.py`, `origin_of` returns
    `(label, basis)`; each surname carries `origin_basis` in the JSON). Built this way ON PURPOSE:
    origin is the controversial part (people resent seeing "their" surname labelled), so we never
    emit an opaque verdict — every label is tagged with the layer that decided it, and **none of
    the layers feed the isonymy/Mantel statistics** (those run on ENDEMISM alone). Origin is
    descriptive colour, not a result. Layers, by decreasing evidential strength:
    - **Layer 1 — MEASURED (INE).** The substrate, not a label: Mallorca-vs-Spain concentration (LQ)
      + per-province rates (LQ_Cat/Bal/Val from `census_prov.csv`, `mapaWidget&tipo=1`) + national
      frequency. Pure arithmetic on INE tables, reproducible, zero judgement.
    - **Layer 2 — CURATED FOREIGN FLAG.** A "recent immigration" mark, two bases tagged apart:
      `ine_nationality` = surname in INE "Apellidos por nacionalidad" (`nac_*.csv`, top-20/country,
      INE-direct); `curated_foreign` = the tail below INE's top-20, caught by the conservative hand
      `FOREIGN_MANUAL` gazetteer (external onomastic knowledge, NOT INE, auditable). EXCLUDES
      centuries-old Andalusi-Mallorcan stock (Bennàssar, Binimelis, Bibiloni). Needed because INE
      distribution alone cannot tell a recent Moroccan surname from an old Mallorcan one.
      **Native-homograph guard (`native_homograph`):** the `ine_nationality` flag defers to Layer 3
      when a surname is clearly native — top-tier national frequency (`NAT_FREQ_NATIVE=60000`, e.g.
      Martín/Marín, in a French list yet mainstream Spanish) or an explicit low-frequency exception
      (`NATIONALITY_FALSE_POSITIVES`, e.g. Thomas = Catalan Tomàs in an English list). Label-only:
      `oref` (is_auto hygiene) is untouched, so the isonymy/Mantel statistics stay byte-identical.
    - **Layer 3 — CONCENTRATION PROXY (descriptive).** català vs castellà from over-representation
      in the Catalan-speaking provinces (LQ_Cat/Bal ≥ `T_ORIGIN=1.5`, or LQ_Val ≥ `T_VAL=5`). A proxy
      for linguistic DOMAIN, NOT etymology ("català" = "concentrated in the Catalan lands per INE").
      Runs only on what Layer 2 did not flag. **Low-frequency floor `ORIGIN_FLOOR = 100`:** below 100
      national bearers LQ_Bal is collinear with Mallorca endemism (a rare surname almost all on the
      island is Balears-concentrated by construction), so there an INDEPENDENT Catalonia/Valencia
      signal is required, else **"sense classificar"** rather than a guess.
    - `basis` counts (JSON `origin_basis_counts`): ~7018 concentration · ~253 ine_nationality ·
      ~55 curated_foreign · ~649 undetermined. The web surfaces each surname's layer as a badge in
      the sidebar search, and the Methodology tab documents the stack + an "if your surname looks
      wrong" note.

## Pipeline (INE → JSON → web)

Dev env is pinned with Nix: `nix develop` (from `flake.nix`, locked in `flake.lock` — same nixpkgs
rev as `llinatges-medievals`) gives Python + `numpy`/`pandas`/`scipy`; `requirements.txt` is the pip
fallback. The fetchers are stdlib-only; only `build_modern.py`/`isonymy.py` need the scientific stack.

All Python lives in `src/`; run each from the repo root (`nix develop -c python src/<script>.py`). Scripts
resolve `data/` and `web/site_data/` relative to the **repo root** (`ROOT = Path(__file__).resolve().parent.parent`),
not the cwd — so they work regardless of where you invoke them from.

`src/fetch_ine_endemic_scan.py` (national scan → `ine_endemic_scan.csv`) → `src/build_census.py`
→ `src/fetch_ine_census_prov.py` (province rates) → `src/build_modern.py` (endemism + origin +
isonymy via the vendored `src/isonymy.py` → `web/site_data/modern_2025.json`).
Helpers: `src/muni_ids.py` (INE contour region-id → town), `src/screen_foreign_candidates.py`
(gazetteer review), `src/fetch_coords_muni.py` (NGIB coords).

## Key results (2025)

- Isolation by distance holds for the autochthonous (Mallorca-endemic) surnames:
  Mantel **r ≈ 0.30, p = 0.0001**, stable across LQ thresholds; full/non-endemic sets ns.
- **Biparental (`biparental` JSON block):** the second surname (maternal line) alone reproduces IBD
  (Mantel **r = 0.2477, p = 0.0015**); combined "total isonymy" **r = 0.2805**; and the paternal- vs
  maternal-line isonymy geographies agree at **r = 0.9129, p = 0.0001** — two independent censuses, same
  map. The `first` sub-block reproduces `auto` (r = 0.2959) byte-for-byte → plumbing self-check. Surfaced
  as Methodology §5 with a town-pair agreement scatter (`drawBipScatter`); feeds no other statistic.
- Origin by population: **≈ 46 % català · 49 % castellà · 3.6 % foreign · 1.1 % sense classificar**
  (the low-frequency floor left the rare undetermined tail out of "català").
- Endemic set = 997 surnames (LQ ≥ 1.3, ≥ 20 bearers, non-foreign).
- The isolation-by-distance MAPS but does not carve clean comarques: cutting the endemic isonymy
  tree gives one big connected core (~28 munis) plus a couple of distinct pockets — the **Sóller
  valley** (Sóller, Fornalutx, Deià, Valldemossa) and a **Llevant-Migjorn** band. Stored per town as
  `auto.region` in the JSON (a `fcluster` k=6 cut of the same tree; descriptive, feeds no statistic).
- Surname coverage is long-tailed: top ~31 surnames = 25 % of bearers, ~164 = 50 %, ~2,066 = 90 %.
  Random-isonymy inbreeding F = Rii_unb/4 (Crow & Mange) spans ~123× — Llubí ~2.5×10⁻³ (interior,
  closed) down to Calvià ~0.02×10⁻³ (coastal, open); computed live in the web from `auto.Rii_unb`.

## Status / backlog

- **Web copy is on the INE census framing** (the old IBESTAT/top-50 narration is gone): Conclusions
  §1–9 and Methodology §1–8 reflect the full-census results — origin stack, regions, coverage/Zipf,
  endogamy F, top-N robustness, and now biparental isonymy (Methodology §5). Keep new numbers in sync
  with `modern_2025.json` when the pipeline is rerun.
- Optional: surname spelling-variant merging (e.g. `Matemalas`≈`Matamalas`) — a normalization
  issue, not origin. The medieval repo has a `normalize.py` for the analogous problem.
- The project was split out of `llinatges-medievals/explore/ibestat_modern/` on 2026-07-06;
  that old copy has since been removed from `llinatges-medievals`.
- **Possible extension — the rest of the Balearics (Menorca / Eivissa / Formentera).** Deferred
  (owner said "just curiosity" for now). Feasibility already scoped: our data is Mallorca-only
  (51 munis); the INE infra already fetches the all-Spain contour (CONTORNOS/19) and we merely
  filter to Mallorca via `coords_muni.csv`, so extending is INE-only but NOT free — it needs (1)
  roster+coords for the other islands (NGIB: Menorca 8, Eivissa 5, Formentera 1 munis), (2) their
  padrón (INE op. 22), (3) a re-harvest of the muni census (`mapaWidget&vista=muni`, ~8k calls),
  (4) endemism re-based per island. What TRANSFERS robustly: cross-island endogamy F (Menorca/
  Eivissa almost certainly far more endogamous — F needs no Mantel), island distinctness (Balearic
  MDS), per-island endemic surnames (Menorca: Pons/Mercadal…; Eivissa: Marí/Tur/Prats…), and the
  català/castellà origin axis. What does NOT: isolation-by-distance/Mantel (too few munis off
  Mallorca — Menorca ~8 weak, Eivissa ~5 impossible, Formentera 1); cross-island IBD is trivial
  (the sea); and the **xueta** overlay is Mallorca-specific. Consider a sibling repo rather than
  widening this deliberately-"Mallorcan" one.
