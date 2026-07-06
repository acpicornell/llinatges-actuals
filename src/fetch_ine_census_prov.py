#!/usr/bin/env python3
"""EXPLORATION — province harvest for the FULL INE census (origin axis).

For every surname present in Mallorca (census_muni_2025.csv) that we do NOT already have
province data for (ine_apellidos.csv = the 442; endemic_prov.csv = the 276 candidates),
fetch its per-PROVINCE rate (INE mapaWidget&tipo=1). Combined with the national total
(taken from the national >=20 file in build_modern), that gives LQ_Cat / LQ_Bal / LQ_Val,
the Catalan-domain concentration that separates a Catalan/Mallorcan surname from a
Castilian or foreign one — the origin axis, now over the whole census, not just the 442.

Only ONE request per surname (provinces); the national total comes from the local file, so
this runs in ~half the time of a widget+map harvest. Resumable (appends to census_prov.csv),
8 workers, identifiable UA, courtesy pause, highest-Mallorca-mass first.

Attribution: "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es".
"""
import csv, json, re, sys, time, unicodedata, urllib.request, urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent            # repo root (this script lives in src/)
D = ROOT / "data"
OUT = D / "census_prov.csv"
UA = {"User-Agent": "Mozilla/5.0 (research; Mallorca surname isonymy; open-data reuse)"}
WORKERS, PAUSE = 8, 0.25


def norm(s):
    s = (s or "").replace("Ñ", "NI").replace("ñ", "ni").replace("_", " ")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^A-Za-z]", "", s).upper()


def covered():
    done = set()
    for fn, key in [("endemic_prov.csv", "surname_norm"),
                    ("census_prov.csv", "surname_norm")]:
        p = D / fn
        if not p.exists():
            continue
        for r in csv.DictReader(open(p, encoding="utf-8")):
            done.add(norm(r[key]))
    return done


def fetch(item):
    k, ine = item
    q = urllib.parse.quote(ine)
    prov = {}
    try:
        m = json.loads(urllib.request.urlopen(urllib.request.Request(
            f"https://www.ine.es/apellidos/mapaWidget?apellido={q}&tipo=1",
            headers=UA, method="POST"), timeout=30).read().decode())
        prov = {str(x["id"]): x["val"] for x in m.get("regiones", [])}
    except Exception:
        return (k, ine, "ERR", "{}")
    time.sleep(PAUSE)
    return (k, ine, "", json.dumps(prov, separators=(",", ":")))


def main():
    # unique present surnames with display spelling + Mallorca mass (order high-mass first)
    mass, spell = {}, {}
    for r in csv.DictReader(open(D / "census_muni_2025.csv", encoding="utf-8")):
        k = r["surname_norm"]
        mass[k] = mass.get(k, 0) + int(r["freq"])
        spell.setdefault(k, r["surname_ine"])
    done = covered()
    todo = [(k, spell[k]) for k in mass if k not in done]
    todo.sort(key=lambda x: -mass[x[0]])
    print(f"census surnames: {len(mass):,}  ·  already have province: {len(done & set(mass)):,}  ·  to fetch: {len(todo):,}",
          flush=True)

    new = not OUT.exists()
    fh = open(OUT, "a", encoding="utf-8", newline="")
    w = csv.writer(fh)
    if new:
        w.writerow(["surname_norm", "surname_ine", "total_nac", "prov_json"])
    t0, n = time.time(), 0
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for k, ine, err, pj in ex.map(fetch, todo):
            if err == "ERR":
                continue
            w.writerow([k, ine, "", pj]); n += 1
            if n % 250 == 0:
                fh.flush()
                dt = time.time() - t0
                print(f"  {n}/{len(todo)}  ·  {n/dt:.1f}/s  ·  ETA {(len(todo)-n)/(n/dt)/60:.0f} min", flush=True)
    fh.close()
    print(f"done: wrote {n} province rows to {OUT.name} in {(time.time()-t0)/60:.1f} min", flush=True)


if __name__ == "__main__":
    main()
