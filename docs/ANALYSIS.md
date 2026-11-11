# Analysis: method, results and caveats

The two orthogonal axes, the key results for 2025, and the limits kept in view.

## The two axes (kept orthogonal)

- **Endemism** (drives every statistic): `LQ_Mall = (freq_Mall/pop)/(freq_Spain/pop)`. Pure INE
  arithmetic. The isonymy/Mantel run on the endemic subset alone.
- **Origin** (descriptive colour, feeds no statistic) is built as an explicit **3-layer stack**, and
  every surname is tagged with the layer that decided it (`origin_basis`), so the site can say *why*
  a surname is labelled as it is:
  1. **Measured (INE):** national frequency + Mallorca-vs-Spain and per-province LQ. The substrate.
  2. **Curated foreign flag:** `ine_nationality` (INE "Apellidos por nacionalidad") + `curated_foreign`
     (the tail below INE's top-20, a conservative hand gazetteer). A nationality flag **defers** to
     Layer 3 for native homographs — a top-tier Spanish surname (Martín, Marín) or a listed exception
     (Thomas = Catalan Tomàs) that merely happens to appear in a foreign nationality list.
  3. **Concentration proxy (català/castellà):** over-representation in the Catalan-speaking provinces.
     A proxy for linguistic *domain*, **not etymology**. Below `ORIGIN_FLOOR = 100` national bearers it
     demands an independent Catalonia/Valencia signal, else **"sense classificar"** rather than a guess.

## Key results (2025)

- **Isolation by distance holds** for the autochthonous (Mallorca-endemic) surnames:
  Mantel **r ≈ 0.30, p = 0.0001**; monotone and stable across LQ thresholds. The full and
  non-endemic sets show no such signal (r ≈ 0.04–0.07, ns) — the structure lives specifically in the
  island-concentrated stock, hidden underneath a shared "ubiquitous" immigrant layer (García, Martínez…).
- **Both surname lines agree (biparental isonymy).** The INE API also serves the *second* surname
  (`tipo=2`, the maternal-grandfather line). On the endemic set, the maternal line alone reproduces the
  same isolation by distance (Mantel **r ≈ 0.25, p = 0.0015**); the combined "total isonymy" gives
  **r ≈ 0.28**. Crucially, the paternal-line and maternal-line isonymy *geographies* agree at **r ≈ 0.91**
  (Mantel of the two Lasker matrices) — two independent surname censuses draw the same map, so the signal
  is not an artefact of the paternal line. Population isonymy uses per-municipality **marginals**, so no
  person-level 1st×2nd pairing is needed; the second-surname endemism filter is borrowed from the first
  (the national ≥20 file is first-surname), while the municipal `tipo=2` rates are genuine INE data.
- **It maps, but not as clean comarques.** Cutting the endemic isonymy tree gives one large connected
  core (~28 munis) plus a couple of distinct pockets — the **Sóller valley** and a **Llevant–Migjorn**
  band. Isolation by distance is a gradient with a few islands, not sharp borders.
- **Size, not distance to Palma, drives autochthony** (corr with log-population ≈ −0.82; with distance
  to Palma ≈ −0.15). 20th-c. immigration went to the big, coastal, touristy towns.
- **Long-tailed surname pool:** the top ~31 surnames cover 25 % of bearers, ~164 cover 50 %, ~2,066
  cover 90 % of the 7,975. Still, **~40 % of the population carries a Mallorca-endemic surname.**
- **Endogamy** (random-isonymy F = Rii_unb/4, Crow & Mange) spans ~123× — from closed interior towns
  (Llubí ~2.5×10⁻³) to open coastal ones (Calvià ~0.02×10⁻³).
- **Origin by population:** ≈ **46 % català · 49 % castellà · 3.6 % foreign · 1.1 % undetermined**.
  Same mass, opposite shape: the *castellà* pool is few ubiquitous surnames (top 10 = 29 % of its mass,
  effective ~86); the *català* pool is a long tail of local surnames (~4,500, effective ~297).
- **The xueta set is two lists.** Of the 15 canonical converso surnames, a Mallorca-exclusive core
  (Forteza 75 % of all Spanish bearers on the island, Bonnín 72 %, Aguiló/Pinya 50 %…) vs common
  Spanish surnames whose xueta branch is a minority (Cortès reads *castellà*). A "marca", not a verdict:
  it flags **lineages that include** converso descendants, not that every bearer is one; feeds no statistic.
- **Recent immigration** (Maghrebi surnames as the clearest case) is the mirror of the old stock:
  founder-led (per-town evenness 0.53 vs the xueta 0.73), rural (Pla farming towns), and the case the
  census undercounts most (≥20-national threshold + <5-per-town secrecy hide the newest, clustered groups).
- **Robustness:** truncating each town to its top-N surnames, the isonymy *geometry* converges by
  **top ~300** (distance-matrix correlation 0.998 with the full census); the raw Mantel r is
  non-monotonic and actually *higher* at top-50 (the signal lives in each town's commonest surnames).
  So the full census is overkill for the isonymy alone — but is required to compute the endemism filter,
  origin, and coverage in the first place.
- Endemic set = 997 surnames (LQ ≥ 1.3, ≥ 20 bearers, non-foreign).

## Caveats (kept in view)

- Census = surnames in the INE national ≥20 file; the rarer tail and INE's <5-per-town secrecy are the
  residual (≈27 % of first surnames). Rii = Σp² is head-dominated, a defensible approximation.
- **A 2025 stock snapshot, not a time series.**
- **LQ measures endemism, not etymology** — it will not split Andalusi from Catalan stock. Origin
  (Layer 3) measures where a surname *concentrates today*, not where it comes from.
- A rare recent-immigrant surname concentrated in Mallorca is, by frequency/geography, indistinguishable
  from a native endemic; only onomastics separates them. The conservative hand `FOREIGN_MANUAL` gazetteer
  patches that gap, explicitly excluding centuries-old Andalusi-Mallorcan stock (Bennàssar, Binimelis, Bibiloni).
