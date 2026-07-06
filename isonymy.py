#!/usr/bin/env python3
"""
Isonymy analysis core. Input: the long table produced by parse_index.py.

Methods (Cavalli-Sforza & Bodmer 1971; Chen & Cavalli-Sforza 1983; Lasker 1977):
  - frequency matrix    surname x locality  (for one year/type slice)
  - raw isonymy         Iij = Σ_k p_ik · p_jk       (Rii = Σ p_ik²)
  - Lasker distance     D_ij = -ln( Iij / sqrt(Iii·Ijj) )
  - Nei distance        (alternative)
  - Mantel test         iso-dist vs geo-dist (haversine, NGIB coords)
  - classical MDS + hierarchical linkage  (tree of localities)
  - JSON export for the static web site

Deps: numpy, pandas, scipy. (skbio.nj optional for a strict NJ tree.)
"""
from __future__ import annotations
import json
import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage, dendrogram


# ---------- 1. frequency matrix ----------
def freq_matrix(long_csv, year=1359, source_type="men-at-arms", area="PartForana",
                by="surname_norm"):
    df = pd.read_csv(long_csv)
    if by not in df.columns:                     # tolerate a pre-normalization CSV
        import sys, pathlib
        sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
        import normalize
        df[by] = df["surname"].map(normalize.surname_norm)
    q = df[(df["year"] == year) & (df["source_type"] == source_type) & (df["area"] == area)]
    # count bearers: each unique (raw surname, given_name) per locality = 1 individual;
    # then group the columns by the normalized surname so graphic variants of one
    # lineage share a column (two distinct "Guillem Ferrer" spellings stay 2 bearers).
    counts = (q.drop_duplicates(["surname", "given_name", "locality"])
                .groupby(["locality", by]).size().unstack(fill_value=0))
    return counts  # rows = localities, columns = normalized surnames


# ---------- 2. isonymy and distances ----------
def isonymy(counts: pd.DataFrame):
    """Return (R, locs): R = raw isonymy matrix Iij (Rii on the diagonal).

    This is the plug-in estimator (pairs WITH replacement); Rii = Σ p_ik² is
    inflated for small N and collinear with 1/N. It still feeds the Lasker
    distance (the off-diagonal Iij between two *different* localities has no
    self-pair, so it is not affected by that bias). For the *reported* internal
    diversity use random_isonymy(counts, unbiased=True) instead.
    """
    N = counts.sum(axis=1).values.reshape(-1, 1)         # total bearers per locality
    P = counts.values / N                                # relative frequencies p_ik
    R = P @ P.T                                          # Iij = Σ p_ik p_jk
    return R, list(counts.index)


def random_isonymy(counts: pd.DataFrame, unbiased=False):
    """Per-locality internal isonymy Rii (the diagonal), as a 1-D array.

    biased  (plug-in, with replacement):  Rii = Σ_k (n_k/N)²
        includes each bearer paired with itself → inflated for small N,
        corr(Rii, 1/N) ≈ 0.95 in this corpus (a sample-size artefact).
    unbiased (without replacement):        Rii = Σ_k n_k(n_k−1) / (N(N−1))
        the probability that two *distinct* bearers share a surname — the
        surname analogue of Nei's (1978) unbiased gene diversity. With N≤1, or a
        locality whose surnames are all distinct, it is 0 (no evidence of
        concentration) instead of the spurious 1/N the plug-in returns.
    """
    n = counts.values.astype(float)
    N = n.sum(axis=1)
    with np.errstate(divide="ignore", invalid="ignore"):
        if unbiased:
            den = N * (N - 1.0)
            rii = np.where(den > 0, (n * (n - 1.0)).sum(axis=1) / den, 0.0)
        else:
            P = n / N.reshape(-1, 1)
            rii = (P ** 2).sum(axis=1)
    return rii


def lasker_distance(R):
    # Locality pairs with no shared surname -> Iij=0 -> -ln(0)=inf.
    # We cap them at the observed finite maximum (methodological choice; documented).
    d = np.sqrt(np.outer(np.diag(R), np.diag(R)))
    with np.errstate(divide="ignore"):
        D = -np.log(R / d)
    np.fill_diagonal(D, 0.0)
    finite = D[np.isfinite(D)]
    D[~np.isfinite(D)] = (finite.max() * 1.1) if finite.size else 1.0
    return D


def nei_distance(counts: pd.DataFrame):
    N = counts.sum(axis=1).values.reshape(-1, 1)
    P = counts.values / N
    num = P @ P.T
    den = np.sqrt(np.outer((P**2).sum(1), (P**2).sum(1)))
    with np.errstate(divide="ignore"):
        D = -np.log(num / den)
    np.fill_diagonal(D, 0.0)
    return D


# ---------- 3. geography + Mantel ----------
def haversine_matrix(coords):
    """coords: dict locality -> (lat, lon). Returns (D_geo_km, order)."""
    locs = list(coords)
    lat = np.radians([coords[l][0] for l in locs])
    lon = np.radians([coords[l][1] for l in locs])
    dlat = lat[:, None] - lat[None, :]
    dlon = lon[:, None] - lon[None, :]
    a = np.sin(dlat/2)**2 + np.cos(lat)[:, None]*np.cos(lat)[None, :]*np.sin(dlon/2)**2
    return 6371.0 * 2 * np.arcsin(np.sqrt(a)), locs


def mantel(D1, D2, perms=9999, seed=0):
    """Mantel correlation between two distance matrices + permutation p-value."""
    iu = np.triu_indices_from(D1, k=1)
    x, y = D1[iu], D2[iu]
    r = np.corrcoef(x, y)[0, 1]
    rng = np.random.default_rng(seed)
    n = D1.shape[0]
    ge = 1
    for _ in range(perms):
        p = rng.permutation(n)
        rp = np.corrcoef(D1[np.ix_(p, p)][iu], y)[0, 1]
        ge += rp >= r
    return r, ge / (perms + 1)


# ---------- 4. tree + MDS ----------
def tree_order(D, labels, method="average"):
    from scipy.spatial.distance import squareform
    Z = linkage(squareform(D, checks=False), method=method)
    dn = dendrogram(Z, labels=labels, no_plot=True)
    return Z, dn["ivl"]


def classical_mds(D, k=2):
    n = D.shape[0]
    J = np.eye(n) - np.ones((n, n)) / n
    B = -0.5 * J @ (D**2) @ J
    w, V = np.linalg.eigh(B)
    idx = np.argsort(w)[::-1][:k]
    return V[:, idx] * np.sqrt(np.maximum(w[idx], 0))


# ---------- 5. export for the web ----------
def export_json(counts, coords=None, path="web/site_data/isonymy_1359.json"):
    R, locs = isonymy(counts)
    D = lasker_distance(R)
    xy = classical_mds(D)
    out = {
        "localities": locs,
        "n_bearers": {l: int(counts.loc[l].sum()) for l in locs},
        "diversity_Rii": {l: float(R[i, i]) for i, l in enumerate(locs)},
        "iso": R.round(6).tolist(),
        "lasker": D.round(4).tolist(),
        "mds": xy.round(4).tolist(),
    }
    if coords:
        out["coords"] = {l: coords.get(l) for l in locs}
        Dg, glocs = haversine_matrix({l: coords[l] for l in locs if l in coords})
        if len(glocs) == len(locs):
            r, p = mantel(D, Dg)
            out["mantel"] = {"r": round(float(r), 4), "p": round(float(p), 4)}
    from pathlib import Path
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(out, ensure_ascii=False))
    return out


if __name__ == "__main__":
    counts = freq_matrix("data/processed/corpus_miralles_long.csv")
    R, locs = isonymy(counts)
    print(f"{len(locs)} localities, {counts.shape[1]} surnames, {int(counts.values.sum())} bearers")
    _, order = tree_order(lasker_distance(R), locs)
    print("tree order (clustering):", " · ".join(order))
