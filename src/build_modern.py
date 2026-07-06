#!/usr/bin/env python3
"""Modern (2025) spatial isonymy of Mallorca municipalities, from the FULL INE surname
census — with an endemism filter to isolate the Mallorca-concentrated stock from the
ubiquitous/shared layer. IBESTAT is not used: everything is INE.

Inputs (data/):
  census_muni_2025.csv       surname × municipality counts (build_census.py: every INE
                             national ≥20 surname present in Mallorca, rate‰ × padrón)
  muni_pop_padron.csv        official INE padrón 2025 municipal population (denominator)
  census_prov.csv, endemic_prov.csv  per-province rates (origin axis, INE surname API)
  freq_Apellidos*.csv        INE national first-surname totals (Spain denominator)
  nac_*.csv                  INE "Apellidos por nacionalidad" (foreign screen)
  coords_muni.csv            NGIB town coordinates
Outputs (web/site_data/):
  modern_2025.json           per-municipality: pop, coords, Rii(all/auto), endemism,
                             lasker+mds+tree (all & autochthonous), mantel + sensitivity,
                             origin composition, surname endemism ranking.

CAVEATS baked into the honesty of the output:
  - The census covers surnames in the INE national ≥20 file (≈73% of the population);
    the rare tail below that, and INE's <5-per-town secrecy, are the residual. Rii=Σp²
    and Iij are head-dominated, so this is a defensible approximation.
  - LQ is ENDEMISM, not etymology (won't split Andalusi/Catalan).
"""
import csv, json, re, unicodedata
from pathlib import Path
import numpy as np, pandas as pd
import isonymy as iso   # vendored alongside in src/ (was ../../src in the medieval repo)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent            # repo root (this script lives in src/)
D = ROOT / "data"
POP_ESP = 48_600_000
# INE surname API (operation APEL) province map keys (CONTORNOS/20) for the origin axis.
# One clean national source replaces Idescat (Catalonia), IVE (Valencia) and IBESTAT
# ds007 (Balears): mapaWidget returns the per-province RATE (per mil) directly.
INE_CAT = ("9", "18", "26", "43")   # Barcelona, Girona, Lleida, Tarragona
INE_VAL = ("46", "13", "4")         # Valencia, Castelló, Alacant
INE_BAL = "8"                       # Illes Balears

def norm(s):
    # IBESTAT encodes ñ as "NI" (CAÑELLAS->CANIELLAS) and spaces as "_"; make INE
    # and IBESTAT agree: map ñ->NI, strip accents, keep only letters, uppercase.
    s = (s or "").replace("Ñ","NI").replace("ñ","ni").replace("_"," ")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^A-Za-z]","",s).upper()

# ---- INE national first-surname totals (denominator) ----
def load_national():
    nat={}
    for fn in ["freq_Apellidos >=100.csv","freq_Apellidos >=20 y <=99.csv"]:
        r=list(csv.reader(open(D/fn,encoding="utf-8")))
        h=next(i for i,x in enumerate(r) if x and x[0].strip()=="Orden")
        for x in r[h+1:]:
            if len(x)<3 or not x[1].strip(): continue
            try:
                k=norm(x[1]); nat[k]=nat.get(k,0)+int(str(x[2]).replace(".","").replace(",","") or 0)
            except ValueError: pass
    return nat

# Data-driven surname ORIGIN from INE "Apellidos por nacionalidad" (2025).
# Only morphologically DISTINCT foreign lists (América / Italia / Filipinas / Guinea Eq.
# bear Spanish surnames -> excluded to avoid mislabelling Castilian surnames).
ORIGIN_PLAN={
 "nac_ÁFRICA.csv":{"MARRUECOS":"magrebí","ARGELIA":"magrebí","SENEGAL":"subsaharià",
    "MALI":"subsaharià","GAMBIA":"subsaharià","NIGERIA":"subsaharià"},
 "nac_ASIA.csv":{"CHINA":"asiàtic","INDIA":"asiàtic","PAKISTÁN":"asiàtic","PAKISTAN":"asiàtic"},
 "nac_EUROPA.csv":{"ALEMANIA":"europeu","REINO UNIDO":"europeu","RUMANÍA":"europeu","RUMANIA":"europeu",
    "BULGARIA":"europeu","UCRANIA":"europeu","RUSIA":"europeu","POLONIA":"europeu","PORTUGAL":"europeu"},
}
# Recent-immigrant surnames that INE's "Apellidos por nacionalidad" MISSES because it only
# publishes the top-20 per country. Hand-verified gazetteer, deliberately CONSERVATIVE: only
# unambiguous 21st-century Maghrebi/Amazigh (and Sikh) transliterations whose entire Spanish
# presence is recent immigration. It is REQUIRED because a recent Moroccan surname and an old
# Mallorcan one are INDISTINGUISHABLE by frequency alone — both are Mallorca-endemic (high LQ)
# and absent from Catalonia — so the LQ machinery would file the Moroccan one as "català".
# Origin therefore needs external onomastic knowledge here; this list makes it explicit and
# reviewable. It EXCLUDES centuries-old Andalusi-origin Mallorcan surnames (Bennàssar,
# Binimelis, Bibiloni, Boscana…): those are autochthonous stock, not recent arrivals.
# "magrebí" groups Maghrebi + other recent Arab immigration (the closest available bucket).
FOREIGN_MANUAL={
 "magrebí":["ACHARKI","ASSOU","AYOUBI","AZAHAF","BAGHDADI","BERRAG","BOUHAMID","BOUHJIRA",
   "ELHANNAOUI","ELJOUHRI","ELKHOUMSSI","ELMIRI","ELYAAKOUBI","ENNAJI","ESSALEHY","FAGRACH",
   "FISSOUNE","GAROUAOUI","HADDOUTI","HAJJI","HAMMOUTI","KARKACH","KHATIB","KHOULATI","KOUHATI",
   "KOUJILI","LOUKILI","OUCHEN","OUCHENE","RACHDI","RAHAOUI","RAISSI","SADDIK","SAID","SALHI",
   "YATTAOUI","ZAHRAOUI","ZANNOUTI","ZOUGAGHI","ZOUGGAGH","ZOUGGAGHI",
   # census screen (screen_foreign_candidates.py): rare recent-Maghrebi/Amazigh transliterations
   # that reach a high Mallorca LQ (almost all their few Spanish bearers are on the island) but
   # are below the top-20 of any country's INE nationality list. Hand-picked, EXCLUDING the
   # centuries-old Andalusi-Mallorcan stock (Bennàssar, Binimelis, Bibiloni) and OCR variants.
   "IBARIGH","CHANGHOUFI","ELMAKIOUI","ELMAHTOUT","BOLAHDOUD","MAHDAJ","BEZZIZI","KOHATI",
   "KAIDARI","NABBOUTI","BELAJROU","KOUBEI","MARGUAA","BENABAD","ELFAKROUNI","ELHITANI",
   "OUAZIL","BENYAAGOUB","SBAGHI"],
 "asiàtic":["SINGH","KAUR","CARILIMDILIMAN"],   # Carilimdiliman: Filipino (census screen)
 "europeu":["NICHITEAN"],                        # Nichitean: Romanian (census screen)
}
def load_origin_ref():
    ref={}
    for fn,cols in ORIGIN_PLAN.items():
        r=list(csv.reader(open(D/fn,encoding="utf-8")))
        sub=next(i for i,x in enumerate(r) if any((c or "").strip().upper()=="PRIMER APELLIDO" for c in x))
        chdr=r[sub-1]
        for country,label in cols.items():
            ci=[i for i,c in enumerate(chdr) if country in (c or "").upper()]
            if not ci: continue
            c=ci[0]
            for x in r[sub+1:]:
                if len(x)>c and x[c].strip():
                    ref.setdefault(norm(x[c]),label)
    return ref

def main():
    import statistics as _st0
    def _med(v):
        v=[x for x in v if x is not None]
        return round(_st0.median(v),3) if v else None
    # ---- FULL INE surname census of Mallorca (no IBESTAT) ----
    # IBESTAT's ds009 gave only the top-50 surnames per town (a data-protection truncation,
    # useless for structure). It is DROPPED. Everything now comes from INE:
    #  * municipal population = official INE padrón 2025 (muni_pop_padron.csv, operation 22).
    #    This is the exact denominator INE divides by to publish its per-mil surname rate, so
    #    count = rate‰ × pop is exact (not the ±2% IBESTAT top-surname approximation).
    #  * surname × municipality counts = build_census.py (census_muni_2025.csv): every INE
    #    national first-surname (>=20) present in Mallorca, with its FULL municipal distribution
    #    from the INE surname API (mapaWidget&vista=muni). ~8k surnames vs IBESTAT's 442.
    # Municipality name is its own code now (IBESTAT muni codes dropped).
    pop={r["municipality"]:int(r["population"])
         for r in csv.DictReader(open(D/"muni_pop_padron.csv",encoding="utf-8"))}
    name={m:m for m in pop}
    code_by_name={m:m for m in pop}
    pop_mall=sum(pop.values())

    dfi=pd.read_csv(D/"census_muni_2025.csv")[["surname_norm","municipality","freq"]]
    dfi=dfi.rename(columns={"surname_norm":"surname"})
    dfi=dfi[dfi["municipality"].isin(pop)].copy()
    dfi["muni_code"]=dfi["municipality"]
    iso_src="INE surname census (mapaWidget&vista=muni; count = rate‰ × INE padrón 2025 population)"
    ine_counts={}   # surname -> {municipality_name: count}
    for r in dfi.itertuples():
        ine_counts.setdefault(r.surname,{})[r.municipality]=int(r.freq)

    # NGIB coords + coverage (INE-tracked first-surname mass / padrón population). Coverage is
    # now the share of the town's population whose first surname is in the INE >=20 census.
    coords={}
    for r in csv.DictReader(open(D/"coords_muni.csv",encoding="utf-8")):
        coords[r["municipality"]]=(float(r["lat"]),float(r["lon"]))
    covsum=dfi.groupby("muni_code")["freq"].sum()
    coverage={name[c]:round(float(covsum[c]*1.0/pop[c]),3) for c in pop if c in covsum.index}

    # ---- per-surname concentration signals (all vs the Spain rate) ----
    # Two orthogonal axes, kept separate on purpose:
    #  * ENDEMISM  lq   = concentration in MALLORCA vs Spain (drives the isonymy filter),
    #    from the INE census (the within-Mallorca municipal geography).
    #  * ORIGIN    a real Catalan-vs-Castilian proxy from concentration in the CATALAN-
    #    SPEAKING DOMAIN, ALL from the INE surname API (operation APEL): the per-province
    #    rate vs the national rate. A Catalan surname is over-represented somewhere in the
    #    domain (Ferrer, Nebot in the Principat; Amengual, Moll, Muntaner in Balears;
    #    Femenia, Miralles, Català in the Valencian provinces), a Castilian one is spread.
    # LQ vs Spain alone measures endemism, not etymology; comparing against the Catalan
    # lands separates origin. Using INE province rates (instead of Idescat/IVE/ds007)
    # both unifies the source AND cleans the Valencia noise: per province, Garcia LQ_Val
    # ~0.95 (not the ~1.9 the region-wide IVE count gave), and it recovers rare Balearic
    # surnames a top-N truncation would undercount (Muntaner LQ_Bal~29).
    nat=load_national()
    # Origin signal from the INE surname API (fetch_ine_apellidos.py): national 1st-surname
    # total + per-province rate (per mil). Replaces Idescat/IVE/ds007 with one source.
    # Province data (per-province rate for the origin axis), merged first-writer-wins by norm:
    #   census_prov.csv    the full-census province harvest (every present-in-Mallorca surname,
    #                      seeded from the INE national file); endemic_prov.csv the 276 earlier
    #                      endemic candidates. Both from the INE surname API (mapaWidget&tipo=1).
    ine={}
    def _load_prov(fn,skey):
        try:
            for r in csv.DictReader(open(D/fn,encoding="utf-8")):
                k=norm(r[skey])
                if k in ine: continue
                tot=r.get("total_nac") or r.get("nat") or ""
                ine[k]=(int(tot) if str(tot).strip() else None, json.loads(r.get("prov_json","{}")))
        except FileNotFoundError:
            pass
    _load_prov("census_prov.csv","surname_norm")
    _load_prov("endemic_prov.csv","surname_norm")
    if not ine:
        print("WARNING: no province data (census_prov/endemic_prov) — origin falls back to national+nationality only")
    mall_freq=dfi.groupby("surname")["freq"].sum()      # Mallorca total per surname (INE, all ≥5 towns)
    endem={}
    for s,fr in mall_freq.items():
        ne=nat.get(s)
        def lq_vs(f,pop):  # Location Quotient of a regional count f (pop base) vs the Spain rate
            return (f/pop)/(ne/POP_ESP) if (ne and ne>0 and f) else None
        lq   = lq_vs(int(fr), pop_mall)                 # Mallorca endemism (INE reconstructed total)
        # Catalan-domain concentration from INE province rates: LQ = province_rate / national_rate.
        # Cat/Val take the max over their provinces (concentration anywhere in the domain).
        it=ine.get(s); lq_c=lq_b=lq_v=None
        tot_nac=(it[0] if it and it[0] else ne)         # province file total, else national-file total
        if it and tot_nac:
            natrate=tot_nac/POP_ESP*1000; pr=it[1]       # national first-surname rate (per mil)
            def lqmax(keys):
                xs=[pr[k]/natrate for k in keys if k in pr and natrate]
                return max(xs) if xs else None
            lq_c=lqmax(INE_CAT)                          # max over Barcelona/Girona/Lleida/Tarragona
            lq_v=lqmax(INE_VAL)                          # max over Valencia/Castelló/Alacant
            lq_b=(pr[INE_BAL]/natrate) if (INE_BAL in pr and natrate) else None  # Balears
        cat_score = max([x for x in (lq_c, lq_b, lq) if x is not None], default=None)  # Catalan-domain
        endem[s]={"mall":int(fr),"spain":int(ne) if ne else None,
                  "lq":round(lq,2) if lq else None,
                  "lq_cat":round(lq_c,2) if lq_c else None,
                  "lq_bal":round(lq_b,2) if lq_b else None,
                  "lq_val":round(lq_v,2) if lq_v else None,
                  "cat_score":round(cat_score,2) if cat_score else None}

    LQ_AUTO=1.3       # endemism cutoff for the ISONYMY filter: >= -> Mallorca-endemic
    T_ORIGIN=1.5      # origin cutoff on the CLEAN anchors (Catalonia/Balears/Mallorca)
    T_VAL=5.0         # origin cutoff on the NOISY Valencia signal (higher, to exclude Garcia/Martinez)
    FOREIGN_LABELS={"magrebí","subsaharià","asiàtic","europeu"}
    oref=load_origin_ref()
    for lab,names in FOREIGN_MANUAL.items():          # hand-verified extension (beyond INE's top-20)
        for s in names: oref.setdefault(s,lab)
    def origin_of(s):
        e=endem[s]; cs=e["cat_score"]; lv=e["lq_val"]
        if s in oref: return oref[s]                  # 1) foreign immigrant (nationality lists + gazetteer)
        if cs is not None and cs>=T_ORIGIN: return "català"   # 2) Catalan-domain (Principat/Balears/Mallorca)
        if lv is not None and lv>=T_VAL:   return "català"    # 2b) strongly Valencian (noisy source, high bar)
        if e["spain"]: return "castellà"              # 3) in INE national, not Catalan-concentrated
        return "sense classificar"                    # 4) tail: not in INE national, no nationality list
    origin={s:origin_of(s) for s in endem}
    for s in endem: endem[s]["origin"]=origin[s]

    # Xueta surnames: the canonical 15-surname list of Mallorcan converso (crypto-Jewish)
    # descendants fixed by Miquel Forteza. A DOCUMENTED HISTORICAL overlay, ORTHOGONAL to
    # the Catalan/Castilian origin axis (these are Catalan-language surnames). It flags a
    # surname that INCLUDES xueta lineages — NOT that every bearer is of converso descent;
    # some Fuster/Martí/Miró/Pomar families are explicitly non-xueta. Source: Miquel
    # Forteza, "Els descendents dels jueus conversos de Mallorca"; ca.wikipedia "Xueta".
    XUETA={"AGUILO","BONNIN","CORTES","FORTESA","FORTEZA","FUSTER","MARTI","MIRO",
           "PICO","PINYA","POMAR","SEGURA","TARONGI","VALENTI","VALLERIOLA","VALLS"}
    for s in endem: endem[s]["xueta"]=s in XUETA
    # ISONYMY sets are driven by ENDEMISM (Mallorca concentration), NOT by origin: the
    # within-Mallorca geographic signal comes from surnames concentrated on the island.
    # MASS_FLOOR removes the tiny-count tail the full INE census surfaces: a surname borne by
    # <20 people island-wide can reach LQ 30+ purely because its national count is ~0 (OCR
    # variants, foreign singletons like IBARIGH/GESIM). It is 66% of the LQ>=1.3 surnames but
    # ~1.6% of the isonymy mass (Rii is p²-weighted → heads dominate), so flooring cleans the
    # endemic set without moving the Mantel result (verified: r stable at ~0.30).
    MASS_FLOOR=20
    def is_auto(s):   e=endem[s]; return e["lq"] is not None and e["lq"]>=LQ_AUTO and e["mall"]>=MASS_FLOOR and s not in oref
    def is_nonend(s): e=endem[s]["lq"]; return e is not None and e<LQ_AUTO and endem[s]["spain"] and s not in oref

    # spatial spread per surname: in how many municipalities (INE, ≥5 per town) and CV of rate
    import statistics as _st
    spat={}
    for sn,g in dfi.groupby("surname"):
        rates=[t.freq/pop[t.muni_code] for t in g.itertuples()]
        m=_st.mean(rates) if rates else 0
        spat[sn]={"nmuni":len(rates),"cv":round(_st.pstdev(rates)/m,3) if (len(rates)>=2 and m) else None}

    # ---- build muni x surname count matrix, run isonymy for a surname set ----
    # Everything (counts, matrix, isonymy) uses the INE municipality counts already loaded
    # into ine_counts / dfi above. IBESTAT only supplied the surname list + population.
    munis=sorted(pop, key=lambda c:-pop[c])
    town_names=[name[c] for c in munis]
    def counts_for(surset):
        cols=sorted(surset)
        M=pd.DataFrame(0,index=town_names,columns=cols)
        for s in surset:
            for tname,f in ine_counts.get(s,{}).items():
                if tname in M.index:
                    M.at[tname,s]=f
        # drop municipalities left with no surnames
        M=M[M.sum(axis=1)>0]
        return M

    def mantel_for(surset):
        """(n_surnames, n_towns, r, p) — Lasker isonymy vs geographic distance."""
        M=counts_for(surset)
        if M.shape[1]==0 or M.shape[0]<3: return M.shape[1],0,None,None
        locs=list(M.index)
        N=np.array([pop[code_by_name[l]] for l in locs],float).reshape(-1,1)
        P=M.values/N; R=P@P.T
        Dl=iso.lasker_distance(R)
        gi=[i for i,l in enumerate(locs) if l in coords]
        if len(gi)<3: return M.shape[1],len(gi),None,None
        Dg,_=iso.haversine_matrix({l:coords[l] for l in [locs[i] for i in gi]})
        r,p=iso.mantel(Dl[np.ix_(gi,gi)],Dg)
        return M.shape[1],len(gi),round(float(r),4),round(float(p),4)

    allset=set(endem)
    autoset={s for s in endem if is_auto(s)}
    nonendset={s for s in endem if is_nonend(s)}
    ORIGINS=["català","castellà","magrebí","subsaharià","asiàtic","europeu","sense classificar"]
    result={}
    for tag,surset in [("all",allset),("auto",autoset),("nonend",nonendset)]:
        M=counts_for(surset)
        # p_k normalised by TRUE municipal population (head-dominated approx)
        locs=list(M.index)
        code_by_name={name[c]:c for c in munis}
        N=np.array([pop[code_by_name[l]] for l in locs],float).reshape(-1,1)
        P=M.values/N
        R=P@P.T
        rii_unb=[]
        for i,l in enumerate(locs):
            n=M.values[i]; Ni=pop[code_by_name[l]]
            rii_unb.append(float((n*(n-1)).sum()/(Ni*(Ni-1))) if Ni>1 else 0.0)
        Dl=iso.lasker_distance(R)
        result[tag]={"locs":locs,"Rii":{l:round(float(R[i,i]),6) for i,l in enumerate(locs)},
                     "Rii_unb":{l:round(v,6) for l,v in zip(locs,rii_unb)},
                     "n_surnames":M.shape[1],
                     "lasker":Dl.round(4).tolist(),
                     "mds":iso.classical_mds(Dl).round(4).tolist(),
                     "pop":{l:int(pop[code_by_name[l]]) for l in locs}}
        from scipy.cluster.hierarchy import dendrogram
        Z,_=iso.tree_order(Dl,locs)
        dn=dendrogram(Z,labels=locs,no_plot=True)
        result[tag]["dendro"]={"ivl":dn["ivl"],
            "icoord":[[round(v,2) for v in s] for s in dn["icoord"]],
            "dcoord":[[round(v,4) for v in s] for s in dn["dcoord"]]}
        # Mantel: isonymic (Lasker) vs geographic distance, located municipalities
        gi=[i for i,l in enumerate(locs) if l in coords]
        if len(gi)>=3:
            sl=[locs[i] for i in gi]
            Dg,_=iso.haversine_matrix({l:coords[l] for l in sl})
            r,p=iso.mantel(Dl[np.ix_(gi,gi)],Dg)
            result[tag]["mantel"]={"r":round(float(r),4),"p":round(float(p),4),"n":len(gi)}

    # LQ threshold sensitivity: autochthonous = non-foreign surnames with LQ>=T.
    # Shows whether the isolation-by-distance result depends on the (arbitrary) cutoff.
    lq_sensitivity=[]
    for T in (1.3,1.5,2.0,3.0,5.0,8.0):
        ss={s for s in endem if endem[s]["lq"] is not None and endem[s]["lq"]>=T
            and endem[s]["mall"]>=MASS_FLOOR and origin[s] not in FOREIGN_LABELS}
        ns,ntw,r,p=mantel_for(ss)
        lq_sensitivity.append({"lq":T,"n_surnames":ns,"n_towns":ntw,"r":r,"p":p})

    # per-municipality autochthony fraction (of the INE-tracked surname mass) + top surnames
    muni_stats={}
    for code,g in dfi.groupby("muni_code"):
        tot=float(g["freq"].sum())
        au=float(g[g["surname"].map(is_auto)]["freq"].sum())
        top=g.sort_values("freq",ascending=False).head(6)
        muni_stats[name[code]]={"autoch":round(au/tot,3) if tot else 0.0,
            "top":[[t.surname,int(t.freq),endem[t.surname]["lq"]] for t in top.itertuples()]}
    # full per-municipality surname list (every INE-visible surname, ≥5, freq desc) for the
    # browsable "Municipis" tab and its CSV export: municipality -> [[surname, freq, rate‰], ...]
    muni_surnames={}
    for code,g in dfi.groupby("muni_code"):
        gg=g.sort_values("freq",ascending=False); P=pop[code]
        muni_surnames[name[code]]=[[t.surname,int(t.freq),round(t.freq*1000.0/P,1) if P else 0.0]
                                   for t in gg.itertuples()]
    # inverted index for the sidebar search / map highlight: surname -> [[municipality, freq], ...].
    # From the INE municipality counts (every town with ≥5 bearers), so a surname shows in ALL its
    # towns, not only the few where it makes the town's local top-50 (e.g. Picornell: 10 towns incl.
    # Palma 139, not the 3 IBESTAT top-50 rows).
    by_surname={sn:sorted([[t,f] for t,f in d.items()],key=lambda x:-x[1]) for sn,d in ine_counts.items()}
    muni_origin={}
    for code,g in dfi.groupby("muni_code"):
        tot=float(g["freq"].sum()); comp={o:0.0 for o in ORIGINS}
        for t in g.itertuples(): comp[origin[t.surname]]+=t.freq
        muni_origin[name[code]]={o:round(comp[o]/tot,4) for o in ORIGINS}
    tot_all=float(dfi["freq"].sum()); overall={o:0.0 for o in ORIGINS}
    for t in dfi.itertuples(): overall[origin[t.surname]]+=t.freq
    overall={o:round(overall[o]/tot_all,4) for o in ORIGINS}
    out={"slice":"Surname list: full INE national census (surnames >=20 in Spain, present in Mallorca); counts: INE municipality reconstruction",
         "isonymy_source":iso_src,
         "muni_stats":muni_stats,"muni_surnames":muni_surnames,
         "origins":ORIGINS,"origin_overall":overall,"muni_origin":muni_origin,
         "by_surname":by_surname,
         "n_municipalities":len(munis),"pop_mallorca_covered":pop_mall,
         "lq_bands":{"auto":LQ_AUTO,"origin":T_ORIGIN,"val":T_VAL,"mass":MASS_FLOOR},
         "lq_sensitivity":lq_sensitivity,
         "municipality_pop":{name[c]:pop[c] for c in munis},
         "coords":{name[c]:coords.get(name[c]) for c in munis},
         "coverage":coverage,
         "endemism":{s:endem[s] for s in sorted(endem,key=lambda s:(endem[s]["lq"] is None,-(endem[s]["lq"] or 0)))},
         "all":result["all"],"auto":result["auto"],"nonend":result["nonend"],
         "homogeneity":{
             "nonend":{"n":len(nonendset),
                     "median_cv":_med([spat[s]["cv"] for s in nonendset]),
                     "median_nmuni":_med([spat[s]["nmuni"] for s in nonendset])},
             "auto":{"n":len(autoset),
                     "median_cv":_med([spat[s]["cv"] for s in autoset]),
                     "median_nmuni":_med([spat[s]["nmuni"] for s in autoset])}}}
    (ROOT/"web"/"site_data").mkdir(parents=True,exist_ok=True)
    (ROOT/"web"/"site_data"/"modern_2025.json").write_text(json.dumps(out,ensure_ascii=False))
    print(f"municipalities: {len(munis)} | pop covered: {pop_mall:,}")
    print(f"surnames: all={len(allset)}  autochthonous={len(autoset)}  non-endemic={len(nonendset)}")
    print("LQ sensitivity:", [(s['lq'],s['n_surnames'],s['r'],s['p']) for s in lq_sensitivity])
    print("most endemic (mass>=%d):"%MASS_FLOOR,
          [s for s in out['endemism'] if endem[s]['mall']>=MASS_FLOOR and is_auto(s)][:12])
    print("least endemic:", [s for s in list(out['endemism'])[-12:]])
    print("Mantel all :",result["all"].get("mantel"))
    print("Mantel auto:",result["auto"].get("mantel"))
    print("Mantel nonend:",result["nonend"].get("mantel"))
    print("homogeneity:",json.dumps(out["homogeneity"],ensure_ascii=False))
    import statistics as st
    cvs=list(coverage.values())
    print(f"census coverage: min={min(cvs):.0%} median={st.median(cvs):.0%} max={max(cvs):.0%}")
    from collections import Counter
    oc=Counter(origin.values())
    print("origin (surnames):",dict(oc))
    print("origin (population share):",overall)
    print("check (disputed surnames): surname lq_cat lq_bal lq_mall lq_val cat_score -> origin")
    for s in ["FUSTER","NEBOT","MOLL","MUNTANER","POMAR","FEMENIA","MIRALLES","CATALA","GOMIS","NAVARRO","MARTINEZ","GARCIA"]:
        if s in endem:
            e=endem[s]; print(f"  {s:10} {str(e['lq_cat']):>6} {str(e['lq_bal']):>6} {str(e['lq']):>6} {str(e['lq_val']):>6} {str(e['cat_score']):>6} -> {e['origin']}")
    xu=[s for s in endem if endem[s]["xueta"]]
    print(f"xueta surnames present in data ({len(xu)}):", sorted(xu))
    print("wrote web/site_data/modern_2025.json")

if __name__=="__main__":
    main()
