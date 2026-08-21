/* Tidslinjeværktøjet — mock-up til godkendelse, jf. ADR-0036.

   Bruger PLAN, PERSONER, BEHOLDNINGER, POSTER, INDBETALINGER, OVERFOERSLER og
   simuler() fra plan.js uændret. Denne fil rører aldrig plan.js — den er
   fælles fixtur for alle mock-ups — men lægger ét lokalt lag ovenpå den
   udelukkende til denne demonstration: se FOELGER_OPHOER nedenfor.

   IKKE motoren. Samme forbehold som plan.js selv: grov, til at vise formen
   og interaktionen, ikke til at efterprøve tal på. */

var krT = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
function KT(v) { return krT.format(Math.round(v)); }
function persT(id) { return PERSONER.filter(function (p) { return p.id === id; })[0]; }
function behT(id) { return BEHOLDNINGER.filter(function (b) { return b.id === id; })[0]; }

/* Samme farverækkefølge som navigator.js's FARVER_N — beholdningens egen
   farve fra Formuegrafen genbruges på dens udbetalingsboks, jf. ADR-0036. */
var FARVER_T = ['#5b7ba6', '#7d92b0', '#96a6bc', '#a3854e', '#b79a6c', '#c5b38d',
  '#75906c', '#8fa387', '#a6b39d'];
var KAT_FARVE = {
  indtaegter: getComputedStyle(document.documentElement).getPropertyValue('--kat-indtaegter').trim(),
  udgifter: getComputedStyle(document.documentElement).getPropertyValue('--kat-udgifter').trim(),
  indbetalinger: getComputedStyle(document.documentElement).getPropertyValue('--kat-indbetalinger').trim(),
  overfoersler: getComputedStyle(document.documentElement).getPropertyValue('--kat-overfoersler').trim()
};

/* plan.js kender ingen AgeBound — BEHOLDNINGER[i].udbetaling.start er altid
   et rent kalenderår. For at kunne vise et LÅST håndtag på en beholdnings
   udbetaling (der findes intet eksempel på i fixturen) mærkes én ordning her
   som om dens start fulgte ejerens erhvervsophør. Rent præsentationslag for
   denne demo — ændrer intet i plan.js og påstår ikke noget om reglen. */
var FOELGER_OPHOER = { b7: 'fra' };

var PXY = 18;             /* pixel pr. år på tidslinjens egen skala */
var RAEKKE_H = 24;        /* højde pr. pakket linje */
var GRUPPE_HOVED_H = 25;

var TL = {
  valgt: null,
  foldet: { indtaegter: false, udgifter: false, beholdninger: false, indbetalinger: false, overfoersler: false }
};

/* Trækkeoverstyringer: id → { fra, til } i kalenderår. Kun for poster, hvis
   endepunkt hverken er låst til erhvervsophør eller åbent — jf. ADR-0036,
   pkt. om at hele posten kun kan flyttes, når begge ender er faste og fri. */
var OVERSTYRING = {};

function aarNu() { return PLAN.startAar; }
function aarSlut() { return PLAN.slutAar; }

/* ---------- normalisering: hvert objekt med en periode bliver ét "item" ---
   { id, kategori, navn, ejer, farve, punkt, fra, til, fraLaast, tilLaast,
     fraAaben, tilAaben }
   `fra`/`til` er altid opløst til kalenderår, uanset om kilden er alders-
   eller kalenderforankret — det er det, en boks tegnes af. Er et endepunkt
   åbent (ingen grænse), er værdien planens egen start/slut, og feltet har
   intet håndtag.                                                          */

function tlItems() {
  var items = [];
  var jesper = PERSONER[0], anne = PERSONER[1];

  function ophoerAar(p) { return p.foedselsaar + p.erhvervsophoerAlder; }

  POSTER.forEach(function (post, i) {
    var id = 'p' + i;
    var er = post.retning === 'ind';
    var item = {
      id: id, kategori: er ? 'indtaegter' : 'udgifter', navn: post.navn,
      ejer: post.ejer, farve: er ? KAT_FARVE.indtaegter : KAT_FARVE.udgifter,
      punkt: post.gentagelse === 'Én gang'
    };

    if (post.forankring === 'alder') {
      var p = post.ejer === 'j' ? jesper : anne;
      if (post.navn === 'Løn') {
        item.fraAaben = true; item.til = ophoerAar(p); item.tilLaast = true;
      } else {
        item.fra = ophoerAar(jesper); item.fraLaast = true;
        item.til = jesper.foedselsaar + 80;
      }
    } else if (typeof post.fra === 'number') {
      item.fra = post.fra; item.til = post.til;
    } else {
      item.fraAaben = true; item.tilAaben = true;
    }
    items.push(anvendOverstyring(item));
  });

  BEHOLDNINGER.forEach(function (b, i) {
    if (!b.udbetaling) return;
    var farve = FARVER_T[i];
    var foelger = FOELGER_OPHOER[b.id];
    var item = {
      id: 'b-' + b.id, kategori: 'beholdninger',
      navn: b.navn + (b.type === 'livrente' ? ' · omsætning' : ''),
      ejer: b.ejer, farve: farve, punkt: b.type === 'livrente'
    };
    if (foelger === 'fra') { item.fra = ophoerAar(persT(b.ejer)); item.fraLaast = true; }
    else item.fra = b.udbetaling.start;
    if (!item.punkt) item.til = item.fra + b.udbetaling.aar - 1;
    items.push(anvendOverstyring(item));
  });

  INDBETALINGER.forEach(function (ind, i) {
    if (ind.kilde.post !== undefined) return; /* arver postens periode, ingen egen boks */
    var dest = behT(ind.destination);
    items.push(anvendOverstyring({
      id: 'i' + i, kategori: 'indbetalinger',
      navn: behT(ind.kilde.beholdning).navn + ' → ' + dest.navn,
      ejer: dest.ejer, farve: KAT_FARVE.indbetalinger,
      fra: ind.fra, til: ind.tilAar
    }));
  });

  OVERFOERSLER.forEach(function (o, i) {
    items.push(anvendOverstyring({
      id: 'o' + i, kategori: 'overfoersler',
      navn: behT(o.fra).navn + ' → ' + behT(o.til).navn,
      ejer: behT(o.fra).ejer, farve: KAT_FARVE.overfoersler,
      punkt: true, fra: +o.periode
    }));
  });

  return items;
}

function anvendOverstyring(item) {
  var o = OVERSTYRING[item.id];
  if (!o) return item;
  if (!item.fraLaast && !item.fraAaben && o.fra !== undefined) item.fra = o.fra;
  if (!item.tilLaast && !item.tilAaben && o.til !== undefined) item.til = o.til;
  return item;
}

/* Kun en post, hvis begge ender er faste og fri, kan flyttes som helhed —
   "lukkede ender" i den forstand ADR-0036 bruger ordet. */
function harLukkedeFriEnder(item) {
  return !item.punkt && !item.fraLaast && !item.tilLaast && !item.fraAaben && !item.tilAaben;
}

/* ---------- pakning: grådig kanttildeling inden for én kategori, på tværs
   af ejere, jf. spørgsmål 6–7 i grillsessionen ---------- */
function pakGruppe(items) {
  var sorteret = items.slice().sort(function (a, b) { return (a.fra || 0) - (b.fra || 0); });
  var linjerSlut = []; /* sidste "til" pr. linje */
  sorteret.forEach(function (item) {
    var slut = item.punkt ? item.fra : item.til;
    var start = item.fra !== undefined ? item.fra : aarNu();
    var lagt = false;
    for (var r = 0; r < linjerSlut.length; r++) {
      if (linjerSlut[r] < start) { item.raekke = r; linjerSlut[r] = slut; lagt = true; break; }
    }
    if (!lagt) { item.raekke = linjerSlut.length; linjerSlut.push(slut); }
  });
  return { items: sorteret, raekker: linjerSlut.length || 1 };
}

var GRUPPER_T = [
  { id: 'indtaegter', titel: 'Indtægter' },
  { id: 'udgifter', titel: 'Udgifter' },
  { id: 'beholdninger', titel: 'Beholdningernes udbetalinger' },
  { id: 'indbetalinger', titel: 'Indbetalinger' },
  { id: 'overfoersler', titel: 'Overførsler' }
];

/* ---------- tegning ---------- */

function xT(aar) { return (aar - aarNu()) * PXY; }
function bredde() { return (aarSlut() - aarNu() + 1) * PXY; }

function tlAkse() {
  var n = aarSlut() - aarNu() + 1;
  var s = ['<div class="tl-akse">'];

  s.push('<div class="tl-akse-raekke aar">');
  for (var a = aarNu(); a <= aarSlut(); a++) {
    if (a % 5 !== 0 && a !== aarNu()) continue;
    s.push('<span class="tl-akse-maerke" style="left:' + xT(a) + 'px">' + a + '</span>');
  }
  s.push('</div>');

  /* Erhvervsophørets eget mærkat sidder på personens egen aldersrække, ikke i
     en delt række for sig — det gør entydigt, hvis greb hører til hvem.
     Rækken er stadig del af den sticky akse, så mærkatet forbliver synligt,
     uanset hvor langt ned man har rullet i grupperne, og aldrig oven i en
     gruppeoverskrift. */
  PERSONER.forEach(function (p) {
    s.push('<div class="tl-akse-raekke">');
    for (var a2 = aarNu(); a2 <= aarSlut(); a2++) {
      var alder = a2 - p.foedselsaar;
      if (alder < 0 || alder > p.horisont) continue;
      if (alder % 5 !== 0) continue;
      s.push('<span class="tl-akse-maerke" style="left:' + xT(a2) + 'px">' + alder + '</span>');
    }
    s.push('<span class="tl-akse-navn">' + p.navn.slice(0, 1) + '</span>');
    var x = xT(p.foedselsaar + p.erhvervsophoerAlder);
    s.push('<div class="tl-ophoer-greb" data-ophoer="' + p.id + '" style="left:' + x + 'px">' +
      p.navn + ' · ' + p.erhvervsophoerAlder + '</div>');
    s.push('</div>');
  });

  s.push('</div>');
  return s.join('');
}

function tlGitter() {
  var s = [];
  for (var a = aarNu(); a <= aarSlut(); a++) {
    s.push('<div class="tl-gitter' + (a % 5 === 0 ? ' femte' : '') + '" style="left:' + xT(a) + 'px"></div>');
  }
  return s.join('');
}

function tlBoks(item) {
  var klasser = 'tl-boks' + (harLukkedeFriEnder(item) ? ' krop-fri' : '') +
    (TL.valgt === item.id ? ' valgt' : '');
  var venstre = xT(item.fraAaben ? aarNu() : item.fra);
  var hoejre = xT(item.tilAaben ? aarSlut() : item.til) + PXY;
  var top = GRUPPE_HOVED_H + item.raekke * RAEKKE_H;
  var s = ['<div class="' + klasser + '" data-id="' + item.id +
    '" style="left:' + venstre + 'px;width:' + (hoejre - venstre) + 'px;top:' + top +
    'px;background:' + item.farve + '" title="' + item.navn + ' — ' + periodeTekst(item) + '"' +
    (harLukkedeFriEnder(item) ? ' data-traek="krop"' : '') + '>'];
  s.push('<span class="navn">' + item.navn + '</span></div>');
  if (!item.fraLaast && !item.fraAaben) {
    s.push('<div class="tl-haandtag fra" data-id="' + item.id + '" data-traek="fra" ' +
      'style="left:' + venstre + 'px;top:' + top + 'px"></div>');
  }
  if (!item.tilLaast && !item.tilAaben) {
    s.push('<div class="tl-haandtag til" data-id="' + item.id + '" data-traek="til" ' +
      'style="left:' + (hoejre - 6) + 'px;top:' + top + 'px"></div>');
  }
  return s.join('');
}

function tlPunkt(item) {
  var top = GRUPPE_HOVED_H + item.raekke * RAEKKE_H;
  var x = xT(item.fra);
  var laast = !!item.fraLaast;
  return '<div class="tl-punkt' + (TL.valgt === item.id ? ' valgt' : '') + '" data-id="' + item.id +
    '" style="left:' + x + 'px;top:' + top + 'px"' +
    (laast ? '' : ' data-traek="punkt"') + ' title="' + item.navn + ' — ' + periodeTekst(item) + '">' +
    '<span class="rombe" style="background:' + item.farve + '"></span>' +
    '<span class="navn">' + item.navn + '</span></div>';
}

function periodeTekst(item) {
  if (item.punkt) return String(item.fra) + (item.fraLaast ? ' · følger erhvervsophør' : '');
  var fra = item.fraAaben ? 'planens start' : (item.fraLaast ? item.fra + ' · følger erhvervsophør' : String(item.fra));
  var til = item.tilAaben ? 'horisontens slut' : (item.tilLaast ? item.til + ' · følger erhvervsophør' : String(item.til));
  return fra + ' – ' + til;
}

function tlGruppe(def, alleItems) {
  var items = alleItems.filter(function (it) { return it.kategori === def.id; });
  var pakket = pakGruppe(items);
  var hoejde = GRUPPE_HOVED_H + pakket.raekker * RAEKKE_H + 4;

  var s = ['<div class="tl-gruppe' + (TL.foldet[def.id] ? ' foldet' : '') + '">'];
  s.push('<div class="tl-gruppe-hoved" style="width:' + (bredde() + 40) + 'px" onclick="tlFold(\'' +
    def.id + '\')"><span class="vip">›</span>' + def.titel +
    '<span class="antal">' + items.length + '</span></div>');
  s.push('<div class="tl-krop" style="height:' + hoejde + 'px;width:' + bredde() + 'px">');
  s.push(tlGitter());
  pakket.items.forEach(function (item) {
    s.push(item.punkt ? tlPunkt(item) : tlBoks(item));
  });
  s.push('</div></div>');
  return s.join('');
}

/* Selve stregen løber ned gennem grupperne, uden sit eget mærkat — mærkatet
   sidder i den faste akse i stedet (se tlAkse), så det aldrig lægger sig
   oven i en gruppeoverskrift, uanset hvor langt ned linjen når. */
function tlOphoerLinje(p, samletHoejde) {
  var x = xT(p.foedselsaar + p.erhvervsophoerAlder);
  return '<div class="tl-ophoer" style="left:' + x + 'px;height:' + samletHoejde + 'px"></div>';
}

function tlIndhold() {
  var items = tlItems();
  var s = ['<div class="tl-indhold" style="width:' + (bredde() + 40) + 'px">'];
  s.push(tlAkse());

  var groepDele = GRUPPER_T.map(function (def) { return tlGruppe(def, items); });
  s.push(groepDele.join(''));

  /* Samlet højde af alle grupper, til erhvervsophørslinjens fulde udstrækning. */
  var samlet = 0;
  GRUPPER_T.forEach(function (def) {
    if (TL.foldet[def.id]) { samlet += GRUPPE_HOVED_H; return; }
    var n = items.filter(function (it) { return it.kategori === def.id; }).length;
    var raekker = pakGruppe(items.filter(function (it) { return it.kategori === def.id; })).raekker;
    samlet += GRUPPE_HOVED_H + raekker * RAEKKE_H + 4;
  });

  var akseHoejde = 18 * (1 + PERSONER.length); /* årstal + én række pr. person */
  s.push('<div style="position:absolute;left:0;top:' + akseHoejde + 'px;right:0;height:' + samlet + 'px;pointer-events:none">' +
    PERSONER.map(function (p) { return tlOphoerLinje(p, samlet); }).join('') + '</div>');

  s.push('</div>');
  return s.join('');
}

function tegnTL() {
  var el = document.getElementById('tl-rul');
  if (!el) return;
  var scrollX = el.scrollLeft, scrollY = el.scrollTop;
  el.innerHTML = tlIndhold();
  el.scrollLeft = scrollX; el.scrollTop = scrollY;
  tegnGrafT();
  tegnInspektorT();
}

function tlFold(id) { TL.foldet[id] = !TL.foldet[id]; tegnTL(); }

/* ---------- træk ---------- */

var DRAG_T = null; /* { id, slags, startX, startFra, startTil, item } */

function itemVedId(id) {
  var items = tlItems();
  for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
  return null;
}

document.addEventListener('mousedown', function (e) {
  var greb = e.target.closest('[data-traek]');
  var ophoer = e.target.closest('[data-ophoer]');
  if (greb) {
    var id = greb.dataset.id, slags = greb.dataset.traek;
    var item = itemVedId(id);
    if (!item) return;
    DRAG_T = { slags: 'item', traek: slags, id: id, startX: e.clientX, fra: item.fra, til: item.til };
    e.preventDefault();
  } else if (ophoer) {
    var pid = ophoer.dataset.ophoer, p = persT(pid);
    DRAG_T = { slags: 'ophoer', id: pid, startX: e.clientX, startAlder: p.erhvervsophoerAlder };
    e.preventDefault();
  }
});

document.addEventListener('mousemove', function (e) {
  if (!DRAG_T) return;
  var deltaAar = Math.round((e.clientX - DRAG_T.startX) / PXY);

  if (DRAG_T.slags === 'ophoer') {
    var p = persT(DRAG_T.id);
    var ny = clamp(DRAG_T.startAlder + deltaAar, 40, p.horisont);
    /* Regner kun om, når den opløste værdi rent faktisk skifter — ikke ved
       hvert pixel, jf. ADR-0036 og spørgsmål 8. */
    if (ny !== p.erhvervsophoerAlder) { p.erhvervsophoerAlder = ny; tegnTL(); }
    return;
  }

  if (deltaAar === 0) return;
  var o = OVERSTYRING[DRAG_T.id] || {};
  if (DRAG_T.traek === 'punkt') {
    var nyFra = DRAG_T.fra + deltaAar;
    if (o.fra !== nyFra) { o.fra = nyFra; OVERSTYRING[DRAG_T.id] = o; tegnTL(); }
  } else if (DRAG_T.traek === 'krop') {
    var nf = DRAG_T.fra + deltaAar, nt = DRAG_T.til + deltaAar;
    if (o.fra !== nf) { o.fra = nf; o.til = nt; OVERSTYRING[DRAG_T.id] = o; tegnTL(); }
  } else if (DRAG_T.traek === 'fra') {
    var nf2 = Math.min(DRAG_T.fra + deltaAar, (o.til !== undefined ? o.til : DRAG_T.til) - 1);
    if (o.fra !== nf2) { o.fra = nf2; OVERSTYRING[DRAG_T.id] = o; tegnTL(); }
  } else if (DRAG_T.traek === 'til') {
    var nt2 = Math.max(DRAG_T.til + deltaAar, (o.fra !== undefined ? o.fra : DRAG_T.fra) + 1);
    if (o.til !== nt2) { o.til = nt2; OVERSTYRING[DRAG_T.id] = o; tegnTL(); }
  }
});

document.addEventListener('mouseup', function () {
  DRAG_T = null;
});

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* Klik uden træk vælger posten og åbner Inspektøren — trækket selv sætter
   ikke TL.valgt, så et endt træk ikke fejlagtigt tæller som et klik andet
   sted. */
document.addEventListener('click', function (e) {
  var boks = e.target.closest('.tl-boks, .tl-punkt');
  if (!boks) return;
  TL.valgt = boks.dataset.id;
  tegnTL();
});

/* ---------- den forenklede inspektør ----------
   Feltdesignet selv er ikke til revision her — kun at et klik på en
   tidslinje-boks rent faktisk åbner objektets rude, som i den rigtige app. */
function tegnInspektorT() {
  var el = document.getElementById('inspektor-t');
  if (!el) return;
  var item = TL.valgt ? itemVedId(TL.valgt) : null;
  if (!item) {
    el.innerHTML = '<div class="tomrude">Klik en post på tidslinjen<br>for at åbne den her.</div>';
    return;
  }
  var ejer = persT(item.ejer);
  el.innerHTML = '<div class="inspektor">' +
    '<div class="titel">' + item.navn + '</div>' +
    '<div class="undertitel">' + (ejer ? ejer.navn + ' · ' : '') + item.kategori + '</div>' +
    '<div class="afsnit"><h3>Perioden</h3>' +
    feltT('Fra', item.fraAaben ? '<span class="laast">planens start</span>' :
      (item.fraLaast ? '<span class="laast">' + item.fra + ' · følger erhvervsophør</span>' : item.fra)) +
    (item.punkt ? '' : feltT('Til', item.tilAaben ? '<span class="laast">horisontens slut</span>' :
      (item.tilLaast ? '<span class="laast">' + item.til + ' · følger erhvervsophør</span>' : item.til))) +
    '</div>' +
    '<div class="hint">Denne rude er forenklet i mock-uppen — feltdesignet er ikke til revision her, kun at klikket åbner den.</div>' +
    '</div>';
}

function feltT(label, vaerdi) {
  return '<div class="felt"><label>' + label + '</label><span class="vaerdi">' + vaerdi + '</span></div>';
}

/* ---------- den medfølgende formuegraf, kun for at vise farvegenbruget ---- */
function tegnGrafT() {
  var el = document.getElementById('graf-t');
  if (!el) return;
  var DATA = simuler('basis');
  var B = 900, H = 210, M = { t: 8, r: 10, b: 18, l: 50 }, n = DATA.length;
  var x = function (i) { return M.l + i * (B - M.l - M.r) / (n - 1); };
  var baand = BEHOLDNINGER.map(function () { return []; }), toppe = [];
  for (var i = 0; i < n; i++) {
    var pos = 0;
    BEHOLDNINGER.forEach(function (b, si) {
      var v = DATA[i].ultimo[b.id] * DATA[i].deflator;
      baand[si].push([pos, pos + v]); pos += v;
    });
    toppe.push(pos);
  }
  var maks = Math.max.apply(null, toppe) * 1.06;
  var y = function (v) { return M.t + (maks - v) * (H - M.t - M.b) / maks; };

  var s = ['<svg viewBox="0 0 ' + B + ' ' + H + '" role="img" aria-label="Formuegraf">'];
  baand.forEach(function (band, si) {
    var op = [], ned = [];
    for (var i2 = 0; i2 < n; i2++) {
      op.push(x(i2).toFixed(1) + ',' + y(band[i2][1]).toFixed(1));
      ned.unshift(x(i2).toFixed(1) + ',' + y(band[i2][0]).toFixed(1));
    }
    s.push('<polygon points="' + op.concat(ned).join(' ') + '" fill="' + FARVER_T[si] +
      '" stroke="#202730" stroke-width="0.5"/>');
  });
  s.push('</svg>');

  var l = ['<div class="graflegende">'];
  BEHOLDNINGER.forEach(function (b, si) {
    l.push('<span><i style="background:' + FARVER_T[si] + '"></i>' + b.navn + '</span>');
  });
  l.push('</div>');
  el.innerHTML = s.join('') + l.join('');
}

document.addEventListener('DOMContentLoaded', function () {
  tegnGrafT();
  tegnTL();
});
