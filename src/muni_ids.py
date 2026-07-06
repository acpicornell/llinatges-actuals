#!/usr/bin/env python3
"""INE municipality-id resolver (100% INE-sourced). Maps the INE surname-API region ids
(mapaWidget&vista=muni) to Mallorca town names, using the INE municipality contour SVG
(CONTORNOS/19) cross-referenced with our town roster (coords_muni.csv, NGIB names).

Extracted from the former fetch_ine_442_muni.py so the harvesters depend on this INE-only
helper, not on any IBESTAT-seeded script. Cached SVG: data/contornos19.svg (re-downloadable).
Attribution: "Elaboración propia con datos extraídos del sitio web del INE: www.ine.es".
"""
import csv, re, unicodedata, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent            # repo root (this script lives in src/)
D = ROOT / "data"
SVG_URL = "https://www.ine.es/wstempus/geosvg/ES/CONTORNOS/19"
UA = {"User-Agent": "Mozilla/5.0 (research; Mallorca surname isonymy; open-data reuse)"}


def _placename(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower().replace("-", " ").strip()


def mallorca_ids():
    """INE region id -> Mallorca town name (only the towns in coords_muni.csv)."""
    cache = D / "contornos19.svg"
    if not cache.exists():
        cache.write_bytes(urllib.request.urlopen(
            urllib.request.Request(SVG_URL, headers=UA), timeout=90).read())
    svg = cache.read_text(encoding="utf-8", errors="replace")
    id2name = {int(m.group(1)): m.group(2)
               for m in re.finditer(r'key="(\d+)"[^>]*title="([^"]*)"', svg)}
    idx = {}
    for k, v in id2name.items():
        idx[_placename(v)] = k
        m = re.match(r"(.*),\s*(Sa|Ses|La|Es|S'|L'|El|Els|Les)\s*$", v)
        if m:
            idx[_placename(m.group(2) + " " + m.group(1))] = k
    ids = {}
    for r in csv.DictReader(open(D / "coords_muni.csv", encoding="utf-8")):
        k = idx.get(_placename(r["municipality"]))
        if k:
            ids[k] = r["municipality"]
    return ids
