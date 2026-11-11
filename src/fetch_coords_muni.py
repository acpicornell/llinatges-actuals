#!/usr/bin/env python3
"""EXPLORATION. NGIB coordinates for the Mallorca municipalities listed in
web/site_data/modern_2025.json (municipality_pop). Same open source/approach as the medieval side (IDEIB NGIB REST),
but here we take each municipality SEAT nucleus. Writes data/coords_muni.csv.
"""
import json, csv, unicodedata, urllib.parse, urllib.request
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent            # repo root (this script lives in src/)
BASE="https://ideib.caib.es/geoserveis/rest/services/public/NGIB/MapServer/0/query"
def norm(s):
    s=unicodedata.normalize("NFKD",s or "");return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()
def q(where):
    p={"where":where,"outFields":"GRAFIA,MUNICIPI,TIPUS_LOCAL","returnGeometry":"true","outSR":"4326","f":"json"}
    with urllib.request.urlopen(BASE+"?"+urllib.parse.urlencode(p),timeout=60) as r:
        return json.load(r).get("features",[])
def esc(s): return s.replace("'","''")
def ascii_prefix(s):
    o=[]
    for ch in s:
        if ord(ch)>127: break
        o.append(ch)
    return "".join(o).strip()
def pick(fs):
    if not fs: return None
    order={3010:0,977:1,917:2}
    fs.sort(key=lambda f:order.get(f["attributes"]["TIPUS_LOCAL"],9)); return fs[0]

munis=list(json.load(open(ROOT/"web/site_data/modern_2025.json"))["municipality_pop"])
rows=[]; miss=[]
for m in munis:
    pre=ascii_prefix(m) or m[:2]
    # 1) nucleus whose GRAFIA matches the municipality name (accent/case-insensitive)
    cand=q(f"UPPER(GRAFIA) LIKE UPPER('{esc(pre)}%')")
    hit=[c for c in cand if norm(c["attributes"]["GRAFIA"])==norm(m)]
    f=pick(hit)
    # 2) else the seat nucleus of that municipi
    if not f:
        cand=q(f"UPPER(MUNICIPI) LIKE UPPER('{esc(pre)}%') AND TIPUS_LOCAL=3010")
        hit=[c for c in cand if norm(c["attributes"]["MUNICIPI"])==norm(m)]
        # prefer the one named like the municipality; else the first nucleus
        f=pick([c for c in hit if norm(c["attributes"]["GRAFIA"])==norm(m)]) or pick(hit)
    if f:
        g=f["geometry"]; rows.append([m,round(g["y"],6),round(g["x"],6),f["attributes"]["GRAFIA"]])
    else:
        miss.append(m)
with open(ROOT/"data/coords_muni.csv","w",newline="",encoding="utf-8") as fp:
    w=csv.writer(fp); w.writerow(["municipality","lat","lon","ngib_grafia"]); w.writerows(rows)
print(f"coords: {len(rows)}/{len(munis)}  missing: {miss or 'none'}")
