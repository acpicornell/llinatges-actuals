"use strict";
// EXPLORATION viewer — modern (INE census 2025) Mallorca surname isonymy.
let D, MAP, MARKERS = {};

fetch("site_data/modern_2025.json").then(r => r.json()).then(d => { D = d; init(); })
  .catch(e => { document.getElementById("map").innerHTML =
    '<p style="padding:20px">No s\'ha pogut carregar <code>site_data/modern_2025.json</code> — serveix la carpeta <code>web/</code> amb un servidor.</p>'; console.error(e); });

const lerp = (a, b, t) => a + (b - a) * t;
// endemism ramp: red (ubiquitous / non-endemic) -> green (endemic / autochthonous)
function ramp(t){
  t = Math.max(0, Math.min(1, t));
  const c0=[201,106,90], c1=[63,174,116];
  const c=[0,1,2].map(i=>Math.round(lerp(c0[i],c1[i],t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function init(){
  buildMantelContrast(); buildLegend(); buildStats();
  buildMap(); buildMunis(); buildEndem(); buildOrigin(); buildIso(); buildMDS(); buildConclusions(); buildMethod(); wireTabs(); wireSearch();
}

const ORIGIN_COLOR={"català":"#3fae74","castellà":"#c96a5a","magrebí":"#d8a13a",
  "subsaharià":"#b5762f","asiàtic":"#c76fb0","europeu":"#5b8fd0","sense classificar":"#7a8a80"};
const oc=o=>ORIGIN_COLOR[o]||"#7a8a80";
const CATF=c=>(c["català"]||0);   // Catalan-domain (origin) fraction

// origin_basis -> which of the 3 layers decided this surname's origin, as a small
// badge with a plain-language tooltip. This is what answers "why is MY surname
// labelled like this?" in place, on the surname itself.
const BASIS={
  concentration:{t:"per concentració",
    d:"CAPA 3 (proxy descriptiu). Assignat per la concentració del cognom a les províncies catalanoparlants segons l'INE. Mesura DOMINI lingüístic, no etimologia: «català» vol dir «concentrat a les terres de parla catalana», res sobre l'arrel del cognom."},
  ine_nationality:{t:"llista INE nacionalitat",
    d:"CAPA 2 (dada directa INE). El cognom surt a «Apellidos por nacionalidad» de l'INE (top-20 del país). Marca d'immigració, no judici nostre."},
  curated_foreign:{t:"llista curada",
    d:"CAPA 2 (curat, revisable). Cognom d'immigració recent per sota del top-20 que publica l'INE; marcat amb una llista curada de coneixement onomàstic. NO és INE i és auditable."},
  undetermined:{t:"sense classificar",
    d:"CAPA 3. A baixa freqüència la concentració no distingeix un cognom català endèmic d'un forà endèmic; no ho afirmem en comptes d'inventar-ho."}};
const basisTag=e=>{const b=BASIS[e&&e.origin_basis]; return b?
  ` <span class="basis" title="${b.d}">${b.t}</span>`:"";};

// --- Origen tab: the 3-layer origin stack (measured INE / curated foreign / concentration proxy) ----
// Descriptive only; none of it feeds the isonymy statistics.
function buildOrigin(){
  const el=document.getElementById("origen-body");
  const ov=D.origin_overall, ORS=D.origins, E=D.endemism;
  const bar=ORS.filter(o=>ov[o]>0).map(o=>
    `<span class="oseg" style="width:${(ov[o]*100).toFixed(1)}%;background:${oc(o)}" title="${o} ${(ov[o]*100).toFixed(1)}%"></span>`).join("");
  const leg=ORS.map(o=>`<span class="oleg"><span class="sw" style="background:${oc(o)}"></span>${o} <b>${(ov[o]*100).toFixed(1)}%</b></span>`).join("");
  const foreignCats=["magrebí","subsaharià","asiàtic","europeu"];
  const foreign=Object.entries(E).filter(([s,e])=>foreignCats.includes(e.origin));
  const nCat=Object.values(E).filter(e=>e.origin==="català").length;
  const nCast=Object.values(E).filter(e=>e.origin==="castellà").length;
  const bc=D.origin_basis_counts||{};
  const nNac=bc.ine_nationality||0, nCur=bc.curated_foreign||0, nUnd=bc.undetermined||0;
  const munis=Object.entries(D.muni_origin).sort((a,b)=>CATF(b[1])-CATF(a[1]));
  const th=`<tr><th>municipi</th>`+ORS.map(o=>`<th class="num" style="color:${oc(o)}">${o.split(' ')[0]}</th>`).join("")+`</tr>`;
  const rows=munis.map(([m,c])=>`<tr><td>${m}</td>`+ORS.map(o=>`<td class="num" data-v="${c[o]||0}">${c[o]?Math.round(c[o]*100)+'%':'·'}</td>`).join("")+`</tr>`).join("");
  el.innerHTML=`
    <p class="caveat" style="margin-top:0">◻ <b>Què és, en una frase.</b> L'INE només ens diu <b>on viu avui</b> la
    gent amb cada cognom, <b>no</b> d'on ve. Fem servir aquesta geografia com a <b>aproximació</b> d'origen. Per
    tant <b>«català» = on es concentra, no d'on prové</b> el cognom — i <b>res d'aquesta pestanya afecta els
    resultats de l'estudi</b> (la isonímia i l'aïllament per distància van per endemisme, no per origen).</p>
    <h3 class="osub" style="margin-top:4px">Com decidim l'origen: 3 capes, de la més sòlida a la més fluixa</h3>
    <div class="layers3">
      <div class="concept" style="border-left-color:#6aa9d0">
        <h4><span>Capa 1 · El que mesura l'INE</span><span class="lstat" style="color:#6aa9d0">mesurat</span></h4>
        <p>On es concentra el cognom (Mallorca vs Espanya i per província). <b>Dada pura de l'INE</b>, qualsevol la
        refà igual. És la base de les dues capes de sota — encara no diu «català» ni «castellà».</p>
      </div>
      <div class="concept" style="border-left-color:var(--warn)">
        <h4><span>Capa 2 · Immigració recent</span><span class="lstat" style="color:var(--warn)">${(nNac+nCur).toLocaleString('ca')} cognoms</span></h4>
        <p><b>${nNac.toLocaleString('ca')}</b> surten a les llistes de nacionalitat de l'INE; <b>${nCur.toLocaleString('ca')}</b>
        els afegim <b>a mà</b> (l'INE talla pel top-20 de cada país). D'aquests <b>sí</b> sabem que són d'arribada
        recent — si no, la geografia els diria «català» per error.</p>
      </div>
      <div class="concept" style="border-left-color:var(--accent)">
        <h4><span>Capa 3 · Català o castellà</span><span class="lstat" style="color:var(--accent)">aproximació</span></h4>
        <p>La resta: concentrat a les <b>terres de parla catalana</b> → <b style="color:${oc('català')}">català</b> (${nCat});
        si no → <b style="color:${oc('castellà')}">castellà</b> (${nCast}); si no es pot decidir →
        <b>sense classificar</b> (${nUnd.toLocaleString('ca')}). Recorda: és <b>on viu</b> la gent, no d'on ve el cognom.</p>
      </div>
    </div>
    <p class="hint">Exemples de la Capa 3: <b>Ferrer, Nebot, Vidal</b> (Principat) · <b>Amengual, Moll, Fuster</b>
    (Balears) · <b>Miralles, Català, Gomis</b> (País Valencià) → català; <b>García, Martínez</b> (repartits per
    Espanya) → castellà.</p>
    <div class="obar">${bar}</div><div class="oleglist">${leg}</div>
    <div class="caveat">⚠ <b>Orígens forans (${foreign.length} cognoms):</b> detectats amb les llistes
    INE per nacionalitat <b>+ una llista curada</b> (l'INE només publica el top-20 per país, així que la cua queda
    <b>subestimada</b>). No els llistem aquí: cada cognom porta la seva etiqueta a la columna <b>capa</b>
    d'<b>Endemisme</b> i a la cerca. El detall (llindar valencià, Muntaner/Pomar, estrat andalusí) és a
    <b>Metodologia</b>.</div>
    <div class="caveat">◻ <b>«Sense classificar» (${Object.values(D.endemism).filter(e=>e.origin==='sense classificar').length} cognoms, ~1% de la massa):</b>
    cua de cognoms raríssims (&lt;${D.lq_bands.origin_floor} portadors a Espanya) l'única marca catalana dels quals és estar concentrats a
    <b>Balears</b>. A aquesta freqüència, «concentrat a Balears» <b>no</b> és origen: és el mateix que endemisme a Mallorca (un cognom
    amb 20 portadors gairebé tots a l'illa hi surt concentrat sigui quin sigui l'ètim). Sense un senyal <b>independent</b> de Catalunya o
    País Valencià, no podem distingir un Garcies català d'un Ahabchi magrebí → honestament, <b>indeterminat</b>. Els castellans i els forans
    coneguts no s'hi toquen.</div>
    <h3 class="osub">Composició per municipi (% de la massa de cognoms rastrejada, INE)</h3>
    <table><thead>${th}</thead><tbody>${rows}</tbody></table>`;
}

// --- CSV download (client-side, no server) --------------------------------
// Build a CSV from a rows array (first row = header) and trigger a download.
// A BOM is prepended so Excel reads the Catalan accents as UTF-8.
function downloadCSV(filename, rows){
  const esc=v=>{ v=(v==null?"":String(v)); return /[",\n\r;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
  const csv=rows.map(r=>r.map(esc).join(",")).join("\r\n");
  const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// --- per-municipality browser (every INE-visible surname ≥5 + CSV export) ----------
function buildMunis(){
  const el=document.getElementById("munis-body");
  const E=D.endemism, MS=D.muni_surnames;
  // municipalities sorted by population (largest first) — drives the CSV order and default selection
  const locs=Object.keys(MS).sort((a,b)=>(D.municipality_pop[b]||0)-(D.municipality_pop[a]||0));
  // dropdown listed alphabetically (Catalan collation); Palma stays the default landing
  const optLocs=[...locs].sort((a,b)=>a.localeCompare(b,"ca"));
  const cls=o=> o==="català"?"auto": o==="castellà"?"cast":"none";
  const nm=v=>v!=null?v:'—';
  const XUBADGE=`<span class="xu" title="«Xueta»: terme d'origen despectiu, avui reapropiat i estàndard. Llinatge de la llista canònica de 15 que INCLOU descendents de conversos jueus mallorquins — no que cada portador ho sigui. Vegeu Metodologia.">xueta</span>`;
  el.innerHTML=`
    <p>Explora la taula <b>completa de cognoms visibles</b> (recompte municipal de l'INE 2025, 1r cognom,
    tots els que tenen ≥5 portadors) d'un municipi: freqüència, taxa per mil habitants, LQ d'endemisme i
    origen. Tria un municipi i baixa'l en CSV.</p>
    <div class="mn-bar">
      <select id="mn-sel">${optLocs.map(m=>`<option value="${m}"${m===locs[0]?" selected":""}>${m} · ${(D.municipality_pop[m]||0).toLocaleString('ca')} hab.</option>`).join("")}</select>
      <button class="dl" id="mn-dl-one">Baixar aquest municipi (CSV)</button>
      <button class="dl" id="mn-dl-all">Baixar tot (municipi × cognom, CSV)</button>
    </div>
    <div id="mn-panel"></div>`;

  // enrich a municipality's surname list with LQ/origin/xueta; return display+raw rows
  const enrich=m=>MS[m].map(([s,f,rate],i)=>{
    const e=E[s]||{}; const tot=MS[m].reduce((z,x)=>z+x[1],0);
    return {rank:i+1,s,f,rate,pctTop:tot?(f/tot*100):0,lq:e.lq??null,
            origin:e.origin||"—",xueta:!!e.xueta};
  });
  function renderMuni(m){
    const rows=enrich(m), pop=D.municipality_pop[m]||0, st=D.muni_stats[m]||{autoch:0},
          cov=D.coverage[m], mo=D.muni_origin[m]||{};
    const obar=D.origins.filter(o=>mo[o]>0).map(o=>
      `<span class="oseg" style="width:${(mo[o]*100).toFixed(1)}%;background:${oc(o)}" title="${o} ${(mo[o]*100).toFixed(1)}%"></span>`).join("");
    const head=`<div class="mn-head">
      <span class="k">població <b>${pop.toLocaleString('ca')}</b></span>
      <span class="k">autoctonia <b style="color:${ramp(st.autoch)}">${Math.round(st.autoch*100)}%</b></span>
      <span class="k">cobertura <b>${cov!=null?Math.round(cov*100)+'%':'—'}</b></span>
      <span class="k">cognoms visibles <b>${rows.length}</b></span></div>
      <div class="obar" style="margin:6px 0 14px">${obar}</div>`;
    const body=rows.map(r=>`<tr class="${cls(r.origin)}"><td class="num" data-v="${r.rank}">${r.rank}</td>
      <td>${r.s.replace(/_/g,' ')}${r.xueta?' '+XUBADGE:''}</td>
      <td class="num" data-v="${r.f}">${r.f.toLocaleString('ca')}</td>
      <td class="num" data-v="${r.pctTop}">${r.pctTop.toFixed(1)}%</td>
      <td class="num" data-v="${r.rate}">${r.rate}</td>
      <td class="num" data-v="${r.lq??''}">${nm(r.lq)}</td>
      <td style="color:${oc(r.origin)}">${r.origin}</td></tr>`).join("");
    document.getElementById("mn-panel").innerHTML=head+
      `<table><thead><tr><th class="num">#</th><th>cognom</th><th class="num">freq</th>
        <th class="num" title="% de la massa de cognoms rastrejada al municipi">% massa</th>
        <th class="num" title="portadors per mil habitants">‰</th>
        <th class="num">LQ Mall</th><th>origen</th></tr></thead><tbody>${body}</tbody></table>`;
  }
  const csvOne=m=>{
    const rows=[["rang","cognom","freq","pct_massa","taxa_permil","LQ_Mallorca","origen","xueta"]];
    enrich(m).forEach(r=>rows.push([r.rank,r.s.replace(/_/g,' '),r.f,r.pctTop.toFixed(1),r.rate,r.lq??"",r.origin,r.xueta?"si":""]));
    return rows;
  };
  const sel=document.getElementById("mn-sel");
  sel.addEventListener("change",()=>renderMuni(sel.value));
  document.getElementById("mn-dl-one").addEventListener("click",()=>
    downloadCSV(`cognoms_${sel.value.replace(/[^\w]+/g,"_")}_2025.csv`, csvOne(sel.value)));
  document.getElementById("mn-dl-all").addEventListener("click",()=>{
    const rows=[["municipi","poblacio","rang","cognom","freq","pct_massa","taxa_permil","LQ_Mallorca","origen","xueta"]];
    locs.forEach(m=>enrich(m).forEach(r=>rows.push([m,D.municipality_pop[m]||"",r.rank,r.s.replace(/_/g,' '),r.f,r.pctTop.toFixed(1),r.rate,r.lq??"",r.origin,r.xueta?"si":""])));
    downloadCSV("cognoms_municipis_mallorca_2025.csv", rows);
  });
  renderMuni(locs[0]);
}

// --- conclusions (computed live from the data) ----------------------------
function buildConclusions(){
  const a=D.all.mantel, u=D.auto.mantel, ne=D.nonend.mantel, E=D.endemism;
  const MST=D.muni_stats, POP=D.municipality_pop, CO=D.coords, R=D.auto.Rii;
  const munis=Object.entries(MST).map(([m,s])=>({m,au:s.autoch,pop:POP[m]}));
  const totPop=munis.reduce((s,x)=>s+x.pop,0);
  const meanAuto=munis.reduce((s,x)=>s+x.au*x.pop,0)/totPop;
  const nCat=Object.values(E).filter(e=>e.origin==="català").length;
  const nCast=Object.values(E).filter(e=>e.origin==="castellà").length;
  const cov=Object.values(D.coverage);
  const pc=x=>Math.round(x*100)+"%";
  const n2=x=>x.toFixed(2).replace('.',',');
  const cap=s=>s.charAt(0)+s.slice(1).toLowerCase().replace(/_/g,' ');
  const sensRows=D.lq_sensitivity.map(r=>`<tr${r.p<0.05?' style="color:#8fd6ac"':''}><td class="num">≥ ${r.lq}</td>`+
    `<td class="num">${r.n_surnames}</td><td class="num">${r.r}</td><td class="num">${r.p}${r.p<0.05?' ✓':''}</td></tr>`).join("");
  // --- the real driver: town SIZE, not distance to Palma ---
  const km=(p,q)=>Math.hypot((p[0]-q[0])*111,(p[1]-q[1])*85), pal=CO.Palma;
  const corr=ps=>{const n=ps.length,mx=ps.reduce((s,p)=>s+p[0],0)/n,my=ps.reduce((s,p)=>s+p[1],0)/n;
    let c=0,sx=0,sy=0;for(const[x,y]of ps){c+=(x-mx)*(y-my);sx+=(x-mx)**2;sy+=(y-my)**2;}return c/Math.sqrt(sx*sy);};
  const cr=Object.keys(MST).filter(m=>CO[m]&&POP[m]>0).map(m=>({au:MST[m].autoch,lp:Math.log(POP[m]),d:km(CO[m],pal),rii:R[m]}));
  const cAuPop=corr(cr.map(r=>[r.au,r.lp])), cAuDist=corr(cr.map(r=>[r.au,r.d])), cRiiPop=corr(cr.filter(r=>r.rii).map(r=>[r.rii,r.lp]));
  const T=m=>({au:pc(MST[m].autoch),pop:POP[m].toLocaleString('ca'),d:Math.round(km(CO[m],pal))});
  const bany=T('Banyalbufar'), calv=T('Calvià'), palm=T('Palma');
  const endog=Object.entries(R).sort((x,y)=>y[1]-x[1]).slice(0,5).map(([m])=>m).join(', ');
  // --- most Mallorcan surnames: share = % of all Spanish bearers who live in Mallorca ---
  const foreign=new Set(["magrebí","subsaharià","asiàtic","europeu","sense classificar"]);
  const mostMall=Object.entries(E).filter(([s,e])=>e.spain&&e.mall>=300&&!foreign.has(e.origin))
    .map(([s,e])=>({s,share:e.mall/e.spain})).sort((x,y)=>y.share-x.share).slice(0,10);
  // --- surname monopolies: town's most common first surname as a share of its population ---
  const mono=Object.entries(MST).filter(([m,s])=>s.top&&s.top.length)
    .map(([m,s])=>({m,sn:s.top[0][0],pct:s.top[0][2]/10})).sort((x,y)=>y.pct-x.pct).slice(0,8);
  // --- 20th-century immigration map: origin composition extremes ---
  const MO=D.muni_origin;
  const mostCat=Object.entries(MO).sort((x,y)=>(y[1]["català"]||0)-(x[1]["català"]||0)).slice(0,5);
  const mostCast=Object.entries(MO).sort((x,y)=>(y[1]["castellà"]||0)-(x[1]["castellà"]||0)).slice(0,5);
  // --- origin: same population mass, opposite distribution shape ---
  const byOrigE={};
  for(const[s,e]of Object.entries(E)){(byOrigE[e.origin]=byOrigE[e.origin]||[]).push([s,e.mall||0]);}
  const oStruct=o=>{const v=(byOrigE[o]||[]).slice().sort((x,y)=>y[1]-x[1]);
    const M=v.reduce((s,x)=>s+x[1],0);
    return {n:v.length, top10:v.slice(0,10).reduce((s,x)=>s+x[1],0)/M,
      eff:1/v.reduce((s,x)=>s+(x[1]/M)**2,0), bigN:v[0][0], bigM:v[0][1]};};
  const oCat=oStruct("català"), oCast=oStruct("castellà");
  const bigRatio=(oCast.bigM/oCat.bigM).toFixed(1).replace('.',',');
  const effRatio=(oCat.eff/oCast.eff).toFixed(1).replace('.',',');
  const pc1=x=>(x*100).toFixed(1).replace('.',',')+'%';
  const d1=x=>x.toFixed(1).replace('.',',');
  const foreignPct=['europeu','asiàtic','magrebí','subsaharià'].reduce((s,k)=>s+(D.origin_overall[k]||0),0);
  // --- §6 the xueta collective: descriptive geography of a closed surname set (marca ≠ persona) ---
  const XU=Object.entries(E).filter(([s,e])=>e.xueta).map(([s,e])=>
    ({s,mall:e.mall||0,spain:e.spain||0,origin:e.origin,share:e.spain?(e.mall||0)/e.spain:0}));
  const xuNucleus=XU.filter(x=>x.share>=0.25).sort((a,b)=>b.share-a.share);   // barely exist off-island
  const xuShared=XU.filter(x=>x.share<0.25).sort((a,b)=>b.mall-a.mall);       // common Spanish surnames
  const BYS=D.by_surname, islPop=Object.values(POP).reduce((s,x)=>s+x,0);
  const nucMu={}; let nucTot=0;
  xuNucleus.forEach(x=>(BYS[x.s]||[]).forEach(([m,f])=>{nucMu[m]=(nucMu[m]||0)+f;nucTot+=f;}));
  const nucPalma=(nucMu['Palma']||0)/nucTot, palmaIsl=POP['Palma']/islPop;
  const nucPermil=Object.entries(nucMu).filter(([m,f])=>POP[m]&&f>=15)
    .map(([m,f])=>({m,pm:f/POP[m]*1000})).sort((a,b)=>b.pm-a.pm).slice(0,6);
  const nucMunis=Object.values(nucMu).filter(f=>f>0).length;
  // per-town diversity of the nucleus lineages: established community (many, even) vs single family (one dominates)
  const nucTown={};
  xuNucleus.forEach(x=>(BYS[x.s]||[]).forEach(([m,f])=>{(nucTown[m]=nucTown[m]||{})[x.s]=f;}));
  const xuDiv=Object.entries(nucTown).map(([m,cs])=>{const vals=Object.values(cs),
    tot=vals.reduce((s,v)=>s+v,0),top=Object.entries(cs).sort((a,b)=>b[1]-a[1])[0];
    return {m,rich:vals.length,eff:1/vals.reduce((s,v)=>s+(v/tot)**2,0),tot,
      topShare:top[1]/tot,top:top[0]};}).filter(d=>d.tot>=40&&d.rich>=2);
  const xuMixed=xuDiv.slice().sort((a,b)=>b.eff-a.eff).slice(0,8);
  const xuFamily=xuDiv.filter(d=>d.topShare>=0.55).sort((a,b)=>b.topShare-a.topShare);
  // pool-size-fair evenness (effective/richness, weighted by bearers): xueta lineages vs recent Maghrebi immigration
  const evennessWtd=surns=>{const tw={};
    surns.forEach(s=>(BYS[s]||[]).forEach(([m,f])=>{(tw[m]=tw[m]||{})[s]=(tw[m][s]||0)+f;}));
    let acc=0,W=0; for(const m in tw){const vals=Object.values(tw[m]),tot=vals.reduce((s,v)=>s+v,0);
      if(tot<40||vals.length<2)continue; const eff=1/vals.reduce((s,v)=>s+(v/tot)**2,0);
      acc+=(eff/vals.length)*tot; W+=tot;} return acc/W;};
  const evXu=evennessWtd(xuNucleus.map(x=>x.s));
  const evMag=evennessWtd(Object.entries(E).filter(([s,e])=>e.origin==='magrebí').map(([s])=>s));
  // --- §7 recent-immigration signature: Maghrebi surnames as the clearest measurable case ---
  const magE=Object.entries(E).filter(([s,e])=>e.origin==='magrebí');
  const magSurns=magE.map(([s])=>s), totMass=Object.values(E).reduce((s,e)=>s+(e.mall||0),0);
  const magMass=magE.reduce((s,[,e])=>s+(e.mall||0),0);
  const magCur=magE.filter(([,e])=>e.origin_basis==='curated_foreign').length;
  const magSorted=magE.map(([s,e])=>e.mall||0).sort((a,b)=>b-a);
  const magEff=1/magE.reduce((s,[,e])=>s+((e.mall||0)/magMass)**2,0);
  const magTop10=magSorted.slice(0,10).reduce((s,x)=>s+x,0)/magMass;
  const magMu={}; magSurns.forEach(s=>(BYS[s]||[]).forEach(([m,f])=>{magMu[m]=(magMu[m]||0)+f;}));
  const magTot=Object.values(magMu).reduce((s,x)=>s+x,0), magPalma=(magMu['Palma']||0)/magTot;
  const magPermil=Object.entries(magMu).filter(([m,f])=>POP[m]&&f>=40)
    .map(([m,f])=>({m,pm:f/POP[m]*1000})).sort((a,b)=>b.pm-a.pm).slice(0,6);
  const magMunis=Object.values(magMu).filter(f=>f>0).length;
  const magTown={}; magSurns.forEach(s=>(BYS[s]||[]).forEach(([m,f])=>{(magTown[m]=magTown[m]||{})[s]=(magTown[m][s]||0)+f;}));
  const magDom=Object.entries(magTown).map(([m,cs])=>{const vals=Object.values(cs),tot=vals.reduce((a,b)=>a+b,0),
    top=Object.entries(cs).sort((a,b)=>b[1]-a[1])[0];return {m,tot,topShare:top[1]/tot,top:top[0]};})
    .filter(d=>d.tot>=40&&Object.keys(magTown[d.m]).length>=2).sort((a,b)=>b.topShare-a.topShare);
  // --- §3 shape of the map: surname coverage, regions, twin/lonely towns ---
  const masses=Object.values(E).map(e=>e.mall||0).sort((a,b)=>b-a);
  const totMassAll=masses.reduce((s,x)=>s+x,0);
  const covN=p=>{let c=0;for(let i=0;i<masses.length;i++){c+=masses[i];if(c>=p*totMassAll)return i+1;}return masses.length;};
  const cov25=covN(0.25), cov50=covN(0.5), cov90=covN(0.9);
  const REG=D.auto.region, regG={};
  Object.entries(REG).forEach(([t,c])=>{(regG[c]=regG[c]||[]).push(t);});
  const regSize=Object.entries(regG).sort((a,b)=>b[1].length-a[1].length);
  const coreN=regSize[0][1].length;                       // biggest cluster = the mixed core
  const sollerReg=(regG[REG['Sóller']]||[]).slice().sort();
  const llevantReg=regG[REG['Manacor']]||[];
  const isolates=regSize.filter(([,ts])=>ts.length===1).map(([,ts])=>ts[0]);
  const LK=D.auto.lasker, LKl=D.auto.locs;
  const lval=(i,j)=>(LK[i][j]+LK[j][i])/2;
  let lpairs=[];
  for(let i=0;i<LKl.length;i++)for(let j=i+1;j<LKl.length;j++)lpairs.push([lval(i,j),LKl[i],LKl[j]]);
  lpairs.sort((a,b)=>a[0]-b[0]);
  const twins=lpairs.slice(0,3);
  const neighbourPair=lpairs.find(([,a,b])=>(a==='Manacor'&&b==='Sant Llorenç des Cardassar')||(b==='Manacor'&&a==='Sant Llorenç des Cardassar'));
  const lonely=LKl.map((t,i)=>({t,d:LKl.reduce((s,_,j)=>s+(i===j?0:lval(i,j)),0)/(LKl.length-1)}))
    .sort((a,b)=>b.d-a.d)[0];

  document.getElementById("concl-body").innerHTML = `
  <h2>Conclusions</h2>
  <p class="lead">Els cognoms de Mallorca semblen <b>homogenis</b> —García, Martínez a tot arreu—, com si no hi
  hagués res a dir. És una <b>màscara</b>. Treu l'estrat d'immigració compartit i, a sota, reapareix una
  <b>geografia de fa segles</b>. Instantània 2025 (cens de cognoms de l'INE), ${D.n_municipalities} municipis,
  ${totPop.toLocaleString('ca')} persones. Aquestes són les conclusions que aguanten els números.</p>

  <h3>1. El filtre destapa una geografia amagada</h3>
  <p>Aïllament per distància (Mantel): els pobles <b>a prop en km</b> tenen també cognoms més semblants? Sobre
  els mateixos ${a.n} municipis:</p>
  <table><thead><tr><th>cognoms usats</th><th class="num">r</th><th class="num">p</th></tr></thead><tbody>
    <tr><td>Tots els cognoms</td><td class="num">${a.r}</td><td class="num">${a.p} <span class="ns">nul</span></td></tr>
    <tr style="color:#8fd6ac"><td>Només autòctons (LQ≥${D.lq_bands.auto})</td><td class="num">${u.r}</td><td class="num">${u.p} ✓</td></tr>
  </tbody></table>
  <p class="result-box">Amb <b>tots</b> els cognoms, <b>res</b> (r=${a.r}): els ubics (García, Martínez…) igualen
  tots els pobles. Aïllant el fons <b>autòcton</b> apareix <b>r=${u.r}, p=${u.p}</b> — aïllament per distància
  clar i significatiu. El filtre no crea el senyal: el <b>destapa</b> traient l'estrat que l'amagava. I no depèn
  del tall triat —a qualsevol llindar raonable es manté o puja:</p>
  <table><thead><tr><th class="num">LQ ≥</th><th class="num">cognoms</th><th class="num">r</th><th class="num">p</th></tr></thead>
    <tbody>${sensRows}</tbody></table>

  <h3>2. El que mana és la MIDA del poble, no la distància a Palma</h3>
  <p>El marc fàcil seria «interior vs Palma». Els números diuen una altra cosa: el que prediu l'autoctonia d'un
  poble és <b>com de gran és</b>, no com de lluny és de la capital.</p>
  <ul>
    <li>autoctonia ↔ <b>mida (població)</b>: correlació <b>${n2(cAuPop)}</b> — fortíssima.</li>
    <li>autoctonia ↔ <b>distància a Palma</b>: correlació <b>${n2(cAuDist)}</b> — pràcticament nul·la.</li>
  </ul>
  <p class="result-box"><b>Banyalbufar</b> (${bany.pop} hab., a ${bany.d} km de Palma) és <b>${bany.au}</b>
  autòcton; <b>Calvià</b> (${calv.pop} hab., a només ${calv.d} km) és <b>${calv.au}</b>. Mateixa distància, món
  oposat: no és la geografia, és que la <b>immigració del s. XX va anar als pobles grans i turístics</b> (Palma
  mateix: ${palm.au}). L'<b>endogàmia</b> segueix la mateixa llei —com més petit el poble, més tancat (Rii ↔
  mida: ${n2(cRiiPop)})—: els més endogàmics són pobles petits de l'interior (${endog}); els més barrejats,
  Palma i Calvià.</p>
  <p><b>Per què.</b> <b>Garcia</b> surt a ${D.by_surname.GARCIA.length}/${D.n_municipalities} pobles amb <b>taxa
  plana</b> (~20‰ pertot) → dilueix la geografia; <b>Cañellas</b> té la massa <b>concentrada</b> en pocs (Santa
  Eugènia ~28‰ vs ~1,6‰ a Palma) → la crea. Els autòctons són grumollosos; els ubics, plans. Autoctonia mitjana
  ponderada per població: <b>${pc(meanAuto)}</b>.</p>
  <p class="hint" style="color:var(--muted)">Comprovat a part: l'arbre d'isonímia de l'estrat <b>no endèmic</b>
  dona r=${ne.r}, p=${ne.p} → cap estructura per distància. La geografia viu <b>només</b> a el fons autòcton.</p>

  <h3>3. La forma del mapa: quants cognoms, quines regions, quins veïns</h3>
  <p><b>Quants cognoms fan Mallorca?</b> Molt pocs en fan el gruix i una cua immensa fa la resta: els
  <b>${cov25}</b> cognoms més comuns ja són <b>una quarta part</b> de tothom, i amb <b>${cov50}</b> ja tens
  <b>mig</b> Mallorca —però en calen <b>${cov90.toLocaleString('ca')}</b> per arribar al 90%, dins un cens de
  ${D.all.n_surnames.toLocaleString('ca')}. Tot i això, <b>4 de cada 10</b> (${pc(meanAuto)} de la població)
  encara porten un cognom <b>arrelat a l'illa</b> (endèmic): aquest fons és el que dibuixa la geografia.</p>
  <p><b>Es veu al mapa?</b> Si aïllem el fons autòcton i deixem que els cognoms agrupin els pobles (arbre
  d'isonímia, el mateix de la pestanya MDS), Mallorca <b>no</b> es parteix en comarques nítides: surt <b>un gran
  nucli connectat</b> (${coreN} dels ${D.n_municipalities} municipis: Palma, el Raiguer, el nord) i, ben
  separades, <b>un parell de bosses</b>. La més neta és la <b>vall de Sóller</b> —${sollerReg.join(', ')}—,
  aïllada rere la Serra; i una <b>banda de Llevant-Migjorn</b> (${llevantReg.slice(0,6).join(', ')}…). L'aïllament
  per distància és, doncs, un <b>gradient amb algunes illes</b>, no fronteres.</p>
  <p><b>Veïns i solitaris.</b> Els pobles amb els cognoms <b>més bessons</b> són els de la corona de Palma
  (${twins[0][1]} ~ ${twins[0][2]}, Lasker ${n2(twins[0][0])}), que comparteixen el mateix fons; però
  l'estructura també aparella <b>veïns de debò</b>: <b>${neighbourPair?neighbourPair[1]+' ~ '+neighbourPair[2]:'Manacor ~ Sant Llorenç des Cardassar'}</b>,
  que de fet <b>eren un sol poble</b> fins que Sant Llorenç se'n va separar (1892). A l'altre extrem,
  <b>${lonely.t}</b> és el poble <b>més sol de l'illa</b>: el seu perfil de cognoms és el més diferent de tots
  els altres.</p>

  <h3>4. Els cognoms més mallorquins, i els pobles que en són «capital»</h3>
  <p><b>Els més exclusivament mallorquins</b> — quin % de tots els portadors d'Espanya viuen a Mallorca:</p>
  <p style="line-height:2.1">${mostMall.map(x=>`<span class="pill" style="border-color:${oc('català')};color:var(--ink)">${cap(x.s)} <b>${Math.round(x.share*100)}%</b></span>`).join(" ")}</p>
  <p class="hint" style="color:var(--muted)">Concentrats desenes de vegades més a l'illa que la mitjana espanyola:
  gairebé no existeixen fora de Mallorca.</p>
  <p><b>Monopolis de cognom</b> — pobles on un sol llinatge domina la població:</p>
  <div class="two">
    <div><table><thead><tr><th>poble</th><th>cognom</th><th class="num">% pob.</th></tr></thead><tbody>
      ${mono.map(x=>`<tr><td>${x.m}</td><td>${cap(x.sn)}</td><td class="num">${n2(x.pct)}%</td></tr>`).join("")}
    </tbody></table></div>
    <div class="result-box" style="align-self:start">A <b>${mono[0].m}</b>, <b>1 de cada ${Math.round(100/mono[0].pct)}</b>
    persones porten el cognom <b>${cap(mono[0].sn)}</b> de primer. Aquests llinatges gairebé <i>són</i> el poble.</div>
  </div>

  <h3>5. El mapa de la immigració del segle XX</h3>
  <p>La composició d'origen (descriptiva, per concentració) dibuixa net l'onada migratòria: els municipis
  <b>costaners i turístics</b> són els més castellans; l'<b>interior</b>, els més catalans.</p>
  <div class="two">
    <div><table><thead><tr><th>Més català</th><th class="num">%&nbsp;cat</th></tr></thead><tbody>
      ${mostCat.map(([m,c])=>`<tr><td>${m}</td><td class="num">${Math.round((c["català"]||0)*100)}%</td></tr>`).join("")}</tbody></table></div>
    <div><table><thead><tr><th>Més castellà</th><th class="num">%&nbsp;cast</th></tr></thead><tbody>
      ${mostCast.map(([m,c])=>`<tr><td>${m}</td><td class="num">${Math.round((c["castellà"]||0)*100)}%</td></tr>`).join("")}</tbody></table></div>
  </div>

  <h3>6. Origen: mateixa massa, estructura oposada</h3>
  <p>Per població l'illa queda gairebé partida en dos: <b>~${pc(D.origin_overall["català"])}</b> català ·
  <b>~${pc(D.origin_overall["castellà"])}</b> castellà. Però darrere de l'empat hi ha <b>dues demografies
  contràries</b> —i és la mateixa moneda que explica tot el que hem vist a dalt.</p>
  <div class="two">
    <div><table><thead><tr><th></th><th class="num">català</th><th class="num">castellà</th></tr></thead><tbody>
      <tr><td>cognoms diferents</td><td class="num">${oCat.n.toLocaleString('ca')}</td><td class="num">${oCast.n.toLocaleString('ca')}</td></tr>
      <tr><td>% de la població</td><td class="num">${pc(D.origin_overall["català"])}</td><td class="num">${pc(D.origin_overall["castellà"])}</td></tr>
      <tr><td>els 10 primers = % de la massa</td><td class="num">${pc(oCat.top10)}</td><td class="num">${pc(oCast.top10)}</td></tr>
      <tr><td>nº <i>efectiu</i> de cognoms</td><td class="num">${Math.round(oCat.eff)}</td><td class="num">${Math.round(oCast.eff)}</td></tr>
      <tr><td>el més gran</td><td class="num">${cap(oCat.bigN)} ${oCat.bigM.toLocaleString('ca')}</td><td class="num">${cap(oCast.bigN)} ${oCast.bigM.toLocaleString('ca')}</td></tr>
    </tbody></table></div>
    <div class="result-box" style="align-self:start">El fons <b>castellà</b> són <b>pocs cognoms i ubics</b>
    (Garcia, Martínez, López…): els 10 primers ja fan el <b>${pc(oCast.top10)}</b> de tota la seva massa. El
    <b>català</b> és una <b>cua llarga de cognoms locals</b> —gairebé el doble de llinatges, i el més gran
    (${cap(oCat.bigN)}) és <b>${bigRatio}×</b> més petit que Garcia. En nombre <i>efectiu</i>, el català és
    <b>${effRatio}× més divers</b>.</div>
  </div>
  <p class="result-box">Això <b>és</b> el mecanisme de la màscara (§2) vist des de l'origen: <b>pocs i plans</b>
  esborren la geografia, una <b>cua llarga de locals</b> la sosté. La composició d'origen i el resultat
  d'isonímia no són dos fets: són <b>la mateixa moneda</b>.</p>
  <p>L'eix es construeix a part, en <b>3 capes</b> (mesura INE → marca de forà curada → proxy de concentració) i
  <b>no entra a cap estadística</b> —la geografia de dalt va tota per endemisme. «Català» vol dir <b>on es
  concentra</b> el cognom, no d'on ve. La <b>immigració recent</b> (marca de forà, Capa 2) és el
  <b>${pc1(foreignPct)}</b> de la població: europeu ${pc1(D.origin_overall["europeu"])} · asiàtic
  ${pc1(D.origin_overall["asiàtic"])} · magrebí ${pc1(D.origin_overall["magrebí"])} · subsaharià
  ${pc1(D.origin_overall["subsaharià"])}. El detall, a les pestanyes <b>Origen</b> i <b>Metodologia</b>.</p>

  <h3>7. Un col·lectiu de contorn net: els llinatges xuetes</h3>
  <p>Rarament la demografia ofereix un col·lectiu tan <b>ben delimitat</b>: 15 cognoms fixats fa segles pels
  processos inquisitorials. Aquí <b>no</b> fem estadística sobre persones —la marca assenyala <b>llinatges, no
  portadors</b>, i <b>no entra a cap càlcul</b> d'isonímia—; només mirem <b>com es distribueixen aquests
  cognoms</b> avui. Diuen dues coses.</p>
  <p><b>a) La llista de 15 són, de fet, dues llistes.</b> Quin % de tots els portadors d'Espanya viu a Mallorca:</p>
  <div class="two">
    <div><table><thead><tr><th>Nucli gairebé exclusiu</th><th class="num">% a Mall.</th></tr></thead><tbody>
      ${xuNucleus.map(x=>`<tr><td>${cap(x.s)}</td><td class="num">${Math.round(x.share*100)}%</td></tr>`).join("")}
    </tbody></table></div>
    <div><table><thead><tr><th>Cognoms compartits</th><th class="num">% a Mall.</th></tr></thead><tbody>
      ${xuShared.map(x=>`<tr><td>${cap(x.s)}${x.origin==='castellà'?' <span class="ns">castellà</span>':''}</td><td class="num">${Math.round(x.share*100)}%</td></tr>`).join("")}
    </tbody></table></div>
  </div>
  <p class="result-box">El <b>nucli</b> (Forteza, Bonnín, Aguiló…) <b>gairebé no existeix fora de Mallorca</b>: són
  els cognoms xuetes en sentit estricte. Els <b>compartits</b> (Cortès, Segura, Martí, Valls…) són cognoms
  espanyols corrents on la branca xueta és una <b>minoria</b> —Cortès surt fins i tot «castellà». Això és,
  <b>mesurat</b>, per què la marca diu «llinatges que <i>inclouen</i> conversos, <b>no</b> que cada portador ho
  sigui».</p>
  <p><b>b) Palma, sí, però no un gueto.</b> Sobre el nucli exclusiu: <b>${pc(nucPalma)}</b> viu a Palma (l'illa
  és ${pc(palmaIsl)} Palma) —sobrerepresentació <b>modesta</b>, ressò del històric <b>Carrer de l'Argenteria</b>
  dels argenters. Per càpita, el senyal fort és a pobles concrets: ${nucPermil.map(x=>`<b>${x.m}</b> ${d1(x.pm)}‰`).join(" · ")}.
  Present a <b>${nucMunis}/${D.n_municipalities}</b> municipis: avui està <b>escampat</b>, no reclòs.</p>
  <p><b>c) Comunitat, no família: la diversitat de llinatges.</b> Comptem quants dels llinatges del nucli
  <b>conviuen</b> a cada poble i com de <b>repartits</b> estan (nº <i>efectiu</i>): molts i barrejats = comunitat
  arrelada; gairebé tot un sol cognom = una família.</p>
  <div class="two">
    <div><table><thead><tr><th>Més diversitat xueta</th><th class="num">llinatges</th><th class="num">nº&nbsp;efectiu</th></tr></thead><tbody>
      ${xuMixed.map(d=>`<tr><td>${d.m}</td><td class="num">${d.rich}</td><td class="num">${d1(d.eff)}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="result-box" style="align-self:start">A <b>Palma</b> hi conviuen <b>els 6</b> llinatges del nucli,
    i a Manacor o Marratxí 5, ben repartits: <b>comunitats</b> de fons antic. On gairebé tot és un sol cognom
    —<b>${xuFamily[0].m}</b> (${Math.round(xuFamily[0].topShare*100)}% ${cap(xuFamily[0].top)})${xuFamily[1]?`, ${xuFamily[1].m} (${Math.round(xuFamily[1].topShare*100)}% ${cap(xuFamily[1].top)})`:''}—
    és més aviat una <b>família</b>.</div>
  </div>
  <p>És el patró <b>contrari</b> al d'un assentament recent, que sol arribar concentrat en <b>pocs cognoms
  fundadors</b>. Mesurant com d'<b>uniformement</b> es reparteixen els portadors entre els cognoms d'un mateix
  grup a cada poble (1 = repartiment perfecte, independent de quants cognoms tingui el grup), els llinatges
  xuetes donen <b>${n2(evXu)}</b> i la immigració magrebina <b>${n2(evMag)}</b>: el fons xueta és una <b>vella
  soca barrejada</b> entre moltes cases, no un grapat de famílies fundadores.</p>
  <p class="hint" style="color:var(--muted)">Valleriola, un dels 15, ni apareix —cau sota el llindar ≥20 a
  Espanya de l'INE; és un llinatge gairebé extint. Tot això descriu la distribució dels <b>cognoms</b>, no fa
  cap afirmació sobre les persones que els porten avui.</p>

  <h3>8. L'altre extrem: la signatura de la immigració recent</h3>
  <p>Si el col·lectiu xueta mostra com es veu una <b>soca establerta de fa segles</b>, la immigració <b>recent</b>
  dibuixa la signatura contrària —i és, alhora, <b>on el cens veu menys</b>. Ho mirem amb els cognoms
  <b>magrebins</b>, el cas de migració laboral recent més net i mesurable (l'etiqueta «europeu» del cens barreja
  perfils molt diversos —del portuguès i l'est-europeu de treball al resident britànic o alemany— i no en fa un
  senyal únic). Com abans: descrivim <b>cognoms</b>, no persones, i <b>no toca cap estadística</b>.</p>
  <p class="result-box" style="border-color:var(--warn)">⚠ <b>La punta de l'iceberg.</b> Només en veiem
  <b>${magMass.toLocaleString('ca')}</b> portadors (${pc1(magMass/totMass)} de la massa), i <b>${magCur} dels
  ${magSurns.length}</b> cognoms només sobreviuen per la llista curada, per sota del top-20/país de l'INE. El
  llindar ≥20 a Espanya i el secret &lt;5 per poble <b>amaguen justament</b> les comunitats noves i concentrades.
  La població real és força més gran: això descriu una <b>signatura</b>, no un recompte.</p>
  <p><b>a) Efecte fundador: pocs cognoms, i dominants.</b> On la soca xueta repartia els portadors entre moltes
  cases, aquí uns pocs cognoms de <b>cadena migratòria</b> dominen: nº <i>efectiu</i> <b>${Math.round(magEff)}</b>
  de ${magSurns.length} presents, i els 10 primers ja fan el <b>${pc(magTop10)}</b>. La uniformitat entre cognoms
  cau a <b>${n2(evMag)}</b> (la xueta era ${n2(evXu)}), i hi ha pobles on gairebé tot és una família fundadora:
  <b>${magDom[0].m}</b> ${Math.round(magDom[0].topShare*100)}% ${cap(magDom[0].top)} · <b>${magDom[1].m}</b>
  ${Math.round(magDom[1].topShare*100)}% ${cap(magDom[1].top)}. Fins i tot es veu la fragmentació per
  <b>transliteració</b>: <i>Zouggaghi</i> i <i>Zougaghi</i> són el mateix cognom escrit de dues maneres —cosa que
  encara infracompta més.</p>
  <p><b>b) Geografia: al camp, i fuig de Palma.</b> El mirall exacte de la §7: els cognoms xuetes eren Palma i
  interior urbà; aquests es concentren als <b>pobles agrícoles del Pla</b>. Per càpita, el senyal és fortíssim a
  pobles concrets: ${magPermil.map(x=>`<b>${x.m}</b> ${d1(x.pm)}‰`).join(" · ")}. I <b>Palma només ${pc(magPalma)}</b>
  del grup, quan és el ${pc(POP['Palma']/islPop)} de l'illa: <b>infrarepresentat a la capital</b>, al revés de
  gairebé tothom —migració de treball al camp, no urbana. Present a ${magMunis}/${D.n_municipalities} municipis.</p>
  <p class="hint" style="color:var(--muted)">Dues immigracions separades per segles, signatures oposades: la
  vella, barrejada i escampada; la recent, concentrada en poques famílies i pobles —i mig invisible per a un cens
  pensat per a cognoms ja assentats. La marca d'origen no diu res de ningú: només descriu <b>on viu, avui</b>, la
  gent que porta cada cognom.</p>

  <h3>9. Límits honestos</h3>
  <ul>
    <li><b>Tot sobre el recompte municipal de l'INE</b> (taxa‰ × padró, ≥5 per poble; reconstrucció exacta). La
    llista de partida és el <b>cens nacional de l'INE</b> (${D.all.n_surnames.toLocaleString('ca')} cognoms ≥20 a
    Espanya presents a Mallorca). Límits: el secret amaga &lt;5 per poble (cobertura
    ${pc(Math.min(...cov))}–${pc(Math.max(...cov))}, Palma la pitjor) i la cua &lt;20 a Espanya queda fora.
    <b>Instantània 2025</b>, no sèrie temporal.</li>
    <li>El resultat fort és el <b>contrast</b>: sense filtre cap geografia, amb filtre geografia clara —prova que
    la homogeneïtat aparent és, en bona part, l'<b>estrat immigrant compartit</b>. Tot amb dades obertes, sense
    lexicon i sense inventar res.</li>
    <li>Els límits són reals i no permeten afirmacions demogràfiques fortes, sinó una tendència ben fonamentada.</li>
  </ul>`;
}

// --- sidebar surname search -----------------------------------------------
function snorm(s){ return (s||"").replace(/ñ/gi,"NI").normalize("NFKD")
  .replace(/[̀-ͯ]/g,"").replace(/[^a-z]/gi,"").toUpperCase(); }

function applySurname(query){
  const box=document.getElementById("result");
  const q=snorm(query);
  if(!q){ resetMarkers(); box.innerHTML=""; return; }
  const matched=Object.keys(D.by_surname).filter(k=>snorm(k).includes(q))
    .sort((a,b)=>(D.endemism[b].mall)-(D.endemism[a].mall)).slice(0,8);
  // aggregate frequency per municipality across matched surnames
  const muniFreq={};
  matched.forEach(sn=>D.by_surname[sn].forEach(([m,f])=>muniFreq[m]=(muniFreq[m]||0)+f));
  const max=Math.max(1,...Object.values(muniFreq));
  D.all.locs.forEach(l=>{
    const mk=MARKERS[l]; if(!mk) return;
    const f=muniFreq[l]||0;
    if(f){ mk.setStyle({fillColor:"#e0b03c",fillOpacity:.95,color:"#3a2c0a",weight:1.5});
      mk.setRadius(5+Math.sqrt(f)*1.4); mk.setTooltipContent(`${l} · ${f}`); }
    else { mk.setStyle({fillColor:"#39463d",fillOpacity:.3,color:"#000",weight:1}); mk.setRadius(4); mk.setTooltipContent(l); }
  });
  if(!matched.length){ box.innerHTML=`<p class="none">Cap cognom «${query}» al cens de 2025 (els ${D.all.n_surnames.toLocaleString('ca')} del cens de cognoms de l'INE).</p>`; return; }
  const heads=matched.map(sn=>{const e=D.endemism[sn];
    const kind=e.origin==='català'?'auto':e.origin==='castellà'?'cast':'none';
    return `<span class="sn ${kind}">${sn.replace(/_/g,' ')}</span>${e.xueta?' <span class="xu" title="«Xueta»: terme d\'origen despectiu, avui reapropiat i estàndard. Llinatge de la llista canònica de 15 que inclou descendents de conversos, no que cada portador ho sigui.">xueta</span>':''} <span class="lqv">LQ ${e.lq??'—'}</span> · ${e.mall.toLocaleString('ca')}${basisTag(e)}`;
  }).join("<br>");
  const munis=Object.entries(muniFreq).sort((a,b)=>b[1]-a[1])
    .map(([m,f])=>`<div class="mrow"><span class="mn">${m}</span><span class="mf">${f}</span></div>`).join("");
  box.innerHTML=`<div class="snhead">${heads}</div>
    <p class="hint">1r cognom, tots els municipis on hi és present (≥5 portadors · recompte INE 2025):</p><div class="mlist">${munis}</div>`;
}
function resetMarkers(){
  D.all.locs.forEach(l=>{const mk=MARKERS[l]; if(!mk) return;
    const st=D.muni_stats[l];
    mk.setStyle({fillColor:ramp(st.autoch),fillOpacity:.85,color:"#000",weight:1});
    mk.setRadius(radius(D.municipality_pop[l])); mk.setTooltipContent(l);});
}
function wireSearch(){
  const q=document.getElementById("q");
  q.addEventListener("input",()=>applySurname(q.value));
  const sugg=["Ferrer","Amengual","Cañellas","Garcia","Pons","Bauzá"];
  document.getElementById("suggest").innerHTML=sugg.map(s=>`<button>${s}</button>`).join("");
  document.querySelectorAll("#suggest button").forEach(b=>
    b.addEventListener("click",()=>{q.value=b.textContent;applySurname(q.value);}));
}

// --- sidebar: the headline Mantel contrast --------------------------------
function buildMantelContrast(){
  const a=D.all.mantel, u=D.auto.mantel, c=D.nonend.mantel;
  const sig=p=>p<0.05;
  document.getElementById("mantel-contrast").innerHTML = `
    <div class="row"><span class="lab">Tots els cognoms</span>
      <span class="val ${sig(a.p)?'sig':'ns'}">r=${a.r} · p=${a.p}</span></div>
    <div class="row"><span class="lab">Només no endèmics (LQ&lt;${D.lq_bands.auto})</span>
      <span class="val ${sig(c.p)?'sig':'ns'}">r=${c.r} · p=${c.p}</span></div>
    <div class="row"><span class="lab">Només autòctons (LQ≥${D.lq_bands.auto})</span>
      <span class="val ${sig(u.p)?'sig':'ns'}">r=${u.r} · p=${u.p}${sig(u.p)?' ✓':''}</span></div>
    <div class="note">Aïllament per distància (Mantel, ${a.n} municipis). L'estrat <b>no endèmic</b>
      (ubic) no té estructura per distància (r≈0); l'<b>autòcton</b> sí. Per això, amb <b>tot</b> junt, el
      senyal queda <b>diluït</b>.</div>`;
}

function buildLegend(){
  const el=document.getElementById("legend"); let h="";
  for(let i=0;i<5;i++){const t=i/4;
    h+=`<div class="row"><span class="sw" style="background:${ramp(t)}"></span>${Math.round(t*100)}%${i===0?' (no endèmic)':i===4?' (autòcton)':''}</div>`;}
  el.innerHTML=h;
}

function buildStats(){
  const nCat=Object.values(D.endemism).filter(e=>e.origin==='català').length;
  const cov=Object.values(D.coverage); const med=cov.slice().sort((a,b)=>a-b)[Math.floor(cov.length/2)];
  document.getElementById("stats").innerHTML = `
    <h2>Tall 2025</h2>
    <p><b>${D.n_municipalities}</b> municipis · pob. coberta <b>${D.pop_mallorca_covered.toLocaleString('ca')}</b>
    <br>cognoms (cens INE): <b>${D.all.n_surnames.toLocaleString('ca')}</b> · endèmics <b>${D.auto.n_surnames}</b> · origen català <b>${nCat}</b></p>
    <p><span class="r">⚠ cobertura</span>: mediana ${Math.round(med*100)}%
    (Palma només ${Math.round(Math.min(...cov)*100)}%). Recompte INE (≥5/poble); la cua &lt;5 queda oculta.</p>`;
}

// --- map ------------------------------------------------------------------
function radius(p){ return 5 + Math.sqrt(p)/9; }
function buildMap(){
  MAP=L.map("map",{zoomControl:true}).setView([39.62,2.98],9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {attribution:"© OpenStreetMap · cens de cognoms INE 2025 (APEL) · coords NGIB (IDEIB)",maxZoom:18,opacity:0.5}).addTo(MAP);
  D.all.locs.forEach(l=>{
    const c=D.coords[l]; if(!c) return;
    const st=D.muni_stats[l], pop=D.municipality_pop[l];
    const m=L.circleMarker([c[0],c[1]],{radius:radius(pop),color:"#000",weight:1,
      fillColor:ramp(st.autoch),fillOpacity:0.85}).addTo(MAP);
    m.bindTooltip(l,{direction:"top",className:"town-label"});
    m.bindPopup(()=>popup(l));
    MARKERS[l]=m;
  });
}
function popup(l){
  const st=D.muni_stats[l], pop=D.municipality_pop[l], cov=D.coverage[l];
  const tops=st.top.map(([s,f,lq])=>`${s} <span style="color:#95a89d">${f}${lq!=null?` · LQ ${lq}`:''}</span>`).join("<br>");
  return `<b>${l}</b><br>població ${pop.toLocaleString('ca')} · autoctonia <b style="color:${ramp(st.autoch)}">${Math.round(st.autoch*100)}%</b>`+
    `<br><span style="color:#95a89d">cobertura INE: ${Math.round(cov*100)}%</span>`+
    `<br><br><b>1rs cognoms:</b><br>${tops}`;
}

// --- endemism table -------------------------------------------------------
function buildEndem(){
  const el=document.getElementById("endem-body");
  const rows=Object.entries(D.endemism).map(([s,e])=>({s,mall:e.mall,spain:e.spain,lq:e.lq,
    lqc:e.lq_cat,lqb:e.lq_bal,lqv:e.lq_val,cs:e.cat_score,origin:e.origin,xueta:e.xueta,basis:e.origin_basis}));
  const cls=o=> o==="català"?"auto": o==="castellà"?"cast":"none";
  const nm=v=>v!=null?v:'—';
  const XUBADGE=`<span class="xu" title="«Xueta»: terme d'origen despectiu, avui reapropiat i estàndard. Llinatge de la llista canònica de 15 que INCLOU descendents de conversos jueus mallorquins — no que cada portador ho sigui. Vegeu Metodologia.">xueta</span>`;
  function render(list){
    return `<table><thead><tr><th>cognom</th><th class="num">Mall.</th>
      <th class="num">Esp.</th><th class="num">LQ Mall</th><th class="num">LQ Cat</th>
      <th class="num">LQ Bal</th><th class="num">LQ Val</th><th>origen</th><th>capa</th></tr></thead><tbody>`+
      list.map(r=>`<tr class="${cls(r.origin)}"><td>${r.s.replace(/_/g,' ')}${r.xueta?' '+XUBADGE:''}</td>
        <td class="num" data-v="${r.mall}">${r.mall.toLocaleString('ca')}</td>
        <td class="num" data-v="${r.spain??''}">${r.spain!=null?r.spain.toLocaleString('ca'):'—'}</td>
        <td class="num" data-v="${r.lq??''}">${nm(r.lq)}</td><td class="num" data-v="${r.lqc??''}">${nm(r.lqc)}</td><td class="num" data-v="${r.lqb??''}">${nm(r.lqb)}</td>
        <td class="num" data-v="${r.lqv??''}">${nm(r.lqv)}</td>
        <td style="color:${oc(r.origin)}">${r.origin}</td>
        <td data-v="${r.basis||''}">${basisTag({origin_basis:r.basis}).trim()}</td></tr>`).join("")+`</tbody></table>`;
  }
  el.innerHTML = `
    <p><b>Dos eixos diferents</b>, un per columna de la taula:</p>
    <div class="two" style="margin-bottom:12px">
      <div class="concept">
        <h4>Endemisme — mou la geografia</h4>
        <p><code>LQ Mall = (freq Mallorca / pob) / (freq Espanya / pob)</code></p>
        <p class="imp">Com de concentrat és el cognom a <b>l'illa</b> respecte d'Espanya. És l'eix que
        <b>ordena aquesta taula</b>.</p>
      </div>
      <div class="concept">
        <h4>Origen — català vs castellà</h4>
        <p>Concentració al <b>domini catalanoparlant</b>: <b>LQ Cat</b> (Catalunya), <b>LQ Bal</b> (Balears) i
        <b>LQ Val</b> (País Valencià), totes des de l'<b>API de cognoms de l'INE</b> (taxa per província).</p>
      </div>
    </div>
    <p class="hint" style="color:var(--muted)">Classificació d'origen: un cognom és
    <b style="color:var(--accent)">català</b> si <b>LQ Cat</b> o <b>LQ Bal ≥ ${D.lq_bands.origin}</b>,
    <b>o LQ Val ≥ ${D.lq_bands.val}</b> (llindar valencià més alt perquè el País Valencià té molt cognom
    castellà); <b style="color:var(--cast)">castellà</b> si surt a l'INE però no es concentra enlloc.
    Taula ordenada per LQ Mall.</p>
    <div class="caveat">⚠ Fixa't com l'origen <b>no</b> és l'endemisme: mesuren coses diferents. L'<b>origen</b>
    mira la concentració al domini català sencer (Principat/Balears/País Valencià): <b>Nebot</b> surt català
    sobretot per LQ Val 33; <b>Femenia/Miralles</b> per LQ Val altíssim tot i tenir LQ Cat baix. L'<b>endemisme</b>
    mira només Mallorca: <b>Muntaner</b> i <b>Pomar</b> hi són massissament concentrats (LQ Bal 28,8 i 12,5) —el
    recompte complet de l'INE els situa bé. I els dos eixos <b>divergeixen</b>:
    <b>El Khoumssi</b> té LQ Mall altíssim (Mallorca-endèmic) però <b>no</b> és català sinó magrebí → per això
    l'endemisme sol no basta i cal el filtre d'origen + forans.<br><br>
    ⚠ <b>Cognoms d'immigració recent</b> (Ayoubi, Bouhjira, El Khoumssi…) són, per freqüència, idèntics a un
    mallorquí endèmic (LQ Mall alt, absents de Catalunya). Es marquen <b>magrebí</b> amb una llista curada
    (l'INE per nacionalitat només en publica el top-20); <b>no</b> es confonen amb els d'ètim andalusí ja
    establerts fa segles (Bennàssar, Binimelis), que són autòctons.</div>
    <div class="caveat"><span class="xu">xueta</span> <b>Marca històrica, no estadística.</b> Marca els 15
    llinatges canònics descendents dels conversos jueus mallorquins (Aguiló, Bonnín, Cortès, Fortesa, Fuster,
    Martí, Miró, Picó, Pinya, Pomar, Segura, Tarongí, Valentí, Valleriola, Valls). <b>No</b> entra a cap
    estadística i és <b>ortogonal</b> a català/castellà. Marca llinatges que <b>inclouen</b> descendents de
    conversos, <b>no</b> que cada portador ho sigui. El terme, la seva història i els límits: a la pestanya
    <b>Metodologia</b>.</div>
    <div class="mn-bar"><input id="eq" type="search" style="flex:1;min-width:200px;margin:0"
      placeholder="cerca un cognom… (p.ex. Garcia, Ferrer, Amengual)">
      <button class="dl" id="en-dl">Baixar taula de cognoms (CSV)</button></div>
    <div id="etable">${render(rows)}</div>`;
  const q=document.getElementById("eq"), t=document.getElementById("etable");
  q.addEventListener("input",()=>{
    const v=q.value.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"");
    t.innerHTML=render(rows.filter(r=>r.s.toLowerCase().includes(v)));
  });
  document.getElementById("en-dl").addEventListener("click",()=>{
    const out=[["cognom","Mallorca","Espanya","LQ_Mallorca","LQ_Catalunya","LQ_Balears","LQ_Valencia","cat_score","origen","xueta"]];
    rows.forEach(r=>out.push([r.s.replace(/_/g,' '),r.mall,r.spain??"",r.lq??"",r.lqc??"",r.lqb??"",r.lqv??"",r.cs??"",r.origin,r.xueta?"si":""]));
    downloadCSV("cognoms_endemisme_origen_mallorca_2025.csv", out);
  });
}

// --- isonymy comparison ---------------------------------------------------
function drawTree(dendro, autochOf){
  const n=dendro.ivl.length, padL=140,padR=16,padT=8,padB=8,rowH=15;
  const W=560,H=padT+padB+n*rowH;
  const icoordMax=10*n, dcoordMax=Math.max(...dendro.dcoord.map(s=>Math.max(...s)))||1;
  const sx=d=>padL+(d/dcoordMax)*(W-padL-padR), sy=i=>padT+(i/icoordMax)*(H-padT-padB);
  let h=`<svg class="tree" viewBox="0 0 ${W} ${H}" height="${H}">`;
  dendro.icoord.forEach((ic,k)=>{const dc=dendro.dcoord[k];
    const pts=[0,1,2,3].map(j=>`${sx(dc[j]).toFixed(1)},${sy(ic[j]).toFixed(1)}`).join(" ");
    h+=`<polyline points="${pts}" fill="none" stroke="#3d5145" stroke-width="1.1"/>`;});
  dendro.ivl.forEach((name,i)=>{const y=sy(10*i+5);
    h+=`<circle cx="${padL}" cy="${y.toFixed(1)}" r="3.5" fill="${ramp(autochOf(name))}" stroke="#000"/>`+
       `<text x="${padL-7}" y="${(y+3).toFixed(1)}" text-anchor="end" class="tree-lab">${name}</text>`;});
  return h+"</svg>";
}
// MDS scatter: the Lasker-distance table projected to 2D — towns close together share
// surnames. Orientation (rotation/mirror) is arbitrary, so no axes are drawn. Dot colour =
// autochthony, radius ~ sqrt(population). To fight the central crowding WITHOUT distorting
// the geometry: only the distinctive towns (farthest from the centroid) + the big ones are
// labelled by default; every dot has a native <title> tooltip; and the plot is zoom/pan-able
// (initMDS) — zooming in spreads the centre and reveals the hidden labels.
function drawMDS(mds, locs, autochOf, regColOf){
  const W=760,H=470,pad=46;
  const xs=mds.map(p=>p[0]), ys=mds.map(p=>p[1]);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const sx=v=>pad+((v-x0)/((x1-x0)||1))*(W-2*pad);
  const sy=v=>pad+((v-y0)/((y1-y0)||1))*(H-2*pad);
  const P=mds.map(p=>[sx(p[0]),sy(p[1])]);
  const cx0=P.reduce((s,p)=>s+p[0],0)/P.length, cy0=P.reduce((s,p)=>s+p[1],0)/P.length;
  const dist=P.map(p=>Math.hypot(p[0]-cx0,p[1]-cy0));
  const cut=[...dist].sort((a,b)=>a-b)[Math.floor(dist.length*0.55)]; // farthest ~45% shown by default
  let dots="",labs="";
  mds.forEach((p,i)=>{const cx=P[i][0],cy=P[i][1],nm=locs[i];
    const r=Math.min(3+Math.sqrt(D.municipality_pop[nm]||0)/70,11);
    const rii=(D.auto.Rii&&D.auto.Rii[nm]!=null)?` · Rii ${D.auto.Rii[nm].toFixed(5)}`:"";
    const cAuto=ramp(autochOf(nm)), cReg=regColOf?regColOf(nm):cAuto;
    dots+=`<circle data-i="${i}" data-cauto="${cAuto}" data-creg="${cReg}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${cReg}" `+
          `fill-opacity=".85" stroke="#000" stroke-width=".6"><title>${nm}${rii}</title></circle>`;
    const far=dist[i]>=cut||r>7;
    labs+=`<text data-i="${i}" x="${cx.toFixed(1)}" y="${(cy-r-2).toFixed(1)}" text-anchor="middle" class="mds-lab ${far?'far':'near'}">${nm}</text>`;});
  return `<svg class="mds" viewBox="0 0 ${W} ${H}" data-vb="0 0 ${W} ${H}" style="--z:1">`+
         `<g class="mds-dots">${dots}</g><g class="mds-labs">${labs}</g></svg>`;
}
// Wheel = zoom toward cursor, drag = pan, double-click = reset. Pure viewBox manipulation
// (no distortion). Label font is scaled by 1/zoom (via --z) so labels keep constant screen
// size, and the class "zm" (set past ~1.5×) reveals the labels hidden by default.
function initMDS(svg){
  if(!svg) return;
  const [X0,Y0,W0,H0]=svg.getAttribute("data-vb").split(" ").map(Number);
  let vb={x:X0,y:Y0,w:W0,h:H0};
  const clamp=()=>{vb.x=Math.max(X0,Math.min(X0+W0-vb.w,vb.x));vb.y=Math.max(Y0,Math.min(Y0+H0-vb.h,vb.y));};
  const apply=()=>{svg.setAttribute("viewBox",`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const z=W0/vb.w; svg.style.setProperty("--z",z); svg.classList.toggle("zm",z>1.5);};
  const toSvg=e=>{const r=svg.getBoundingClientRect();
    return {x:vb.x+(e.clientX-r.left)/r.width*vb.w, y:vb.y+(e.clientY-r.top)/r.height*vb.h};};
  svg.addEventListener("wheel",e=>{e.preventDefault(); const m=toSvg(e), f=e.deltaY<0?0.85:1/0.85;
    let nw=Math.max(W0*0.12,Math.min(W0,vb.w*f)); const nh=nw*(H0/W0);
    vb.x=m.x-(m.x-vb.x)*(nw/vb.w); vb.y=m.y-(m.y-vb.y)*(nh/vb.h); vb.w=nw; vb.h=nh; clamp(); apply();},{passive:false});
  // click a bubble (a press that didn't drag) → pin its town name + highlight the dot
  const pick=e=>{const el=document.elementFromPoint(e.clientX,e.clientY);
    const c=el&&el.closest&&el.closest("circle[data-i]"); if(!c)return;
    const i=c.getAttribute("data-i"), on=c.classList.toggle("sel");
    const lab=svg.querySelector(`.mds-lab[data-i="${i}"]`); if(lab)lab.classList.toggle("pin",on);};
  let drag=null,moved=false;
  svg.addEventListener("pointerdown",e=>{drag={x:e.clientX,y:e.clientY,vx:vb.x,vy:vb.y}; moved=false;
    svg.setPointerCapture(e.pointerId); svg.classList.add("grab");});
  svg.addEventListener("pointermove",e=>{if(!drag)return;
    if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)moved=true; const r=svg.getBoundingClientRect();
    vb.x=drag.vx-(e.clientX-drag.x)/r.width*vb.w; vb.y=drag.vy-(e.clientY-drag.y)/r.height*vb.h; clamp(); apply();});
  const end=e=>{if(drag&&!moved)pick(e); drag=null; svg.classList.remove("grab");};
  svg.addEventListener("pointerup",end); svg.addEventListener("pointercancel",()=>{drag=null;svg.classList.remove("grab");});
  svg.addEventListener("dblclick",()=>{vb={x:X0,y:Y0,w:W0,h:H0}; apply();
    svg.querySelectorAll(".sel").forEach(c=>c.classList.remove("sel"));
    svg.querySelectorAll(".mds-lab.pin").forEach(l=>l.classList.remove("pin"));});
}
function buildIso(){
  const a=D.all.mantel,u=D.auto.mantel,c=D.nonend.mantel;
  const autochOf=l=>(D.muni_stats[l]||{autoch:0}).autoch;
  const verdict=m=>m.p<0.05?'<b class="sig">significatiu</b>':'<b class="ns">nul</b>';
  // random-isonymy inbreeding coefficient F = Rii_unb / 4 (Crow & Mange) per town
  const RU=D.auto.Rii_unb, POPi=D.municipality_pop, f3=x=>(x*1000).toFixed(2).replace('.',',');
  const Fr=Object.entries(RU).map(([m,v])=>({m,F:v/4,pop:POPi[m]||0})).filter(x=>x.pop>0);
  const Fhi=Fr.slice().sort((x,y)=>y.F-x.F).slice(0,6);
  const Flo=Fr.slice().sort((x,y)=>x.F-y.F).slice(0,4);
  const Fisl=Object.values(D.auto.Rii).reduce((s,v)=>s+v,0)/Object.keys(D.auto.Rii).length/4;
  document.getElementById("iso-body").innerHTML = `
    <p>Isonímia de Cavalli-Sforza (R<sub>ii</sub>, distància de Lasker, MDS, arbre UPGMA, Mantel) sobre
    municipis, en <b>tres versions</b> per respondre la pregunta clau: <i>l'estrat no endèmic (ubic), té
    estructura geogràfica pròpia o no?</i></p>
    <div class="three">
      <div class="card"><h3>Tots (${D.all.n_surnames})</h3>
        <div class="m">Mantel r=<b class="${a.p<0.05?'sig':'ns'}">${a.r}</b>, p=${a.p} — ${verdict(a)}.</div>
        ${drawTree(D.all.dendro,autochOf)}</div>
      <div class="card"><h3>No endèmics (${D.nonend.n_surnames}, LQ&lt;${D.lq_bands.auto})</h3>
        <div class="m">Mantel r=<b class="${c.p<0.05?'sig':'ns'}">${c.r}</b>, p=${c.p} — ${verdict(c)}.
        Arbre <b>pla</b>: cap estructura per distància.</div>
        ${drawTree(D.nonend.dendro,autochOf)}</div>
      <div class="card"><h3>Autòctons (${D.auto.n_surnames}, LQ≥${D.lq_bands.auto})</h3>
        <div class="m">Mantel r=<b class="${u.p<0.05?'sig':'ns'}">${u.r}</b>, p=${u.p} — ${verdict(u)}.
        Emergeix estructura geogràfica.</div>
        ${drawTree(D.auto.dendro,autochOf)}</div>
    </div>
    <div class="caveat"><b>Comprovat (resposta a «estan homogèniament distribuïts?»):</b> l'arbre i el Mantel
    de l'estrat <b>no endèmic</b> (r=${c.r}, p=${c.p}) confirmen que <b>no</b> té aïllament per distància — no és
    que sigui uniforme (es concentra a Palma/costa), sinó que la seva variació és un gradient centre-perifèria,
    <b>no</b> una estructura fina. L'autòcton sí. Recorda: «no endèmic» és una barreja de castellà i de català
    peninsular escampat, no un estrat «castellà» pur. Fulles acolorides per autoctonia del municipi.
    R<sub>ii</sub>/distàncies es calculen sobre els <b>recomptes municipals de l'INE</b> (taxa‰ × padró
    del municipi, cada poble amb ≥5 portadors) i sobre el <b>cens complet de l'INE</b> (${D.all.n_surnames.toLocaleString('ca')}
    cognoms). El Mantel dels autòctons queda en <b>${u.r}</b>, significatiu.
    Límit que queda: el secret estadístic amaga &lt;5 per poble.</div>

    <h3 class="osub">Com de tancat és cada poble? El coeficient d'endogàmia (F)</h3>
    <p>La isonímia té un número clàssic de genètica de poblacions (Crow &amp; Mange): la <b>isonímia
    aleatòria</b> —la probabilitat que dues persones a l'atzar del poble comparteixin el 1r cognom— dividida per
    4 estima el <b>coeficient de consanguinitat (F)</b> del municipi. Com més alt, més <b>tancat</b> ha estat el
    poble (menys cognoms, més repetits). No és consanguinitat individual: és una <b>signatura històrica</b>
    d'aïllament que confirma, amb el número estàndard, el que diu la conclusió §2 —com més petit el poble, més
    tancat.</p>
    <div class="two">
      <div><table><thead><tr><th>Més tancats</th><th class="num">F (×10⁻³)</th><th class="num">pob.</th></tr></thead><tbody>
        ${Fhi.map(x=>`<tr><td>${x.m}</td><td class="num">${f3(x.F)}</td><td class="num">${x.pop.toLocaleString('ca')}</td></tr>`).join("")}
      </tbody></table></div>
      <div><table><thead><tr><th>Més oberts</th><th class="num">F (×10⁻³)</th><th class="num">pob.</th></tr></thead><tbody>
        ${Flo.map(x=>`<tr><td>${x.m}</td><td class="num">${f3(x.F)}</td><td class="num">${x.pop.toLocaleString('ca')}</td></tr>`).join("")}
      </tbody></table></div>
    </div>
    <p class="hint" style="color:var(--muted)">Mitjana de l'illa ≈ ${f3(Fisl)}×10⁻³. <b>${Fhi[0].m}</b>
    (${f3(Fhi[0].F)}) és ~${Math.round(Fhi[0].F/Flo[0].F)}× més tancat que <b>${Flo[0].m}</b> (${f3(Flo[0].F)}):
    pobles petits de l'interior a dalt, Palma i la costa turística a baix. F = R<sub>ii</sub> no esbiaixada ÷ 4;
    valors petits (~10⁻³) i <b>relatius</b>, no consanguinitat literal.</p>`;
}

// --- MDS tab: the Lasker-distance table projected to an interactive 2D scatter ------------
function buildMDS(){
  const u=D.auto.mantel;
  const autochOf=l=>(D.muni_stats[l]||{autoch:0}).autoch;
  // --- region colouring (fcluster of the endemic isonymy tree, from the JSON) ---
  const REG=D.auto.region, groups={};
  Object.entries(REG).forEach(([t,c])=>{(groups[c]=groups[c]||[]).push(t);});
  const bySize=Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
  const PAL=["#6b8cae","#e0913c","#5aa46a","#a877cf","#d05a52","#3fa8a0","#c9a13b"];
  const regCol={}; bySize.forEach(([id],k)=>regCol[id]=PAL[k%PAL.length]);
  const regColOf=t=>regCol[REG[t]]||"#888";
  const nameFor=(towns)=> towns.length===1?towns[0]
      : towns.includes('Sóller')?'Vall de Sóller'
      : towns.includes('Manacor')?'Llevant–Migjorn'
      : towns.includes('Palma')?'Nucli connectat'
      : towns.includes('Andratx')?'Andratx–Puigpunyent'
      : towns.slice(0,2).join(', ');
  const regLegend=bySize.map(([id,towns])=>
    `<span class="oleg"><span class="sw" style="background:${regCol[id]}"></span>${nameFor(towns)} <b>${towns.length}</b></span>`).join(" ");
  document.getElementById("mds-body").innerHTML = `
    <h2>MDS — mapa de semblança entre pobles</h2>
    <p class="lead">La taula de distàncies de Lasker (estrat <b>autòcton</b>, ${D.auto.n_surnames} cognoms
    endèmics) projectada a un pla 2D: <b>com més a prop dos pobles, més s'assemblen pels cognoms</b>. No és un
    mapa geogràfic —l'orientació és arbitrària—; el color agrupa els pobles per <b>regió</b> (el tall de l'arbre
    d'isonímia en 6 grups) i la mida ~ població. Que els pobles s'agrupin per color <b>i</b> per posició és la
    mateixa estructura que capta el <b>Mantel (r=${u.r}, p=${u.p})</b>.</p>
    <div class="mn-bar" style="align-items:center">
      <span class="hint" style="margin:0">Color:</span>
      <span id="mds-toggle">
        <button class="tog active" data-k="creg">per regió</button>
        <button class="tog" data-k="cauto">per autoctonia</button>
      </span>
    </div>
    <div id="mds-legend-reg" class="oleglist" style="margin:6px 0">${regLegend}</div>
    <div id="mds-legend-auto" class="oleglist" style="margin:6px 0;display:none">
      <span class="oleg"><span class="sw" style="background:${ramp(1)}"></span>autòcton</span>
      <span class="oleg"><span class="sw" style="background:${ramp(0)}"></span>no endèmic</span></div>
    <p class="hint" style="color:var(--muted)"><span style="color:var(--accent)">↔ Clica una bombolla per
    fixar-ne el nom · roda del ratolí per apropar · arrossega per moure · doble clic per reiniciar.</span>
    De base només s'etiqueten els pobles distintius; clica (o passa-hi el ratolí) per identificar qualsevol
    punt, i en apropar-te apareixen les etiquetes del nucli central.</p>
    ${drawMDS(D.auto.mds, D.auto.locs, autochOf, regColOf)}
    <div class="caveat">La <b>vall de Sóller</b> i la banda de <b>Llevant-Migjorn</b> salten com a grups nets;
    la resta és un <b>nucli connectat</b>, amb un parell de solitaris a les vores (Banyalbufar, Maria de la
    Salut) que comparteixen pocs cognoms amb ningú → Rii alt. Canvia a <b>autoctonia</b> per veure el gradient
    verd→vermell. Calculat sobre els recomptes municipals de l'INE (≥5 per poble), estrat autòcton (LQ≥${D.lq_bands.auto}).</div>`;
  const svg=document.querySelector("#mds-body svg.mds");
  initMDS(svg);
  document.querySelectorAll("#mds-toggle button").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll("#mds-toggle button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    const reg=b.dataset.k==="creg";
    svg.querySelectorAll("circle[data-i]").forEach(c=>c.setAttribute("fill",reg?c.dataset.creg:c.dataset.cauto));
    document.getElementById("mds-legend-reg").style.display=reg?"":"none";
    document.getElementById("mds-legend-auto").style.display=reg?"none":"";
  }));
}

// --- methodology ----------------------------------------------------------
// robustness curve: Mantel r (left axis) and full-matrix correlation (right axis) vs top-N per town
function drawConvergence(tc){
  const rows=tc.rows, n=rows.length, rf=tc.r_full;
  const W=720,H=320,pl=52,pr=54,pt=20,pb=48, iw=W-pl-pr, ih=H-pt-pb;
  const X=i=>pl+(n>1?i/(n-1):0)*iw, yR=v=>pt+ih-(v/0.5)*ih, yC=v=>pt+ih-v*ih;
  const CR="#e0913c", CC="#6b8cae", MUT="#95a89d";
  let g="";
  [0,0.1,0.2,0.3,0.4,0.5].forEach(v=>{const y=yR(v);
    g+=`<line x1="${pl}" y1="${y.toFixed(1)}" x2="${pl+iw}" y2="${y.toFixed(1)}" stroke="#ffffff" stroke-opacity=".07"/>`+
       `<text x="${pl-8}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="${CR}" font-size="10">${v.toFixed(1)}</text>`;});
  [0,0.25,0.5,0.75,1].forEach(v=>g+=`<text x="${pl+iw+8}" y="${(yC(v)+3).toFixed(1)}" text-anchor="start" fill="${CC}" font-size="10">${v.toFixed(2)}</text>`);
  let xl="";
  rows.forEach((r,i)=>xl+=`<text x="${X(i).toFixed(1)}" y="${(pt+ih+16).toFixed(1)}" text-anchor="middle" fill="${MUT}" font-size="10">${r.n||'complet'}</text>`);
  xl+=`<text x="${(pl+iw/2).toFixed(1)}" y="${(pt+ih+38).toFixed(1)}" text-anchor="middle" fill="${MUT}" font-size="11">top-N cognoms més freqüents per municipi</text>`;
  const yrf=yR(rf);
  const ref=`<line x1="${pl}" y1="${yrf.toFixed(1)}" x2="${pl+iw}" y2="${yrf.toFixed(1)}" stroke="${CR}" stroke-dasharray="4 4" stroke-opacity=".6"/>`+
    `<text x="${pl+iw}" y="${(yrf-5).toFixed(1)}" text-anchor="end" fill="${CR}" font-size="10">cens complet · r=${rf.toFixed(2).replace('.',',')}</text>`;
  const poly=(key,y,c)=>`<polyline points="${rows.map((r,i)=>`${X(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2"/>`;
  const dots=(key,y,c,lab)=>rows.map((r,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${y(r[key]).toFixed(1)}" r="3" fill="${c}"><title>top-${r.n||'complet'} · ${lab}=${r[key]}</title></circle>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;margin:6px 0">
    ${g}${ref}
    ${poly('mcorr',yC,CC)}${poly('r',yR,CR)}
    ${dots('mcorr',yC,CC,'corr. matriu')}${dots('r',yR,CR,'Mantel r')}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt+ih}" stroke="#ffffff" stroke-opacity=".25"/>
    <line x1="${pl}" y1="${pt+ih}" x2="${pl+iw}" y2="${pt+ih}" stroke="#ffffff" stroke-opacity=".25"/>
    ${xl}
    <g font-size="11"><rect x="${pl+10}" y="${pt+4}" width="10" height="10" fill="${CR}"/>
      <text x="${pl+24}" y="${pt+13}" fill="${CR}">Mantel r (aïllament per distància, eix esq.)</text>
      <rect x="${pl+10}" y="${pt+20}" width="10" height="10" fill="${CC}"/>
      <text x="${pl+24}" y="${pt+29}" fill="${CC}">correlació amb la matriu completa (eix dret)</text></g>
  </svg>`;
}
// biparental agreement: each town-PAIR's Lasker distance on the paternal line (x) vs the
// maternal-grandfather line (y). A tight diagonal cloud IS the agreement Mantel r — two
// independent surname censuses drawing the same map. A and B are the two 51×51 Lasker
// matrices (same town order); r is the agreement correlation for the annotation.
function drawBipScatter(A,B,r){
  const n=A.length, pts=[];
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)pts.push([A[i][j],B[i][j]]);
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  const lo=Math.min(Math.min(...xs),Math.min(...ys)), hi=Math.max(Math.max(...xs),Math.max(...ys));
  const S=440,pad=52,rp=14,tp=14,iw=S-pad-rp,ih=S-pad-tp-24;
  const sx=v=>pad+((v-lo)/((hi-lo)||1))*iw, sy=v=>tp+ih-((v-lo)/((hi-lo)||1))*ih;
  const AC="#6b8cae", MUT="#95a89d";
  let ax="";
  for(let t=0;t<=4;t++){const v=lo+(hi-lo)*t/4;
    ax+=`<text x="${(pad-8).toFixed(1)}" y="${(sy(v)+3).toFixed(1)}" text-anchor="end" fill="${MUT}" font-size="10">${v.toFixed(1).replace('.',',')}</text>`
      + `<text x="${sx(v).toFixed(1)}" y="${(tp+ih+16).toFixed(1)}" text-anchor="middle" fill="${MUT}" font-size="10">${v.toFixed(1).replace('.',',')}</text>`;}
  const diag=`<line x1="${sx(lo).toFixed(1)}" y1="${sy(lo).toFixed(1)}" x2="${sx(hi).toFixed(1)}" y2="${sy(hi).toFixed(1)}" stroke="${MUT}" stroke-dasharray="4 4" stroke-opacity=".7"/>`;
  const dots=pts.map(p=>`<circle cx="${sx(p[0]).toFixed(1)}" cy="${sy(p[1]).toFixed(1)}" r="2.1" fill="${AC}" fill-opacity=".26"/>`).join("");
  return `<svg viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px;height:auto;margin:6px 0">
    ${diag}${dots}${ax}
    <line x1="${pad}" y1="${tp}" x2="${pad}" y2="${(tp+ih).toFixed(1)}" stroke="#ffffff" stroke-opacity=".25"/>
    <line x1="${pad}" y1="${(tp+ih).toFixed(1)}" x2="${(pad+iw).toFixed(1)}" y2="${(tp+ih).toFixed(1)}" stroke="#ffffff" stroke-opacity=".25"/>
    <text x="${(pad+iw/2).toFixed(1)}" y="${(tp+ih+38).toFixed(1)}" text-anchor="middle" fill="${MUT}" font-size="11">distància Lasker · línia paterna (1r cognom)</text>
    <text transform="translate(14,${(tp+ih/2).toFixed(1)}) rotate(-90)" text-anchor="middle" fill="${MUT}" font-size="11">línia materna (2n cognom)</text>
    <text x="${(pad+iw-4).toFixed(1)}" y="${(tp+16).toFixed(1)}" text-anchor="end" fill="${AC}" font-size="12">r=${String(r).replace('.',',')} · ${(n*(n-1)/2)} parells</text>
  </svg>`;
}
function buildMethod(){
  const cov=Object.values(D.coverage);
  const B=D.biparental;
  const TC=D.topn_convergence, tcr=n=>(TC.rows.find(r=>r.n===n)||{}).r;
  const d2=x=>x.toFixed(2).replace('.',','), cc=x=>String(x).replace('.',',');
  const tcTable=TC.rows.map(r=>`<tr${r.n===50?' style="color:#e0b070"':''}><td class="num">${r.n||'complet'}</td>`+
    `<td class="num">${cc(r.r)}</td><td class="num">${cc(r.mcorr)}</td><td class="num">${r.k}</td></tr>`).join("");
  document.getElementById("metod-body").innerHTML = `
    <h2>Metodologia i límits</h2>
    <p class="lead">Prova seriosa de si es pot fer isonímia actual de Mallorca separant el fons
    autòcton (endèmic) de l'estrat ubic/no endèmic, <b>sense lexicon onomàstic</b> i només amb dades obertes.</p>

    <h3>Conceptes estadístics</h3>
    <p class="hint" style="color:var(--muted)">Definició i interpretació dels estadístics que es fan servir al
    llarg del projecte.</p>
    <div class="concepts">
      <div class="concept">
        <h4>Isonímia = compartir cognom</h4>
        <p>Dues persones amb el mateix cognom solen compartir un avantpassat. Comptar els cognoms que
        comparteixen dos pobles (o que es repeteixen dins d'un) és un <b>indicador indirecte de parentiu</b>
        sense necessitat d'ADN: el cognom es transmet per via paterna, com el cromosoma Y (Cavalli-Sforza).</p>
        <p class="imp"><b>Implica:</b> molts cognoms compartits entre dos pobles → hi ha hagut matrimonis i
        migració entre ells.</p>
      </div>
      <div class="concept">
        <h4>R<sub>ii</sub> — índex d'aïllament</h4>
        <p>Probabilitat que dues persones a l'atzar <b>del mateix poble</b> tinguin el mateix primer cognom
        (<code>Rii = Σ pₖ²</code>, on pₖ és la proporció de cada cognom).</p>
        <p class="imp"><b>Alt</b> = pocs cognoms dominen → poble <b>tancat/endogàmic</b> (Sa Pobla, llogarets
        aïllats). <b>Baix</b> = molts cognoms → poble <b>obert i barrejat</b> (Palma).</p>
      </div>
      <div class="concept">
        <h4>Distància de Lasker — entre dos pobles</h4>
        <p>Com de «lluny» estan dos pobles segons els cognoms que <b>no</b> comparteixen. 0 = mateix repertori
        de cognoms; alta = gairebé no en comparteixen cap.</p>
        <p class="imp"><b>Implica:</b> distància petita → els dos pobles han intercanviat població; distància
        gran → han estat aïllats l'un de l'altre.</p>
      </div>
      <div class="concept">
        <h4>Test de Mantel (r, p) — aïllament per distància</h4>
        <p>Pregunta: els pobles <b>a prop en quilòmetres</b> tenen també cognoms més semblants? <b>r</b> va de
        0 (cap relació) a 1 (relació total); <b>p</b> és la probabilitat que sigui casualitat (p&lt;0,05 = real).</p>
        <p class="imp"><b>En aquest projecte:</b> estrat autòcton r≈${D.auto.mantel.r}, p=${D.auto.mantel.p} →
        estructura geogràfica significativa (aparellament de proximitat, endogàmia local). El conjunt complet
        de cognoms: r≈${D.all.mantel.r} → l'estrat d'immigració l'esvaeix.</p>
      </div>
      <div class="concept">
        <h4>LQ — quocient de localització</h4>
        <p>Com de concentrat està un cognom en una zona respecte a la mitjana espanyola.
        <code>LQ = taxa local / taxa Espanya</code>. LQ=1 → igual que pertot; LQ=10 → deu vegades més
        concentrat aquí.</p>
        <p class="imp"><b>Implica:</b> LQ_Mallorca alt = cognom <b>endèmic</b> de l'illa (Cañellas, Bestard).
        És el filtre que separa el fons autòcton del soroll ubic.</p>
      </div>
      <div class="concept">
        <h4>MDS i dendrograma — dibuixar les distàncies</h4>
        <p>Dues maneres de <b>veure</b> la taula de distàncies de Lasker. El <b>MDS</b> és un mapa 2D on els
        pobles semblants queden a prop; el <b>dendrograma</b> és un arbre que agrupa els pobles que s'assemblen.</p>
        <p class="imp"><b>Implica:</b> branques que s'ajunten aviat = pobles amb cognoms molt semblants (mateixa
        «família»).</p>
      </div>
    </div>

    <h3>1. Dades (totes obertes)</h3>
    <p><b>INE — API de cognoms</b> (operació APEL, la mateixa del cercador d'ine.es) — <b>una sola font</b> per a
    tot: (a) el <b>total nacional</b> de cada cognom ≥20 a Espanya → la <b>llista</b> de partida
    (${D.all.n_surnames.toLocaleString('ca')} cognoms presents a Mallorca); (b) la <b>taxa per província</b>
    (<code>mapaWidget&amp;tipo=1</code>) → l'eix català/castellà de l'origen (Capa 3); (c) la <b>taxa per
    municipi</b> (<code>mapaWidget&amp;vista=muni</code>) → reconstrucció dels <b>recomptes municipals</b>
    (taxa‰ × padró, ≥5 per poble; reconstrucció exacta, la taxa‰ surt d'aquest mateix padró) sobre els quals es
    calcula <b>tota l'anàlisi</b> (isonímia, endemisme, composició i navegador). Població: <b>padró INE</b>
    (operació 22, taula 2860). Coordenades: NGIB.</p>
    <p class="hint" style="color:var(--muted)">L'eix <b>català/castellà</b> (Capa 3) ve tot de l'API de l'INE per
    província —una sola font, sense barreja de fonts heterogènies—, i el recompte complet capta bé cognoms com
    Muntaner i Pomar. La <b>marca de forà</b> (Capa 2) hi afegeix les llistes INE de nacionalitat i una llista
    curada; vegeu-ho detallat a sota.</p>

    <h3>2. Endemisme (mesura) i origen (3 capes)</h3>
    <p><b>Endemisme</b> — l'eix que mou la geografia i que alimenta la isonímia:
    <code>LQ Mall = (freq_Mallorca/pob)/(freq_Espanya/pob)</code>. LQ≫1 = cognom concentrat a l'illa. És
    <b>mesura directa</b> de dades de l'INE i és l'<b>únic</b> que fan servir els estadístics d'aquest estudi.</p>

    <p><b>Origen</b> (català / castellà / forà) és <b>una altra cosa</b>, i és la part delicada: a ningú li agrada
    veure «el seu» cognom etiquetat. Per això <b>no</b> donem un veredicte opac. L'origen es construeix en
    <b>tres capes de força probatòria decreixent</b>, cadascuna <b>marcada a cada cognom</b> (cerca'l a la barra
    lateral i veuràs l'etiqueta de la capa que ho ha decidit). Punt clau: <b>cap capa d'origen alimenta les
    estadístiques</b> — la isonímia i l'aïllament per distància van només per endemisme. L'origen és
    <b>color descriptiu</b>, no un resultat.</p>

    <p><b>Capa 1 · Mesurat (INE, reproduïble).</b> No és una etiqueta d'origen, és el substrat: la concentració
    Mallorca-vs-Espanya (LQ) i les <b>taxes per província</b> (LQ Cat/Bal/Val, de l'API de l'INE), més la
    freqüència nacional. Aritmètica pura sobre taules de l'INE; qualsevol la refà idèntica, sense cap judici.</p>

    <p><b>Capa 2 · Marca de forà (curada, revisable).</b> Un senyal binari d'<b>immigració recent</b>, amb dues
    procedències que <b>distingim</b>: <span class="basis">llista INE nacionalitat</span> = el cognom surt a
    «Apellidos por nacionalidad» de l'INE (top-20 del país, <b>dada directa INE</b>); <span class="basis">llista
    curada</span> = la cua per sota d'aquest top-20, marcada a mà (<b>coneixement onomàstic, NO INE</b>, i
    auditable). Cal perquè un cognom marroquí recent i un de mallorquí vell són <b>indistingibles per la
    distribució de l'INE</b> (tots dos concentrats a Mallorca). Exclou a posta el fons andalusí de fa segles
    (Bennàssar, Binimelis): no és arribada recent.</p>

    <p><b>Capa 3 · Proxy de concentració (inferència, DESCRIPTIVA).</b> català vs castellà per
    sobrerepresentació a les províncies catalanoparlants (LQ Cat/Bal ≥ ${D.lq_bands.origin}, o LQ Val ≥
    ${D.lq_bands.val}, més alt perquè el País Valencià té molt cognom castellà per la repoblació aragonesa). És un
    proxy de <b>domini lingüístic, NO d'etimologia</b>: «català» vol dir <i>«concentrat a les terres de parla catalana
    segons l'INE»</i>, res sobre l'arrel del cognom. Corre <b>només</b> sobre el que la Capa 2 no ha marcat, així
    que cap immigrant recent hi arriba. I per sota de <b>${D.lq_bands.origin_floor} portadors a Espanya</b> la
    concentració a Balears és <b>col·lineal amb l'endemisme</b> (un cognom raríssim gairebé tot a l'illa hi surt
    concentrat per construcció), així que allà <b>exigim</b> un senyal independent de Catalunya o València; si no
    n'hi ha, es queda <b>«sense classificar»</b> en comptes d'inventar-ho.</p>

    <div class="caveat">⚠ <b>Si el teu cognom sembla mal classificat</b>, mira'n l'etiqueta de capa a la cerca.
    Si diu <span class="basis">per concentració</span>, <b>no</b> estem dient d'on ve el teu cognom ni qui eres:
    diem <b>on viu avui</b> la gent que el porta (Capa 3, un proxy descriptiu, no etimologia). «Català» no vol dir
    «d'ètim català» ni «castellà» vol dir «no mallorquí» — mesuren concentració geogràfica, no llinatge. Els
    veredictes de debò (Moll, Coromines) són en diccionaris; aquí no els fem servir. Repartiment actual de com
    s'ha decidit cada cognom: <b>${((D.origin_basis_counts||{}).concentration||0).toLocaleString('ca')}</b> per
    concentració (Capa 3) · <b>${((D.origin_basis_counts||{}).ine_nationality||0).toLocaleString('ca')}</b> per llista
    INE de nacionalitat (Capa 2) · <b>${((D.origin_basis_counts||{}).curated_foreign||0).toLocaleString('ca')}</b> per
    llista curada (Capa 2) · <b>${((D.origin_basis_counts||{}).undetermined||0).toLocaleString('ca')}</b> sense
    classificar.</div>

    <h3>3. Isonímia</h3>
    <p>S'aplica sobre el filtre d'<b>endemisme</b> (no d'origen: la geografia interna de Mallorca ve dels
    cognoms concentrats a l'illa). Es comparen tots els cognoms amb el subconjunt endèmic (LQ≥${D.lq_bands.auto}).</p>
    <p><b>Resultat:</b> amb tots els cognoms el Mantel és nul (r=${D.all.mantel.r}); amb els endèmics,
    <b>r=${D.auto.mantel.r}, p=${D.auto.mantel.p}</b>. El filtre revela una estructura geogràfica que l'estrat
    ubic amagava.</p>
    <p>Calculat sobre els <b>recomptes municipals de l'INE</b> (≥5 per poble) i el <b>cens complet</b>
    (${D.all.n_surnames.toLocaleString('ca')} cognoms): el senyal és robust.</p>

    <h3>4. Robustesa: quantes dades calien de veritat?</h3>
    <p>Vam baixar el <b>cens nacional sencer</b> (${D.all.n_surnames.toLocaleString('ca')} cognoms presents a
    Mallorca). Per a la isonímia, era <b>overkill</b>? Es pot provar directament: truncar cada municipi als seus
    <b>N cognoms més freqüents</b> (de tots), quedar-nos els endèmics que hi caiguin, recalcular la isonímia de
    l'estrat autòcton i veure com convergeix cap al cens complet —mesurant dues coses: el <b>Mantel r</b> (vs
    geografia) i la <b>correlació de tota la matriu de distàncies</b> de Lasker amb la del cens complet.</p>
    ${drawConvergence(TC)}
    <table><thead><tr><th class="num">top-N/poble</th><th class="num">Mantel r</th>
      <th class="num" title="correlació de la matriu de distàncies amb la del cens complet">corr. matriu</th>
      <th class="num" title="cognoms endèmics que sobreviuen a la truncació, sumat sobre pobles">endèmics usats</th></tr></thead>
      <tbody>${tcTable}</tbody></table>
    <p><b>1. El senyal viu al <i>cap</i> de la distribució.</b> El Mantel r <b>no és monòton</b>: amb top-50 per
    poble val <b>${d2(tcr(50))}</b> —<b>més fort</b> que amb el cens complet (${d2(TC.r_full)})—, i després baixa.
    Els cognoms més <b>comuns</b> de cada poble són els <b>marcadors geogràfics més nítids</b> (Cañellas a Santa
    Eugènia, Bibiloni a Santa Margalida…); la cua llarga de cognoms endèmics <b>difusos</b> afegeix fidelitat al
    mapa però <b>dilueix</b> la correlació bruta. Per només <b>detectar</b> l'aïllament per distància, doncs, en
    tindries prou amb <b>top ~30–50</b> (i encara el sobreestimaries).</p>
    <p><b>2. El <i>mapa</i> de debò necessita més.</b> La <b>matriu sencera</b> de distàncies —la que mou el MDS,
    les regions, els parells bessó/solitari i la F— només convergeix cap a <b>top ~200</b>: la seva correlació amb
    la del cens complet puja <b>0,25</b> (N=10) → <b>0,72</b> (N=50) → <b>0,94</b> (N=100) → <b>0,99</b> (N=200) →
    <b>0,9998</b> (N=500). A partir de <b>top ~300</b> ja no canvia pràcticament res.</p>
    <div class="caveat"><b>Veredicte.</b> Per a la <b>geometria d'isonímia</b>, els
    ${D.all.n_surnames.toLocaleString('ca')} cognoms <b>eren overkill</b>: amb <b>top ~300</b> per poble el mapa
    és indistingible del complet (corr 0,998). <b>Però</b> el cens sencer <b>no era només per a la isonímia</b>:
    fa falta per <b>calcular el filtre d'endemisme mateix</b> (necessites la freqüència <b>nacional</b>/LQ),
    l'<b>origen</b>, la <b>cobertura</b> i els «cognoms més mallorquins» —amb un top-N per poble ni tan sols
    podries classificar l'endemisme. Per al <b>projecte</b>, doncs, no era overkill; per a la <b>isonímia
    sola</b>, sí. I rehabilita honestament el vell veredicte d'IBESTAT: el top-50 <b>no</b> era «inútil per a
    l'estructura» —detecta el senyal (fins i tot inflat) i recupera el mapa gruixut (corr 0,72)—; era <b>cru</b>
    per al mapa fi, i sobretot inservible per una altra raó: d'una taula top-50 per poble <b>no</b> pots treure
    freqüències nacionals ni, per tant, el filtre endèmic. <b>Matís:</b> aquest experiment <b>assumeix</b>
    l'endemisme ja classificat (des de les dades nacionals); mesura quants cognoms per poble necessita la
    <b>geometria</b>, no si es podria arrencar tot des de dades truncades —que no es pot.</div>

    ${B?`<h3>5. Isonímia biparental: la línia materna confirma el mapa</h3>
    <p>Fins aquí tot es feia amb el <b>primer cognom</b> (la línia <b>paterna</b>). Però l'API de cognoms de
    l'INE també serveix el <b>segon cognom</b> (<code>tipo=2</code>) —la línia del <b>avi matern</b>—, i n'hem
    baixat el cens municipal sencer (${(5669).toLocaleString('ca')} cognoms presents a Mallorca). Amb <b>dues
    línies independents</b> es pot fer la <b>isonímia biparental</b>, l'estàndard del camp (Rodríguez-Larralde
    &amp; Barrai) que la versió d'un sol cognom no podia assolir.</p>
    <p><b>Per què n'hi ha prou amb els marginals.</b> La isonímia de població es calcula sobre les
    <b>freqüències de cognoms per municipi</b> (els marginals), <b>no</b> sobre parells 1r×2n de persones
    concretes —no tenim cap llistat de noms, no és una guia telefònica—. Per tant els <b>dos censos separats</b>
    basten: no cal saber com es combinen dins de cada persona. Es fa servir el <b>mateix conjunt endèmic</b>
    (l'endemisme és una propietat del cognom, surti a la línia paterna o materna).</p>
    <table><thead><tr><th>línia</th><th class="num">Mantel r</th><th class="num">p</th>
      <th class="num" title="cognoms endèmics amb senyal a la línia">cognoms</th></tr></thead>
      <tbody>
        <tr><td><b>paterna</b> (1r cognom, <code>tipo=1</code>)</td><td class="num">${cc(B.first.mantel.r)}</td><td class="num">${cc(B.first.mantel.p)}</td><td class="num">${B.first.n_surnames}</td></tr>
        <tr><td><b>materna</b> (2n cognom, <code>tipo=2</code>)</td><td class="num">${cc(B.second.mantel.r)}</td><td class="num">${cc(B.second.mantel.p)}</td><td class="num">${B.second.n_surnames}</td></tr>
        <tr style="color:#e0b070"><td><b>combinada</b> (isonímia total)</td><td class="num">${cc(B.combined.mantel.r)}</td><td class="num">${cc(B.combined.mantel.p)}</td><td class="num">${B.combined.n_surnames}</td></tr>
      </tbody></table>
    <p><b>La línia materna, tota sola, reprodueix l'aïllament per distància</b> (r=${cc(B.second.mantel.r)},
    p=${cc(B.second.mantel.p)}). És una mica més feble que la paterna (r=${cc(B.first.mantel.r)}) —normal: el
    segon cognom està una generació més <b>barrejat</b> i dispers—, però ben significativa. La
    <b>combinada</b>, agrupant els cognoms de totes dues línies i normalitzant per 2× població, dóna
    <b>r=${cc(B.combined.mantel.r)}</b>: el número biparental estàndard.</p>
    <p><b>I la prova de robustesa de debò:</b> comparant la <b>geometria isonímica</b> de la línia paterna amb
    la de la materna —el Mantel d'una matriu de Lasker contra l'altra— surt <b>r=${cc(B.agreement.r)},
    p=${cc(B.agreement.p)}</b>. És a dir: <b>dues fonts de dades independents</b> (primer i segon cognom)
    dibuixen <b>gairebé el mateix mapa</b>. L'aïllament per distància <b>no</b> és un artefacte de la línia
    paterna; els dos llinatges el confirmen. Cada punt del núvol és un <b>parell de pobles</b>: com més a prop
    de la diagonal, més coincideixen les dues línies en com de lluny estan aquells dos pobles.</p>
    ${drawBipScatter(B.first.lasker,B.second.lasker,B.agreement.r)}
    <div class="caveat"><b>Matís honest.</b> El fitxer nacional de freqüències de l'INE (≥20) és de
    <b>primer</b> cognom, així que el <b>filtre d'endemisme</b> es defineix sobre la línia paterna i el segon
    cognom el <b>manlleva</b> (indicatiu). Ara bé, les <b>taxes municipals</b> del segon cognom són dades
    <b>genuïnes</b> de l'INE (<code>tipo=2</code>): el que es manlleva és només <i>quins</i> cognoms es
    consideren endèmics, no els seus recomptes. I com tota la resta, això <b>no</b> mou cap altre estadístic
    —els resultats d'un sol cognom queden intactes.</div>`:''}

    <h3>6. Límits honestos (importants)</h3>
    <ul>
      <li><b>Tot sobre el recompte municipal de l'INE.</b> La isonímia, l'endemisme, la composició
      per municipi i el navegador es calculen sobre els recomptes reconstruïts de l'INE (taxa‰ × padró del
      municipi, cada poble amb ≥5 portadors; reconstrucció exacta). La llista de
      partida és el <b>cens nacional de l'INE</b> (${D.all.n_surnames.toLocaleString('ca')} cognoms ≥20 a Espanya
      presents a Mallorca) i el padró. Límits que queden: el secret estadístic amaga &lt;5 per poble (cobertura
      ${Math.round(Math.min(...cov)*100)}%–${Math.round(Math.max(...cov)*100)}%), i la cua &lt;20 a Espanya queda
      fora del cens de partida (≈27% de la població).</li>
      <li><b>Origen: residu.</b> Amb el recompte provincial de l'INE el gruix queda ben classificat
      —fins i tot Muntaner i Pomar surten català correctament. El que
      <b>no</b> es fa: detecció de l'estrat
      andalusí/mossàrab, ni alguns fronterers (Beltran, Colomar).</li>
      <li><b>Endemisme:</b> marca com a endèmica la <b>immigració recent concentrada</b> (marroquins) → filtrat
      amb les llistes de nacionalitat, però és contaminació menor al cap.</li>
      <li><b>Secret estadístic:</b> municipis &lt;400 hab. exclosos; cua &lt;5 suprimida. <b>Instantània 2025.</b></li>
    </ul>

    <h3>7. Veredicte preliminar</h3>
    <p>El mètode <b>funciona</b> per a una avaluació exploratòria: amb dades obertes i sense inventar res,
    aïlla el fons autòcton i en revela l'estructura geogràfica (r≈${D.auto.mantel.r}). Els límits (cens de partida
    = cognoms ≥20 a Espanya, secret &lt;5, contaminació d'immigració recent) són reals i s'han de mantenir a la vista.</p>

    <h3>8. La marca xueta</h3>
    <p>El navegador marca amb <span class="xu">xueta</span> els cognoms de la <b>llista canònica de 15
    llinatges</b> descendents dels conversos jueus mallorquins, fixada per Miquel <b>Forteza</b> (<i>Els
    descendents dels jueus conversos de Mallorca</i>): <b>Aguiló, Bonnín, Cortès, Fortesa, Fuster, Martí, Miró,
    Picó, Pinya, Pomar, Segura, Tarongí, Valentí, Valleriola, Valls</b>. La consciència col·lectiva d'aquest
    origen s'ha conservat justament pel fet de portar aquests cognoms, marcats pels processos de la Inquisició
    per criptojudaisme de finals del s. XVII.</p>
    <p><b>Sobre el terme.</b> «Xueta» és d'<b>origen despectiu</b>: se'n donen dues etimologies —de <i>juetó</i>
    ('jueuet', diminutiu de jueu) o de <i>xulla</i> (cansalada/porc), per la burla que els conversos no en
    menjaven. Els insults <i>xuetó, xuetona, xuetarro</i> i l'acusació de deïcidi van perseguir els portadors
    dels quinze llinatges durant tres segles. Per això la mateixa gent afectada preferia autoanomenar-se amb
    noms neutres —<b>«del carrer», «del Segell», «es nostros»</b> (per oposició a «es de fora del carrer»).
    Avui, però, «xueta» és el <b>terme reapropiat i estàndard</b>: l'usen la historiografia, la Viquipèdia i la
    mateixa comunitat, i el va emprar Forteza, xueta ell mateix i font d'aquesta llista. La qüestió xueta a
    Mallorca es considera avui socialment superada.</p>
    <p><b>Què marca i què no.</b> És una marca <b>històrica, no estadística</b>: <b>no entra a cap càlcul</b>
    (isonímia, Mantel, endemisme) i és <b>ortogonal</b> a l'eix català/castellà —són cognoms d'arrel catalana,
    per bé que algun de compartit i corrent arreu (Cortès) el proxy de concentració el llegeixi «castellà»:
    recorda que aquell eix mesura <b>on es concentra</b> el cognom, no d'on ve. I marca llinatges que
    <b>inclouen</b> descendents de conversos, <b>no</b> que cada portador ho sigui: cognoms com Fuster, Martí,
    Miró o Pomar tenen moltes branques <b>no</b> xuetes. És context, no un veredicte sobre ningú.</p>
    <p class="src">Font de la marca: M. Forteza / Viquipèdia.</p>

    <p class="src">Fonts: INE — API de cognoms (operació APEL: total nacional + taxa per província + taxa per
    municipi) · INE — padró (operació 22, taula 2860) · NGIB/IDEIB (coords) ·
    OpenStreetMap · Leaflet.</p>
    <p class="src"><b>Atribució INE (obligatòria):</b> «Elaboración propia con datos extraídos del sitio web del
    INE: www.ine.es».</p>`;
}

// --- click a column header to sort its table -------------------------------
// data-v (raw value) drives the numeric sort; text columns fall back to a
// Catalan-aware compare. Delegated on document, so it also covers the tables
// that get re-rendered (municipality browser, endemism search).
document.addEventListener("click", e=>{
  const th=e.target.closest("th"); if(!th) return;
  const table=th.closest("table"), tb=table&&table.tBodies[0]; if(!tb) return;
  const ci=[...th.parentNode.children].indexOf(th);
  const asc=th.getAttribute("aria-sort")!=="ascending";
  [...th.parentNode.children].forEach(h=>h.removeAttribute("aria-sort"));
  th.setAttribute("aria-sort", asc?"ascending":"descending");
  const num=tr=>{const c=tr.cells[ci]; if(!c) return NaN;
    const dv=c.getAttribute("data-v");
    return parseFloat(dv!=null?dv:c.textContent.replace(/[^0-9.\-]/g,""));};
  const txt=tr=>{const c=tr.cells[ci]; return c?c.textContent.trim():"";};
  [...tb.rows].sort((a,b)=>{
    const na=num(a), nb=num(b);
    const r=(!isNaN(na)&&!isNaN(nb))?na-nb:txt(a).localeCompare(txt(b),"ca",{numeric:true});
    return asc?r:-r;
  }).forEach(tr=>tb.appendChild(tr));
});

function wireTabs(){
  document.querySelectorAll("#tabs button").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll("#tabs button").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
    b.classList.add("active"); document.getElementById(b.dataset.tab).classList.add("active");
    if(b.dataset.tab==="map") setTimeout(()=>MAP.invalidateSize(),0);
  }));
}
