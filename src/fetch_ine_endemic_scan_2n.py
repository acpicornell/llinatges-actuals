#!/usr/bin/env python3
"""EXPLORATION. SECOND-surname twin of fetch_ine_endemic_scan.py: scan EVERY national
surname (INE ≥20 file, ~86k) through the INE municipality view **as SECOND surname**
(`tipo=2`), to build the second-surname municipal census of Mallorca. This enables the
classic biparental isonymy (paternal 1st-surname line + maternal-grandfather 2nd-surname
line), the field standard the single-surname build could not reach.

The INE surname API exposes the second surname: `mapaWidget&apellido=X&tipo=2&vista=muni`
returns X's per-municipality rate as a SECOND surname (verified empirically: tipo=2 totals
track tipo=1 ~1:1 with both-way variation, the signature of first-vs-second, not "either").

Per candidate: one `mapaWidget&tipo=2&vista=muni` call → the Mallorca-town rates →
reconstruct counts (rate‰ × municipal population) → freq_Mallorca and LQ_Mallorca (as a
second surname). Scanned high-national-frequency first; resumable (skips surnames already
in the CSV). Same profile as the first-surname scan: 8 workers, identifiable UA, courtesy
pause per request. INE reuse permitted; attribution required.
Attribution: "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es".

Output: data/ine_endemic_scan_2n.csv
  (surname_norm, surname_ine, nat, n_mall_muni, freq_mall, lq_mall, mall_json {town: rate‰})
  n_mall_muni = -1 marks a surname that errored after retries (recorded so resume won't loop).
NOTE: `nat`/`lq_mall` reuse the national FIRST-surname total as denominator (the ≥20 file is
first-surname); they are indicative only. The second-surname isonymy uses the municipal
rates (mall_json), which are genuine second-surname data — the LQ column is not used there.
"""
import csv, json, re, threading, time, unicodedata, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent            # repo root (this script lives in src/)
D = ROOT / "data"
OUT = D / "ine_endemic_scan_2n.csv"
MAPA = "https://www.ine.es/apellidos/mapaWidget?apellido={}&tipo=2&vista=muni"   # tipo=2 = SECOND surname
UA = {"User-Agent": "Mozilla/5.0 (research; Mallorca surname isonymy; open-data reuse)"}
WORKERS = 8
PAUSE = 0.30           # per-request courtesy pause (per worker)
POP_ESP = 47_000_000
LQ_ENDEMIC = 1.3       # report flag; the file keeps every surname so the cutoff can move later
NAT_MIN = 20           # full scan: everything in the national ≥20 file


def norm(s):
    # Match build_modern.py::norm exactly: IBESTAT encodes ñ as "NI" (CAÑELLAS->CANIELLAS).
    # ñ MUST be replaced BEFORE NFKD (else it decomposes to N and the "NI" mapping misses).
    s = (s or "").replace("Ñ", "NI").replace("ñ", "ni").replace("_", " ")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^A-Za-z]", "", s).upper()


def load_national():
    """norm -> (total_national_freq, best real spelling to query INE with)."""
    nat = {}
    for fn in ["freq_Apellidos >=100.csv", "freq_Apellidos >=20 y <=99.csv"]:
        rows = list(csv.reader(open(D / fn, encoding="utf-8")))
        h = next(i for i, x in enumerate(rows) if x and x[0].strip() == "Orden")
        for x in rows[h + 1:]:
            if len(x) < 3 or not x[1].strip():
                continue
            try:
                f = int(str(x[2]).replace(".", "") or 0)
            except ValueError:
                continue
            k = norm(x[1]); tot, raw = nat.get(k, (0, x[1].strip()))
            nat[k] = (tot + f, x[1].strip() if f >= (tot or 0) else raw)
    return nat


def _get(url):
    req = urllib.request.Request(url, headers=UA, method="POST")
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    # Mallorca id->name map (INE contours) + municipal population (INE padrón). Both from INE.
    from muni_ids import mallorca_ids
    MALL = mallorca_ids()
    pop = {r["municipality"]: int(r["population"])
           for r in csv.DictReader(open(D / "muni_pop_padron.csv", encoding="utf-8"))}
    POP_MALL = sum(pop.values())
    print(f"[2n] Mallorca municipalities: {len(MALL)}  ·  pop {POP_MALL:,}")

    nat = load_national()
    cand = [(k, raw, f) for k, (f, raw) in nat.items() if f >= NAT_MIN]
    cand.sort(key=lambda t: -t[2])                       # high national frequency first
    done = set()
    new = not OUT.exists()
    if not new:
        for r in csv.DictReader(open(OUT, encoding="utf-8")):
            done.add(r["surname_norm"])
    todo = [c for c in cand if c[0] not in done]
    print(f"[2n] national≥{NAT_MIN}: {len(nat):,} · candidates: {len(cand):,} · "
          f"done: {len(done):,} · todo: {len(todo):,}")

    fh = open(OUT, "a", encoding="utf-8", newline="")
    wr = csv.writer(fh)
    if new:
        wr.writerow(["surname_norm", "surname_ine", "nat", "n_mall_muni", "freq_mall", "lq_mall", "mall_json"])
        fh.flush()
    lock = threading.Lock()
    state = {"n": 0, "present": 0, "err": 0}
    t0 = time.time()

    def work(item):
        k, raw, f = item
        mall = {}
        for attempt in range(3):
            try:
                m = _get(MAPA.format(urllib.parse.quote(raw)))
                for reg in m.get("regiones", []):
                    if reg["id"] in MALL:
                        mall[MALL[reg["id"]]] = reg["val"]
                break
            except Exception:
                if attempt == 2:
                    time.sleep(PAUSE)
                    return (k, raw, f, -1, -1.0, None, None)   # errored after retries
                time.sleep(0.8)
        time.sleep(PAUSE)
        freq_mall = sum(rate * pop[t] / 1000 for t, rate in mall.items() if t in pop)
        lq = (freq_mall / POP_MALL) / (f / POP_ESP) if f else 0.0
        return (k, raw, f, len(mall), round(freq_mall), round(lq, 2),
                json.dumps(mall, ensure_ascii=False, separators=(",", ":")))

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = [ex.submit(work, c) for c in todo]
        for fut in as_completed(futs):
            k, raw, f, nmuni, freq_mall, lq, mj = fut.result()
            with lock:
                wr.writerow([k, raw, f, nmuni, freq_mall if freq_mall is not None else "",
                             lq if lq is not None else "", mj if mj is not None else ""])
                state["n"] += 1
                if nmuni == -1:
                    state["err"] += 1
                elif nmuni and nmuni > 0:
                    state["present"] += 1
                if state["n"] % 1000 == 0:
                    fh.flush()
                    el = time.time() - t0; rate = state["n"] / el
                    eta = (len(todo) - state["n"]) / rate / 60 if rate else 0
                    print(f"  [2n] {state['n']:>6}/{len(todo)}  in_mallorca:{state['present']:>5} "
                          f"err:{state['err']}  {rate:.1f} req/s  ETA {eta:.0f} min", flush=True)
    fh.flush(); fh.close()
    print(f"[2n] done. wrote {OUT} · scanned {state['n']} · present {state['present']} · errors {state['err']} "
          f"· {(time.time()-t0)/60:.0f} min")


if __name__ == "__main__":
    main()
