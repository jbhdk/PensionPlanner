/* Tre udgaver af B · Navigator. Samme plan, samme udtryk (4a · Aften), samme
   inspektør — kun højden og pladsen behandles forskelligt.

   Alle tre deler to greb, som ikke er til diskussion:

     · siden ruller ikke — hver spalte ruller for sig, og spaltehovedet bliver
       stående, så man aldrig mister overblikket over hvilken spalte man er i
     · grafen står øverst i resultatspalten og er det, man ser først

   De tre skiller sig ad på, hvordan navigatoren holdes kort:

     B1 · Foldbar   alle grupper synlige, hver kan foldes sammen til én linje
     B2 · Faner     én gruppe ad gangen, valgt i et fanebånd øverst
     B3 · Skuffe    som B1, men inspektøren ligger hen over resultatet i
                    stedet for at koste en fast spalte

   Kontakten Tabel under grafen · Tabel på egen fane er uafhængig af de tre.  */

var N = {
  model: 'b1',
  tabel: 'under',
  fane: 'graf',
  gruppe: 'beholdninger',
  valgt: 'b4',
  foldet: { plan: true, husstand: true, ydelser: true, indtaegter: true, udgifter: true,
    indbetalinger: true, overfoersler: true }
};

var FARVER_N = ['#5b7ba6', '#7d92b0', '#96a6bc', '#a3854e', '#b79a6c', '#c5b38d',
  '#75906c', '#8fa387', '#a6b39d'];

var krN = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
var pctN = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function KN(v) { return krN.format(Math.round(v)); }
function PN(v) { return pctN.format(v * 100) + ' %'; }
function persN(id) { return PERSONER.filter(function (p) { return p.id === id; })[0]; }
function behN(id) { return BEHOLDNINGER.filter(function (b) { return b.id === id; })[0]; }
function nettoN(b) { return b.brutto - b.aaop; }
function folkeaarN(p) { return p.foedselsaar + p.folkepensionsalder; }

var DATA_N = simuler('basis');
function aarN(a) { return DATA_N.filter(function (r) { return r.aar === a; })[0]; }

/* ---------- indbetalingens to former ----------
   Samme figur, to udgaver. Kilden er det eneste, der skiller dem: en lønpost
   har en periode, en forankring, en gentagelse og et forfald, som bidraget
   arver og derfor ikke bærer selv — en beholdning har ingen af delene at
   låne ud, så bidraget bærer dem alle. Navnet er kilde → destination i begge
   udgaver, så de læses som ét slags objekt i listen.                       */

function kildeN(ind) {
  return ind.kilde.post !== undefined ? POSTER[ind.kilde.post] : behN(ind.kilde.beholdning);
}
function kildeNavnN(ind) {
  var k = kildeN(ind);
  return k.navn + ' · ' + persN(k.ejer).navn;
}
function indNavnN(ind) { return kildeNavnN(ind) + ' → ' + behN(ind.destination).navn; }
function indBeloebN(ind) {
  return ind.procent !== undefined ? PN(ind.procent) : KN(ind.beloeb) + ' kr.';
}
function indTilN(id) {
  return INDBETALINGER.map(function (ind, i) { return { ind: ind, i: i }; })
    .filter(function (o) { return o.ind.destination === id; });
}
function indFraPostN(i) {
  return INDBETALINGER.map(function (ind, j) { return { ind: ind, i: j }; })
    .filter(function (o) { return o.ind.kilde.post === i; });
}

/* ---------- planens indhold som én liste af grupper ----------
   De tre udgaver læser den samme struktur; det er kun indpakningen, der
   skifter. Hver gruppe har et resumé, der træder i stedet for listen, når
   gruppen foldes sammen — en foldet gruppe må ikke være tavs.            */

function grupperN() {
  var sumB = BEHOLDNINGER.reduce(function (s, b) { return s + b.saldo; }, 0);
  var indtaegter = POSTER.filter(function (p) { return p.retning === 'ind'; });
  var udgifter = POSTER.filter(function (p) { return p.retning === 'ud'; });

  return [
    {
      id: 'plan', titel: 'Planen', kort: 'Planen', antal: '', resume: '2026–2080',
      raekker: [{ id: 'plan', navn: 'Ophør som 58', tal: '2026–2080' }]
    },
    {
      id: 'husstand', titel: 'Husstanden', kort: 'Husstanden', antal: PERSONER.length,
      resume: PERSONER.map(function (p) { return p.navn; }).join(' · '),
      raekker: PERSONER.map(function (p) {
        return { id: p.id, navn: p.navn, tal: 'f. ' + p.foedselsaar };
      })
    },
    {
      id: 'beholdninger', titel: 'Beholdninger', kort: 'Beholdninger', antal: BEHOLDNINGER.length,
      resume: KN(sumB) + ' kr.', tilfoej: '+ Beholdning',
      raekker: BEHOLDNINGER.map(function (b, i) {
        return { id: b.id, navn: b.navn, tal: KN(b.saldo), farve: FARVER_N[i] };
      })
    },
    {
      id: 'ydelser', titel: 'Ydelser', kort: 'Ydelser', antal: YDELSER.length,
      resume: 'fra ' + folkeaarN(PERSONER[0]),
      raekker: YDELSER.map(function (y, i) {
        return {
          id: 'y' + i, navn: y.navn + ' · ' + persN(y.ejer).navn,
          tal: y.udledt ? '<span class="stille">udledt</span>' : KN(y.beloeb)
        };
      })
    },
    {
      // Ingen sum her: poster kan have begrænset periode eller gentagelse,
      // så et samlet kronetal ville love en regelmæssighed, planen ikke har.
      // De nøjagtige tal står i årstabellen. Antallet i badge'en er nok.
      id: 'indtaegter', titel: 'Indtægter', kort: 'Indtægter', antal: indtaegter.length,
      resume: '', tilfoej: '+ Indtægt',
      raekker: indtaegter.map(function (p) {
        return { id: 'p' + POSTER.indexOf(p), navn: p.navn, tal: KN(p.beloeb) };
      })
    },
    {
      id: 'udgifter', titel: 'Udgifter', kort: 'Udgifter', antal: udgifter.length,
      resume: '', tilfoej: '+ Udgift',
      raekker: udgifter.map(function (p) {
        return { id: 'p' + POSTER.indexOf(p), navn: p.navn, tal: '−' + KN(p.beloeb) };
      })
    },
    {
      // Ingen sum her heller. En procent af en lønpost har intet kronebeløb,
      // før året er regnet, og et samlet tal ville være et årsafhængigt
      // resultat i en spalte, der kun viser planen. Antallet er nok.
      id: 'indbetalinger', titel: 'Indbetalinger', kort: 'Indbetalinger',
      antal: INDBETALINGER.length, resume: '', tilfoej: '+ Indbetaling',
      raekker: INDBETALINGER.map(function (ind, i) {
        return { id: 'i' + i, navn: indNavnN(ind), tal: indBeloebN(ind) };
      })
    },
    {
      id: 'overfoersler', titel: 'Overførsler', kort: 'Overførsler', antal: OVERFOERSLER.length,
      resume: OVERFOERSLER.length + ' faste', tilfoej: '+ Overførsel',
      raekker: OVERFOERSLER.map(function (o, i) {
        return { id: 'o' + i, navn: behN(o.fra).navn + ' → ' + behN(o.til).navn, tal: KN(o.beloeb) };
      })
    }
  ];
}

function navRaekke(r) {
  return '<div class="nav-rk' + (N.valgt === r.id ? ' valgt' : '') +
    '" onclick="vaelgN(\'' + r.id + '\')">' +
    (r.farve ? '<i class="prik" style="background:' + r.farve + '"></i>' : '') +
    '<span class="navn">' + r.navn + '</span><span class="tal">' + r.tal + '</span></div>';
}
function navKrop(g) {
  return '<div class="nav-krop">' + g.raekker.map(navRaekke).join('') +
    (g.tilfoej ? '<div class="nav-bund"><button class="knap">' + g.tilfoej + '</button></div>' : '') +
    '</div>';
}

/* ---------- B1 og B3 · foldbare grupper ---------- */

function navigatorFoldbar() {
  var g = grupperN();
  var aabne = g.filter(function (x) { return !N.foldet[x.id]; }).length;
  var h = ['<div class="spaltehoved">Planen<span class="hoejre">' +
    '<button class="knap" onclick="foldAlle()">' +
    (aabne ? 'Fold alt sammen' : 'Fold alt ud') + '</button></span></div>'];

  g.forEach(function (x) {
    h.push('<div class="nav-gruppe' + (N.foldet[x.id] ? ' foldet' : '') + '">' +
      '<h3 onclick="foldN(\'' + x.id + '\')"><span class="vip">›</span>' + x.titel +
      (x.antal !== '' ? '<span class="antal">' + x.antal + '</span>' : '') +
      '<span class="resume">' + x.resume + '</span></h3>' + navKrop(x) + '</div>');
  });

  h.push('<div class="nav-gruppe foldet"><h3 style="cursor:default">' +
    '<span class="vip">›</span>Bolig og lån<span class="skitsemaerke">etape 4</span>' +
    '<span class="resume">ikke i planen</span></h3></div>');
  return h.join('');
}

/* ---------- B2 · én gruppe ad gangen ---------- */

function navigatorFaner() {
  var g = grupperN();
  var valgt = g.filter(function (x) { return x.id === N.gruppe; })[0] || g[2];
  var h = ['<div class="spaltehoved">Planen<span class="hoejre"><span class="antal">' +
    g.reduce(function (s, x) { return s + x.raekker.length; }, 0) + ' i alt</span></span></div>'];

  h.push('<div class="faneboand">');
  g.forEach(function (x) {
    h.push('<button aria-pressed="' + (x.id === N.gruppe) + '" onclick="vaelgGruppeN(\'' + x.id + '\')">' +
      x.kort + (x.antal !== '' ? '<span class="antal">' + x.antal + '</span>' : '') + '</button>');
  });
  h.push('<button aria-pressed="false" style="opacity:.55" title="Etape 4">Bolig</button>');
  h.push('</div>');

  h.push('<div class="nav-gruppe">' + navKrop(valgt) + '</div>');
  return h.join('');
}

/* ---------- inspektøren ---------- */

function felt(navn, indre, enhed) {
  return '<div class="felt"><label>' + navn + '</label>' +
    '<span style="display:flex;gap:8px;align-items:center">' + indre +
    '<span class="enhed">' + (enhed || '') + '</span></span></div>';
}
function inp(v, slags) { return '<input class="' + slags + '" value="' + v + '">'; }
/* Hvert afsnit i inspektøren står på sin egen flade, som i 4a. */
function afsnitN(titel, krop) {
  return '<section class="afsnit"><h3>' + titel + '</h3>' + krop + '</section>';
}
function udl(v) { return '<span class="udledt">' + v + '</span>'; }
function vlg(valg) {
  return '<select>' + valg.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select>';
}
function behUnderN(b) {
  var u = [];
  if (b.type === 'frie') u.push(b.variant);
  if (b.buffer) u.push('buffer');
  if (b.udbetaling) {
    u.push(b.type === 'livrente' ? 'omsættes ' + b.udbetaling.start
      : b.udbetaling.start + '–' + (b.udbetaling.start + b.udbetaling.aar - 1));
  }
  u.push(PN(nettoN(b)) + ' netto');
  return u.join(' · ');
}

function behFelterN(b) {
  var h = [];

  var grund = felt('Navn', inp(b.navn, 'tekst')) +
    felt('Ejer', vlg([persN(b.ejer).navn])) +
    felt('Saldo (nutidskroner)', inp(KN(b.saldo), 'tal'), 'kr.');
  if (b.type === 'frie') {
    grund += felt('Beskatningsform', vlg(['Aktieindkomst', 'Kapitalindkomst'])) +
      felt('Buffer', '<input type="radio" ' + (b.buffer ? 'checked' : '') + ' style="width:auto">');
  }
  h.push(afsnitN('Beholdningen', grund));

  h.push(afsnitN('Afkast',
    felt('Bruttoafkast', inp(pctN.format(b.brutto * 100), 'tal'), '% p.a.') +
    felt('ÅOP', inp(pctN.format(b.aaop * 100), 'tal'), '% p.a.') +
    felt('Nettoafkast', udl(PN(nettoN(b))), 'udledt')));

  if (b.regime) {
    h.push(afsnitN('Udbetalingsregime',
      felt('Oprettet', vlg([b.regime])) +
      felt('Pensionsudbetalingsalder',
        udl((b.regime.indexOf('2007') > 0 ? 60 : persN(b.ejer).folkepensionsalder - 3) + ' år'), 'udledt')));
  }
  if (b.udbetaling && b.type !== 'livrente') {
    h.push(afsnitN('Udbetalingsplan',
      felt('Start', inp(b.udbetaling.start, 'tal')) +
      felt('Varighed', inp(b.udbetaling.aar, 'tal'), 'år') +
      felt('Princip', vlg(['Serieprincippet', 'Annuitetsprincippet']))));
  }
  if (b.type === 'livrente') {
    h.push(afsnitN('Omsætning',
      felt('Udbetalingsstart', inp(b.udbetaling.start, 'tal')) +
      felt('Omsætningsfaktor', inp(pctN.format(b.omsaetningsfaktor * 100), 'tal'), '%') +
      felt('Ydelse', udl(KN(aarN(b.udbetaling.start).udbetaling[b.id])), 'udledt')));
  }

  /* Beholdningen viser sine indbetalinger kompakt og fører til hver enkelt.
     Indbetalingen er et objekt på linje med posten og overførslen — den
     redigeres i sin egen rude, ikke inde i destinationens. */
  if (b.type !== 'frie') {
    var ind = indTilN(b.id);
    h.push(afsnitN('Indbetaling', (ind.length
      ? ind.map(function (o) {
          return '<div class="henvis" onclick="vaelgN(\'i' + o.i + '\')">' +
            '<span class="navn">' + kildeNavnN(o.ind) + '</span>' +
            '<span class="tal">' + indBeloebN(o.ind) + '</span><span class="vip">›</span></div>';
        }).join('')
      : '<div class="hint" style="margin:0 0 6px">Ingen indbetaling til denne beholdning.</div>') +
      '<button class="knap" style="width:100%;text-align:left">+ Indbetaling</button>'));
  }
  return h.join('');
}

/* ---------- indbetalingens rude ----------
   Kilden er ét felt med to grupper, fordi kilden er ét spørgsmål og ikke to.
   Ruden skifter form efter svaret: er kilden en lønpost, står periode,
   forankring, gentagelse og forfald slet ikke her — hverken som felter eller
   som grå felter — men som én linje, der siger, hvad bidraget følger.     */

function kildevaelgerN(ind) {
  var h = ['<select style="max-width:190px"><optgroup label="Lønposter">'];
  POSTER.forEach(function (p, i) {
    if (p.retning !== 'ind') return;
    h.push('<option' + (ind.kilde.post === i ? ' selected' : '') + '>' +
      p.navn + ' · ' + persN(p.ejer).navn + '</option>');
  });
  h.push('</optgroup><optgroup label="Beholdninger">');
  BEHOLDNINGER.forEach(function (b) {
    if (b.id === ind.destination) return;   /* kilden er en *anden* beholdning */
    h.push('<option' + (ind.kilde.beholdning === b.id ? ' selected' : '') + '>' +
      b.navn + ' · ' + persN(b.ejer).navn + '</option>');
  });
  h.push('</optgroup></select>');
  return h.join('');
}

/* En indbetaling kan ikke gå til frie midler — så er det en overførsel. */
function destinationsvaelgerN(ind) {
  return '<select style="max-width:190px">' + BEHOLDNINGER.filter(function (b) {
    return b.type !== 'frie';
  }).map(function (b) {
    return '<option' + (b.id === ind.destination ? ' selected' : '') + '>' +
      b.navn + ' · ' + persN(b.ejer).navn + '</option>';
  }).join('') + '</select>';
}

function kontaktN(valg) {
  return '<span class="kontakt">' + valg.map(function (v) {
    return '<button aria-pressed="' + (v.valgt ? 'true' : 'false') + '">' +
      v.tekst + '</button>';
  }).join('') + '</span>';
}

function indFelterN(ind) {
  var fraPost = ind.kilde.post !== undefined;
  var dest = behN(ind.destination);
  var pct = ind.procent !== undefined;
  var h = [];

  h.push(afsnitN('Indbetalingen',
    felt('Kilde', kildevaelgerN(ind)) +
    felt('Destination', destinationsvaelgerN(ind)) +
    '<div class="hint">' + (fraPost
      ? 'Kilden er en post, så AM-bidraget trækkes på vejen ind.'
      : 'Kilden er en beholdning, så der trækkes intet AM-bidrag.') +
    ' ' + (harFradragsret(dest)
      ? dest.navn + ' giver fradragsret'
      : dest.navn + ' giver ingen fradragsret') +
    (loftFor(dest, PLAN.startAar)
      ? (loftFor(dest, PLAN.startAar).form === 'PerYear'
        ? ' og har et loft pr. år.' : ' og har et loft på saldoen.')
      : ' og har intet loft.') +
    ' Begge følger destinationen og tastes ikke. Om loftet bandt, står i forklar-året.</div>'));

  /* Kontakten står kun, når der er noget at vælge imellem. En procent skal
     have en post at måle af, så et beholdningskildet bidrag har kun den ene
     form — og så er linjen *Angives som* et valg, der aldrig kan træffes. */
  h.push(afsnitN('Beløb',
    (fraPost ? felt('Angives som', kontaktN([
      { tekst: '% af posten', valgt: pct },
      { tekst: 'kr.', valgt: !pct }
    ])) : '') +
    felt(pct ? 'Procent' : 'Fast beløb',
      inp(pct ? pctN.format(ind.procent * 100) : KN(ind.beloeb), 'tal'),
      pct ? '%' : 'kr.') +
    (pct ? '<div class="hint">Måles af ' + kildeNavnN(ind) +
      ', så bidraget følger lønnen op uden at blive rettet.</div>' : '')));

  if (fraPost) {
    var post = POSTER[ind.kilde.post];
    h.push('<section class="afsnit arvet"><h3>Følger ' + kildeNavnN(ind) + '</h3>' +
      '<div class="arvelinje">' + post.periode + ' · ' + post.gentagelse.toLowerCase() +
      ' · ' + post.forfald.toLowerCase() + '</div>' +
      '<div class="hint">Periode, forankring, gentagelse og forfald hører til posten. ' +
      'Bidraget har dem ikke selv og ophører derfor af sig selv ved erhvervsophøret.</div></section>');
  } else {
    h.push(afsnitN('Perioden',
      felt('Forankring', vlg(ind.forankring === 'alder'
        ? ['Alder', 'Kalenderår'] : ['Kalenderår', 'Alder'])) +
      felt('Fra', inp(ind.periode.split(' – ')[0], 'tekst')) +
      felt('Til', inp(ind.periode.split(' – ')[1] || '', 'tekst')) +
      felt('Gentagelse', vlg([ind.gentagelse, 'Én gang', 'Hvert N. år'])) +
      felt('Forfald', vlg([ind.forfald, 'Jævnt'])) +
      '<div class="hint">Kilden er en beholdning og har ingen periode at låne ud. ' +
      'Til gengæld kan bidraget aldersforankres: destinationen har en ejer.</div>'));
  }
  return h.join('');
}

/* ---------- postens rude ----------
   ADR-0040 ruller ADR-0007's indtastningsregel tilbage: lønnen er lønsedlens
   løn, og arbejdsgiverbidraget lægges til af pensionsaftalen på posten. Det
   er ikke kosmetik: målte de 12 %, der står på sedlen, en brutto brugeren
   selv havde lagt sammen, skulle de tastes som 10,714 % for at ramme det
   rigtige beløb — og den, der tastede de 12, ramte 8.640 kr. for højt hvert
   år, uden at nogen invariant fangede det.                                */

function postFelterN(i) {
  var post = POSTER[i], erIndtaegt = post.retning === 'ind';
  var loen = post.skat === 'Arbejdsindkomst';
  var h = [];

  h.push(afsnitN('Posten',
    felt('Navn', inp(post.navn, 'tekst')) +
    felt('Ejer', vlg([post.ejer ? persN(post.ejer).navn : 'Husstanden'])) +
    felt('Retning', vlg([erIndtaegt ? 'Indtægt' : 'Udgift'])) +
    felt('Beløb', inp(KN(post.beloeb), 'tal'), 'kr.') +
    (erIndtaegt ? felt('Skattebehandling', vlg([post.skat, 'Arbejdsindkomst', 'Skattefri'])) : '') +
    (loen ? '<div class="hint">Det, lønsedlen kalder løn — uden arbejdsgiverens ' +
      'pensionsbidrag. Bidraget hører til i afsnittet Pension nedenfor og lægges til ' +
      'derfra, så de procenter, der står på sedlen, er dem, der tastes.</div>' : '')));

  h.push(afsnitN('Perioden',
    felt('Forankring', vlg([post.forankring === 'alder' ? 'Alder' : 'Kalenderår'])) +
    felt('Periode', inp(post.periode, 'tekst')) +
    felt('Gentagelse', vlg([post.gentagelse])) +
    felt('Forfald', vlg([post.forfald])) +
    (erIndtaegt ? felt('Reguleringssats',
      inp(pctN.format((post.egenRegulering !== undefined ? post.egenRegulering
        : PLAN.loenregulering) * 100), 'tal'), '% p.a.') : '')));

  var traekker = indFraPostN(i);
  if (traekker.length) {
    h.push(afsnitN('Trækker på posten', traekker.map(function (o) {
      return '<div class="henvis" onclick="vaelgN(\'i' + o.i + '\')">' +
        '<span class="navn">→ ' + behN(o.ind.destination).navn + '</span>' +
        '<span class="tal">' + indBeloebN(o.ind) + '</span><span class="vip">›</span></div>';
    }).join('') + '<div class="hint">Bidragene arver postens periode, gentagelse og forfald.</div>'));
  }
  return h.join('');
}

function planFelterN() {
  return afsnitN('Grundlag',
    felt('Navn', inp('Ophør som 58', 'tekst')) +
    felt('Startår', inp('2026', 'tal')) +
    felt('Inflation', inp('2,00', 'tal'), '% p.a.') +
    felt('Lønregulering', inp('3,00', 'tal'), '% p.a.')) +
  afsnitN('Fremskrivning',
    felt('§ 20-regulering', inp('2,00', 'tal'), '% p.a.') +
    felt('Folkepensionsregulering', inp('2,00', 'tal'), '% p.a.') +
    '<div class="hint">Sidst kendte satsår er 2026. Årene efter regnes på fremskrevne satser.</div>');
}

function inspektorKrop() {
  if (!N.valgt) {
    return '<div class="tomrude">Ingenting er valgt.<br>Vælg noget i planen for at rette i det.</div>';
  }
  if (N.valgt === 'plan') {
    return '<div class="inspektor"><div class="titel">Ophør som 58' + lukN() + '</div>' +
      '<div class="undertitel">Det, der gælder hele forløbet</div>' + planFelterN() + '</div>';
  }
  var p = persN(N.valgt);
  if (p) {
    return '<div class="inspektor"><div class="titel">' + p.navn + lukN() + '</div>' +
      '<div class="undertitel">Født ' + p.foedselsaar + ' · ' + (2026 - p.foedselsaar) + ' år i dag</div>' +
      afsnitN('Personen',
        felt('Navn', inp(p.navn, 'tekst')) +
        felt('Fødselsår', inp(p.foedselsaar, 'tal'))) +
      afsnitN('Aldre',
        felt('Erhvervsophør', inp(p.erhvervsophoerAlder, 'tal'), 'år') +
        felt('Folkepensionsalder',
          p.udledt ? udl(p.folkepensionsalder + ' år') : inp(p.folkepensionsalder, 'tal'),
          p.udledt ? 'udledt' : 'overstyret') +
        felt('Horisont', inp(p.horisont, 'tal'), 'år') +
        '<div class="hint">' + (p.udledt
          ? 'Udledt af fødselsåret efter den vedtagne indeksering.'
          : 'Folkepensionsalderen er ikke vedtaget for ' + p.foedselsaar + '. Tallet er sat i hånden.') +
        '</div>') +
      afsnitN('Skat',
        felt('Kommune', vlg([p.kommune])) +
        felt('Kommuneskat', udl(PN(PLAN.kommuneskat)), 'udledt') +
        felt('Medlem af folkekirken',
          '<input type="checkbox" ' + (p.medlemFolkekirken ? 'checked' : '') + ' style="width:auto">') +
        (p.medlemFolkekirken ? felt('Kirkeskat', udl(PN(PLAN.kirkeskat)), 'udledt') : '') +
        '<div class="hint">Sats slået op for ' + p.kommune + ' i satsåret. Ikke et tal, der tastes.</div>') +
      '</div>';
  }
  var b = behN(N.valgt);
  if (b) {
    return '<div class="inspektor"><div class="titel">' + b.navn + lukN() + '</div>' +
      '<div class="undertitel">' + persN(b.ejer).navn + ' · ' + behUnderN(b) + '</div>' +
      behFelterN(b) + '</div>';
  }
  if (/^i\d+$/.test(N.valgt)) {
    var ind = INDBETALINGER[+N.valgt.slice(1)];
    return '<div class="inspektor"><div class="titel">Indbetaling' + lukN() + '</div>' +
      '<div class="undertitel">' + indNavnN(ind) + '</div>' + indFelterN(ind) + '</div>';
  }
  if (/^p\d+$/.test(N.valgt)) {
    var pi = +N.valgt.slice(1), post = POSTER[pi];
    return '<div class="inspektor"><div class="titel">' + post.navn + lukN() + '</div>' +
      '<div class="undertitel">' + (post.ejer ? persN(post.ejer).navn + ' · ' : '') +
      (post.retning === 'ind' ? 'indtægt' : 'udgift') + ' · ' + post.periode + '</div>' +
      postFelterN(pi) + '</div>';
  }
  return '<div class="tomrude">Ruden for denne slags er ikke tegnet.<br>' +
    'Den ligner beholdningens.</div>';
}
function lukN() { return '<span class="luk" onclick="vaelgN(null)">×</span>'; }

function inspektorN() {
  return '<div class="spaltehoved">Inspektør</div>' + inspektorKrop();
}

/* ---------- resultatspalten ---------- */

function grafN(H) {
  var B = 900, M = { t: 10, r: 10, b: 20, l: 52 }, n = DATA_N.length;
  var x = function (i) { return M.l + i * (B - M.l - M.r) / (n - 1); };
  var baand = BEHOLDNINGER.map(function () { return []; }), toppe = [];
  for (var i = 0; i < n; i++) {
    var pos = 0;
    BEHOLDNINGER.forEach(function (b, si) {
      var v = DATA_N[i].ultimo[b.id] * DATA_N[i].deflator;
      baand[si].push([pos, pos + v]); pos += v;
    });
    toppe.push(pos);
  }
  var maks = Math.max.apply(null, toppe) * 1.06;
  var y = function (v) { return M.t + (maks - v) * (H - M.t - M.b) / maks; };

  var s = ['<svg viewBox="0 0 ' + B + ' ' + H + '" role="img" aria-label="Formuen år for år">'];
  for (var v2 = 0; v2 <= maks; v2 += 2500000) {
    s.push('<line x1="' + M.l + '" x2="' + (B - M.r) + '" y1="' + y(v2).toFixed(1) +
      '" y2="' + y(v2).toFixed(1) + '" stroke="' + (v2 === 0 ? '#3d4855' : '#2a323c') + '"/>');
    s.push('<text x="' + (M.l - 7) + '" y="' + (y(v2) + 3.5).toFixed(1) +
      '" text-anchor="end" font-size="9.5" fill="#78838f">' +
      pctN.format(v2 / 1000000).replace(',00', '') + ' mio.</text>');
  }
  var fremhaev = !!behN(N.valgt);
  baand.forEach(function (band, si) {
    var op = [], ned = [];
    for (var i2 = 0; i2 < n; i2++) {
      op.push(x(i2).toFixed(1) + ',' + y(band[i2][1]).toFixed(1));
      ned.unshift(x(i2).toFixed(1) + ',' + y(band[i2][0]).toFixed(1));
    }
    var min = fremhaev && BEHOLDNINGER[si].id !== N.valgt;
    s.push('<polygon points="' + op.concat(ned).join(' ') + '" fill="' + FARVER_N[si] +
      '" fill-opacity="' + (min ? '.28' : '1') + '" stroke="#202730" stroke-width="0.5"/>');
  });
  for (var i3 = 0; i3 < n; i3++) {
    if (DATA_N[i3].aar % 10) continue;
    var anker = x(i3) > B - M.r - 20 ? 'end' : 'middle';
    s.push('<text x="' + x(i3).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="' + anker +
      '" font-size="9.5" fill="#78838f">' + DATA_N[i3].aar + '</text>');
  }
  s.push('</svg>');

  var l = ['<div class="graflegende">'];
  BEHOLDNINGER.forEach(function (b, si) {
    l.push('<span class="' + (N.valgt === b.id ? 'valgt' : '') + '" onclick="vaelgN(\'' + b.id + '\')">' +
      '<i style="background:' + FARVER_N[si] + '"></i>' + b.navn + '</span>');
  });
  l.push('</div>');

  return '<div class="graf">' + s.join('') + l.join('') + '</div>';
}

function tabelN() {
  var h = ['<div class="tabelramme"><table class="aar"><thead><tr>'];
  ['År', 'J', 'A', 'Løn m.v.', 'Ordninger', 'Ydelser', 'Afkast', 'Skat', 'Udgifter', 'Formue']
    .forEach(function (k) { h.push('<th>' + k + '</th>'); });
  h.push('</tr></thead><tbody>');
  DATA_N.forEach(function (r) {
    var f = r.deflator;
    h.push('<tr' + (r.aar === 2043 ? ' class="valgt"' : '') + '><td>' + r.aar + '</td>' +
      '<td class="alder">' + r.aldre.j + '</td><td class="alder">' + r.aldre.a + '</td>' +
      '<td>' + (r.loenIalt ? KN(r.loenIalt * f) : '<span class="svag">–</span>') + '</td>' +
      '<td>' + (r.ordningsindkomst ? KN(r.ordningsindkomst * f) : '<span class="svag">–</span>') + '</td>' +
      '<td>' + (r.ydelser ? KN(r.ydelser * f) : '<span class="svag">–</span>') + '</td>' +
      '<td>' + KN(r.afkastIalt * f) + '</td><td>−' + KN(r.skat * f) + '</td>' +
      '<td>−' + KN(r.udgifter * f) + '</td>' +
      '<td class="formue">' + KN(r.ultimoFormue * f) + '</td></tr>');
  });
  h.push('</tbody></table></div>');
  return h.join('');
}

function resultatN() {
  var enheder = '<span class="omskifter hoejre">' +
    '<button aria-pressed="true">Nutidskroner</button>' +
    '<button aria-pressed="false">Fremtidskroner</button></span>';

  if (N.tabel === 'fane') {
    var h = ['<div class="resultathoved"><span class="omskifter">' +
      '<button aria-pressed="' + (N.fane === 'graf') + '" onclick="vaelgFaneN(\'graf\')">Formuen</button>' +
      '<button aria-pressed="' + (N.fane === 'tabel') + '" onclick="vaelgFaneN(\'tabel\')">Årstabellen</button>' +
      '</span>' + enheder + '</div>'];
    h.push(N.fane === 'graf' ? grafN(430) : tabelN());
    return h.join('');
  }

  return '<div class="resultathoved"><span class="titel">Resultatet</span>' + enheder + '</div>' +
    grafN(300) + '<div class="videre">Årstabellen · 2026–2080</div>' + tabelN();
}

/* ---------- sammensætning ---------- */

var MODELLER_N = {
  b1: { spalter: '268px 340px minmax(0,1fr)', dele: [navigatorFoldbar, inspektorN, resultatN], skuffe: false },
  b2: { spalter: '262px 340px minmax(0,1fr)', dele: [navigatorFaner, inspektorN, resultatN], skuffe: false },
  b3: { spalter: '300px minmax(0,1fr)', dele: [navigatorFoldbar, resultatN], skuffe: true }
};

function tegnN() {
  var m = MODELLER_N[N.model];
  var s = document.getElementById('spalter');
  s.style.gridTemplateColumns = m.spalter;
  var skuffe = m.skuffe && N.valgt;
  s.innerHTML = m.dele.map(function (d) { return '<div class="spalte">' + d() + '</div>'; }).join('') +
    (skuffe ? '<aside class="skuffe">' + inspektorN() + '</aside>' : '');
  s.className = 'spalter' + (skuffe ? ' med-skuffe' : '');

  tilpasGrafN();

  Array.prototype.forEach.call(document.querySelectorAll('.kappe button'), function (b) {
    if (b.dataset.m) b.setAttribute('aria-current', b.dataset.m === N.model);
    if (b.dataset.t) b.setAttribute('aria-current', b.dataset.t === N.tabel);
  });
}

/* Grafen skal fylde den plads, den har — ikke et fast sidetal. SVG'en tegnes
   derfor en gang med en foreløbig højde og males om, når spalten er målt.
   På fanen fylder den hele spalten; under tabellen får den lidt under to
   tredjedele, så tabellens øverste rækker lige akkurat titter frem og røber,
   at der er mere. */
function tilpasGrafN() {
  var g = document.querySelector('.graf');
  if (!g) return;
  var bredde = g.clientWidth - 28;
  var ledig = g.parentNode.clientHeight - 115;
  if (bredde < 200 || ledig < 120) return;
  var maal = N.tabel === 'fane' ? ledig : ledig * 0.64;
  g.outerHTML = grafN(Math.round(900 * maal / bredde));
}
window.addEventListener('resize', tilpasGrafN);

function saetModelN(m) { N.model = m; location.hash = m + '-' + N.tabel; tegnN(); }
function saetTabelN(t) { N.tabel = t; location.hash = N.model + '-' + t; tegnN(); }
function vaelgFaneN(f) { N.fane = f; tegnN(); }
function vaelgN(id) { N.valgt = N.valgt === id ? null : id; tegnN(); }
function vaelgGruppeN(g) { N.gruppe = g; tegnN(); }
function foldN(id) { N.foldet[id] = !N.foldet[id]; tegnN(); }
function foldAlle() {
  var g = grupperN();
  var luk = g.some(function (x) { return !N.foldet[x.id]; });
  g.forEach(function (x) { N.foldet[x.id] = luk; });
  tegnN();
}

document.addEventListener('DOMContentLoaded', function () {
  var h = (location.hash || '').replace('#', '').split('-');
  if (MODELLER_N[h[0]]) N.model = h[0];
  if (h[1] === 'under' || h[1] === 'fane') N.tabel = h[1];
  tegnN();
});
