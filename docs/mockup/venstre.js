/* Fire strukturer for venstre spalte. Samme plan, samme udtryk, samme
   resultatspalte — kun venstre side skifter.

   De fire er valgt, så de dækker to uafhængige akser:

     grupperingsakse   type · tid · person
     redigeringssted   inline · fast rude · i teksten

   A = type + inline      B = type + fast rude
   C = person + i teksten D = tid + fast rude                          */

var V = { model: 'a', valgt: 'b4', tidValgt: 2033 };

var FARVER_V = ['#5b7ba6', '#7d92b0', '#96a6bc', '#a3854e', '#b79a6c', '#c5b38d',
  '#75906c', '#8fa387', '#a6b39d'];

var krV = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
var pctV = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function KV(v) { return krV.format(Math.round(v)); }
function PV(v) { return pctV.format(v * 100) + ' %'; }
function pers(id) { return PERSONER.filter(function (p) { return p.id === id; })[0]; }
function beh(id) { return BEHOLDNINGER.filter(function (b) { return b.id === id; })[0]; }
function netto(b) { return b.brutto - b.aaop; }
function ophoersaar(p) { return p.foedselsaar + p.erhvervsophoerAlder; }
function folkeaar(p) { return p.foedselsaar + p.folkepensionsalder; }

var DATA_V = simuler('basis');

/* ---------- fælles beskrivelser, så de fire modeller siger det samme ---------- */

function behUnder(b) {
  var u = [];
  if (b.type === 'frie') u.push(b.variant);
  if (b.buffer) u.push('buffer');
  if (b.udbetaling) {
    u.push(b.type === 'livrente' ? 'omsættes ' + b.udbetaling.start
      : b.udbetaling.start + '–' + (b.udbetaling.start + b.udbetaling.aar - 1));
  }
  u.push(PV(netto(b)) + ' netto');
  return u.join(' · ');
}
function postUnder(p) { return p.periode + ' · ' + p.gentagelse + ' · ' + p.forfald; }

/* Indbetalingen er én figur i to udgaver. Kilden er hele skellet: en post har
   en periode, en forankring, en gentagelse og et forfald, som bidraget arver
   og derfor ikke bærer selv; en beholdning har ingen af delene at låne ud. */
function kildeV(ind) {
  return ind.kilde.post !== undefined ? POSTER[ind.kilde.post] : beh(ind.kilde.beholdning);
}
function kildenavnV(ind) {
  var k = kildeV(ind);
  return k.navn + (k.ejer ? ' · ' + pers(k.ejer).navn : '');
}
function indNavnV(ind) { return kildenavnV(ind) + ' → ' + beh(ind.destination).navn; }
function indBeloebV(ind) {
  return ind.procent !== undefined ? PV(ind.procent) : KV(ind.beloeb) + ' kr.';
}
function indUnderV(ind) {
  if (ind.kilde.post !== undefined) {
    var p = POSTER[ind.kilde.post];
    return 'Følger ' + kildenavnV(ind) + ': ' + p.periode + ' · ' +
      p.gentagelse.toLowerCase() + ' · ' + p.forfald.toLowerCase();
  }
  return ind.periode + ' · ' + ind.gentagelse.toLowerCase() + ' · ' + ind.forfald.toLowerCase();
}
function indTilV(id) {
  return INDBETALINGER.map(function (ind, i) { return { ind: ind, i: i }; })
    .filter(function (o) { return o.ind.destination === id; });
}
function fradragsretsnoteV(b) {
  var loft = loftFor(b, PLAN.startAar);
  return b.navn + (harFradragsret(b) ? ' giver fradragsret' : ' giver ingen fradragsret') +
    (loft ? (loft.form === 'PerYear' ? ' og har et loft pr. år.' : ' og har et loft på saldoen.')
      : ' og har intet loft.') +
    ' Begge følger destinationen. Om loftet bandt, står i forklar-året.';
}

/* ================= A · HARMONIKA ================= */

function modelA() {
  var h = ['<div class="spaltehoved">Planen<span class="hoejre"><button class="knap">Indstillinger</button></span></div>'];

  h.push(kort('Planen', '', [
    felt('Navn', inp('Ophør som 58', 'tekst')),
    felt('Startår', inp('2026', 'tal')),
    felt('Inflation', inp('2,00', 'tal'), '% p.a.'),
    felt('Kommuneskat', inp('25,40', 'tal'), '%'),
    felt('Kirkeskat', inp('0,74', 'tal'), '%')
  ].join('')));

  h.push(kort('Husstanden', 2, PERSONER.map(function (p) {
    return '<div class="rk"><div class="hoved"><span class="ejer">' + p.navn.charAt(0) + '</span>' +
      '<span class="navn">' + p.navn + '</span><span class="tal">f. ' + p.foedselsaar + '</span></div>' +
      '<div class="under">Ophør ' + p.erhvervsophoerAlder + ' · folkepension ' + p.folkepensionsalder +
      (p.udledt ? ' (udledt)' : ' (overstyret)') + ' · horisont ' + p.horisont + '</div></div>';
  }).join('') + knap('+ Person')));

  h.push(kort('Beholdninger', BEHOLDNINGER.length, BEHOLDNINGER.map(function (b) {
    var valgt = V.valgt === b.id;
    var r = '<div class="rk' + (valgt ? ' valgt' : '') + '" onclick="vaelgV(\'' + b.id + '\')">' +
      '<div class="hoved"><span class="ejer">' + pers(b.ejer).navn.charAt(0) + '</span>' +
      '<span class="navn">' + b.navn + '</span><span class="tal">' + KV(b.saldo) + '</span></div>' +
      '<div class="under">' + behUnder(b) + '</div></div>';
    return valgt ? r + '<div class="rude">' + behFelter(b) + '</div>' : r;
  }).join('') + knap('+ Beholdning')));

  h.push(kort('Ydelser', YDELSER.length, YDELSER.map(function (y) {
    var p = pers(y.ejer);
    return '<div class="rk"><div class="hoved"><span class="ejer">' + p.navn.charAt(0) + '</span>' +
      '<span class="navn">' + y.navn + '</span><span class="tal">' +
      (y.udledt ? '<span class="stille">udledt</span>' : KV(y.beloeb)) + '</span></div>' +
      '<div class="under">' + (y.udledt ? 'fra ' + folkeaar(p) + ' · aftrappes' : 'fra ' + y.startAlder + ' år') +
      '</div></div>';
  }).join('')));

  h.push(kort('Bolig og lån', 0, '<div class="skitse" style="padding:8px"><div class="hint" style="margin:0">' +
    'Etape 4. Ordene mangler i glossaret.</div></div>', 'skitse'));

  h.push(kort('Poster', POSTER.length, POSTER.map(function (p) {
    return '<div class="rk"><div class="hoved"><span class="ejer">' +
      (p.ejer ? pers(p.ejer).navn.charAt(0) : '·') + '</span>' +
      '<span class="navn">' + p.navn + '</span><span class="tal">' +
      (p.retning === 'ud' ? '−' : '') + KV(p.beloeb) + '</span></div>' +
      '<div class="under">' + postUnder(p) + '</div></div>';
  }).join('') + knap('+ Post')));

  h.push(kort('Overførsler', OVERFOERSLER.length, OVERFOERSLER.map(function (o) {
    return '<div class="rk"><div class="hoved"><span class="ejer">→</span>' +
      '<span class="navn">' + beh(o.fra).navn + ' → ' + beh(o.til).navn + '</span>' +
      '<span class="tal">' + KV(o.beloeb) + '</span></div>' +
      '<div class="under">' + o.periode + ' · ' + o.gentagelse + '</div></div>';
  }).join('')));

  return h.join('');
}

function kort(titel, antal, krop, klasse) {
  return '<section class="kort"><h3>' + titel +
    (klasse === 'skitse' ? '<span class="skitsemaerke">skitse</span>' : '') +
    (antal !== '' ? '<span class="antal">' + antal + '</span>' : '') +
    '</h3>' + krop + '</section>';
}
function felt(navn, felt2, enhed) {
  return '<div class="felt"><label>' + navn + '</label><span style="display:flex;gap:8px;align-items:center">' +
    felt2 + '<span class="enhed">' + (enhed || '') + '</span></span></div>';
}
function inp(v, slags) { return '<input class="' + slags + '" value="' + v + '">'; }
function udl(v) { return '<span class="udledt">' + v + '</span>'; }
function vlg(valgmuligheder) {
  return '<select>' + valgmuligheder.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select>';
}
function knap(t) { return '<button class="knap tilfoej">' + t + '</button>'; }

function behFelter(b) {
  var h = ['<h4>Beholdningen</h4>'];
  h.push(felt('Navn', inp(b.navn, 'tekst')));
  h.push(felt('Ejer', vlg([pers(b.ejer).navn])));
  h.push(felt('Saldo', inp(KV(b.saldo), 'tal'), 'kr.'));
  if (b.type === 'frie') {
    h.push(felt('Beskatningsform', vlg(['Aktieindkomst', 'Kapitalindkomst'])));
    h.push(felt('Buffer', '<input type="radio" ' + (b.buffer ? 'checked' : '') + ' style="width:auto">'));
  }
  h.push('<h4>Afkast</h4>');
  h.push(felt('Bruttoafkast', inp(pctV.format(b.brutto * 100), 'tal'), '% p.a.'));
  h.push(felt('ÅOP', inp(pctV.format(b.aaop * 100), 'tal'), '% p.a.'));
  h.push(felt('Nettoafkast', udl(PV(netto(b))), 'udledt'));
  if (b.regime) {
    h.push('<h4>Udbetalingsregime</h4>');
    h.push(felt('Oprettet', vlg([b.regime])));
    h.push(felt('Pensionsudbetalingsalder',
      udl((b.regime.indexOf('2007') > 0 ? 60 : pers(b.ejer).folkepensionsalder - 3) + ' år'), 'udledt'));
  }
  if (b.udbetaling && b.type !== 'livrente') {
    h.push('<h4>Udbetalingsplan</h4>');
    h.push(felt('Start', inp(b.udbetaling.start, 'tal')));
    h.push(felt('Varighed', inp(b.udbetaling.aar, 'tal'), 'år'));
    h.push(felt('Princip', vlg(['Serieprincippet', 'Annuitetsprincippet'])));
  }
  if (b.type === 'livrente') {
    h.push('<h4>Omsætning</h4>');
    h.push(felt('Udbetalingsstart', inp(b.udbetaling.start, 'tal')));
    h.push(felt('Omsætningsfaktor', inp(pctV.format(b.omsaetningsfaktor * 100), 'tal'), '%'));
    h.push(felt('Ydelse', udl(KV(aarV(b.udbetaling.start).udbetaling[b.id])), 'udledt'));
  }
  /* Kun en ordning kan modtage en indbetaling. Går pengene ind i frie midler,
     er det en overførsel — destinationen er hele skellet. */
  if (b.type !== 'frie') {
    var ind = indTilV(b.id);
    h.push('<h4>Indbetaling</h4>');
    h.push(ind.length ? ind.map(function (o) {
      return '<div class="rk"><div class="hoved"><span class="ejer">→</span>' +
        '<span class="navn">' + kildenavnV(o.ind) + '</span>' +
        '<span class="tal">' + indBeloebV(o.ind) + '</span></div>' +
        '<div class="under">' + indUnderV(o.ind) + '</div></div>';
    }).join('') : '<div class="hint" style="margin:0">Ingen indbetaling til denne beholdning.</div>');
    h.push('<div class="hint">' + fradragsretsnoteV(b) + '</div>');
    h.push(knap('+ Indbetaling'));
  }
  return h.join('');
}
function aarV(a) { return DATA_V.filter(function (r) { return r.aar === a; })[0]; }

/* ================= B · NAVIGATOR + INSPEKTØR ================= */

function modelB() {
  var h = ['<div class="spaltehoved">Planen<span class="antal">' +
    (BEHOLDNINGER.length + POSTER.length + INDBETALINGER.length + OVERFOERSLER.length +
      YDELSER.length + 2) + '</span></div>'];

  h.push(navGruppe('Planen', '', '<div class="nav-rk' + (V.valgt === 'plan' ? ' valgt' : '') +
    '" onclick="vaelgV(\'plan\')"><span class="navn">Ophør som 58</span>' +
    '<span class="tal">2026–2080</span></div>'));

  h.push(navGruppe('Husstanden', 2, PERSONER.map(function (p) {
    return navRk(p.id, p.navn, p.foedselsaar + '', null);
  }).join('')));

  h.push(navGruppe('Beholdninger', BEHOLDNINGER.length, BEHOLDNINGER.map(function (b, i) {
    return navRk(b.id, b.navn, KV(b.saldo), FARVER_V[i]);
  }).join('')));

  h.push(navGruppe('Ydelser', YDELSER.length, YDELSER.map(function (y, i) {
    return navRk('y' + i, y.navn + ' · ' + pers(y.ejer).navn,
      y.udledt ? 'udledt' : KV(y.beloeb), null);
  }).join('')));

  h.push(navGruppe('Poster', POSTER.length, POSTER.map(function (p, i) {
    return navRk('p' + i, p.navn, (p.retning === 'ud' ? '−' : '') + KV(p.beloeb), null);
  }).join('')));

  h.push(navGruppe('Indbetalinger', INDBETALINGER.length, INDBETALINGER.map(function (ind, i) {
    return navRk('i' + i, indNavnV(ind), indBeloebV(ind), null);
  }).join('')));

  h.push(navGruppe('Overførsler', OVERFOERSLER.length, OVERFOERSLER.map(function (o, i) {
    return navRk('o' + i, beh(o.fra).navn + ' → ' + beh(o.til).navn, KV(o.beloeb), null);
  }).join('')));

  return h.join('');
}
function navGruppe(titel, antal, krop) {
  return '<div class="nav-gruppe"><h3>' + titel +
    (antal !== '' ? '<span class="antal">' + antal + '</span>' : '') + '</h3>' + krop + '</div>';
}
function navRk(id, navn, tal, farve) {
  return '<div class="nav-rk' + (V.valgt === id ? ' valgt' : '') + '" onclick="vaelgV(\'' + id + '\')">' +
    (farve ? '<i class="prik" style="background:' + farve + '"></i>' : '') +
    '<span class="navn">' + navn + '</span><span class="tal">' + tal + '</span></div>';
}

function inspektor() {
  if (/^i\d+$/.test(V.valgt)) {
    var ind = INDBETALINGER[+V.valgt.slice(1)];
    var fraPost = ind.kilde.post !== undefined;
    var dest = beh(ind.destination);
    var pct = ind.procent !== undefined;
    return '<div class="spaltehoved">Inspektør</div><div class="inspektor">' +
      '<div class="titel">Indbetaling<span class="luk">×</span></div>' +
      '<div class="undertitel">' + indNavnV(ind) + '</div>' +
      '<h4>Indbetalingen</h4>' +
      felt('Kilde', vlg([kildenavnV(ind)])) +
      felt('Destination', vlg([dest.navn + ' · ' + pers(dest.ejer).navn])) +
      '<div class="hint">' + (fraPost
        ? 'Kilden er en post, så AM-bidraget trækkes på vejen ind. '
        : 'Kilden er en beholdning, så der trækkes intet AM-bidrag. ') +
      fradragsretsnoteV(dest) + '</div>' +
      '<h4>Beløb</h4>' +
      felt(pct ? 'Procent af posten' : 'Fast beløb',
        inp(pct ? pctV.format(ind.procent * 100) : KV(ind.beloeb), 'tal'), pct ? '%' : 'kr.') +
      /* Det arvede står som én linje og ikke som felter: bidraget har dem ikke. */
      (fraPost
        ? '<h4>Følger ' + kildenavnV(ind) + '</h4><div class="hint" style="margin:0">' +
          indUnderV(ind).replace('Følger ' + kildenavnV(ind) + ': ', '') +
          '. Periode, forankring, gentagelse og forfald hører til posten.</div>'
        : '<h4>Perioden</h4>' +
          felt('Forankring', vlg([ind.forankring === 'alder' ? 'Alder' : 'Kalenderår'])) +
          felt('Periode', inp(ind.periode, 'tekst')) +
          felt('Gentagelse', vlg([ind.gentagelse])) +
          felt('Forfald', vlg([ind.forfald]))) +
      '</div>';
  }
  var b = beh(V.valgt);
  if (!b) {
    return '<div class="spaltehoved">Inspektør</div><div class="inspektor">' +
      '<div class="titel">Planen</div>' +
      '<div class="undertitel">Det, der gælder hele forløbet</div>' +
      '<h4>Grundlag</h4>' +
      felt('Navn', inp('Ophør som 58', 'tekst')) +
      felt('Startår', inp('2026', 'tal')) +
      felt('Inflation', inp('2,00', 'tal'), '% p.a.') +
      '<h4>Skat</h4>' +
      felt('Kommuneskat', inp('25,40', 'tal'), '%') +
      felt('Kirkeskat', inp('0,74', 'tal'), '%') +
      '<h4>Fremskrivning</h4>' +
      felt('§ 20-regulering', inp('2,00', 'tal'), '% p.a.') +
      felt('Folkepensionsregulering', inp('2,00', 'tal'), '% p.a.') +
      '<div class="hint">Sidst kendte satsår er 2026.</div></div>';
  }
  return '<div class="spaltehoved">Inspektør</div><div class="inspektor">' +
    '<div class="titel">' + b.navn + '<span class="luk">×</span></div>' +
    '<div class="undertitel">' + pers(b.ejer).navn + ' · ' + behUnder(b) + '</div>' +
    behFelter(b) + '</div>';
}

/* ================= C · DOKUMENT ================= */

function modelC() {
  var h = ['<div class="spaltehoved">Planen<span class="hoejre">' +
    '<button class="knap">Rediger som liste</button></span></div><div class="dok">'];

  PERSONER.forEach(function (p) {
    var egne = BEHOLDNINGER.filter(function (b) { return b.ejer === p.id; });
    var sum = egne.reduce(function (a, b) { return a + b.saldo; }, 0);
    var poster = POSTER.filter(function (x) { return x.ejer === p.id; });

    h.push('<section><h2>' + p.navn + '<span class="bi">født ' + p.foedselsaar +
      ' · ' + (2026 - p.foedselsaar) + ' år i dag</span></h2>');
    h.push('<p>Holder op med at arbejde som <span class="v">' + p.erhvervsophoerAlder +
      '</span> — altså i <span class="stille">' + ophoersaar(p) + '</span>.</p>');
    h.push('<p>Får folkepension som <span class="v">' + p.folkepensionsalder + '</span> i ' +
      '<span class="stille">' + folkeaar(p) + '</span>' +
      (p.udledt ? ', udledt af fødselsåret.' : ', overstyret — ikke vedtaget for hendes fødselsår.') + '</p>');
    h.push('<p>Planen regner med, at ' + p.navn + ' lever til <span class="v">' + p.horisont + '</span>.</p>');

    h.push('<h3>Beholdninger <span class="sum">' + egne.length + ' · ' + KV(sum) + ' kr.</span></h3>');
    egne.forEach(function (b) {
      var s = '<p class="spids">· <span class="v ord">' + b.navn + '</span> ' +
        '<span class="v">' + KV(b.saldo) + '</span> kr.';
      if (b.type === 'frie') s += ', beskattet som <span class="v ord">' + b.variant.toLowerCase() + '</span>';
      if (b.buffer) s += ' og udpeget som <span class="v ord">buffer</span>';
      if (b.udbetaling && b.type !== 'livrente') {
        s += ', udbetales over <span class="v">' + b.udbetaling.aar + '</span> år fra ' +
          '<span class="v">' + b.udbetaling.start + '</span> efter <span class="v ord">' +
          b.udbetaling.princip.toLowerCase() + '</span>';
      }
      if (b.type === 'livrente') {
        s += ', omsættes i <span class="v">' + b.udbetaling.start + '</span> med faktor ' +
          '<span class="v">' + pctV.format(b.omsaetningsfaktor * 100) + ' %</span>';
      }
      s += '. <span class="stille">Afkast <span class="v">' + pctV.format(b.brutto * 100) +
        '</span> minus ÅOP <span class="v">' + pctV.format(b.aaop * 100) + '</span> = ' +
        PV(netto(b)) + ' netto.</span></p>';
      h.push(s);
    });

    if (poster.length) {
      h.push('<h3>Poster</h3>');
      poster.forEach(function (x) {
        h.push('<p class="spids">· <span class="v ord">' + x.navn + '</span> ' +
          (x.retning === 'ud' ? 'ud af' : 'ind i') + ' husstanden med <span class="v">' +
          KV(x.beloeb) + '</span> kr. om året, <span class="v ord">' + x.periode +
          '</span>. <span class="stille">' + x.gentagelse.toLowerCase() + ', ' +
          x.forfald.toLowerCase() + (x.skat ? ', ' + x.skat.toLowerCase() : '') + '.</span></p>');
      });
    }
    h.push('</section>');
  });

  var faelles = POSTER.filter(function (x) { return !x.ejer; });
  h.push('<section><h2>Fælles<span class="bi">husstandens egne udgifter</span></h2>');
  faelles.forEach(function (x) {
    h.push('<p class="spids">· <span class="v ord">' + x.navn + '</span> <span class="v">−' +
      KV(x.beloeb) + '</span> kr., <span class="v ord">' + x.periode + '</span>. ' +
      '<span class="stille">' + x.gentagelse.toLowerCase() + ', ' + x.forfald.toLowerCase() + '.</span></p>');
  });
  h.push('<h3>Overførsler</h3>');
  OVERFOERSLER.forEach(function (o) {
    h.push('<p class="spids">· <span class="v">' + KV(o.beloeb) + '</span> kr. fra ' +
      '<span class="v ord">' + beh(o.fra).navn + '</span> til <span class="v ord">' +
      beh(o.til).navn + '</span>, <span class="v ord">' + o.periode + '</span>.</p>');
  });
  h.push('</section>');

  h.push('<section><h2>Forudsætninger<span class="bi">gælder hele forløbet</span></h2>' +
    '<p>Inflationen antages til <span class="v">2,00 %</span> om året, lønnen reguleres med ' +
    '<span class="v">3,00 %</span>.</p>' +
    '<p>Kommuneskatten er <span class="v">25,40 %</span> og kirkeskatten <span class="v">0,74 %</span>.</p>' +
    '<p>Satsår <span class="v">2026</span> er det sidst kendte. Årene efter regnes på fremskrevne satser.</p>' +
    '<p class="stille">Bolig og lån er ikke i planen.<span class="skitsemaerke">etape 4</span></p>' +
    '</section>');

  h.push('</div>');
  return h.join('');
}

/* ================= D · TIDSLINJE ================= */

function begivenheder() {
  var j = PERSONER[0], a = PERSONER[1], b = [];

  b.push({ aar: null, hoved: 'Hele forløbet' });
  b.push({ id: 'plan', aar: '—', hvad: 'Forudsætninger', under: 'Inflation 2,00 % · kommuneskat 25,40 % · satsår 2026' });
  b.push({ id: 'husstand', aar: '—', hvad: 'Husstanden', under: 'Jesper f. 1973 · Anne f. 1985 · horisont 2080' });
  b.push({
    id: 'loebende', aar: '—', hvad: 'Løbende poster',
    under: POSTER.filter(function (p) { return p.periode === 'Hele horisonten'; }).length + ' poster hele vejen',
    beloeb: '−' + KV(POSTER.filter(function (p) { return p.periode === 'Hele horisonten'; })
      .reduce(function (s, p) { return s + p.beloeb; }, 0))
  });

  b.push({ aar: null, hoved: 'Forløbet' });
  b.push({ id: 'b-nu', aar: 2026, hvad: 'I dag', under: BEHOLDNINGER.length + ' beholdninger', maerke: true,
    beloeb: KV(BEHOLDNINGER.reduce(function (s, x) { return s + x.saldo; }, 0)) });
  b.push({ id: 'b-udd', aar: 2027, hvad: 'Uddannelse, børnene', under: 'til 2033 · hvert år', beloeb: '−60.000' });
  b.push({ id: 'b-bil', aar: 2028, hvad: 'Bil, udskiftning', under: 'hvert 8. år til 2060', beloeb: '−420.000' });
  b.push({ id: 'b-kok', aar: 2029, hvad: 'Nyt køkken', under: 'én gang · august', beloeb: '−320.000' });
  b.push({ id: 'b-ophj', aar: ophoersaar(j), hvad: 'Jesper holder op med at arbejde', maerke: true,
    under: 'som ' + j.erhvervsophoerAlder + ' · lønnen falder bort · rejser begynder' });
  b.push({ id: 'b-bro', aar: 2031, hvad: 'Broperiode', under: '2 år til første udbetaling — bæres af frie midler' });
  b.push({ id: 'b4', aar: 2033, hvad: 'Tre ratepensioner begynder', maerke: true,
    under: 'oprettet før 1. maj 2007 · udbetalingsalder 60 · over 10 år',
    beloeb: KV(aarV(2033).ordningsindkomst * aarV(2033).deflator) });
  b.push({ id: 'b-arv', aar: 2038, hvad: 'Arv efter far', under: 'skattefri · én gang', beloeb: '+900.000' });
  b.push({ id: 'b-fpj', aar: folkeaar(j), hvad: 'Jesper får folkepension', maerke: true,
    under: 'ratepensionerne er tømt året før · aldersopsparing begynder',
    beloeb: KV(aarV(2043).ydelser * aarV(2043).deflator) });
  b.push({ id: 'b-opha', aar: ophoersaar(a), hvad: 'Anne holder op med at arbejde', maerke: true,
    under: 'som ' + a.erhvervsophoerAlder + ' · 7 år til hendes første udbetaling' });
  b.push({ id: 'b8', aar: 2054, hvad: 'Annes ratepension og livrente', maerke: true,
    under: 'livrentedepotet omsættes · aftrapper Jespers pensionstillæg' });
  b.push({ id: 'b-fpa', aar: folkeaar(a), hvad: 'Anne får folkepension', maerke: true,
    under: 'begge er nu pensionister · aftrapningen falder fra 32 % til 16 %' });
  b.push({ id: 'b-slut', aar: 2080, hvad: 'Horisonten', under: 'Annes 95. år · formue 2.421.690 kr.' });
  return b;
}

function modelD() {
  var h = ['<div class="spaltehoved">Planen<span class="hoejre">' +
    '<button class="knap">Efter type</button></span></div><div class="tid">'];
  begivenheder().forEach(function (e) {
    if (e.hoved) { h.push('<div class="tid-hoved">' + e.hoved + '</div>'); return; }
    h.push('<div class="tid-post' + (V.valgt === e.id ? ' valgt' : '') + (e.maerke ? ' maerke' : '') +
      '" onclick="vaelgV(\'' + e.id + '\')">' +
      '<span class="aar">' + e.aar + '</span>' +
      (e.beloeb ? '<span class="beloeb">' + e.beloeb + '</span>' : '') +
      '<div class="hvad">' + e.hvad + '</div>' +
      (e.under ? '<div class="under">' + e.under + '</div>' : '') + '</div>');
  });
  h.push('</div>');
  return h.join('');
}

function inspektorD() {
  if (V.valgt === 'b4') {
    var r = ['<div class="spaltehoved">2033 · Tre ratepensioner</div><div class="inspektor">'];
    r.push('<div class="titel">Udbetalingen begynder</div>');
    r.push('<div class="undertitel">Jesper fylder 60. Alle tre ordninger er oprettet før 1. maj 2007 og må ' +
      'derfor udbetales fra 60 — ti år før folkepensionen.</div>');
    ['b4', 'b5', 'b6'].forEach(function (id) {
      var b = beh(id);
      r.push('<h4>' + b.navn + '</h4>');
      r.push(felt('Saldo i dag', udl(KV(b.saldo)), 'kr.'));
      r.push(felt('Start', inp(b.udbetaling.start, 'tal')));
      r.push(felt('Varighed', inp(b.udbetaling.aar, 'tal'), 'år'));
      r.push(felt('Princip', vlg(['Serieprincippet', 'Annuitetsprincippet'])));
    });
    r.push('<div class="hint">Tømmes de inden Jesper fylder 70, rammer de aldrig pensionstillægget. ' +
      'Det er den beslutning, hele planen står og falder med.</div></div>');
    return r.join('');
  }
  var b2 = beh(V.valgt);
  if (b2) {
    return '<div class="spaltehoved">Inspektør</div><div class="inspektor">' +
      '<div class="titel">' + b2.navn + '<span class="luk">×</span></div>' +
      '<div class="undertitel">' + pers(b2.ejer).navn + ' · ' + behUnder(b2) + '</div>' + behFelter(b2) + '</div>';
  }
  return '<div class="spaltehoved">Inspektør</div><div class="inspektor">' +
    '<div class="titel">Vælg en begivenhed</div>' +
    '<div class="undertitel">Ruden viser det, der hører til det valgte år — og kun det.</div></div>';
}

/* ---------- resultatspalten ---------- */

function grafV() {
  var B = 900, H = 150, M = { t: 8, r: 8, b: 18, l: 50 }, n = DATA_V.length;
  var x = function (i) { return M.l + i * (B - M.l - M.r) / (n - 1); };
  var baand = BEHOLDNINGER.map(function () { return []; }), toppe = [];
  for (var i = 0; i < n; i++) {
    var pos = 0;
    BEHOLDNINGER.forEach(function (b, si) {
      var v = DATA_V[i].ultimo[b.id] * DATA_V[i].deflator;
      baand[si].push([pos, pos + v]); pos += v;
    });
    toppe.push(pos);
  }
  var maks = Math.max.apply(null, toppe) * 1.06;
  var y = function (v) { return M.t + (maks - v) * (H - M.t - M.b) / maks; };
  var s = ['<svg viewBox="0 0 ' + B + ' ' + H + '" role="img" aria-label="Formuegraf">'];
  for (var v2 = 0; v2 <= maks; v2 += 5000000) {
    s.push('<line x1="' + M.l + '" x2="' + (B - M.r) + '" y1="' + y(v2).toFixed(1) + '" y2="' + y(v2).toFixed(1) +
      '" stroke="' + (v2 === 0 ? '#3d4855' : '#2a323c') + '"/>');
    s.push('<text x="' + (M.l - 7) + '" y="' + (y(v2) + 3.5).toFixed(1) +
      '" text-anchor="end" font-size="9.5" fill="#78838f">' + (v2 / 1000000) + ' mio.</text>');
  }
  baand.forEach(function (band, si) {
    var op = [], ned = [];
    for (var i2 = 0; i2 < n; i2++) {
      op.push(x(i2).toFixed(1) + ',' + y(band[i2][1]).toFixed(1));
      ned.unshift(x(i2).toFixed(1) + ',' + y(band[i2][0]).toFixed(1));
    }
    s.push('<polygon points="' + op.concat(ned).join(' ') + '" fill="' + FARVER_V[si] +
      '" stroke="#202730" stroke-width="0.5"/>');
  });
  for (var i3 = 0; i3 < n; i3++) {
    if (DATA_V[i3].aar % 10) continue;
    var anker = x(i3) > B - M.r - 20 ? 'end' : 'middle';
    s.push('<text x="' + x(i3).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="' + anker +
      '" font-size="9.5" fill="#78838f">' + DATA_V[i3].aar + '</text>');
  }
  s.push('</svg>');
  return '<div class="graf">' + s.join('') + '</div>';
}

function tabelV() {
  var h = ['<div class="tabelramme"><table class="aar"><thead><tr>'];
  ['År', 'J', 'A', 'Løn m.v.', 'Ordninger', 'Ydelser', 'Afkast', 'Skat', 'Udgifter', 'Formue']
    .forEach(function (k) { h.push('<th>' + k + '</th>'); });
  h.push('</tr></thead><tbody>');
  DATA_V.forEach(function (r) {
    var f = r.deflator;
    h.push('<tr' + (r.aar === 2043 ? ' class="valgt"' : '') + '><td>' + r.aar + '</td>' +
      '<td class="alder">' + r.aldre.j + '</td><td class="alder">' + r.aldre.a + '</td>' +
      '<td>' + (r.loenIalt ? KV(r.loenIalt * f) : '<span class="svag">–</span>') + '</td>' +
      '<td>' + (r.ordningsindkomst ? KV(r.ordningsindkomst * f) : '<span class="svag">–</span>') + '</td>' +
      '<td>' + (r.ydelser ? KV(r.ydelser * f) : '<span class="svag">–</span>') + '</td>' +
      '<td>' + KV(r.afkastIalt * f) + '</td><td>−' + KV(r.skat * f) + '</td>' +
      '<td>−' + KV(r.udgifter * f) + '</td>' +
      '<td class="formue">' + KV(r.ultimoFormue * f) + '</td></tr>');
  });
  h.push('</tbody></table></div>');
  return h.join('');
}

function resultatV() {
  return '<div class="resultathoved"><span class="titel">Resultatet</span>' +
    '<span class="omskifter"><button aria-pressed="true">Nutidskroner</button>' +
    '<button aria-pressed="false">Fremtidskroner</button></span></div>' + grafV() + tabelV();
}

/* ---------- sammensætning ---------- */

var MODELLER = {
  a: { spalter: '384px minmax(0,1fr)', dele: [modelA, resultatV] },
  b: { spalter: '236px 340px minmax(0,1fr)', dele: [modelB, inspektor, resultatV] },
  c: { spalter: '432px minmax(0,1fr)', dele: [modelC, resultatV] },
  d: { spalter: '312px 336px minmax(0,1fr)', dele: [modelD, inspektorD, resultatV] }
};

function tegnV() {
  var m = MODELLER[V.model];
  var s = document.getElementById('spalter');
  s.style.gridTemplateColumns = m.spalter;
  s.innerHTML = m.dele.map(function (d) { return '<div class="spalte">' + d() + '</div>'; }).join('');
  Array.prototype.forEach.call(document.querySelectorAll('.kappe nav button'), function (b) {
    b.setAttribute('aria-current', b.dataset.m === V.model);
  });
}

function saetModel(m) {
  V.model = m;
  V.valgt = 'b4';
  location.hash = m;
  tegnV();
}
function vaelgV(id) { V.valgt = V.valgt === id ? null : id; tegnV(); }

document.addEventListener('DOMContentLoaded', function () {
  var h = (location.hash || '').replace('#', '');
  if (MODELLER[h]) V.model = h;
  tegnV();
});
