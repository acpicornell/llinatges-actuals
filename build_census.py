#!/usr/bin/env python3
"""EXPLORATION — build the FULL INE surname census of Mallorca (no IBESTAT).

IBESTAT's ds009 gives only the top-50 surnames per municipality: great for data
protection, useless for structure analysis (it truncates every town's tail). The INE
surname API (operation APEL, mapaWidget&vista=muni) instead returns, per surname, its
per-municipality RATE (‰) across ALL municipalities where it is present. Scanning the
national first-surname file (>=20) through that endpoint yields every surname present in
Mallorca with its full municipal distribution — the actual census, not a top-N sample.

Source (INE rates, ‰):
  ine_endemic_scan.csv    the national harvest: EVERY INE national ≥20 surname (INE's own
                          list, no IBESTAT), present ones carry mall_json = {municipality: rate‰}

Counts are reconstructed as  round(rate‰ × padrón_population / 1000)  using the official
INE padrón 2025 municipal population (muni_pop_padron.csv) — the SAME denominator INE
divides by to publish the rate, so the reconstruction is exact (validated ±1 vs IBESTAT).
Municipalities INE did not publish for a surname are simply absent (INE's own suppression);
we add no extra floor beyond dropping reconstructed count 0.

Output: data/census_muni_2025.csv  (surname_norm, surname_ine, municipality, freq)
Attribution: "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es".
"""
import csv, json, re, unicodedata
from pathlib import Path

HERE = Path(__file__).parent
D = HERE / "data"


def norm(s):
    s = (s or "").replace("Ñ", "NI").replace("ñ", "ni").replace("_", " ")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^A-Za-z]", "", s).upper()


def main():
    pop = {r["municipality"]: int(r["population"])
           for r in csv.DictReader(open(D / "muni_pop_padron.csv", encoding="utf-8"))}

    # surname_norm -> {municipality: count}. First writer wins on collisions; we load the 442
    # first so their canonical IBESTAT spelling/rows take precedence over any ñ-variant the
    # harvest re-derived (the harvest excluded the 442 by norm, but the ñ-decode bug let ~11
    # through — those are dropped here by the `seen` guard).
    counts = {}     # norm -> {muni: count}
    label = {}      # norm -> surname_ine (display spelling)
    seen = set()
    n_lt5 = 0

    def ingest(surname_ine, mall_json):
        nonlocal n_lt5
        k = norm(surname_ine)
        if k in seen:
            return
        seen.add(k)
        try:
            rates = json.loads(mall_json) if mall_json else {}
        except json.JSONDecodeError:
            rates = {}
        d = {}
        for muni, rate in rates.items():
            if muni not in pop:
                continue
            c = round(float(rate) * pop[muni] / 1000.0)
            if c <= 0:
                continue
            if c < 5:
                n_lt5 += 1
            d[muni] = c
        if d:
            counts[k] = d
            label[k] = surname_ine

    # The national harvest (fetch_ine_endemic_scan.py) seeds from the INE national ≥20 file —
    # its OWN list, no IBESTAT — so it now covers EVERY national surname present in Mallorca,
    # common ones included. Present rows carry mall_json = {municipality: rate‰}.
    for r in csv.DictReader(open(D / "ine_endemic_scan.csv", encoding="utf-8")):
        if r.get("n_mall_muni") in ("-1", "0"):   # errored or absent from Mallorca
            continue
        ingest(r["surname_ine"], r.get("mall_json", ""))
    n442 = 0

    rows = []
    for k, d in counts.items():
        for muni, c in d.items():
            rows.append((k, label[k], muni, c))
    rows.sort(key=lambda x: (x[0], -x[3]))

    OUT = D / "census_muni_2025.csv"
    with open(OUT, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["surname_norm", "surname_ine", "municipality", "freq"])
        w.writerows(rows)

    munis = {m for _, _, m, _ in rows}
    total = sum(c for *_, c in rows)
    print(f"surnames present in Mallorca: {len(counts):,}  (all INE national-file seeded)")
    print(f"rows (surname×municipality): {len(rows):,}   municipalities: {len(munis)}")
    print(f"total reconstructed first-surname bearers: {total:,}  (padrón pop of 51 munis: {sum(pop.values()):,})")
    print(f"rows with reconstructed count < 5 (INE published the rate anyway): {n_lt5:,}")
    print(f"→ wrote {OUT.name}")


if __name__ == "__main__":
    main()
