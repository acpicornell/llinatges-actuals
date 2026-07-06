#!/usr/bin/env python3
"""EXPLORATION — generate a REVIEW list of possible foreign surnames hiding in the endemic
set, so the FOREIGN_MANUAL gazetteer can be extended by hand (onomastics), conservatively.

The problem: a rare recent-immigrant surname whose bearers are almost all in Mallorca gets a
huge Mallorca LQ and a high LQ_Balears — identical, by frequency/geography, to a genuine
Balearic native (Prohens, Cabrer). No numeric signal separates them; only morphology does.
So this script does NOT decide origin. It ranks the CANDIDATES a human should look at:

  endemic (LQ_Mall≥1.3, mass≥MASS) · NOT already foreign-labelled · NOT concentrated in
  Catalonia-proper (LQ_Cat<1.5) nor Valencia (LQ_Val<5) — i.e. the label rests only on
  Balears/Mallorca concentration, exactly where native and immigrant look alike.

A coarse morphology flag (`morph`) pre-sorts the obvious non-Catalan transliterations
(Arabic/Amazigh El-/Ben-/-oui/kh/gh/dj clusters, etc.) to the top for review. It is a HINT,
not a decision — the human confirms which go into the gazetteer.

Output: data/foreign_review.csv  (surname_ine, surname_norm, nat, freq_mall, lq_mall, lq_cat,
lq_bal, n_muni, top_town, morph). Sorted morph-first then LQ_Mall desc.
Attribution: "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es".
"""
import csv, json, re, unicodedata
from pathlib import Path

HERE = Path(__file__).parent
D = HERE / "data"
POP_ESP = 48_600_000
INE_CAT = ("9", "18", "26", "43"); INE_VAL = ("46", "13", "4"); INE_BAL = "8"
MASS = 20
T_ORIGIN, T_VAL = 1.5, 5.0

# Coarse non-Catalan transliteration morphology (HINT only, human confirms). Catalan surnames
# almost never match these; a few might (checked at review), which is why nothing is auto-applied.
MORPH = re.compile(
    r"(^EL[A-Z])|(^BEN[A-Z])|(^AIT)|(^OU)|(OUI$)|(AOUI)|(KH)|(GH)|(DJ)|(ZZ)|(TCH)|(^MB)|(^ND)|(NGU)|(^DIA)",
)


def norm(s):
    s = (s or "").replace("Ñ", "NI").replace("ñ", "ni").replace("_", " ")
    s = unicodedata.normalize("NFKD", s); s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^A-Za-z]", "", s).upper()


def load_national():
    nat = {}
    for fn in ["freq_Apellidos >=100.csv", "freq_Apellidos >=20 y <=99.csv"]:
        r = list(csv.reader(open(D / fn, encoding="utf-8")))
        h = next(i for i, x in enumerate(r) if x and x[0].strip() == "Orden")
        for x in r[h + 1:]:
            if len(x) < 3 or not x[1].strip():
                continue
            try:
                k = norm(x[1]); nat[k] = nat.get(k, 0) + int(str(x[2]).replace(".", "") or 0)
            except ValueError:
                pass
    return nat


def load_oref():
    # nationality lists + hand gazetteer already in build_modern (import to avoid drift)
    import build_modern as bm
    ref = bm.load_origin_ref()
    for lab, names in bm.FOREIGN_MANUAL.items():
        for s in names:
            ref.setdefault(s, lab)
    return ref


def load_prov():
    ine = {}
    for fn, key in [("census_prov.csv", "surname_norm"), ("endemic_prov.csv", "surname_norm")]:
        p = D / fn
        if not p.exists():
            continue
        for r in csv.DictReader(open(p, encoding="utf-8")):
            k = norm(r[key])
            if k in ine:
                continue
            tot = r.get("total_nac") or r.get("nat") or ""
            ine[k] = (int(tot) if str(tot).strip() else None, json.loads(r.get("prov_json", "{}")))
    return ine


def main():
    nat = load_national(); oref = load_oref(); ine = load_prov()
    pop_mall = sum(int(r["population"]) for r in csv.DictReader(open(D / "muni_pop_padron.csv", encoding="utf-8")))
    mass, spell, towns = {}, {}, {}
    for r in csv.DictReader(open(D / "census_muni_2025.csv", encoding="utf-8")):
        k = r["surname_norm"]; f = int(r["freq"])
        mass[k] = mass.get(k, 0) + f; spell.setdefault(k, r["surname_ine"])
        towns.setdefault(k, []).append((r["municipality"], f))

    rows = []
    for k, m in mass.items():
        if m < MASS or k in oref:
            continue
        ne = nat.get(k)
        lqm = (m / pop_mall) / (ne / POP_ESP) if ne else None   # endemism LQ (matches build_modern)
        it = ine.get(k); lq_c = lq_b = lq_v = None
        tot = (it[0] if it and it[0] else ne)
        if it and tot:
            natrate = tot / POP_ESP * 1000; pr = it[1]
            def lqx(keys):
                xs = [pr[x] / natrate for x in keys if x in pr and natrate]
                return max(xs) if xs else None
            lq_c = lqx(INE_CAT); lq_v = lqx(INE_VAL)
            lq_b = pr[INE_BAL] / natrate if INE_BAL in pr and natrate else None
        endem_lq = lqm if lqm else 0
        if endem_lq < 1.3:
            continue
        # Catalan-proper OR Valencian concentration → treat as Catalan-domain, not a candidate
        if (lq_c and lq_c >= T_ORIGIN) or (lq_v and lq_v >= T_VAL):
            continue
        tt = sorted(towns[k], key=lambda x: -x[1])[0][0]
        rows.append({"surname_ine": spell[k], "surname_norm": k, "nat": ne or 0,
                     "freq_mall": m, "lq_mall": round(endem_lq, 1),
                     "lq_cat": round(lq_c, 2) if lq_c else "", "lq_bal": round(lq_b, 2) if lq_b else "",
                     "n_muni": len(towns[k]), "top_town": tt, "morph": int(bool(MORPH.search(k)))})

    rows.sort(key=lambda r: (-r["morph"], -r["lq_mall"]))
    OUT = D / "foreign_review.csv"
    with open(OUT, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["surname_ine", "surname_norm", "nat", "freq_mall",
                                           "lq_mall", "lq_cat", "lq_bal", "n_muni", "top_town", "morph"])
        w.writeheader(); w.writerows(rows)
    nm = sum(r["morph"] for r in rows)
    print(f"candidates for review: {len(rows)}  (morphology-flagged: {nm})  → wrote {OUT.name}")
    print("\ntop morphology-flagged (likely foreign to add to gazetteer):")
    for r in [x for x in rows if x["morph"]][:40]:
        print(f"   {r['surname_ine']:16} nat={r['nat']:>6} freq={r['freq_mall']:>4} "
              f"LQ={r['lq_mall']:>5} LQ_cat={r['lq_cat']} town={r['top_town']}")
    print("\ntop NON-flagged (review: native Balearic vs missed foreign):")
    for r in [x for x in rows if not x["morph"]][:25]:
        print(f"   {r['surname_ine']:16} nat={r['nat']:>6} freq={r['freq_mall']:>4} "
              f"LQ={r['lq_mall']:>5} LQ_bal={r['lq_bal']} town={r['top_town']}")


if __name__ == "__main__":
    main()
