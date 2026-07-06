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

// --- origin layer: REAL Catalan-vs-Castilian proxy (data-driven, no LLM) ----
function buildOrigin(){
  const el=document.getElementById("origen-body");
  const ov=D.origin_overall, ORS=D.origins, E=D.endemism;
  const bar=ORS.filter(o=>ov[o]>0).map(o=>
    `<span class="oseg" style="width:${(ov[o]*100).toFixed(1)}%;background:${oc(o)}" title="${o} ${(ov[o]*100).toFixed(1)}%"></span>`).join("");
  const leg=ORS.map(o=>`<span class="oleg"><span class="sw" style="background:${oc(o)}"></span>${o} <b>${(ov[o]*100).toFixed(1)}%</b></span>`).join("");
  const foreignCats=["magrebí","subsaharià","asiàtic","europeu"];
  const foreign=Object.entries(E).filter(([s,e])=>foreignCats.includes(e.origin));
  const flist=foreign.map(([s,e])=>`<span class="pill" style="border-color:${oc(e.origin)};color:${oc(e.origin)}">${s.replace(/_/g,' ')} · ${e.origin}</span>`).join(" ")||"—";
  const nCat=Object.values(E).filter(e=>e.origin==="català").length;
  const nCast=Object.values(E).filter(e=>e.origin==="castellà").length;
  const munis=Object.entries(D.muni_origin).sort((a,b)=>CATF(b[1])-CATF(a[1]));
  const th=`<tr><th>municipi</th>`+ORS.map(o=>`<th class="num" style="color:${oc(o)}">${o.split(' ')[0]}</th>`).join("")+`</tr>`;
  const rows=munis.map(([m,c])=>`<tr><td>${m}</td>`+ORS.map(o=>`<td class="num" data-v="${c[o]||0}">${c[o]?Math.round(c[o]*100)+'%':'·'}</td>`).join("")+`</tr>`).join("");
  el.innerHTML=`
    <p>Origen <b>real</b>, <b>només amb dades obertes</b> (sense LLM, sense lexicon). Un cognom és
    <b style="color:${oc('català')}">català</b> (${nCat}) si està <b>concentrat al domini catalanoparlant</b>
    per damunt de la mitjana espanyola a les <b>terres catalanes</b> (<b>Catalunya</b>, <b>Balears</b>,
    <b>País Valencià</b>) —tot des de l'<b>API de cognoms de l'INE</b>, taxa per província, una sola font—;
    <b style="color:${oc('castellà')}">castellà</b> (${nCast}) si surt a l'INE però <b>no</b> hi està
    concentrat; <b>forà</b> si és a les llistes INE per nacionalitat <b>o</b> a una <b>llista curada</b>
    de cognoms d'immigració recent (magrebins, sikhs) que l'INE no recull —només en publica el top-20
    per país— i que, per freqüència, són <b>indistingibles</b> d'un cognom mallorquí endèmic. Això <b>sí</b> separa origen:
    Ferrer, Nebot, Vidal al Principat; Amengual, Moll, Fuster a Balears; Miralles, Català, Gomis, Ballester al
    País Valencià; García, Martínez repartits per Espanya.</p>
    <div class="obar">${bar}</div><div class="oleglist">${leg}</div>
    <div class="caveat">⚠ <b>El País Valencià és un senyal sorollós</b> (a diferència de Catalunya i Balears):
    per la repoblació aragonesa i la immigració hi ha cognom castellà sobrerepresentat (Navarro LQ_Val 2,3;
    Martínez 1,6). Per això el llindar valencià és <b>més alt</b> (LQ≥${D.lq_bands.val}, no ${D.lq_bands.origin}):
    rescata els valencians de debò (Femenia, Miralles, Català, Gomis…) sense deixar passar García ni Navarro.
    <br>✓ <b>El recompte provincial complet de l'INE arregla els antics residus:</b> <b>Muntaner</b> i <b>Pomar</b>,
    que en una llista truncada per municipi semblarien rars i castellans, tenen de fet LQ_Bal altíssim (28,8 i 12,5)
    → ara <b>català</b> correctament. No detecta l'estrat andalusí/mossàrab: cognoms com <b>Bennàssar</b>,
    <b>Binimelis</b> o <b>Bibiloni</b>, d'ètim àrab però mallorquins <b>fa segles</b>, són —correctament— autòctons,
    <b>no</b> immigració recent.<br>⚠ <b>Orígens forans (${foreign.length}):</b> ${flist}. Detectats amb les llistes
    INE per nacionalitat <b>+ una llista curada</b> (l'INE només publica el top-20 per país). Encara
    <b>subestimats</b> (l'INE per nacionalitat només arriba al top-20 per país) i algun rar sense regió assignada (Nineb, Masaquiza queden per revisar).</div>
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
  // municipalities sorted by population (largest first)
  const locs=Object.keys(MS).sort((a,b)=>(D.municipality_pop[b]||0)-(D.municipality_pop[a]||0));
  const cls=o=> o==="català"?"auto": o==="castellà"?"cast":"none";
  const nm=v=>v!=null?v:'—';
  const XUBADGE=`<span class="xu" title="Llinatge de la llista canònica xueta (Forteza). Marca lineatges que INCLOUEN descendents de conversos, no cada portador.">xueta</span>`;
  el.innerHTML=`
    <p>Explora la taula <b>completa de cognoms visibles</b> (recompte municipal de l'INE 2025, 1r cognom,
    tots els que tenen ≥5 portadors) d'un municipi: freqüència, taxa per mil habitants, LQ d'endemisme i
    origen. Tria un municipi i baixa'l en CSV.</p>
    <div class="mn-bar">
      <select id="mn-sel">${locs.map(m=>`<option value="${m}">${m} · ${(D.municipality_pop[m]||0).toLocaleString('ca')} hab.</option>`).join("")}</select>
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
  const a=D.all.mantel, u=D.auto.mantel, E=D.endemism;
  const munis=Object.entries(D.muni_stats).map(([m,s])=>({m,au:s.autoch,pop:D.municipality_pop[m]}));
  const byAuto=[...munis].sort((x,y)=>y.au-x.au);
  const topAuto=byAuto.slice(0,5), lowAuto=byAuto.slice(-5).reverse();
  const totPop=munis.reduce((s,x)=>s+x.pop,0);
  const meanAuto=munis.reduce((s,x)=>s+x.au*x.pop,0)/totPop;
  const nEnd=D.auto.n_surnames;                                    // Mallorca-endemic (isonymy filter)
  const nCat=Object.values(E).filter(e=>e.origin==="català").length;
  const nCast=Object.values(E).filter(e=>e.origin==="castellà").length;
  const cov=Object.values(D.coverage);
  const sensRows=D.lq_sensitivity.map(r=>`<tr${r.p<0.05?' style="color:#8fd6ac"':''}><td class="num">≥ ${r.lq}</td>`+
    `<td class="num">${r.n_surnames}</td><td class="num">${r.r}</td><td class="num">${r.p}${r.p<0.05?' ✓':''}</td></tr>`).join("");
  const lq=n=>E[n]?E[n].lq:null;
  const csc=n=>E[n]?E[n].cat_score:null;
  const catEx=["FERRER","NEBOT","VIDAL","BONET","MOLL","FUSTER","AMENGUAL"].filter(s=>E[s]);
  const casEx=["GARCIA","MARTINEZ","LOPEZ","FERNANDEZ","GONZALEZ","SANCHEZ"].filter(s=>E[s]);
  const pc=x=>Math.round(x*100)+"%";
  const arow=r=>`<tr><td>${r.m}</td><td class="num" data-v="${r.pop}">${r.pop.toLocaleString('ca')}</td><td class="num" data-v="${r.au}">${pc(r.au)}</td></tr>`;

  document.getElementById("concl-body").innerHTML = `
  <h2>Conclusions</h2>
  <p class="lead">Instantània de 2025 (cens de cognoms de l'INE), ${D.n_municipalities} municipis, ${totPop.toLocaleString('ca')}
  persones, amb els seus propis límits (secret &lt;5 per poble; la llista ve del cens nacional de l'INE, cognoms ≥20 a Espanya). Aquestes
  són les conclusions que aguanten els números.</p>

  <h3>1. El filtre d'endemisme converteix un resultat nul en un senyal fort</h3>
  <p>Aïllament per distància (Mantel) sobre els mateixos ${a.n} municipis:</p>
  <table><thead><tr><th>cognoms usats</th><th class="num">r</th><th class="num">p</th></tr></thead><tbody>
    <tr><td>Tots els cognoms</td><td class="num">${a.r}</td><td class="num">${a.p} <span class="ns">nul</span></td></tr>
    <tr style="color:#8fd6ac"><td>Només autòctons (LQ≥${D.lq_bands.auto})</td><td class="num">${u.r}</td><td class="num">${u.p} ✓</td></tr>
  </tbody></table>
  <p class="result-box">Amb <b>tots</b> els cognoms el senyal és <b>nul</b> (r=${a.r}): els cognoms ubics
  (García, Martínez…) igualen tots els municipis. En aïllar l'estoc <b>autòcton</b>, apareix
  <b>r=${u.r}, p=${u.p}</b> — aïllament per distància clar i <b>significatiu</b>. El filtre no crea el senyal:
  el <b>destapa</b> traient la capa que l'amagava.</p>
  <p><b>Sensibilitat del llindar</b> (per no dependre d'un tall arbitrari): definint «autòcton» com a
  LQ ≥ T, per a qualsevol T raonable el senyal es manté —fins i tot <b>puja</b> com més endèmic:</p>
  <table><thead><tr><th class="num">LQ ≥</th><th class="num">cognoms</th><th class="num">r</th><th class="num">p</th></tr></thead>
    <tbody>${sensRows}</tbody></table>
  <p class="hint" style="color:var(--muted)">La conclusió <b>no</b> depèn del llindar triat: r≈0,29–0,32, p≤0,001 a tot arreu
  (sobre els recomptes municipals complets de l'INE).</p>

  <h3>2. Mallorca són dues capes superposades (comprovat)</h3>
  <p>El paisatge de 2025 és la suma d'una <b>capa no endèmica</b> (cognoms ubics: immigració castellana
  del s. XX <i>més</i> cognoms catalans escampats per tot Espanya) i un <b>estoc autòcton</b> concentrat a
  l'illa. <b>Ho hem verificat amb un arbre d'isonímia de la capa no endèmica a part</b>
  (pestanya Isonímia): dona <b>Mantel r=${D.nonend.mantel.r}, p=${D.nonend.mantel.p}</b> →
  <b>cap aïllament per distància</b>. Matís honest: <b>no</b> vol dir «repartit uniformement» —de fet es
  concentren a Palma/costa—, sinó que la seva variació és un <b>gradient centre-perifèria</b>, no una
  estructura geogràfica fina. Concretament (amb la cobertura completa de l'INE): <b>Garcia</b> surt a
  ${D.by_surname.GARCIA.length}/${D.n_municipalities} municipis amb <b>taxa plana</b> (~20‰ pertot);
  <b>Cañellas</b> també apareix a molts pobles (${D.by_surname.CANIELLAS.length}), però amb la <b>massa
  concentrada per taxa</b> en uns pocs (Santa Eugènia ~28‰, Santa Maria ~17‰, enfront de ~1,6‰ a Palma).
  Els autòctons són <b>grumollosos per taxa</b> → creen geografia; els ubics, plans → la dilueixen.
  Autoctonia mitjana (ponderada per població): <b>${pc(meanAuto)}</b>. El gradient és net:</p>
  <div class="two">
    <div><table><thead><tr><th>Més autòctons</th><th class="num">pob.</th><th class="num">aut.</th></tr></thead>
      <tbody>${topAuto.map(arow).join("")}</tbody></table></div>
    <div><table><thead><tr><th>Menys autòctons</th><th class="num">pob.</th><th class="num">aut.</th></tr></thead>
      <tbody>${lowAuto.map(arow).join("")}</tbody></table></div>
  </div>
  <p>És l'eix <b>interior autòcton</b> vs <b>Palma / costa turística</b> (immigrant): un gradient
  centre-perifèria mesurat sobre centenars de milers de persones.</p>

  <h3>3. Origen real: català vs castellà, comparant amb els Països Catalans</h3>
  <p>Dos eixos <b>diferents</b>: l'<b>endemisme</b> (concentració a Mallorca, seccions 1–3, mou la geografia) i
  l'<b>origen</b>. Per a l'origen, en comptes de mesurar concentració a Mallorca (que és endemisme, no
  etimologia), es mesura la concentració al <b>domini catalanoparlant sencer</b>: un cognom és <b>català</b> si
  està sobrerepresentat a <b>Catalunya</b>, <b>Balears</b> <i>o</i> al <b>País Valencià</b> respecte de la
  mitjana espanyola —tot des d'una <b>sola font</b>, l'<b>API de cognoms de l'INE</b> (taxa per província).
  Això <b>sí</b> distingeix origen —resol el problema que l'endemisme sol no podia:</p>
  <ul>
    <li><b style="color:${oc('català')}">Català</b> (${nCat} cognoms): ${catEx.map(s=>`${s.charAt(0)+s.slice(1).toLowerCase()} (${csc(s)})`).join(" · ")} — Principat (Ferrer, Nebot, Vidal), Balears (Amengual, Moll) i País Valencià (Miralles, Català, Gomis, Ballester).</li>
    <li><b style="color:${oc('castellà')}">Castellà</b> (${nCast}): ${casEx.map(s=>`${s.charAt(0)+s.slice(1).toLowerCase()} (${csc(s)||lq(s)})`).join(" · ")} — a l'INE però <b>no</b> concentrats al domini català.</li>
  </ul>
  <p class="result-box">Casos que amb endemisme sol sortien mal etiquetats i <b>ara es corregeixen</b>:
  <b>Fuster</b>, <b>Moll</b>, <b>Nebot</b> pel senyal de Catalunya/Balears; <b>Femenia</b>
  (LQ Val ${csc('FEMENIA')&&D.endemism.FEMENIA?D.endemism.FEMENIA.lq_val:''}), <b>Miralles</b>, <b>Català</b>,
  <b>Gomis</b> pel del País Valencià → tots <b>català</b>. I sobretot <b>Muntaner</b> i <b>Pomar</b>: el
  recompte provincial complet de l'INE (LQ_Bal 28,8 i 12,5) mostra que <b>no</b> eren rars sinó fortament
  balears → deixen de ser el «residu castellà» que serien en una llista truncada per municipi.</p>
  <p class="warn-box">⚠ <b>El País Valencià és sorollós:</b> cognom castellà sobrerepresentat per la repoblació
  aragonesa (Navarro LQ_Val 2,3; Martínez 1,6). Per això s'hi aplica un llindar <b>més alt</b>
  (LQ≥${D.lq_bands.val}) que a Catalunya/Balears (${D.lq_bands.origin}). <b>Residu real:</b> no hi ha detecció
  de l'estrat andalusí/mossàrab (Bennàssar, Binimelis són català, no marcats com d'ètim àrab antic), i la capa
  d'immigració recent depèn d'una llista curada (l'INE per nacionalitat només arriba al top-20 per país).</p>

  <h3>4. Límits honestos</h3>
  <ul>
    <li><b>Tota l'anàlisi va sobre els recomptes municipals de l'INE</b> (taxa‰ × padró, ≥5 per poble;
    reconstrucció exacta, la taxa‰ de l'INE surt d'aquest mateix padró): isonímia, endemisme, composició i
    navegador. La llista de cognoms és el <b>cens nacional de l'INE</b> (${D.all.n_surnames.toLocaleString('ca')} cognoms ≥20 a
    Espanya presents a Mallorca) i el padró. Límits: el secret amaga &lt;5 per poble (cobertura
    ${pc(Math.min(...cov))}–${pc(Math.max(...cov))}, Palma la pitjor) i la cua &lt;20 a Espanya queda fora del
    cens de partida. R<sub>ii</sub>/I<sub>ij</sub> dominades pel cap → aproximació defensable.</li>
    <li><b>Instantània 2025</b>, no sèrie temporal.</li>
    <li>Municipis &lt;400 hab. exclosos; cua &lt;5 suprimida (secret estadístic).</li>
  </ul>

  <h3>5. Veredicte</h3>
  <ul>
    <li>Amb <b>dades obertes, sense lexicon i sense inventar res</b>, es pot aïllar l'estoc autòcton i
    revelar-ne l'estructura geogràfica (r=${u.r}, p=${u.p}), <b>estadísticament robust</b> (centenars de
    milers de persones).</li>
    <li>El resultat interessant és el <b>contrast</b>: sense filtre, cap geografia; amb filtre, geografia clara.
    Prova que la homogeneïtat aparent dels cognoms moderns és, en bona part, la <b>capa immigrant compartida</b>.</li>
    <li>Els límits (cens de partida = cognoms ≥20 a Espanya, secret &lt;5 per poble,
    contaminació d'immigració recent) s'han de mantenir a la vista i no permeten afirmacions demogràfiques
    fortes, sinó una tendència ben fonamentada.</li>
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
    return `<span class="sn ${kind}">${sn.replace(/_/g,' ')}</span>${e.xueta?' <span class="xu" title="Llinatge de la llista canònica xueta (marca lineatges que inclouen descendents de conversos, no cada portador)">xueta</span>':''} <span class="lqv">LQ ${e.lq??'—'}</span> · ${e.mall.toLocaleString('ca')}`;
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
    lqc:e.lq_cat,lqb:e.lq_bal,lqv:e.lq_val,cs:e.cat_score,origin:e.origin,xueta:e.xueta}));
  const cls=o=> o==="català"?"auto": o==="castellà"?"cast":"none";
  const nm=v=>v!=null?v:'—';
  const XUBADGE=`<span class="xu" title="Llinatge de la llista canònica xueta (Forteza). Marca lineatges que INCLOUEN descendents de conversos, no cada portador.">xueta</span>`;
  function render(list){
    return `<table><thead><tr><th>cognom</th><th class="num">Mall.</th>
      <th class="num">Esp.</th><th class="num">LQ Mall</th><th class="num">LQ Cat</th>
      <th class="num">LQ Bal</th><th class="num">LQ Val</th><th>origen</th></tr></thead><tbody>`+
      list.map(r=>`<tr class="${cls(r.origin)}"><td>${r.s.replace(/_/g,' ')}${r.xueta?' '+XUBADGE:''}</td>
        <td class="num" data-v="${r.mall}">${r.mall.toLocaleString('ca')}</td>
        <td class="num" data-v="${r.spain??''}">${r.spain!=null?r.spain.toLocaleString('ca'):'—'}</td>
        <td class="num" data-v="${r.lq??''}">${nm(r.lq)}</td><td class="num" data-v="${r.lqc??''}">${nm(r.lqc)}</td><td class="num" data-v="${r.lqb??''}">${nm(r.lqb)}</td>
        <td class="num" data-v="${r.lqv??''}">${nm(r.lqv)}</td>
        <td style="color:${oc(r.origin)}">${r.origin}</td></tr>`).join("")+`</tbody></table>`;
  }
  el.innerHTML = `
    <p><b>Dos eixos.</b> <b>Endemisme</b> = <code>LQ Mall = (freq Mallorca/pob)/(freq Espanya/pob)</code>
    (concentració a l'illa; mou la geografia). <b>Origen</b> = concentració al <b>domini catalanoparlant</b>:
    <b>LQ Cat</b> (Catalunya), <b>LQ Bal</b> (Balears) i <b>LQ Val</b> (País Valencià), totes des de l'<b>API de
    cognoms de l'INE</b> (taxa per província). Un cognom és
    <span style="color:var(--accent)">català</span> si LQ Cat o LQ Bal ≥ ${D.lq_bands.origin}, <b>o</b> LQ Val ≥
    ${D.lq_bands.val} (llindar valencià més alt: el País Valencià té molt cognom castellà);
    <span style="color:var(--cast)">castellà</span> si surt a l'INE però a cap. Ordenat per LQ Mall.</p>
    <div class="caveat">⚠ Fixa't com l'origen <b>no</b> és l'endemisme: mesuren coses diferents. L'<b>origen</b>
    mira la concentració al domini català sencer (Principat/Balears/País Valencià): <b>Nebot</b> surt català
    sobretot per LQ Val 33; <b>Femenia/Miralles</b> per LQ Val altíssim tot i tenir LQ Cat baix. L'<b>endemisme</b>
    mira només Mallorca: <b>Muntaner</b> i <b>Pomar</b> hi són massissament concentrats (LQ Bal 28,8 i 12,5) —el
    recompte complet de l'INE els rescata, que en una llista truncada semblarien rars. I els dos eixos <b>divergeixen</b>:
    <b>El Khoumssi</b> té LQ Mall altíssim (Mallorca-endèmic) però <b>no</b> és català sinó magrebí → per això
    l'endemisme sol no basta i cal el filtre d'origen + forans.<br>
    ⚠ <b>Cognoms d'immigració recent</b> (Ayoubi, Bouhjira, El Khoumssi…) són, per freqüència, idèntics a un
    mallorquí endèmic (LQ Mall alt, absents de Catalunya). Es marquen <b>magrebí</b> amb una llista curada
    (l'INE per nacionalitat només en publica el top-20); <b>no</b> es confonen amb els d'ètim andalusí ja
    establerts fa segles (Bennàssar, Binimelis), que són autòctons.</div>
    <div class="caveat"><span class="xu">xueta</span> <b>Capa històrica, no estadística.</b> Marca els cognoms
    de la <b>llista canònica de 15 llinatges xuetes</b> (descendents dels conversos jueus mallorquins, fixada
    per M. Forteza): Aguiló, Bonnín, Cortès, Fortesa, Fuster, Martí, Miró, Picó, Pinya, Pomar, Segura, Tarongí,
    Valentí, Valleriola, Valls. És <b>ortogonal</b> a català/castellà (són cognoms catalans). <b>Important:</b>
    marca llinatges que <b>inclouen</b> descendents de conversos, <b>no</b> que cada portador ho sigui — hi ha
    Fuster, Martí, Miró, Pomar <b>no</b> xuetes. Font: Forteza / Viquipèdia.</div>
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
function drawMDS(mds, locs, autochOf){
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
    dots+=`<circle data-i="${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${ramp(autochOf(nm))}" `+
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
    de la capa <b>no endèmica</b> (r=${c.r}, p=${c.p}) confirmen que <b>no</b> té aïllament per distància — no és
    que sigui uniforme (es concentra a Palma/costa), sinó que la seva variació és un gradient centre-perifèria,
    <b>no</b> una estructura fina. L'autòctona sí. Recorda: «no endèmic» és una barreja de castellà i de català
    peninsular escampat, no un estrat «castellà» pur. Fulles acolorides per autoctonia del municipi.
    R<sub>ii</sub>/distàncies es calculen sobre els <b>recomptes municipals de l'INE</b> (taxa‰ × padró
    del municipi, cada poble amb ≥5 portadors) i sobre el <b>cens complet de l'INE</b> (${D.all.n_surnames.toLocaleString('ca')}
    cognoms), no una llista truncada per municipi: així no hi ha biaix de truncació que infli el contrast entre
    pobles ni infravalori les viles grans. El Mantel dels autòctons queda en <b>${u.r}</b>, significatiu.
    Límit que queda: el secret estadístic amaga &lt;5 per poble.</div>`;
}

// --- MDS tab: the Lasker-distance table projected to an interactive 2D scatter ------------
function buildMDS(){
  const u=D.auto.mantel;
  const autochOf=l=>(D.muni_stats[l]||{autoch:0}).autoch;
  document.getElementById("mds-body").innerHTML = `
    <h2>MDS — mapa de semblança entre pobles</h2>
    <p class="lead">La taula de distàncies de Lasker (capa <b>autòctona</b>, ${D.auto.n_surnames} cognoms
    endèmics) projectada a un pla 2D: <b>com més a prop dos pobles, més s'assemblen pels cognoms</b>. No és un
    mapa geogràfic —l'orientació és arbitrària—; el color és l'autoctonia del municipi i la mida ~ població.
    Que els pobles interiors i de muntanya s'agrupin lluny de Palma és la mateixa estructura que capta el
    <b>Mantel (r=${u.r}, p=${u.p})</b>.</p>
    <p class="hint" style="color:var(--muted)"><span style="color:var(--accent)">↔ Clica una bombolla per
    fixar-ne el nom · roda del ratolí per apropar · arrossega per moure · doble clic per reiniciar.</span>
    De base només s'etiqueten els pobles distintius; clica (o passa-hi el ratolí) per identificar qualsevol
    punt, i en apropar-te apareixen les etiquetes del nucli central.</p>
    ${drawMDS(D.auto.mds, D.auto.locs, autochOf)}
    <div class="caveat">Els pobles <b>aïllats</b> (Banyalbufar, Búger, Costitx, Deià, Sóller…) salten a les
    vores: comparteixen pocs cognoms amb la resta → Rii alt. El <b>nucli dens</b> són els pobles que s'assemblen
    molt entre ells. Calculat sobre els recomptes municipals de l'INE (≥5 per poble), capa autòctona (LQ≥${D.lq_bands.auto}).</div>`;
  initMDS(document.querySelector("#mds-body svg.mds"));
}

// --- methodology ----------------------------------------------------------
function buildMethod(){
  const cov=Object.values(D.coverage);
  document.getElementById("metod-body").innerHTML = `
    <h2>Metodologia i límits</h2>
    <p class="lead">Prova seriosa de si es pot fer isonímia moderna de Mallorca separant l'estoc
    autòcton (endèmic) de la capa ubiqua/no endèmica, <b>sense lexicon onomàstic</b> i només amb dades obertes.</p>

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
        <p class="imp"><b>En aquest projecte:</b> capa autòctona r≈${D.auto.mantel.r}, p=${D.auto.mantel.p} →
        estructura geogràfica significativa (aparellament de proximitat, endogàmia local). El conjunt complet
        de cognoms: r≈${D.all.mantel.r} → la capa d'immigració l'esvaeix.</p>
      </div>
      <div class="concept">
        <h4>LQ — quocient de localització</h4>
        <p>Com de concentrat està un cognom en una zona respecte a la mitjana espanyola.
        <code>LQ = taxa local / taxa Espanya</code>. LQ=1 → igual que pertot; LQ=10 → deu vegades més
        concentrat aquí.</p>
        <p class="imp"><b>Implica:</b> LQ_Mallorca alt = cognom <b>endèmic</b> de l'illa (Cañellas, Bestard).
        És el filtre que separa l'estoc autòcton del soroll ubic.</p>
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
    (<code>mapaWidget&amp;tipo=1</code>) → l'eix d'origen (Catalunya, Balears, País Valencià); (c) la <b>taxa per
    municipi</b> (<code>mapaWidget&amp;vista=muni</code>) → reconstrucció dels <b>recomptes municipals</b>
    (taxa‰ × padró, ≥5 per poble; reconstrucció exacta, la taxa‰ surt d'aquest mateix padró) sobre els quals es
    calcula <b>tota l'anàlisi</b> (isonímia, endemisme, composició i navegador). Població: <b>padró INE</b>
    (operació 22, taula 2860). Coordenades: NGIB.</p>
    <p class="hint" style="color:var(--muted)">L'origen ve tot de l'API de l'INE per província: una sola font,
    sense el soroll de fonts heterogènies, i amb el recompte complet rescata cognoms que una llista truncada
    undercomptaria (Muntaner, Pomar).</p>

    <h3>2. Dos eixos: endemisme i origen</h3>
    <p><b>Endemisme</b> (per a la isonímia): <code>LQ = (freq_Mallorca/pob)/(freq_Espanya/pob)</code>.
    LQ≫1 = cognom concentrat a l'illa.</p>
    <p><b>Origen</b> (català vs castellà): es mesura la concentració al <b>domini catalanoparlant sencer</b> —
    <code>LQ Cat</code> (Catalunya), <code>LQ Bal</code> (Balears) i <code>LQ Val</code> (País Valencià), totes
    des de l'<b>API de l'INE</b> (taxa província / taxa nacional). Un cognom és <b>català</b> si LQ Cat o
    LQ Bal ≥ ${D.lq_bands.origin}, <b>o</b> LQ Val ≥ ${D.lq_bands.val}.</p>
    <p><b>Per què el llindar valencià és més alt:</b> Catalunya i Balears són àncores netes, però el País
    Valencià té cognom castellà sobrerepresentat per la repoblació aragonesa (Navarro LQ_Val 2,3; Martínez 1,6).
    Cal un llindar alt per rescatar els valencians genuïns (Femenia, Miralles, Català, Gomis) sense colar-hi
    Navarro.</p>
    <p><b>Castellà:</b> present a l'INE però concentrat a cap regió catalana.</p>
    <p><b>Forà:</b> llistes INE per nacionalitat <b>+ una llista curada</b> de cognoms d'immigració recent
    (magrebins, sikhs) que l'INE no recull (només top-20 per país) i que —amb LQ Mall alt i absents de
    Catalunya— la classificació per LQ etiquetaria erròniament com a «català». S'exclouen d'aquesta llista els
    cognoms d'ètim andalusí <b>establerts fa segles</b> (Bennàssar, Binimelis): són estoc autòcton, no arribada
    recent.</p>

    <h3>3. Isonímia</h3>
    <p>S'aplica sobre el filtre d'<b>endemisme</b> (no d'origen: la geografia interna de Mallorca ve dels
    cognoms concentrats a l'illa). Es comparen tots els cognoms amb el subconjunt endèmic (LQ≥${D.lq_bands.auto}).</p>
    <p><b>Resultat:</b> amb tots els cognoms el Mantel és nul (r=${D.all.mantel.r}); amb els endèmics,
    <b>r=${D.auto.mantel.r}, p=${D.auto.mantel.p}</b>. El filtre revela una estructura geogràfica que la capa
    ubiqua amagava.</p>
    <p>Calculat sobre els <b>recomptes municipals de l'INE</b> (≥5 per poble) i el <b>cens complet</b>
    (${D.all.n_surnames.toLocaleString('ca')} cognoms): sense biaix de truncació, el senyal és robust.</p>

    <h3>4. Límits honestos (importants)</h3>
    <ul>
      <li><b>Tot sobre el recompte municipal de l'INE.</b> La isonímia, l'endemisme, la composició
      per municipi i el navegador es calculen sobre els recomptes reconstruïts de l'INE (taxa‰ × padró del
      municipi, cada poble amb ≥5 portadors; reconstrucció exacta), sense cap biaix de truncació. La llista de
      partida és el <b>cens nacional de l'INE</b> (${D.all.n_surnames.toLocaleString('ca')} cognoms ≥20 a Espanya
      presents a Mallorca) i el padró. Límits que queden: el secret estadístic amaga &lt;5 per poble (cobertura
      ${Math.round(Math.min(...cov)*100)}%–${Math.round(Math.max(...cov)*100)}%), i la cua &lt;20 a Espanya queda
      fora del cens de partida (≈27% de la població).</li>
      <li><b>Origen: residu.</b> Amb el recompte provincial complet de l'INE el gruix queda ben classificat
      —fins els que en recomptes truncats haurien caigut a «castellà» (Muntaner, Pomar) ara surten català. El que
      <b>no</b> es fa: detecció de l'estrat
      andalusí/mossàrab, ni alguns fronterers (Beltran, Colomar).</li>
      <li><b>Endemisme:</b> marca com a endèmica la <b>immigració recent concentrada</b> (marroquins) → filtrat
      amb les llistes de nacionalitat, però és contaminació menor al cap.</li>
      <li><b>Secret estadístic:</b> municipis &lt;400 hab. exclosos; cua &lt;5 suprimida. <b>Instantània 2025.</b></li>
    </ul>

    <h3>5. Veredicte preliminar</h3>
    <p>El mètode <b>funciona</b> per a una avaluació exploratòria: amb dades obertes i sense inventar res,
    aïlla l'estoc autòcton i en revela l'estructura geogràfica (r≈${D.auto.mantel.r}). Els límits (cens de partida
    = cognoms ≥20 a Espanya, secret &lt;5, contaminació d'immigració recent) són reals i s'han de mantenir a la vista.</p>
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
