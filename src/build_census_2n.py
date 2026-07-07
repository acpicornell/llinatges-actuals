#!/usr/bin/env python3
"""EXPLORATION — build the SECOND-surname INE census of Mallorca (twin of build_census.py).

Same reconstruction as the first-surname census, but from the second-surname harvest
(fetch_ine_endemic_scan_2n.py, INE mapaWidget&tipo=2&vista=muni). Together the two censuses
enable a biparental isonymy (paternal 1st-surname line + maternal-grandfather 2nd-surname
line), the field standard (Rodríguez-Larralde & Barrai) the single-surname build could not
reach. Population isonymy uses only the per-municipality marginals of each surname, so the
two censuses are sufficient on their own — no person-level 1st×2nd pairing is needed.

Source (INE rates, ‰):
  ine_endemic_scan_2n.csv   the national harvest through tipo=2: every INE national ≥20
                            surname, present ones carry mall_json = {municipality: rate‰}
                            as a SECOND surname.

Counts are reconstructed as  round(rate‰ × padrón_population / 1000)  with the same official
INE padrón 2025 municipal population — the exact denominator INE divides by to publish the
rate. Municipalities INE did not publish for a surname are absent (INE's own <5 suppression);
no extra floor beyond dropping reconstructed count 0.

Output: data/census_muni_2025_2n.csv  (surname_norm, surname_ine, municipality, freq)
Attribution: "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es".
"""
import csv, json, re, unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent            # repo root (this script lives in src/)
D = ROOT / "data"


def norm(s):
    s = (s or "").replace("Ñ", "NI").replace("ñ", "ni").replace("_", " ")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^A-Za-z]", "", s).upper()


def main():
    pop = {r["municipality"]: int(r["population"])
           for r in csv.DictReader(open(D / "muni_pop_padron.csv", encoding="utf-8"))}

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

    for r in csv.DictReader(open(D / "ine_endemic_scan_2n.csv", encoding="utf-8")):
        if r.get("n_mall_muni") in ("-1", "0"):   # errored or absent from Mallorca
            continue
        ingest(r["surname_ine"], r.get("mall_json", ""))

    rows = []
    for k, d in counts.items():
        for muni, c in d.items():
            rows.append((k, label[k], muni, c))
    rows.sort(key=lambda x: (x[0], -x[3]))

    OUT = D / "census_muni_2025_2n.csv"
    with open(OUT, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["surname_norm", "surname_ine", "municipality", "freq"])
        w.writerows(rows)

    munis = {m for _, _, m, _ in rows}
    total = sum(c for *_, c in rows)
    print(f"surnames present in Mallorca (2nd surname): {len(counts):,}")
    print(f"rows (surname×municipality): {len(rows):,}   municipalities: {len(munis)}")
    print(f"total reconstructed second-surname bearers: {total:,}  (padrón pop of 51 munis: {sum(pop.values()):,})")
    print(f"rows with reconstructed count < 5 (INE published the rate anyway): {n_lt5:,}")
    print(f"→ wrote {OUT.name}")


if __name__ == "__main__":
    main()
