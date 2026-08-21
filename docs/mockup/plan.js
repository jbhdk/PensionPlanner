/* Fixturen og mock-motoren bag fladekortet.

   Dette er IKKE Pensionsplannerens motor. Det er en grov fremskrivning, der
   findes for at give fladekortet tal med den rigtige størrelsesorden og den
   rigtige form. Den er bevidst simpel, den kender ikke alle regler, og den må
   aldrig blive forlæg for docs/adr eller for koden. Se README.md. */

var SATSER_2026 = {
  amBidrag: 0.0800,
  bundskat: 0.1201,
  mellemskat: 0.0750,
  topskat: 0.0750,
  topTopskat: 0.0500,
  aktieindkomstLav: 0.27,
  aktieindkomstHoej: 0.42,
  palSkat: 0.1530,
  aktiesparekonto: 0.17,
  personfradrag: 54100,
  mellemskattegraense: 641200,
  topskattegraense: 777900,
  topTopskattegraense: 2592700,
  aktieindkomstgraense: 79400,
  beskaeftigelsesfradragPct: 0.1275,
  beskaeftigelsesfradragMaks: 63300,
  jobfradragPct: 0.0450,
  jobfradragBund: 235200,
  jobfradragMaks: 3100,
  grundbeloeb: 90528,
  pensionstillaegGift: 53604,
  aftrapningFradrag: 198800,
  aftrapningIkkePensionist: 0.32,
  aftrapningPensionist: 0.16,
  aegtefaelleBortseelse: 0.54,
  /* Lofterne. De to former måler ikke det samme: PerYear måler årets samlede
     indbetaling til ordningen, OnBalance måler saldoen ved årets begyndelse. */
  ratepensionLoft: 68700,
  aldersopsparingLoft: 9900,
  aldersopsparingLoftHoej: 64200,
  aktiesparekontoLoft: 174200
};

var PLAN = {
  navn: 'Ophør som 58',
  startAar: 2026,
  slutAar: 2080,
  inflation: 0.0200,
  loenregulering: 0.0300,
  satsregulering: 0.0200,
  paragraf20: 0.0200,
  kommuneskat: 0.2540,
  kirkeskat: 0.0074,
  sidstKendteSatsaar: 2026
};

var PERSONER = [
  { id: 'j', navn: 'Jesper', foedselsaar: 1973, erhvervsophoerAlder: 58,
    folkepensionsalder: 70, udledt: true, horisont: 95, kommune: 'Aarhus', medlemFolkekirken: true },
  { id: 'a', navn: 'Anne', foedselsaar: 1985, erhvervsophoerAlder: 62,
    folkepensionsalder: 72, udledt: false, horisont: 95, kommune: 'Aarhus', medlemFolkekirken: false }
];

/* type: frie | ask | rate | alder | livrente */
var BEHOLDNINGER = [
  { id: 'b1', navn: 'Frie midler', ejer: 'j', type: 'frie', variant: 'Aktieindkomst',
    saldo: 2900000, brutto: 0.0650, aaop: 0.0045, buffer: true },
  { id: 'b2', navn: 'Frie midler', ejer: 'a', type: 'frie', variant: 'Kapitalindkomst',
    saldo: 480000, brutto: 0.0250, aaop: 0.0020, buffer: false },
  { id: 'b3', navn: 'Aktiesparekonto', ejer: 'j', type: 'ask',
    saldo: 162000, brutto: 0.0650, aaop: 0.0045 },
  { id: 'b4', navn: 'Ratepension, Danica', ejer: 'j', type: 'rate', regime: 'før 1. maj 2007',
    saldo: 3100000, brutto: 0.0500, aaop: 0.0080,
    udbetaling: { start: 2033, aar: 10, princip: 'Serieprincippet' } },
  { id: 'b5', navn: 'Ratepension, PFA', ejer: 'j', type: 'rate', regime: 'før 1. maj 2007',
    saldo: 1480000, brutto: 0.0500, aaop: 0.0070,
    udbetaling: { start: 2033, aar: 10, princip: 'Serieprincippet' } },
  { id: 'b6', navn: 'Ratepension, Velliv', ejer: 'j', type: 'rate', regime: 'før 1. maj 2007',
    saldo: 960000, brutto: 0.0500, aaop: 0.0075,
    udbetaling: { start: 2033, aar: 10, princip: 'Serieprincippet' } },
  { id: 'b7', navn: 'Aldersopsparing', ejer: 'j', type: 'alder', regime: 'fra 1. januar 2018',
    saldo: 340000, brutto: 0.0550, aaop: 0.0060,
    udbetaling: { start: 2043, aar: 5, princip: 'Serieprincippet' } },
  { id: 'b8', navn: 'Ratepension, Velliv', ejer: 'a', type: 'rate', regime: 'fra 1. januar 2018',
    saldo: 900000, brutto: 0.0500, aaop: 0.0075,
    udbetaling: { start: 2054, aar: 10, princip: 'Annuitetsprincippet' } },
  { id: 'b9', navn: 'Livrente, PFA', ejer: 'a', type: 'livrente', regime: 'fra 1. januar 2018',
    saldo: 760000, brutto: 0.0480, aaop: 0.0090,
    omsaetningsfaktor: 0.0512, udbetaling: { start: 2054 } }
];

var YDELSER = [
  { navn: 'Folkepension', ejer: 'j', udledt: true },
  { navn: 'Folkepension', ejer: 'a', udledt: true },
  { navn: 'ATP', ejer: 'j', beloeb: 32000, startAlder: 70 },
  { navn: 'ATP', ejer: 'a', beloeb: 26000, startAlder: 72 }
];

/* Beløb i nutidskroner. retning: ind | ud. */
var POSTER = [
  { navn: 'Løn', ejer: 'j', retning: 'ind', beloeb: 1150000, skat: 'Arbejdsindkomst',
    forankring: 'alder', periode: 'Nu – Jespers erhvervsophør', gentagelse: 'Hvert år', forfald: 'Jævnt' },
  { navn: 'Løn', ejer: 'a', retning: 'ind', beloeb: 620000, skat: 'Arbejdsindkomst',
    forankring: 'alder', periode: 'Nu – Annes erhvervsophør', gentagelse: 'Hvert år', forfald: 'Jævnt' },
  { navn: 'Arv efter far', ejer: 'j', retning: 'ind', beloeb: 900000, skat: 'Skattefri',
    forankring: 'kalender', fra: 2038, til: 2038, periode: '2038', gentagelse: 'Én gang', forfald: 'Juni' },
  { navn: 'Husholdning', retning: 'ud', beloeb: 262000, periode: 'Hele horisonten', gentagelse: 'Hvert år', forfald: 'Jævnt' },
  { navn: 'Bolig, drift', retning: 'ud', beloeb: 78000, periode: 'Hele horisonten', gentagelse: 'Hvert år', forfald: 'Jævnt' },
  { navn: 'Forsikringer', retning: 'ud', beloeb: 32000, periode: 'Hele horisonten', gentagelse: 'Hvert år', forfald: 'Januar' },
  { navn: 'Biler, drift', retning: 'ud', beloeb: 58000, periode: 'Hele horisonten', gentagelse: 'Hvert år', forfald: 'Jævnt' },
  { navn: 'Sommerhus', retning: 'ud', beloeb: 44000, periode: 'Hele horisonten', gentagelse: 'Hvert år', forfald: 'Jævnt' },
  { navn: 'Rejser', retning: 'ud', beloeb: 110000, forankring: 'alder',
    periode: 'Jespers erhvervsophør – Jesper 80', gentagelse: 'Hvert år', forfald: 'Jævnt' },
  { navn: 'Nyt køkken', retning: 'ud', beloeb: 320000, forankring: 'kalender',
    fra: 2029, til: 2029, periode: '2029', gentagelse: 'Én gang', forfald: 'August' },
  { navn: 'Bil, udskiftning', retning: 'ud', beloeb: 420000, gentagelse: 'Hvert 8. år',
    forankring: 'kalender', fra: 2028, til: 2060, periode: '2028 – 2060', forfald: 'Marts' },
  { navn: 'Uddannelse, børnene', retning: 'ud', beloeb: 60000, forankring: 'kalender',
    fra: 2027, til: 2033, periode: '2027 – 2033', gentagelse: 'Hvert år', forfald: 'Jævnt' },
  { navn: 'Tandlæge og sundhed', retning: 'ud', beloeb: 20000, periode: 'Hele horisonten',
    gentagelse: 'Hvert år', forfald: 'Jævnt', egenRegulering: 0.0400 },
  { navn: 'Kontingenter og abonnementer', retning: 'ud', beloeb: 18000,
    periode: 'Hele horisonten', gentagelse: 'Hvert år', forfald: 'Jævnt' }
];

/* En overførsel flytter mellem frie midler. Flytningen til aktiesparekontoen
   stod her indtil etape 2 og hørte aldrig til: destinationen er en ordning med
   et loft, og så er det en indbetaling — jf. ADR-0016. Den står nu blandt
   INDBETALINGER. */
var OVERFOERSLER = [
  { fra: 'b2', til: 'b1', beloeb: 200000, gentagelse: 'Én gang', periode: '2047', forfald: 'Juni' }
];

/* Indbetalinger. Kilden er enten en lønpost — et indeks i POSTER — eller en
   beholdning, og det er hele skellet mellem de to former, jf. ADR-0016.

   Et lønkildet bidrag arver periode, forankring, gentagelse og forfald fra sin
   post og bærer derfor kun destinationen og en beløbsangivelse: enten en
   procent af posten eller et fast beløb i nutidskroner. Et beholdningskildet
   bidrag har ingen post at arve fra og bærer dem alle selv.

   Fradragsretten og loftet står ikke her: begge følger destinationens variant
   og slås op. AM-behandlingen følger kilden.                                 */
var INDBETALINGER = [
  { kilde: { post: 0 }, destination: 'b4', procent: 0.0800 },
  { kilde: { post: 0 }, destination: 'b7', beloeb: 9900 },
  { kilde: { post: 1 }, destination: 'b9', procent: 0.1200 },
  { kilde: { post: 1 }, destination: 'b8', procent: 0.0400 },
  { kilde: { beholdning: 'b1' }, destination: 'b3', beloeb: 15000,
    forankring: 'kalender', fra: 2026, tilAar: 2038, periode: '2026 – 2038',
    gentagelse: 'Hvert år', forfald: 'Januar' },
  /* Aldersopsparingens høje loft gælder de sidste syv år før folkepensionen.
     Jesper holder op med at arbejde som 58, så hele det vindue ligger efter
     sidste lønkrone — uden en kilde, der er en beholdning, kan det ikke
     skrives. Det er ADR-0016's egen begrundelse, sat i fixturen. */
  { kilde: { beholdning: 'b1' }, destination: 'b7', beloeb: 64200,
    forankring: 'alder', fra: 2036, tilAar: 2042, periode: 'Jesper 63 – Jesper 69',
    gentagelse: 'Hvert år', forfald: 'Januar' }
];

/* ---------- mock-motoren ---------- */

function alder(person, aar) { return aar - person.foedselsaar; }
function nettoafkast(b) { return b.brutto - b.aaop; }
function behP(id) { return BEHOLDNINGER.filter(function (b) { return b.id === id; })[0]; }
function persP(id) { return PERSONER.filter(function (p) { return p.id === id; })[0]; }

/* Fradragsretten følger destinationens variant og er ikke noget, bidraget
   bærer selv — jf. ADR-0016. Loftet er et uafhængigt opslag i samme tabel:
   aldersopsparingen har et loft og ingen fradragsret, den arbejdsgiver-
   administrerede livrente har fradragsret og intet loft. */
function harFradragsret(b) { return b.type === 'rate' || b.type === 'livrente'; }

function loftFor(b, aar) {
  var s = SATSER_2026, f = Math.pow(1 + PLAN.paragraf20, aar - PLAN.startAar);
  if (b.type === 'rate') return { form: 'PerYear', beloeb: s.ratepensionLoft * f };
  if (b.type === 'alder') {
    var p = persP(b.ejer);
    var hoej = alder(p, aar) >= p.folkepensionsalder - 7;
    return { form: 'PerYear', beloeb: (hoej ? s.aldersopsparingLoftHoej : s.aldersopsparingLoft) * f };
  }
  if (b.type === 'ask') return { form: 'OnBalance', beloeb: s.aktiesparekontoLoft * f };
  return null;
}

function personskat(p) {
  var s = SATSER_2026, f = Math.pow(1 + PLAN.paragraf20, p.aar - PLAN.startAar);
  var g = function (n) { return s[n] * f; };
  var l = {};

  var am = p.arbejdsindkomst * s.amBidrag;
  /* Fradragsretten holder indbetalingen uden for den personlige indkomst og
     rammer dermed alle lag ovenpå. Den er ikke et ligningsmæssigt fradrag. */
  var pi = p.arbejdsindkomst - am + p.ovrigPersonligIndkomst - (p.fradragsret || 0);
  var posKap = Math.max(0, p.kapitalindkomst);

  var besk = Math.min((p.arbejdsindkomst - am) * s.beskaeftigelsesfradragPct, g('beskaeftigelsesfradragMaks'));
  var job = Math.min(Math.max(0, p.arbejdsindkomst - am - g('jobfradragBund')) * s.jobfradragPct, g('jobfradragMaks'));
  var skattepligtig = pi + p.kapitalindkomst - besk - job;
  var pf = g('personfradrag');

  l.amBidrag = am;
  l.fradragsret = p.fradragsret || 0;
  l.personligIndkomst = pi;
  l.kapitalindkomst = p.kapitalindkomst;
  l.aktieindkomst = p.aktieindkomst;
  l.beskaeftigelsesfradrag = besk;
  l.jobfradrag = job;
  l.skattepligtigIndkomst = skattepligtig;

  l.bundskat = Math.max(0, pi + posKap) * s.bundskat;
  l.mellemskat = Math.max(0, pi - g('mellemskattegraense')) * s.mellemskat;
  l.topskat = Math.max(0, pi - g('topskattegraense')) * s.topskat;
  l.topTopskat = Math.max(0, pi - g('topTopskattegraense')) * s.topTopskat;
  l.kommuneskat = Math.max(0, skattepligtig) * PLAN.kommuneskat;
  l.kirkeskat = Math.max(0, skattepligtig) * PLAN.kirkeskat;
  l.personfradragVaerdi = -Math.min(pf, Math.max(0, skattepligtig)) * (s.bundskat + PLAN.kommuneskat + PLAN.kirkeskat);

  var sum = 0;
  ['amBidrag', 'bundskat', 'mellemskat', 'topskat', 'topTopskat', 'kommuneskat',
    'kirkeskat', 'personfradragVaerdi'].forEach(function (k) { sum += l[k]; });
  l.iAlt = Math.max(0, sum);
  return l;
}

function postAktiv(post, aar) {
  var j = PERSONER[0];
  var fra = PLAN.startAar, til = PLAN.slutAar;
  if (post.forankring === 'alder') {
    if (post.navn === 'Løn') {
      var p = post.ejer === 'j' ? PERSONER[0] : PERSONER[1];
      til = p.foedselsaar + p.erhvervsophoerAlder - 1;
    } else {
      fra = j.foedselsaar + j.erhvervsophoerAlder;
      til = j.foedselsaar + 80;
    }
  } else if (typeof post.fra === 'number') {
    fra = post.fra; til = post.til;
  }
  if (aar < fra || aar > til) return false;
  if (post.gentagelse === 'Én gang') return aar === fra;
  if (post.gentagelse === 'Hvert 8. år') return (aar - fra) % 8 === 0;
  return true;
}

/* Et lønkildet bidrag har ingen periode at prøve: det falder præcis de år,
   dets post falder, og ophører af sig selv ved erhvervsophøret. */
function indbetalingAktiv(ind, aar) {
  if (ind.kilde.post !== undefined) return postAktiv(POSTER[ind.kilde.post], aar);
  if (aar < ind.fra || aar > ind.tilAar) return false;
  if (ind.gentagelse === 'Én gang') return aar === ind.fra;
  return true;
}

function simuler(variant) {
  var saldi = {}, omsat = {}, raekker = [];
  var udgiftsloft = variant === 'uholdbar' ? 1.22 : 1;
  BEHOLDNINGER.forEach(function (b) { saldi[b.id] = b.saldo; });

  for (var aar = PLAN.startAar; aar <= PLAN.slutAar; aar++) {
    var r = { aar: aar, aldre: {}, primo: {}, ultimo: {}, afkast: {}, beholdningsskat: {},
      udbetaling: {}, indbetaling: {}, indbetalinger: [], lofter: [],
      satsgrundlag: aar <= PLAN.sidstKendteSatsaar ? 'kendt' : 'fremskrevet' };
    var infl = Math.pow(1 + PLAN.inflation, aar - PLAN.startAar);
    var satsreg = Math.pow(1 + PLAN.satsregulering, aar - PLAN.startAar);

    PERSONER.forEach(function (p) { r.aldre[p.id] = alder(p, aar); });
    var primoIalt = 0;
    BEHOLDNINGER.forEach(function (b) { r.primo[b.id] = saldi[b.id]; primoIalt += saldi[b.id]; });
    r.primoFormue = primoIalt;

    /* Beholdningsskatten bæres af beholdningen selv og trækkes af dens saldo.
       Det gælder også aktiesparekontoens egen sats, som denne fil før lod
       bufferen betale — den passerer ingen persons indkomst og hører derfor
       ikke til blandt de skattelag, husstanden betaler af pengestrømmen.  */
    var afkastIalt = 0, beholdningsskatIalt = 0;
    r.omsatDepot = 0;
    BEHOLDNINGER.forEach(function (b) {
      var grundlag = (b.type === 'livrente' && omsat[b.id] !== undefined) ? 0 : saldi[b.id];
      var a = grundlag * nettoafkast(b);
      r.afkast[b.id] = a; afkastIalt += a;
      saldi[b.id] += a;
      var sats = 0;
      if (b.type === 'rate' || b.type === 'alder' || b.type === 'livrente') sats = SATSER_2026.palSkat;
      else if (b.type === 'ask') sats = SATSER_2026.aktiesparekonto;
      if (!sats) return;
      var bs = Math.max(0, a) * sats;
      r.beholdningsskat[b.id] = bs; beholdningsskatIalt += bs; saldi[b.id] -= bs;
    });
    r.afkastIalt = afkastIalt; r.beholdningsskatIalt = beholdningsskatIalt;

    BEHOLDNINGER.forEach(function (b) {
      if (!b.udbetaling || aar < b.udbetaling.start) return;
      if (b.type === 'livrente') {
        if (omsat[b.id] === undefined) {
          /* Depotet omsaettes en gang og forlader balancen, jf. ADR-0009.
             Det er ikke en udgift — derfor sit eget led i invarianten. */
          r.omsatDepot += saldi[b.id];
          omsat[b.id] = saldi[b.id] * b.omsaetningsfaktor;
          saldi[b.id] = 0;
        }
        r.udbetaling[b.id] = omsat[b.id] * Math.pow(1 + PLAN.satsregulering, aar - b.udbetaling.start);
        return;
      }
      var rest = b.udbetaling.start + b.udbetaling.aar - aar;
      if (rest <= 0) return;
      var beloeb;
      if (b.udbetaling.princip === 'Annuitetsprincippet') {
        var i = 0.0150;
        beloeb = saldi[b.id] * i / (1 - Math.pow(1 + i, -rest));
      } else {
        beloeb = saldi[b.id] / rest;
      }
      beloeb = Math.max(0, Math.min(beloeb, saldi[b.id]));
      r.udbetaling[b.id] = beloeb;
      saldi[b.id] -= beloeb;
    });

    var loenIalt = 0, udgifter = 0;
    r.poster = [];
    POSTER.forEach(function (post) {
      if (!postAktiv(post, aar)) return;
      var sats = post.egenRegulering !== undefined ? post.egenRegulering
        : (post.navn === 'Løn' ? PLAN.loenregulering : PLAN.inflation);
      var beloeb = post.beloeb * Math.pow(1 + sats, aar - PLAN.startAar);
      if (post.retning === 'ud') beloeb *= udgiftsloft;
      r.poster.push({ indeks: POSTER.indexOf(post), navn: post.navn, ejer: post.ejer,
        retning: post.retning, beloeb: beloeb, skat: post.skat });
      if (post.retning === 'ind') loenIalt += beloeb; else udgifter += beloeb;
    });

    /* ---------- indbetalinger ----------
       Kilden afgør AM-behandlingen, destinationen afgør fradragsretten og
       loftet. Et lønkildet bidrag betaler AM på vejen ind, så der lander 92 %
       i ordningen; forskellen står allerede i personens eget skattelag og må
       ikke trækkes igen her. Et beholdningskildet bidrag flytter hele beløbet.
       Begge former er bevægelser og dermed formueneutrale — de flytter, de
       skaber og forbruger ikke.                                             */
    var fradragsretPr = {};
    var landetPr = {}, forladtFraLoen = 0;
    PERSONER.forEach(function (p) { fradragsretPr[p.id] = 0; });

    INDBETALINGER.forEach(function (ind) {
      if (!indbetalingAktiv(ind, aar)) return;
      var dest = behP(ind.destination);
      var fraLoen = ind.kilde.post !== undefined;
      var forlod;
      if (ind.procent !== undefined) {
        var lp = r.poster.filter(function (x) { return x.indeks === ind.kilde.post; })[0];
        if (!lp) return;
        forlod = lp.beloeb * ind.procent;
      } else {
        forlod = ind.beloeb * infl;
      }
      var landet = fraLoen ? forlod * (1 - SATSER_2026.amBidrag) : forlod;

      /* Et OnBalance-loft afviser: det uindskudte beløb bliver liggende i
         kilden, og intet er markeret. Råderummet er loftet minus saldoen
         primo og ånder derfor med afkastet. */
      var loft = loftFor(dest, aar), uindskudt = 0;
      if (loft && loft.form === 'OnBalance') {
        var raaderum = Math.max(0, loft.beloeb - r.primo[dest.id] - (landetPr[dest.id] || 0));
        if (landet > raaderum) {
          uindskudt = landet - raaderum;
          landet = raaderum;
          forlod = fraLoen ? landet / (1 - SATSER_2026.amBidrag) : landet;
        }
      }

      if (fraLoen) forladtFraLoen += landet;
      else saldi[ind.kilde.beholdning] -= forlod;
      saldi[dest.id] += landet;
      landetPr[dest.id] = (landetPr[dest.id] || 0) + landet;

      r.indbetalinger.push({
        kilde: ind.kilde, destination: dest.id, fraLoen: fraLoen,
        forlod: forlod, landet: landet, uindskudt: uindskudt
      });
    });

    /* Loftet måler årets samlede indbetaling til ordningen, ikke det enkelte
       bidrag. Et brudt PerYear-loft afviser ikke pengene — det overskydende
       mister blot sin fradragsret, og året er markeret. */
    Object.keys(landetPr).forEach(function (id) {
      var b = behP(id), loft2 = loftFor(b, aar), indbetalt = landetPr[id];
      var brudt = !!(loft2 && loft2.form === 'PerYear' && indbetalt > loft2.beloeb);
      var medFradragsret = !harFradragsret(b) ? 0
        : (loft2 && loft2.form === 'PerYear' ? Math.min(indbetalt, loft2.beloeb) : indbetalt);
      fradragsretPr[b.ejer] += medFradragsret;
      r.lofter.push({
        beholdning: id, indbetalt: indbetalt,
        loft: loft2 ? loft2.beloeb : null, loftform: loft2 ? loft2.form : null,
        raaderum: loft2 && loft2.form === 'OnBalance'
          ? Math.max(0, loft2.beloeb - r.primo[id]) : null,
        medFradragsret: medFradragsret, brudt: brudt
      });
    });
    r.indbetaling = landetPr;

    var pr = {};
    PERSONER.forEach(function (p) {
      pr[p.id] = { arbejdsindkomst: 0, ordningsindkomst: 0, aldersopsparing: 0, atp: 0,
        folkepension: 0, grundbeloeb: 0, pensionstillaeg: 0, aftrapning: 0,
        kapitalindkomst: 0, aktieindkomst: 0, skattefri: 0 };
    });
    r.poster.forEach(function (post) {
      if (post.retning !== 'ind' || !post.ejer) return;
      if (post.skat === 'Skattefri') pr[post.ejer].skattefri += post.beloeb;
      else pr[post.ejer].arbejdsindkomst += post.beloeb;
    });
    BEHOLDNINGER.forEach(function (b) {
      if (r.udbetaling[b.id]) {
        if (b.type === 'alder') pr[b.ejer].aldersopsparing += r.udbetaling[b.id];
        else pr[b.ejer].ordningsindkomst += r.udbetaling[b.id];
      }
      if (b.type === 'frie') {
        if (b.variant === 'Kapitalindkomst') pr[b.ejer].kapitalindkomst += r.afkast[b.id];
        else pr[b.ejer].aktieindkomst += r.afkast[b.id];
      }
    });
    YDELSER.forEach(function (y) {
      if (y.navn !== 'ATP') return;
      var p = PERSONER.filter(function (x) { return x.id === y.ejer; })[0];
      if (alder(p, aar) >= y.startAlder) pr[y.ejer].atp = y.beloeb * satsreg;
    });

    var erPensionist = {};
    PERSONER.forEach(function (p) { erPensionist[p.id] = alder(p, aar) >= p.folkepensionsalder; });

    PERSONER.forEach(function (p) {
      if (!erPensionist[p.id]) return;
      var anden = PERSONER.filter(function (x) { return x.id !== p.id; })[0].id;
      var egen = pr[p.id].ordningsindkomst + pr[p.id].atp;
      var aegte = (pr[anden].ordningsindkomst + pr[anden].atp +
        Math.max(0, pr[anden].kapitalindkomst) + pr[anden].aktieindkomst) *
        (1 - SATSER_2026.aegtefaelleBortseelse);
      var base = egen + Math.max(0, pr[p.id].kapitalindkomst) + pr[p.id].aktieindkomst + aegte;
      var fradrag = SATSER_2026.aftrapningFradrag * satsreg;
      var sats = erPensionist[anden] ? SATSER_2026.aftrapningPensionist : SATSER_2026.aftrapningIkkePensionist;
      var tillaeg = SATSER_2026.pensionstillaegGift * satsreg;
      var x = pr[p.id];
      x.taperEgen = egen; x.taperAegtefaelle = aegte; x.taperBase = base;
      x.taperFradrag = fradrag; x.taperSats = sats;
      x.grundbeloeb = SATSER_2026.grundbeloeb * satsreg;
      x.pensionstillaegFuldt = tillaeg;
      x.aftrapning = Math.min(tillaeg, Math.max(0, base - fradrag) * sats);
      x.pensionstillaeg = tillaeg - x.aftrapning;
      x.folkepension = x.grundbeloeb + x.pensionstillaeg;
    });

    var skatIalt = beholdningsskatIalt;
    PERSONER.forEach(function (p) {
      var x = pr[p.id];
      x.fradragsret = fradragsretPr[p.id];
      x.skat = personskat({
        aar: aar,
        arbejdsindkomst: x.arbejdsindkomst,
        ovrigPersonligIndkomst: x.ordningsindkomst + x.atp + x.folkepension,
        kapitalindkomst: x.kapitalindkomst,
        aktieindkomst: x.aktieindkomst,
        fradragsret: x.fradragsret
      });
      skatIalt += x.skat.iAlt;
    });

    /* Aktieindkomstskatten er husstandens og ikke den enkelte persons:
       progressionsgrænsen er fælles og overførbar mellem ægtefæller, så
       husstandens samlede aktieindkomst prøves mod husstandens samlede
       grænse — jf. ADR-0014 og docs/satser/2026.md. Regnet pr. person mod
       den doblede grænse, som denne fil gjorde før, talte de 158.800 kr.
       to gange. */
    var aktieF = Math.pow(1 + PLAN.paragraf20, aar - PLAN.startAar);
    var aktieIalt = 0;
    PERSONER.forEach(function (p) { aktieIalt += pr[p.id].aktieindkomst; });
    aktieIalt = Math.max(0, aktieIalt);
    var aktieGraense = SATSER_2026.aktieindkomstgraense * aktieF * PERSONER.length;
    var aktieLav = Math.min(aktieIalt, aktieGraense);
    var aktieHoej = aktieIalt - aktieLav;
    r.aktieindkomstskat = {
      graense: aktieGraense,
      lavGrundlag: aktieLav,
      lavSkat: aktieLav * SATSER_2026.aktieindkomstLav,
      hoejGrundlag: aktieHoej,
      hoejSkat: aktieHoej * SATSER_2026.aktieindkomstHoej
    };
    skatIalt += r.aktieindkomstskat.lavSkat + r.aktieindkomstskat.hoejSkat;

    /* En livrente er en beholdning indtil omsaetningen og en ydelse bagefter,
       jf. ADR-0009. Efter omsaetningen kommer beloebet ikke fra en saldo og
       hoerer derfor til blandt ydelserne — ikke blandt udbetalingerne. */
    var ydelser = 0, ordninger = 0;
    PERSONER.forEach(function (p) { ydelser += pr[p.id].folkepension + pr[p.id].atp; });
    BEHOLDNINGER.forEach(function (b) {
      if (!r.udbetaling[b.id]) return;
      if (b.type === 'livrente') ydelser += r.udbetaling[b.id];
      else ordninger += r.udbetaling[b.id];
    });

    r.pr = pr;
    r.loenIalt = loenIalt;
    r.ydelser = ydelser;
    r.ordningsindkomst = ordninger;
    r.indtaegter = loenIalt + ydelser;
    r.udgifter = udgifter;
    r.skat = skatIalt;

    /* Bufferen modtager årets eksterne over- eller underskud plus alt, der er
       udbetalt fra andre beholdninger, minus det, der er indbetalt fra
       pengestrømmen. Beholdningsskatten er allerede trukket i beholdningen og
       må derfor ikke trækkes en gang til her — den indgår kun i r.skat, som er
       visningens tal.
       Balanceinvarianten er dermed:
       ultimoFormue − primoFormue
         = indtægter + afkast − skat − udgifter − omsatDepot
       Indbetalingerne har intet led: de flytter formue og skaber den ikke. */
    var buffer = BEHOLDNINGER.filter(function (b) { return b.buffer; })[0];
    r.bufferBevaegelse = r.indtaegter - (r.skat - r.beholdningsskatIalt) - r.udgifter +
      ordninger - forladtFraLoen;
    saldi[buffer.id] += r.bufferBevaegelse;
    r.netto = r.indtaegter + r.afkastIalt - r.skat - r.udgifter - r.omsatDepot;

    var ultimoIalt = 0;
    BEHOLDNINGER.forEach(function (b) { r.ultimo[b.id] = saldi[b.id]; ultimoIalt += saldi[b.id]; });
    r.ultimoFormue = ultimoIalt;
    r.bufferSaldo = saldi[buffer.id];
    r.deflator = 1 / infl;
    raekker.push(r);
  }
  return raekker;
}
