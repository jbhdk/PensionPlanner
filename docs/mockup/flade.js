/* Fladekortets tegnelag. Ingen ramme, intet bibliotek — graferne er råt SVG,
   netop fordi bibliotekvalget ikke er truffet endnu. */

var TILSTAND = { skaerm: 'hoved', kroner: 'real', aar: 2043, variant: 'basis', valgtBeholdning: 'b4' };

var FARVER = {
  b1: '#4a6f92', b2: '#7d9ab3', b3: '#a8bccc',
  b4: '#8a7a5e', b5: '#a8977a', b6: '#c4b699',
  b7: '#6e8a6a', b8: '#94ab8f', b9: '#b9c9b3'
};

var kr = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
var pct = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function K(v) { return kr.format(Math.round(v)); }
function P(v) { return pct.format(v * 100) + ' %'; }
function mio(v) { return (v / 1000000).toFixed(1).replace('.', ',') + ' mio.'; }
function person(id) { return PERSONER.filter(function (p) { return p.id === id; })[0]; }
function beholdning(id) { return BEHOLDNINGER.filter(function (b) { return b.id === id; })[0]; }

var RAEKKER = { basis: simuler('basis'), uholdbar: simuler('uholdbar') };
function raekker() { return RAEKKER[TILSTAND.variant === 'uholdbar' ? 'uholdbar' : 'basis']; }
function faktor(r) { return TILSTAND.kroner === 'real' ? r.deflator : 1; }
function aarsraekke(aar) { return raekker().filter(function (r) { return r.aar === aar; })[0]; }

/* ================= venstre spalte ================= */

function tegnPlanspalte() {
  var j = PERSONER[0], a = PERSONER[1];
  var horisont = Math.max(j.foedselsaar + j.horisont, a.foedselsaar + a.horisont);
  var h = [];

  h.push('<div class="spaltehoved">Planen</div>');

  h.push(afsnit('Planen', '', [
    felt('Navn', input('text', PLAN.navn, 150)),
    felt('Startår', input('number', PLAN.startAar)),
    felt('Inflation', input('number', pct.format(PLAN.inflation * 100)), '% p.a.'),
    felt('Kommuneskat', input('number', pct.format(PLAN.kommuneskat * 100)), '%'),
    felt('Kirkeskat', input('number', pct.format(PLAN.kirkeskat * 100)), '%'),
    felt('§ 20-regulering', input('number', pct.format(PLAN.paragraf20 * 100)), '% p.a.'),
    felt('Satsregulering', input('number', pct.format(PLAN.satsregulering * 100)), '% p.a.'),
    '<div class="hint">Sidst kendte satsår er ' + PLAN.sidstKendteSatsaar +
      '. Årene efter regnes på fremskrevne satser og er mærket ≈ i tabellen.</div>'
  ].join('')));

  var personer = PERSONER.map(function (p) {
    return '<div class="linje"><span class="ejermaerke">' + p.navn.charAt(0) + '</span>' +
      '<span class="navn">' + p.navn + '</span>' +
      '<span class="tal">f. ' + p.foedselsaar + '</span>' +
      '<span class="under">Erhvervsophør ' + p.erhvervsophoerAlder +
      ' · folkepension ' + p.folkepensionsalder +
      (p.udledt ? ' <em>(udledt)</em>' : ' <em>(overstyret)</em>') +
      ' · horisont ' + p.horisont + '</span></div>';
  }).join('');
  h.push(afsnit('Husstanden', 2, personer +
    '<div class="hint">Husstandens horisont: <span class="udledt" style="width:auto">' + horisont +
    '</span> — den længstlevendes.</div>' +
    '<button class="knap tilfoej">+ Person</button>'));

  h.push(afsnit('Beholdninger', BEHOLDNINGER.length,
    BEHOLDNINGER.map(beholdningslinje).join('') +
    '<button class="knap tilfoej">+ Beholdning</button>'));

  h.push(afsnit('Ydelser', YDELSER.length, YDELSER.map(function (y) {
    var p = person(y.ejer);
    return '<div class="linje"><span class="ejermaerke">' + p.navn.charAt(0) + '</span>' +
      '<span class="navn">' + y.navn + '</span>' +
      '<span class="tal">' + (y.udledt ? '<em class="udledt" style="width:auto;border:0">udledt</em>' : K(y.beloeb) + ' kr.') + '</span>' +
      '<span class="under">' + (y.udledt
        ? 'Grundbeløb og pensionstillæg fra ' + (p.foedselsaar + p.folkepensionsalder) + ' · aftrappes'
        : 'Fra ' + y.startAlder + ' år · satsreguleres') + '</span></div>';
  }).join('') + '<button class="knap tilfoej">+ Ydelse</button>'));

  h.push(afsnit('Bolig og lån', 0,
    '<div class="skitse" style="padding:8px">' +
    '<div class="tom">Ingen bolig og ingen lån i planen.</div>' +
    '<div class="hint">Etape 4. Bolig, restgæld, ejendomsværdiskat, grundskyld og nedsparingslån ' +
    'står ikke i glossaret endnu — ordene her er skitse, ikke afgjort.</div>' +
    '<button class="knap tilfoej">+ Bolig</button> <button class="knap tilfoej">+ Lån</button>' +
    '</div>', 'skitse'));

  h.push(afsnit('Poster', POSTER.length, POSTER.map(function (post) {
    var ejer = post.ejer ? person(post.ejer).navn.charAt(0) : '·';
    return '<div class="linje"><span class="ejermaerke">' + ejer + '</span>' +
      '<span class="navn">' + post.navn + '</span>' +
      '<span class="tal">' + (post.retning === 'ud' ? '−' : '') + K(post.beloeb) + ' kr.</span>' +
      '<span class="under">' + post.periode + ' · ' + post.gentagelse + ' · ' + post.forfald +
      (post.skat ? ' · ' + post.skat : '') +
      (post.egenRegulering !== undefined ? ' · reguleres ' + P(post.egenRegulering) : '') +
      '</span></div>';
  }).join('') +
    '<div class="hint">Lønposter tastes <b>brutto, inklusive arbejdsgiverens pensionsbidrag</b> ' +
    '— tallet på lønsedlen og ikke det, der går ind på kontoen. Bidraget flyttes til ordningen ' +
    'som en indbetaling for sig; taster du nettolønnen og lægger et bidrag oveni, går alle tal ' +
    'op og er alligevel forkerte.</div>' +
    '<button class="knap tilfoej">+ Post</button>'));

  h.push(afsnit('Indbetalinger', INDBETALINGER.length, INDBETALINGER.map(function (ind) {
    return '<div class="linje"><span class="ejermaerke">→</span>' +
      '<span class="navn">' + kildenavn(ind) + ' → ' + beholdning(ind.destination).navn + '</span>' +
      '<span class="tal">' + indbetalingsbeloeb(ind) + '</span>' +
      '<span class="under">' + (ind.kilde.post !== undefined
        ? 'Arver periode, gentagelse og forfald fra posten'
        : ind.periode + ' · ' + ind.gentagelse.toLowerCase() + ' · ' + ind.forfald.toLowerCase()) +
      '</span></div>';
  }).join('') + '<button class="knap tilfoej">+ Indbetaling</button>'));

  h.push(afsnit('Overførsler', OVERFOERSLER.length, OVERFOERSLER.map(function (o) {
    var f = beholdning(o.fra), t = beholdning(o.til);
    return '<div class="linje"><span class="ejermaerke">→</span>' +
      '<span class="navn">' + f.navn + ' → ' + t.navn + '</span>' +
      '<span class="tal">' + K(o.beloeb) + ' kr.</span>' +
      '<span class="under">' + person(f.ejer).navn + ' → ' + person(t.ejer).navn +
      ' · ' + o.periode + ' · ' + o.gentagelse + ' · ' + o.forfald + '</span></div>';
  }).join('') + '<button class="knap tilfoej">+ Overførsel</button>'));

  return h.join('');
}

function afsnit(titel, antal, krop, klasse) {
  var aaben = ['Husstanden', 'Beholdninger'].indexOf(titel) >= 0;
  return '<details class="afsnit"' + (aaben ? ' open' : '') + '><summary>' + titel +
    (klasse === 'skitse' ? '<span class="skitsemaerke">skitse</span>' : '') +
    (antal !== '' ? '<span class="antal">' + antal + '</span>' : '') +
    '</summary><div class="afsnitskrop">' + krop + '</div></details>';
}
function felt(navn, felt2, enhed) {
  return '<div class="felt"><label>' + navn + '</label><span>' + felt2 +
    (enhed ? ' <span class="enhed">' + enhed + '</span>' : '') + '</span></div>';
}
function input(type, v, bredde) {
  return '<input type="text" value="' + v + '"' + (bredde ? ' style="width:' + bredde + 'px"' : '') + '>';
}
function udledt(v) { return '<span class="udledt">' + v + '</span>'; }

function beholdningslinje(b) {
  var p = person(b.ejer);
  var valgt = TILSTAND.valgtBeholdning === b.id;
  var under = [];
  if (b.type === 'frie') under.push(b.variant);
  if (b.buffer) under.push('<b>buffer</b>');
  if (b.regime) under.push('oprettet ' + b.regime);
  if (b.udbetaling) {
    under.push(b.type === 'livrente'
      ? 'omsættes ' + b.udbetaling.start
      : 'udbetales ' + b.udbetaling.start + '–' + (b.udbetaling.start + b.udbetaling.aar - 1));
  }
  under.push(P(nettoafkast(b)) + ' netto');

  var linje = '<div class="linje' + (valgt ? ' valgt' : '') + '" onclick="vaelgBeholdning(\'' + b.id + '\')">' +
    '<span class="ejermaerke">' + p.navn.charAt(0) + '</span>' +
    '<span class="navn">' + b.navn + '</span>' +
    '<span class="tal">' + K(b.saldo) + ' kr.</span>' +
    '<span class="under">' + under.join(' · ') + '</span></div>';

  return valgt ? linje + beholdningsdetalje(b) : linje;
}

function beholdningsdetalje(b) {
  var h = ['<div class="detalje">'];
  h.push('<h4>Beholdningen</h4>');
  h.push(felt('Navn', input('text', b.navn, 150)));
  h.push(felt('Ejer', '<select><option>' + person(b.ejer).navn + '</option></select>'));
  h.push(felt('Saldo', input('number', K(b.saldo)), 'kr. (dagens kroner)'));
  if (b.type === 'frie') {
    h.push(felt('Beskatningsform', '<select><option>Aktieindkomst</option><option>Kapitalindkomst</option></select>'));
    h.push(felt('Buffer', '<input type="radio" checked style="width:auto">'));
  }
  h.push('<h4>Afkast</h4>');
  h.push(felt('Bruttoafkast', input('number', pct.format(b.brutto * 100)), '% p.a.'));
  h.push(felt('ÅOP', input('number', pct.format(b.aaop * 100)), '% p.a.'));
  h.push(felt('Nettoafkast', udledt(P(nettoafkast(b))), 'udledt'));

  if (b.regime) {
    h.push('<h4>Udbetalingsregime</h4>');
    h.push(felt('Oprettet', '<select><option>' + b.regime + '</option></select>'));
    var pa = b.regime.indexOf('2007') > 0 ? 60 : person(b.ejer).folkepensionsalder - 3;
    h.push(felt('Pensionsudbetalingsalder', udledt(pa + ' år'), 'udledt'));
  }
  if (b.udbetaling && b.type !== 'livrente') {
    h.push('<h4>Udbetalingsplan</h4>');
    h.push(felt('Start', input('number', b.udbetaling.start)));
    h.push(felt('Varighed', input('number', b.udbetaling.aar), 'år'));
    h.push(felt('Princip', '<select><option>Serieprincippet</option><option>Annuitetsprincippet</option></select>'));
    h.push('<div class="hint">Beløbet pr. år følger af princippet og saldoen — det tastes ikke.</div>');
  }
  if (b.type === 'livrente') {
    h.push('<h4>Omsætning</h4>');
    h.push(felt('Udbetalingsstart', input('number', b.udbetaling.start)));
    h.push(felt('Omsætningsfaktor', input('number', pct.format(b.omsaetningsfaktor * 100)), '%'));
    h.push(felt('Ydelse fra ' + b.udbetaling.start, udledt(K(aarsraekke(b.udbetaling.start).udbetaling[b.id]) + ' kr.'), 'udledt'));
  }
  if (b.type !== 'frie') {
    var ind = indbetalingerTil(b.id);
    h.push('<h4>Indbetaling</h4>');
    h.push(ind.length ? ind.map(indbetalingslinje).join('')
      : '<div class="tom">Ingen indbetaling til denne beholdning.</div>');
    h.push('<div class="hint">' + fradragsretsnote(b) + '</div>');
    h.push('<button class="knap tilfoej">+ Indbetaling</button>');
  }
  h.push('</div>');
  return h.join('');
}

/* ---------- indbetalingens to former ----------
   Ét objekt i to udgaver, ikke to slags. Kilden er hele skellet: en post har
   en periode, en forankring, en gentagelse og et forfald, som bidraget arver
   og derfor ikke bærer selv; en beholdning har ingen af delene at låne ud.  */

function indbetalingskilde(ind) {
  return ind.kilde.post !== undefined ? POSTER[ind.kilde.post] : beholdning(ind.kilde.beholdning);
}
function kildenavn(ind) {
  var k = indbetalingskilde(ind);
  return k.navn + (k.ejer ? ' · ' + person(k.ejer).navn : '');
}
function indbetalingsbeloeb(ind) {
  return ind.procent !== undefined ? P(ind.procent) : K(ind.beloeb) + ' kr.';
}
function indbetalingerTil(id) {
  return INDBETALINGER.filter(function (ind) { return ind.destination === id; });
}
function fradragsretsnote(b) {
  var loft = loftFor(b, PLAN.startAar);
  return b.navn + (harFradragsret(b) ? ' giver fradragsret' : ' giver ingen fradragsret') +
    (loft ? (loft.form === 'PerYear' ? ' og har et loft pr. år.' : ' og har et loft på saldoen.')
      : ' og har intet loft.') +
    ' Begge følger destinationen og tastes ikke. Om loftet bandt, står i forklar-året.';
}

function indbetalingslinje(ind) {
  var fraPost = ind.kilde.post !== undefined;
  var under = fraPost
    ? 'Følger ' + kildenavn(ind) + ': ' + POSTER[ind.kilde.post].periode + ' · ' +
      POSTER[ind.kilde.post].gentagelse.toLowerCase() + ' · ' +
      POSTER[ind.kilde.post].forfald.toLowerCase() + ' · AM-bidrag på vejen ind'
    : ind.periode + ' · ' + ind.gentagelse.toLowerCase() + ' · ' + ind.forfald.toLowerCase() +
      ' · intet AM-bidrag';
  return '<div class="linje"><span class="ejermaerke">→</span>' +
    '<span class="navn">' + kildenavn(ind) + '</span>' +
    '<span class="tal">' + indbetalingsbeloeb(ind) + '</span>' +
    '<span class="under">' + under + '</span></div>';
}

/* ================= formuegrafen ================= */

/* Likviditet andetsteds = alt, der kan flyttes med en overførsel uden at bryde
   en udbetalingsplan: de øvrige frie midler og aktiesparekontoen. */
function likviditetUdenBuffer(x) {
  var sum = 0;
  BEHOLDNINGER.forEach(function (b) {
    if (b.buffer) return;
    if (b.type === 'frie' || b.type === 'ask') sum += x.ultimo[b.id];
  });
  return sum;
}

/* Sammenhængende spænd af år, hvor bufferen er tom eller i minus, delt op i de
   to tilstande. De to skal skelnes: den ene mangler en overførsel, den anden
   mangler penge. Dybden går tabt, når båndet gulves ved nul, og bæres derfor
   af mærkatets beløb — det dybeste år i spændet. */
function holdbarhedsspaen(data) {
  var ud = [], nu = null;
  data.forEach(function (r, i) {
    if (r.bufferSaldo > 0) { nu = null; return; }
    var mangler = Math.abs(Math.min(0, r.bufferSaldo));
    var slags = likviditetUdenBuffer(r) >= mangler ? 'ufuldstaendig' : 'uholdbar';
    if (nu && nu.slags === slags) {
      nu.til = i;
      nu.dybest = Math.max(nu.dybest, mangler * faktor(r));
      return;
    }
    nu = { fra: i, til: i, slags: slags, aar: r.aar, dybest: mangler * faktor(r) };
    ud.push(nu);
  });
  return ud;
}

function tegnFormuegraf(data, serier, hoejde, maerker) {
  /* Top og bund har hver sin ekstra linje til aksens navn: enheden over
     y-mærkaterne, tidsenheden under årstallene. */
  var B = 900, H = hoejde || 250, M = { t: 22, r: 8, b: 34, l: 58 };
  var n = data.length;
  var x = function (i) { return M.l + i * (B - M.l - M.r) / (n - 1); };

  var toppe = [], bånd = serier.map(function () { return []; });
  for (var i = 0; i < n; i++) {
    var pos = 0;
    serier.forEach(function (s, si) {
      /* Negative værdier gulves ved nul. En tom buffer er ikke en beholdning
         med negativ værdi — det er et hul i planen, og et hul har ingen
         udstrækning på formueaksen. Året markeres i stedet, se maerker. */
      var v = Math.max(0, s.vaerdi(data[i]));
      bånd[si].push([pos, pos + v]); pos += v;
    });
    toppe.push(pos);
  }
  var maks = Math.max.apply(null, toppe), min = 0;
  if (maks === min) maks = min + 1;
  var pad = (maks - min) * 0.06;
  var y = function (v) { return M.t + (maks + pad - v) * (H - M.t - M.b) / (maks - min + 2 * pad); };

  var s = ['<svg viewBox="0 0 ' + B + ' ' + H + '" role="img" aria-label="Formuegraf">'];

  /* Mærkaterne tegnes først, så gitter og bånd ligger oven på dem. */
  var TONER = {
    ufuldstaendig: { flade: 'rgba(138,107,31,.12)', streg: '#8a6b1f', ord: 'Ufuldstændig' },
    uholdbar: { flade: 'rgba(164,39,29,.12)', streg: '#a4271d', ord: 'Uholdbar' }
  };
  /* Mærkaterne sidder nede ved aksen, fordi milepælene har toppen, og de
     trappes indbyrdes: to spænd kan ligge få år fra hinanden. */
  var sidsteVenstre = 1e9, etageM = -1;
  (maerker || []).slice().reverse().forEach(function (m) {
    var halv = (B - M.l - M.r) / (n - 1) / 2;
    var x0 = Math.max(M.l, x(m.fra) - halv), x1 = Math.min(B - M.r, x(m.til) + halv);
    var t = TONER[m.slags];
    s.push('<rect x="' + x0.toFixed(1) + '" y="' + M.t + '" width="' + (x1 - x0).toFixed(1) +
      '" height="' + (H - M.b - M.t) + '" fill="' + t.flade + '"/>');
    s.push('<line x1="' + x0.toFixed(1) + '" x2="' + x0.toFixed(1) + '" y1="' + M.t +
      '" y2="' + (H - M.b) + '" stroke="' + t.streg + '" stroke-width="1"/>');

    /* Beløbet står i mærkatet, fordi båndet ikke længere kan vise dybden. */
    var tekst = t.ord + ' fra ' + m.aar + ' · op til ' +
      (m.dybest < 1000000 ? K(m.dybest) + ' kr.' : mio(m.dybest) + ' kr.') + ' i minus';
    var bredde = tekst.length * 4.6 + 10;
    var venstre = Math.min(x0 + 4, B - M.r - bredde);
    etageM = venstre + bredde + 6 > sidsteVenstre ? etageM + 1 : 0;
    sidsteVenstre = venstre;
    var linje = H - M.b - 6 - etageM * 16;
    s.push('<rect x="' + venstre.toFixed(1) + '" y="' + (linje - 10) + '" width="' + bredde.toFixed(1) +
      '" height="14" rx="2" fill="#ffffff" fill-opacity="0.86"/>');
    s.push('<text x="' + (venstre + 5).toFixed(1) + '" y="' + linje +
      '" font-size="9.5" fill="' + t.streg + '">' + tekst + '</text>');
  });

  /* y-gitter */
  var trin = Math.pow(10, Math.floor(Math.log10(Math.max(1, maks - min)))) / 2;
  for (var v = Math.ceil(min / trin) * trin; v <= maks; v += trin) {
    s.push('<line x1="' + M.l + '" x2="' + (B - M.r) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) +
      '" stroke="' + (v === 0 ? '#b9b6b0' : '#eeecea') + '"/>');
    s.push('<text x="' + (M.l - 6) + '" y="' + (y(v) + 3.5).toFixed(1) +
      '" text-anchor="end" font-size="10" fill="#7d7a74">' + mio(v) + '</text>');
  }
  /* Enheden står som overskrift over mærkatsøjlen. Hvilke kroner det er,
     dagens eller årets egne, står i omskifteren over grafen. */
  s.push('<text x="' + (M.l - 6) + '" y="' + (M.t - 8) +
    '" text-anchor="end" font-size="10" fill="#57544f">mio. kr.</text>');

  /* båndene */
  bånd.forEach(function (band, si) {
    var op = [], ned = [];
    for (var i = 0; i < n; i++) {
      op.push(x(i).toFixed(1) + ',' + y(band[i][1]).toFixed(1));
      ned.unshift(x(i).toFixed(1) + ',' + y(band[i][0]).toFixed(1));
    }
    s.push('<polygon points="' + op.concat(ned).join(' ') + '" fill="' + serier[si].farve +
      '" stroke="#ffffff" stroke-width="0.4"/>');
  });

  /* Milepælene. Navnene sættes i trapper, fordi to milepæle kan ligge få år
     fra hinanden og ellers skriver oven i hinanden. */
  var sidsteX = -999, etage = 0;
  MILEPAELE().sort(function (p, q) { return p.aar - q.aar; }).forEach(function (m) {
    var i = data.map(function (d) { return d.aar; }).indexOf(m.aar);
    if (i < 0) return;
    etage = (x(i) - sidsteX) < 90 ? etage + 1 : 0;
    sidsteX = x(i);
    s.push('<line x1="' + x(i).toFixed(1) + '" x2="' + x(i).toFixed(1) + '" y1="' + M.t + '" y2="' + (H - M.b) +
      '" stroke="#4a4844" stroke-dasharray="2 3" stroke-width="0.8"/>');
    s.push('<text x="' + (x(i) + 3).toFixed(1) + '" y="' + (M.t + 10 + etage * 11) +
      '" font-size="9.5" fill="#4a4844">' + m.tekst + '</text>');
  });

  /* x-akse */
  for (var i2 = 0; i2 < n; i2++) {
    if (data[i2].aar % 10 !== 0) continue;
    var anker = x(i2) > B - M.r - 22 ? 'end' : 'middle';
    s.push('<text x="' + x(i2).toFixed(1) + '" y="' + (H - M.b + 14) + '" text-anchor="' + anker +
      '" font-size="10" fill="#7d7a74">' + data[i2].aar + '</text>');
  }
  /* Tidsenheden står midt under årstallene, hvor den ikke kan forveksles
     med et af dem. */
  s.push('<text x="' + ((M.l + B - M.r) / 2).toFixed(1) + '" y="' + (H - 6) +
    '" text-anchor="middle" font-size="10" fill="#57544f">år</text>');
  s.push('</svg>');
  return s.join('');
}

function MILEPAELE() {
  var j = PERSONER[0], a = PERSONER[1];
  return [
    { aar: j.foedselsaar + j.erhvervsophoerAlder, tekst: 'Jesper ophører' },
    { aar: 2033, tekst: 'Ratepensioner' },
    { aar: j.foedselsaar + j.folkepensionsalder, tekst: 'Jesper folkepension' },
    { aar: a.foedselsaar + a.erhvervsophoerAlder, tekst: 'Anne ophører' },
    { aar: a.foedselsaar + a.folkepensionsalder, tekst: 'Anne folkepension' }
  ];
}

function formueserier() {
  return BEHOLDNINGER.map(function (b) {
    return {
      navn: b.navn + ' (' + person(b.ejer).navn + ')',
      farve: FARVER[b.id],
      vaerdi: function (r) { return r.ultimo[b.id] * faktor(r); }
    };
  });
}

function forklaring(serier) {
  return '<div class="forklaring">' + serier.map(function (s) {
    return '<span><i class="proeve" style="background:' + s.farve + '"></i>' + s.navn + '</span>';
  }).join('') + '</div>';
}

/* ================= årstabellen ================= */

function tegnAarstabel() {
  var h = ['<div class="tabelramme"><table class="aar"><thead><tr>'];
  ['År', 'Jesper', 'Anne', 'Løn m.v.', 'Ordninger', 'Ydelser', 'Afkast', 'Skat', 'Udgifter', 'Netto', 'Buffer', 'Formue']
    .forEach(function (k) { h.push('<th>' + k + '</th>'); });
  h.push('</tr></thead><tbody>');

  var milepaele = MILEPAELE().map(function (m) { return m.aar; });
  raekker().forEach(function (r) {
    var f = faktor(r);
    var negativ = r.bufferSaldo < 0;
    h.push('<tr class="' + (negativ ? 'negativ ' : '') +
      (milepaele.indexOf(r.aar) >= 0 ? 'milepael ' : '') +
      (TILSTAND.aar === r.aar ? 'valgt' : '') + '" onclick="vaelgAar(' + r.aar + ')">');
    h.push('<td class="' + (r.satsgrundlag === 'fremskrevet' ? 'fremskrevet' : '') + '">' + r.aar + '</td>');
    h.push('<td class="alder">' + r.aldre.j + '</td><td class="alder">' + r.aldre.a + '</td>');
    h.push('<td>' + K(r.loenIalt * f) + '</td>');
    h.push('<td>' + (r.ordningsindkomst ? K(r.ordningsindkomst * f) : '–') + '</td>');
    h.push('<td>' + (r.ydelser ? K(r.ydelser * f) : '–') + '</td>');
    h.push('<td>' + K(r.afkastIalt * f) + '</td>');
    h.push('<td>−' + K(r.skat * f) + '</td>');
    h.push('<td>−' + K(r.udgifter * f) + '</td>');
    h.push('<td>' + (r.netto < 0 ? '−' : '') + K(Math.abs(r.netto) * f) + '</td>');
    h.push('<td class="buffer">' + (r.bufferSaldo < 0 ? '−' : '') + K(Math.abs(r.bufferSaldo) * f) + '</td>');
    h.push('<td class="formue">' + K(r.ultimoFormue * f) + '</td>');
    h.push('</tr>');
  });
  h.push('</tbody></table></div>');
  return h.join('');
}

/* ================= forklar-året ================= */

function tegnForklarAaret() {
  var r = aarsraekke(TILSTAND.aar), f = faktor(r);
  var h = ['<div class="forklar">'];

  h.push('<div class="forklarhoved"><h2>' + r.aar + '</h2>' +
    '<span class="kontekst">Jesper ' + r.aldre.j + ' år · Anne ' + r.aldre.a + ' år · ' +
    'satsår ' + (r.satsgrundlag === 'kendt' ? PLAN.sidstKendteSatsaar + ' (kendt)' :
      PLAN.sidstKendteSatsaar + ' fremskrevet ' + (r.aar - PLAN.sidstKendteSatsaar) + ' år') + '</span>' +
    '<span class="hoejre"><button class="knap" onclick="vaelgAar(' + (r.aar - 1) + ')">‹ ' + (r.aar - 1) + '</button>' +
    '<button class="knap" onclick="vaelgAar(' + (r.aar + 1) + ')">' + (r.aar + 1) + ' ›</button>' +
    '<button class="knap primaer" onclick="tilbageTilTabellen()">Tilbage til tabellen</button></span></div>');

  /* balanceinvarianten som synlig stribe */
  h.push('<div class="balancestribe">' +
    stribe('Formue primo', r.primoFormue * f) + regnetegn('+') +
    stribe('Indtægter', r.indtaegter * f) + regnetegn('+') +
    stribe('Afkast', r.afkastIalt * f) + regnetegn('−') +
    stribe('Skat', r.skat * f) + regnetegn('−') +
    stribe('Udgifter', r.udgifter * f) +
    (r.omsatDepot ? regnetegn('−') + stribe('Livrentedepot omsat', r.omsatDepot * f) : '') +
    regnetegn('=') + stribe('Formue ultimo', r.ultimoFormue * f) + '</div>');
  if (r.omsatDepot) {
    h.push('<div class="hint" style="margin:-8px 0 14px">Livrentens depot forlader formuen i ' +
      'omsætningsåret og bliver til en livsvarig ydelse. Det er hverken en udgift eller en ' +
      'udbetaling, og det har derfor sit eget led i balancen.</div>');
  }

  h.push('<div class="blokke">');

  PERSONER.forEach(function (p) {
    var x = r.pr[p.id], s = x.skat;
    var rows = [];
    rows.push(['Løn og skattepligtige poster', x.arbejdsindkomst]);
    if (x.arbejdsindkomst) rows.push(['AM-bidrag, 8,00 %', -s.amBidrag, 'indryk']);
    /* Fradragsretten er ikke et ligningsmæssigt fradrag: den nedsætter den
       personlige indkomst og dermed alle lag ovenpå. Derfor står den her og
       ikke nede ved beskæftigelses- og jobfradraget. */
    if (s.fradragsret) rows.push(['Indbetaling med fradragsret', -s.fradragsret, 'indryk']);
    if (x.ordningsindkomst) rows.push(['Udbetaling fra ordninger', x.ordningsindkomst]);
    if (x.atp) rows.push(['ATP', x.atp]);
    if (x.folkepension) rows.push(['Folkepension', x.folkepension]);
    rows.push(['Personlig indkomst', s.personligIndkomst, 'mellemsum']);
    rows.push(['Kapitalindkomst', s.kapitalindkomst]);
    if (s.beskaeftigelsesfradrag) rows.push(['Beskæftigelsesfradrag', -s.beskaeftigelsesfradrag]);
    if (s.jobfradrag) rows.push(['Jobfradrag', -s.jobfradrag]);
    rows.push(['Skattepligtig indkomst', s.skattepligtigIndkomst, 'mellemsum']);
    rows.push(['Aktieindkomst (lagerbeskattet)', s.aktieindkomst]);
    if (x.aldersopsparing) rows.push(['Aldersopsparing (skattefri)', x.aldersopsparing]);
    if (x.skattefri) rows.push(['Skattefri poster', x.skattefri]);

    var skat = [];
    if (s.amBidrag) skat.push(['AM-bidrag', s.amBidrag, '', '8,00 %']);
    skat.push(['Bundskat', s.bundskat, '', '12,01 %']);
    if (s.mellemskat) skat.push(['Mellemskat', s.mellemskat, '', '7,50 % over ' + K(SATSER_2026.mellemskattegraense * satsF(r.aar) * f)]);
    if (s.topskat) skat.push(['Topskat', s.topskat, '', '7,50 % over ' + K(SATSER_2026.topskattegraense * satsF(r.aar) * f)]);
    if (s.topTopskat) skat.push(['Top-topskat', s.topTopskat, '', '5,00 %']);
    skat.push(['Kommuneskat', s.kommuneskat, '', P(PLAN.kommuneskat)]);
    skat.push(['Kirkeskat', s.kirkeskat, '', P(PLAN.kirkeskat)]);
    skat.push(['Personfradrag', s.personfradragVaerdi, '', 'skatteværdi']);
    skat.push(['Skat i alt', s.iAlt, 'sum']);

    h.push('<div class="blok"><h3>' + p.navn + ' — indkomstopgørelse</h3>' + regn(rows, f) +
      '<h3 style="margin-top:14px">' + p.navn + ' — skatteberegning</h3>' + regn(skat, f) + '</div>');
  });

  /* Aktieindkomstskatten står for sig og ikke i en persons blok:
     progressionsgrænsen er husstandens, fælles og overførbar, og der findes
     ingen hjemmel til at fordele skatten på personer — jf. ADR-0014. */
  var ak = r.aktieindkomstskat;
  if (ak && (ak.lavSkat || ak.hoejSkat)) {
    var akRows = [];
    if (ak.lavGrundlag) akRows.push(['Til progressionsgrænsen ' + K(ak.graense * f),
      ak.lavSkat, '', '27 % af ' + K(ak.lavGrundlag * f)]);
    if (ak.hoejGrundlag) akRows.push(['Over progressionsgrænsen',
      ak.hoejSkat, '', '42 % af ' + K(ak.hoejGrundlag * f)]);
    akRows.push(['Aktieindkomstskat i alt', ak.lavSkat + ak.hoejSkat, 'sum']);
    h.push('<div class="blok"><h3>Husstandens aktieindkomstskat</h3>' + regn(akRows, f) +
      '<div class="hint">Grænsen er fælles og overførbar mellem ægtefæller, så ' +
      'husstandens samlede aktieindkomst prøves mod husstandens samlede grænse. ' +
      'Skatten hører derfor ikke til nogen enkelt person.</div></div>');
  }

  /* folkepension og aftrapning */
  var pens = PERSONER.filter(function (p) { return r.pr[p.id].folkepension > 0; });
  if (pens.length) {
    var fh = ['<div class="blok"><h3>Folkepension og aftrapning af pensionstillæg</h3>'];
    pens.forEach(function (p) {
      var x = r.pr[p.id], anden = PERSONER.filter(function (q) { return q.id !== p.id; })[0];
      fh.push(regn([
        [p.navn + ': grundbeløb', x.grundbeloeb],
        ['Pensionstillæg, fuldt (gift/samlevende)', x.pensionstillaegFuldt],
        ['Aftrapningsgrundlag — udbetalinger og ATP', x.taperEgen, 'indryk'],
        ['Egen aktieindkomst og positiv kapitalindkomst',
          Math.max(0, x.kapitalindkomst) + x.aktieindkomst, 'indryk'],
        [anden.navn + 's indkomst efter 54 % bortseelse', x.taperAegtefaelle, 'indryk'],
        ['Aftrapningsgrundlag i alt', x.taperBase, 'mellemsum'],
        ['Fradragsbeløb', -x.taperFradrag, 'indryk'],
        ['Aftrapning, ' + P(x.taperSats) + ' af det overskydende', -x.aftrapning, 'negativ'],
        ['Folkepension i alt', x.folkepension, 'sum']
      ], f));
      fh.push('<div class="hint">Arbejdsindkomst, udbetaling fra aldersopsparing og afkast på ' +
        'aktiesparekonto indgår ikke i grundlaget. ' + anden.navn + 's arbejdsindkomst indgår slet ikke.</div>');
    });
    fh.push('</div>');
    h.push(fh.join(''));
  }

  /* beholdningerne */
  var udbetaltIalt = 0;
  BEHOLDNINGER.forEach(function (b) { udbetaltIalt += r.udbetaling[b.id] || 0; });
  var indbetaltIalt = 0;
  BEHOLDNINGER.forEach(function (b) { indbetaltIalt += r.indbetaling[b.id] || 0; });
  /* Beholdningsskatten står som sin egen kolonne ved siden af afkastet, så de
     to kan efterregnes hver for sig. Den bæres af beholdningen selv — også
     aktiesparekontoens, som ikke er nogen persons skat. */
  var brows = ['<div class="blok bred"><h3>Beholdningerne</h3>' +
    '<table class="regn"><tr><td></td><td class="b">Primo</td><td class="b">Indbetaling</td>' +
    '<td class="b">Afkast</td><td class="b">Beholdningsskat</td><td class="b">Udbetaling</td>' +
    '<td class="b">Omsætning</td><td class="b">Buffer</td><td class="b">Ultimo</td></tr>'];
  BEHOLDNINGER.forEach(function (b) {
    var buf = b.buffer ? r.bufferBevaegelse : 0;
    var omsat = (b.type === 'livrente' && r.omsatDepot && r.primo[b.id] > 0) ? r.omsatDepot : 0;
    brows.push('<tr><td>' + b.navn + ' <span class="enhed">(' + person(b.ejer).navn + ')</span></td>' +
      '<td class="b">' + K(r.primo[b.id] * f) + '</td>' +
      '<td class="b">' + (r.indbetaling[b.id] ? '+' + K(r.indbetaling[b.id] * f) : '–') + '</td>' +
      '<td class="b">' + K(r.afkast[b.id] * f) + '</td>' +
      '<td class="b">' + (r.beholdningsskat[b.id] ? '−' + K(r.beholdningsskat[b.id] * f) : '–') + '</td>' +
      '<td class="b">' + (r.udbetaling[b.id] ? '−' + K(r.udbetaling[b.id] * f) : '–') + '</td>' +
      '<td class="b">' + (omsat ? '−' + K(omsat * f) : '–') + '</td>' +
      '<td class="b">' + (b.buffer ? (buf < 0 ? '−' : '+') + K(Math.abs(buf) * f) : '–') + '</td>' +
      '<td class="b">' + K(r.ultimo[b.id] * f) + '</td></tr>');
  });
  brows.push('<tr class="sum"><td>I alt</td><td class="b">' + K(r.primoFormue * f) + '</td>' +
    '<td class="b">' + (indbetaltIalt ? '+' + K(indbetaltIalt * f) : '–') + '</td>' +
    '<td class="b">' + K(r.afkastIalt * f) + '</td>' +
    '<td class="b">' + (r.beholdningsskatIalt ? '−' + K(r.beholdningsskatIalt * f) : '–') + '</td>' +
    '<td class="b">' + (udbetaltIalt ? '−' + K(udbetaltIalt * f) : '–') + '</td>' +
    '<td class="b">' + (r.omsatDepot ? '−' + K(r.omsatDepot * f) : '–') + '</td>' +
    '<td class="b">' + (r.bufferBevaegelse < 0 ? '−' : '+') + K(Math.abs(r.bufferBevaegelse) * f) + '</td>' +
    '<td class="b">' + K(r.ultimoFormue * f) + '</td></tr></table>');
  brows.push('<div class="hint">Beholdningsskatten er trukket i beholdningen selv og passerer ' +
    'ingen persons indkomst: PAL-skat på ratepension, aldersopsparing og livrente, ' +
    'aktiesparekontoens egen sats på 17 %. De frie midler har ingen — deres afkast beskattes ' +
    'hos personen eller husstanden i stedet. Indbetalingskolonnen er det, der landede i ' +
    'beholdningen; hvad der forlod kilden, står nedenfor.</div></div>');
  h.push(brows.join(''));

  h.push(indbetalingsblok(r, f));

  /* posterne */
  var prows = r.poster.map(function (post) {
    return [post.navn + (post.ejer ? ' (' + person(post.ejer).navn + ')' : ''),
      (post.retning === 'ud' ? -1 : 1) * post.beloeb, '', post.skat || ''];
  });
  prows.push(['Poster i alt', r.loenIalt - r.udgifter, 'sum']);
  h.push('<div class="blok bred"><h3>Posterne</h3>' + regn(prows, f) + '</div>');

  h.push('</div></div>');
  return h.join('');
}

/* ---------- indbetalingerne og lofterne ----------
   Loftlinjen hører i forklar-året og aldrig i inspektørskuffen. Om et loft
   bandt, afhænger af årets fremskrevne beløb målt mod årets satsår — det er
   et resultat og ikke en egenskab ved planen. Skuffen viser planen; her står
   det, året gjorde ved den.

   De to tal pr. indbetaling er, hvad der forlod kilden, og hvad der landede i
   beholdningen. Forskellen er AM-bidraget, som allerede står i personens eget
   skattelag og derfor ikke gentages.                                        */

function indbetalingsblok(r, f) {
  if (!r.indbetalinger.length) return '';
  var h = ['<div class="blok bred"><h3>Indbetalingerne</h3>' +
    '<table class="regn"><tr><td></td><td class="b">Forlod kilden</td>' +
    '<td class="b">Landede</td><td class="n"></td></tr>'];
  var forlodIalt = 0, landetIalt = 0;
  r.indbetalinger.forEach(function (i) {
    forlodIalt += i.forlod; landetIalt += i.landet;
    var kilde = i.fraLoen ? POSTER[i.kilde.post] : beholdning(i.kilde.beholdning);
    var noter = [i.fraLoen ? 'AM-bidrag 8,00 % på vejen ind' : 'fra beholdning, intet AM-bidrag'];
    if (i.uindskudt) noter.push(K(i.uindskudt * f) + ' kr. blev liggende i kilden');
    h.push('<tr><td>' + kilde.navn +
      (kilde.ejer ? ' <span class="enhed">(' + person(kilde.ejer).navn + ')</span>' : '') +
      ' → ' + beholdning(i.destination).navn + '</td>' +
      '<td class="b">' + K(i.forlod * f) + '</td>' +
      '<td class="b">' + K(i.landet * f) + '</td>' +
      '<td class="n">' + noter.join(' · ') + '</td></tr>');
  });
  h.push('<tr class="sum"><td>Indbetalt i alt</td><td class="b">' + K(forlodIalt * f) +
    '</td><td class="b">' + K(landetIalt * f) + '</td><td class="n"></td></tr></table>');

  h.push('<h3 style="margin-top:14px">Lofterne</h3>' +
    '<table class="regn"><tr><td></td><td class="b">Indbetalt</td><td class="b">Loft</td>' +
    '<td class="b">Med fradragsret</td><td class="n"></td></tr>');
  r.lofter.forEach(function (l) {
    var b = beholdning(l.beholdning), noter = [];
    if (!l.loft) noter.push('intet loft');
    else if (l.loftform === 'OnBalance') {
      noter.push('måler saldoen primo · råderum ' + K(l.raaderum * f) + ' kr.');
    } else if (l.brudt) {
      noter.push('loftet bandt · ' + K((l.indbetalt - l.loft) * f) + ' kr. uden fradragsret');
    } else noter.push('måler årets samlede indbetaling');
    if (!harFradragsret(b)) noter.push('ordningen giver ingen fradragsret');
    /* Ingen rød farve her: den er forbeholdt en negativ buffer. Et brudt loft
       er ikke en fejl, det er en oplysning — og den står i noten. */
    h.push('<tr><td>' + b.navn +
      ' <span class="enhed">(' + person(b.ejer).navn + ')</span></td>' +
      '<td class="b">' + K(l.indbetalt * f) + '</td>' +
      '<td class="b">' + (l.loft ? K(l.loft * f) : '–') + '</td>' +
      '<td class="b">' + (l.medFradragsret ? K(l.medFradragsret * f) : '–') + '</td>' +
      '<td class="n">' + noter.join(' · ') + '</td></tr>');
  });
  h.push('</table><div class="hint">Fradragsretten holder indbetalingen uden for den ' +
    'personlige indkomst og rammer dermed alle lag ovenpå. Den følger destinationens ' +
    'variant og ikke bidraget: ratepension og livrente har den, aldersopsparing og ' +
    'aktiesparekonto har den ikke. Et brudt loft pr. år afviser ikke pengene — det ' +
    'overskydende mister blot sin fradragsret. Et loft på saldoen afviser derimod, og ' +
    'det uindskudte bliver liggende, uden at noget er sket.</div></div>');
  return h.join('');
}

function satsF(aar) { return Math.pow(1 + PLAN.paragraf20, aar - PLAN.startAar); }
function stribe(m, v) { return '<div><span class="m">' + m + '</span><span class="v">' + K(v) + '</span></div>'; }
function regnetegn(t) { return '<div class="tegn">' + t + '</div>'; }

function regn(rows, f) {
  return '<table class="regn">' + rows.map(function (row) {
    var klasse = row[2] || '';
    return '<tr class="' + klasse + '"><td>' + row[0] + '</td><td class="b">' +
      (row[1] < 0 ? '−' : '') + K(Math.abs(row[1]) * f) + '</td>' +
      '<td class="n">' + (row[3] || '') + '</td></tr>';
  }).join('') + '</table>';
}

/* ================= cashflow (etape 5) ================= */

function tegnCashflow() {
  var data = raekker();
  var B = 900, H = 300, M = { t: 10, r: 8, b: 22, l: 62 };
  var bredde = (B - M.l - M.r) / data.length;
  var poster = [
    { navn: 'Løn m.v.', farve: '#4a6f92', v: function (r) { return r.loenIalt; }, op: true },
    { navn: 'Ordninger', farve: '#8a7a5e', v: function (r) { return r.ordningsindkomst; }, op: true },
    { navn: 'Ydelser', farve: '#6e8a6a', v: function (r) { return r.ydelser; }, op: true },
    { navn: 'Skat', farve: '#a4271d', v: function (r) { return -r.skat; }, op: false },
    { navn: 'Udgifter', farve: '#b9b6b0', v: function (r) { return -r.udgifter; }, op: false }
  ];
  var maks = 0, min = 0;
  data.forEach(function (r) {
    var p = 0, n = 0;
    poster.forEach(function (s) { var v = s.v(r) * faktor(r); if (v > 0) p += v; else n += v; });
    maks = Math.max(maks, p); min = Math.min(min, n);
  });
  var y = function (v) { return M.t + (maks - v) * (H - M.t - M.b) / (maks - min); };

  var s = ['<svg viewBox="0 0 ' + B + ' ' + H + '" role="img" aria-label="Cashflow-graf">'];
  s.push('<line x1="' + M.l + '" x2="' + (B - M.r) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" stroke="#b9b6b0"/>');
  var trin = 500000;
  for (var v = Math.ceil(min / trin) * trin; v <= maks; v += trin) {
    if (v !== 0) s.push('<line x1="' + M.l + '" x2="' + (B - M.r) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="#eeecea"/>');
    s.push('<text x="' + (M.l - 6) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="#7d7a74">' + mio(v) + '</text>');
  }
  data.forEach(function (r, i) {
    var xp = M.l + i * bredde, pos = 0, neg = 0;
    poster.forEach(function (p2) {
      var v = p2.v(r) * faktor(r);
      if (v === 0) return;
      var y0, y1;
      if (v > 0) { y0 = y(pos + v); y1 = y(pos); pos += v; } else { y0 = y(neg); y1 = y(neg + v); neg += v; }
      s.push('<rect x="' + (xp + 0.4).toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + (bredde - 0.8).toFixed(1) +
        '" height="' + Math.max(0.5, y1 - y0).toFixed(1) + '" fill="' + p2.farve + '"/>');
    });
    if (r.aar % 10 === 0) s.push('<text x="' + (xp + bredde / 2).toFixed(1) + '" y="' + (H - 6) +
      '" text-anchor="middle" font-size="10" fill="#7d7a74">' + r.aar + '</text>');
  });
  s.push('</svg>');

  return '<div class="graf skitse">' + s.join('') + '</div>' +
    '<div class="forklaring">' + poster.map(function (p2) {
      return '<span><i class="proeve" style="background:' + p2.farve + '"></i>' + p2.navn + '</span>';
    }).join('') + '</div>' +
    '<div class="besked"><h3>Cashflow-grafen <span class="skitsemaerke">etape 5</span></h3>' +
    '<p>Indtægter opad, skat og udgifter nedad, stablet pr. år. Underskudsår er dem, hvor søjlen ' +
    'nedad er længere end søjlen opad.</p>' +
    '<p><b>Det, den koster:</b> en divergerende stablet søjlegraf med 55 kategorier på x-aksen. ' +
    'Sammen med formuegrafens negative bånd er det de to krav, der reelt afgør bibliotekvalget — ' +
    'begge dele skal kunne stables om nul uden at bryde sammen.</p></div>';
}

/* ================= sammenligning (etape 5) ================= */

function tegnSammenligning() {
  var a = RAEKKER.basis, b = RAEKKER.uholdbar;
  var B = 900, H = 280, M = { t: 10, r: 8, b: 22, l: 62 };
  var alle = a.concat(b).map(function (r) { return r.ultimoFormue * r.deflator; });
  var maks = Math.max.apply(null, alle), min = Math.min.apply(null, alle);
  var x = function (i) { return M.l + i * (B - M.l - M.r) / (a.length - 1); };
  var y = function (v) { return M.t + (maks - v) * (H - M.t - M.b) / (maks - min); };
  var linje = function (data, farve, streg) {
    return '<polyline fill="none" stroke="' + farve + '" stroke-width="1.6"' +
      (streg ? ' stroke-dasharray="4 3"' : '') + ' points="' +
      data.map(function (r, i) { return x(i).toFixed(1) + ',' + y(r.ultimoFormue * r.deflator).toFixed(1); }).join(' ') + '"/>';
  };
  var s = ['<svg viewBox="0 0 ' + B + ' ' + H + '" role="img" aria-label="Sammenligning af planer">'];
  s.push('<line x1="' + M.l + '" x2="' + (B - M.r) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" stroke="#b9b6b0"/>');
  s.push('<text x="' + (M.l - 6) + '" y="' + (y(0) + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="#7d7a74">0</text>');
  s.push(linje(a, '#2f5d8a', false));
  s.push(linje(b, '#8a7a5e', true));
  a.forEach(function (r, i) {
    if (r.aar % 10 === 0) s.push('<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) +
      '" text-anchor="middle" font-size="10" fill="#7d7a74">' + r.aar + '</text>');
  });
  s.push('</svg>');

  return '<div class="graf skitse">' + s.join('') + '</div>' +
    '<div class="forklaring"><span><i class="proeve" style="background:#2f5d8a"></i>Ophør som 58</span>' +
    '<span><i class="proeve" style="background:#8a7a5e"></i>Ophør som 55</span></div>' +
    '<div class="besked"><h3>Sammenligning af planer <span class="skitsemaerke">etape 5</span></h3>' +
    '<p>To planer er to uafhængige planer, ikke to varianter af en fælles kerne. Sammenligningen ' +
    'kan derfor kun tegne kurverne oven i hinanden — den kan ikke vise en <em>difference</em> ' +
    'linje for linje, for der er ingen fælles struktur at trække fra hinanden.</p>' +
    '<p><b>Det uafklarede:</b> hvad venstre spalte viser, når to planer er valgt. To planspalter ' +
    'ved siden af hinanden sprænger bredden. Forslaget her er, at venstre spalte bliver ved med at ' +
    'vise <em>den aktive</em> plan, og at sammenligningen er en tilstand i højre spalte alene.</p>' +
    '<p>Søgningen efter tidligste holdbare erhvervsophør hører til her: den producerer en plan, ' +
    'som lægges ved siden af den aktive.</p></div>';
}

/* ================= fejltilstande ================= */

function tegnFejltilstande() {
  var r = RAEKKER.uholdbar;
  /* Likviditet andetsteds = alt, der kan flyttes med en overførsel uden at
     bryde en udbetalingsplan: de øvrige frie midler og aktiesparekontoen. */
  var likviditet = likviditetUdenBuffer;
  var foerste = r.filter(function (x) { return x.bufferSaldo < 0; })[0];
  var foersteUholdbar = r.filter(function (x) {
    return x.bufferSaldo < 0 && likviditet(x) < Math.abs(x.bufferSaldo);
  })[0];
  var f0 = foerste ? faktor(foerste) : 1;

  return '<div class="besked stop"><h3>Planen kan ikke simuleres</h3>' +
    '<p>To beholdninger er udpeget som buffer: <b>Frie midler (Jesper)</b> og <b>Frie midler (Anne)</b>. ' +
    'Præcis én skal være det — ellers har årets over- eller underskud ingen entydig modtager.</p>' +
    '<p>Resultatspalten står ikke tom: den siger hvorfor. Fejlen hører hjemme her og ikke ved ' +
    'inputfeltet, fordi den er en egenskab ved planen som helhed.</p></div>' +

    '<div class="besked"><h3>Til sammenligning: en uholdbar plan er ikke en fejl</h3>' +
    '<p>Bufferen går negativ ' + (foerste ? 'første gang i <b>' + foerste.aar + '</b>' : 'ikke') +
    '. Det er et <em>resultat</em>, ikke en valideringsfejl. Det vises i tabellen og i grafen — ' +
    'aldrig som en rød ramme om et felt.</p>' +
    (foerste ? '<ul>' +
      '<li><b>Ufuldstændig plan:</b> bufferen er negativ, men husstanden har likviditet et andet sted. ' +
      'Der mangler en overførsel. <span class="markoer">Det er tilstanden i ' + foerste.aar +
      ': bufferen mangler ' + K(Math.abs(foerste.bufferSaldo) * f0) + ' kr., og der står ' +
      K(likviditet(foerste) * f0) + ' kr. på de øvrige frie midler og aktiesparekontoen.</span></li>' +
      '<li><b>Uholdbar plan:</b> bufferen er negativ, og der er ingen likviditet at hente. ' +
      (foersteUholdbar
        ? '<span class="markoer">Det indtræffer i ' + foersteUholdbar.aar + '.</span>'
        : 'Det sker ikke inden for horisonten.') + '</li>' +
      '</ul>' +
      '<p><b>Pointen:</b> den samme plan er begge dele — ufuldstændig først, uholdbar bagefter. ' +
      'Tilstanden hører derfor til <em>pr. år i tabellen</em> og ikke som én dom over hele planen.</p>' : '') +
    '<p class="hint">De to tilstande skal skelnes i tabellen, ikke kun farves ens. ' +
    'Forslaget her er en markør i buffer-kolonnen frem for en helt rød række.</p></div>' +

    '<div class="graf">' +
    tegnFormuegraf(RAEKKER.uholdbar, formueserier(), null, holdbarhedsspaen(RAEKKER.uholdbar)) + '</div>' +
    forklaring(formueserier()) +
    '<div class="hint" style="padding:0 16px 12px">Bufferen tegnes aldrig under nul. ' +
    'En tom buffer er ikke en beholdning med negativ værdi — det er et hul i planen, og et hul har ingen ' +
    'udstrækning på formueaksen. Årene markeres i stedet, i hver sin tone for de to tilstande, og dybden ' +
    'står som beløb i mærkatet og i tabellens bufferkolonne. Til gengæld er stablens overkant ikke ' +
    'formuen i de år: den overvurderer med det, bufferen mangler.</div>' +
    tegnAarstabelFor(RAEKKER.uholdbar);
}

function tegnAarstabelFor(data) {
  var gemt = TILSTAND.variant;
  TILSTAND.variant = 'uholdbar';
  var h = tegnAarstabel();
  TILSTAND.variant = gemt;
  return h;
}

/* ================= sammensætning ================= */

function tegnResultatspalte() {
  var titler = { hoved: 'Resultatet', forklar: 'Forklar året', cashflow: 'Cashflow', sammenlign: 'Sammenligning', fejl: 'Tilstande' };
  var h = ['<div class="resultathoved"><span class="titel">' + titler[TILSTAND.skaerm] + '</span>'];
  h.push('<span class="hoejre">');
  if (TILSTAND.skaerm !== 'fejl') {
    h.push('<span class="omskifter">' +
      '<button aria-pressed="' + (TILSTAND.kroner === 'real') + '" onclick="saetKroner(\'real\')">Dagens kroner</button>' +
      '<button aria-pressed="' + (TILSTAND.kroner === 'nominal') + '" onclick="saetKroner(\'nominal\')">Løbende priser</button>' +
      '</span>');
  }
  h.push('</span></div>');

  if (TILSTAND.skaerm === 'hoved') {
    var serier = formueserier();
    h.push('<div class="graf">' +
      tegnFormuegraf(raekker(), serier, null, holdbarhedsspaen(raekker())) + '</div>');
    h.push(forklaring(serier));
    h.push(tegnAarstabel());
  } else if (TILSTAND.skaerm === 'forklar') {
    h.push(tegnForklarAaret());
  } else if (TILSTAND.skaerm === 'cashflow') {
    h.push(tegnCashflow());
  } else if (TILSTAND.skaerm === 'sammenlign') {
    h.push(tegnSammenligning());
  } else {
    h.push(tegnFejltilstande());
  }
  return h.join('');
}

function tegn() {
  document.getElementById('planspalte').innerHTML = tegnPlanspalte();
  document.getElementById('resultatspalte').innerHTML = tegnResultatspalte();
  Array.prototype.forEach.call(document.querySelectorAll('.kappe nav button'), function (b) {
    b.setAttribute('aria-current', b.dataset.skaerm === TILSTAND.skaerm);
  });
}

function saetSkaerm(s) { TILSTAND.skaerm = s; location.hash = s; tegn(); }
function saetKroner(k) { TILSTAND.kroner = k; tegn(); }
function vaelgAar(a) {
  if (a < PLAN.startAar || a > PLAN.slutAar) return;
  TILSTAND.aar = a; TILSTAND.skaerm = 'forklar'; tegn();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function tilbageTilTabellen() { TILSTAND.skaerm = 'hoved'; tegn(); }
function vaelgBeholdning(id) {
  TILSTAND.valgtBeholdning = TILSTAND.valgtBeholdning === id ? null : id;
  tegn();
}

/* Hver skaerm har sin egen adresse, saa en tilstand kan deles i et issue. */
function fraHash() {
  var h = (location.hash || '').replace('#', '').split(':');
  if (['hoved', 'forklar', 'cashflow', 'sammenlign', 'fejl'].indexOf(h[0]) >= 0) TILSTAND.skaerm = h[0];
  if (h[1] && +h[1] >= PLAN.startAar && +h[1] <= PLAN.slutAar) TILSTAND.aar = +h[1];
  if (h[2] === 'nominal' || h[2] === 'real') TILSTAND.kroner = h[2];
}

document.addEventListener('DOMContentLoaded', function () { fraHash(); tegn(); });
window.addEventListener('hashchange', function () { fraHash(); tegn(); });
