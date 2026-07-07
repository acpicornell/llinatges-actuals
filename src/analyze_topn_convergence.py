#!/usr/bin/env python3
"""Standalone robustness probe: how many top-N surnames per municipality are needed to
recover the isonymy result? Reads web/site_data/modern_2025.json (no re-fetch), truncates
each town to its N most-frequent surnames, keeps the endemic ones, recomputes the endemic
Lasker matrix + Mantel r, and prints the convergence to the full census.

This is the exploratory version of the `topn_convergence()` now baked into build_modern.py
(stored as JSON `topn_convergence` and drawn in the web's Methodology → "Robustness"). Kept
as a script so the analysis is reproducible on its own.

Run: nix develop -c python src/analyze_topn_convergence.py
"""
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
D = json.load(open(ROOT / "web/site_data/modern_2025.json"))
E = D["endemism"]; POP = D["municipality_pop"]; CO = D["coords"]; BY = D["by_surname"]
LOCS = D["auto"]["locs"]                                   # fixed 51-town order
FOREIGN = {"magrebí", "subsaharià", "asiàtic", "europeu"}
AUTO = {s for s, e in E.items()
        if e["lq"] is not None and e["lq"] >= 1.3 and (e["mall"] or 0) >= 20 and e["origin"] not in FOREIGN}

# town -> {surname: freq} for ALL surnames (the reconstructed full municipal census)
town_all = {l: {} for l in LOCS}
for s, rows in BY.items():
    for m, f in rows:
        if m in town_all:
            town_all[m][s] = f

pop = np.array([POP[l] for l in LOCS], float)
lat = np.radians([CO[l][0] for l in LOCS]); lon = np.radians([CO[l][1] for l in LOCS])
dlat = lat[:, None] - lat[None, :]; dlon = lon[:, None] - lon[None, :]
a = np.sin(dlat / 2) ** 2 + np.cos(lat)[:, None] * np.cos(lat)[None, :] * np.sin(dlon / 2) ** 2
GEO = 6371.0 * 2 * np.arcsin(np.sqrt(a))


def lasker(R):
    d = np.sqrt(np.outer(np.diag(R), np.diag(R)))
    with np.errstate(divide="ignore"):
        Dm = -np.log(R / d)
    np.fill_diagonal(Dm, 0.0)
    fin = Dm[np.isfinite(Dm)]
    Dm[~np.isfinite(Dm)] = (fin.max() * 1.1) if fin.size else 1.0
    return Dm


def iso_for(topN):
    """endemic Lasker matrix keeping only each town's top-N surnames (of all types)."""
    kept, surv = [], set()
    for l in LOCS:
        items = sorted(town_all[l].items(), key=lambda x: -x[1])
        keep = set(s for s, _ in items[:topN]) if topN is not None else set(town_all[l])
        kept.append(keep); surv |= (keep & AUTO)
    cols = sorted(surv); idx = {s: i for i, s in enumerate(cols)}
    M = np.zeros((len(LOCS), len(cols)))
    for r, l in enumerate(LOCS):
        for s in (kept[r] & AUTO):
            M[r, idx[s]] = town_all[l][s]
    P = M / pop.reshape(-1, 1)
    return lasker(P @ P.T), len(cols)


def mantel_r(D1, D2):
    iu = np.triu_indices_from(D1, k=1)
    return float(np.corrcoef(D1[iu], D2[iu])[0, 1])


def main():
    print(f"endemic set: {len(AUTO)} (JSON says {D['auto']['n_surnames']})")
    Dfull, nfull = iso_for(None)
    iu = np.triu_indices_from(Dfull, k=1)
    rfull = mantel_r(Dfull, GEO)
    print(f"FULL: endemic used={nfull}, Mantel r={rfull:.4f}\n")
    print(f'{"topN":>6}{"Mantel_r":>10}{"matrix_corr":>13}{"endem_used":>11}')
    for N in [10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000, None]:
        Dn, nn = iso_for(N)
        r = mantel_r(Dn, GEO)
        mc = float(np.corrcoef(Dn[iu], Dfull[iu])[0, 1])
        print(f'{("full" if N is None else str(N)):>6}{r:>10.4f}{mc:>13.4f}{nn:>11}')


if __name__ == "__main__":
    main()
