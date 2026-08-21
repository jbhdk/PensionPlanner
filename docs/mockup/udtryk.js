/* Tre udtryk, samme indhold. Tallene kommer fra plan.js, så tætheden er
   ægte — en skitse med runde tal lyver om, hvor svær tabellen er at læse. */

var UDTRYK = 'papir';

var PALETTER = {
  papir:      ['#43608a', '#7d94b3', '#b3c0d1', '#9a7f4e', '#bda379', '#d6c6a5', '#6d8465', '#9aae91', '#c2cebb'],
  nordisk:    ['#2f6bdb', '#5b90ea', '#9dbcf5', '#0e9f9f', '#4cbdbd', '#9ad9d9', '#7a5af0', '#a58cf5', '#cbbcfa'],
  instrument: ['#4a9ecb', '#3b7fa4', '#2c5f7c', '#c99038', '#a5762c', '#7d5a22', '#5fae7a', '#4a8a61', '#356647'],
  aften:      ['#5b7ba6', '#7d92b0', '#96a6bc', '#a3854e', '#b79a6c', '#c5b38d', '#75906c', '#8fa387', '#a6b39d'],
  'aften-flad': ['#5b7ba6', '#7d92b0', '#96a6bc', '#a3854e', '#b79a6c', '#c5b38d', '#75906c', '#8fa387', '#a6b39d']
};
var GRAFTONER = {
  papir:      { gitter: '#e6dfd0', nul: '#b8ae9a', akse: '#8c8477', kant: '#fbf9f4' },
  nordisk:    { gitter: '#eef1f6', nul: '#c9d2df', akse: '#8a94a6', kant: '#ffffff' },
  instrument: { gitter: '#1c232c', nul: '#33404e', akse: '#6b7684', kant: '#131820' },
  aften:      { gitter: '#2a323c', nul: '#3d4855', akse: '#78838f', kant: '#202730' },
  'aften-flad': { gitter: '#242b34', nul: '#3d4855', akse: '#78838f', kant: '#191e25' }
};

var kr2 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
var pct2 = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function K2(v) { return kr2.format(Math.round(v)); }
function P2(v) { return pct2.format(v * 100) + ' %'; }
function navn(id) { return PERSONER.filter(function (p) { return p.id === id; })[0].navn; }

var DATA = simuler('basis');

function planspalte() {
  var h = ['<div class="spaltetitel">Planen</div>'];

  h.push('<section class="afsnit"><h3>Planen</h3>' +
    felt2('Navn', 'Ophør som 58', '') +
    felt2('Startår', '2026', '') +
    felt2('Inflation', pct2.format(2), '% p.a.') +
    felt2('Kommuneskat', pct2.format(25.40), '%') +
    '</section>');

  h.push('<section class="afsnit"><h3>Husstanden<span class="antal">2</span></h3>' +
    PERSONER.map(function (p) {
      return '<div class="rk"><div class="hoved"><span class="ejer">' + p.navn.charAt(0) + '</span>' +
        '<span class="navn">' + p.navn + '</span><span class="tal">f. ' + p.foedselsaar + '</span></div>' +
        '<div class="under">Erhvervsophør ' + p.erhvervsophoerAlder + ' · folkepension ' +
        p.folkepensionsalder + ' · horisont ' + p.horisont + '</div></div>';
    }).join('') + '</section>');

  h.push('<section class="afsnit"><h3>Beholdninger<span class="antal">' + BEHOLDNINGER.length +
    '</span></h3>' + BEHOLDNINGER.map(function (b, i) {
      var under = [];
      if (b.type === 'frie') under.push(b.variant);
      if (b.buffer) under.push('buffer');
      if (b.udbetaling) {
        under.push(b.type === 'livrente' ? 'omsættes ' + b.udbetaling.start
          : 'udbetales ' + b.udbetaling.start + '–' + (b.udbetaling.start + b.udbetaling.aar - 1));
      }
      under.push(P2(b.brutto - b.aaop) + ' netto');
      return '<div class="rk' + (i === 3 ? ' valgt' : '') + '"><div class="hoved">' +
        '<span class="ejer">' + navn(b.ejer).charAt(0) + '</span>' +
        '<span class="navn">' + b.navn + '</span>' +
        '<span class="tal">' + K2(b.saldo) + '</span></div>' +
        '<div class="under">' + under.join(' · ') + '</div></div>';
    }).join('') + '</section>');

  var posterRk = function (p) {
    return '<div class="rk"><div class="hoved">' +
      '<span class="ejer">' + (p.ejer ? navn(p.ejer).charAt(0) : '·') + '</span>' +
      '<span class="navn">' + p.navn + '</span>' +
      '<span class="tal">' + (p.retning === 'ud' ? '−' : '') + K2(p.beloeb) + '</span></div>' +
      '<div class="under">' + p.periode + ' · ' + p.gentagelse + '</div></div>';
  };
  var indtaegter = POSTER.filter(function (p) { return p.retning === 'ind'; });
  var udgifter = POSTER.filter(function (p) { return p.retning === 'ud'; });
  // Ingen sum i overskriften — poster kan have begrænset periode eller
  // gentagelse, så et samlet kronetal ville love en regelmæssighed, planen
  // ikke har. Antallet i badge'en er nok; de nøjagtige tal står i årstabellen.
  h.push('<section class="afsnit"><h3>Indtægter<span class="antal">' + indtaegter.length +
    '</span></h3>' + indtaegter.slice(0, 2).map(posterRk).join('') + '</section>');
  h.push('<section class="afsnit"><h3>Udgifter<span class="antal">' + udgifter.length +
    '</span></h3>' + udgifter.slice(0, 2).map(posterRk).join('') + '</section>');

  return h.join('');
}

function felt2(navn2, vaerdi, enhed) {
  /* Et felt med et tal i skal stå i kolonne; et felt med tekst i skal ikke. */
  var slags = /^[\d.,\s]+$/.test(vaerdi) ? 'tal' : 'tekst';
  return '<div class="felt"><label>' + navn2 + '</label>' +
    '<input type="text" class="' + slags + '" value="' + vaerdi + '">' +
    '<span class="enhed">' + enhed + '</span></div>';
}

function graf() {
  var farver = PALETTER[UDTRYK], t = GRAFTONER[UDTRYK];
  var B = 900, H = 230, M = { t: 10, r: 10, b: 22, l: 56 };
  var n = DATA.length;
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

  for (var v = 0; v <= maks; v += 5000000) {
    s.push('<line x1="' + M.l + '" x2="' + (B - M.r) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) +
      '" stroke="' + (v === 0 ? t.nul : t.gitter) + '"/>');
    s.push('<text x="' + (M.l - 8) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="' +
      t.akse + '">' + (v / 1000000) + ' mio.</text>');
  }
  baand.forEach(function (band, si) {
    var op = [], ned = [];
    for (var i2 = 0; i2 < n; i2++) {
      op.push(x(i2).toFixed(1) + ',' + y(band[i2][1]).toFixed(1));
      ned.unshift(x(i2).toFixed(1) + ',' + y(band[i2][0]).toFixed(1));
    }
    s.push('<polygon points="' + op.concat(ned).join(' ') + '" fill="' + farver[si] +
      '" stroke="' + t.kant + '" stroke-width="0.5"/>');
  });
  for (var i3 = 0; i3 < n; i3++) {
    if (DATA[i3].aar % 10) continue;
    var anker = x(i3) > B - M.r - 22 ? 'end' : 'middle';
    s.push('<text x="' + x(i3).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + anker +
      '" font-size="10" fill="' + t.akse + '">' + DATA[i3].aar + '</text>');
  }
  s.push('</svg>');

  var forkl = '<div class="tegnforklaring">' + BEHOLDNINGER.map(function (b, i4) {
    return '<span><i class="proeve" style="background:' + farver[i4] + '"></i>' +
      b.navn + ' (' + navn(b.ejer) + ')</span>';
  }).join('') + '</div>';

  return '<div class="graf">' + s.join('') + '</div>' + forkl;
}

function tabel() {
  var h = ['<div class="tabelramme"><table class="aar"><thead><tr>'];
  ['År', 'Jesper', 'Anne', 'Løn m.v.', 'Ordninger', 'Ydelser', 'Afkast', 'Skat', 'Udgifter', 'Formue']
    .forEach(function (k) { h.push('<th>' + k + '</th>'); });
  h.push('</tr></thead><tbody>');
  DATA.forEach(function (r) {
    var f = r.deflator;
    h.push('<tr' + (r.aar === 2043 ? ' class="valgt"' : '') + '>' +
      '<td>' + r.aar + '</td>' +
      '<td class="alder">' + r.aldre.j + '</td><td class="alder">' + r.aldre.a + '</td>' +
      '<td>' + (r.loenIalt ? K2(r.loenIalt * f) : '<span class="svag">–</span>') + '</td>' +
      '<td>' + (r.ordningsindkomst ? K2(r.ordningsindkomst * f) : '<span class="svag">–</span>') + '</td>' +
      '<td>' + (r.ydelser ? K2(r.ydelser * f) : '<span class="svag">–</span>') + '</td>' +
      '<td>' + K2(r.afkastIalt * f) + '</td>' +
      '<td>−' + K2(r.skat * f) + '</td>' +
      '<td>−' + K2(r.udgifter * f) + '</td>' +
      '<td class="formue">' + K2(r.ultimoFormue * f) + '</td></tr>');
  });
  h.push('</tbody></table></div>');
  return h.join('');
}

function tegnUdtryk() {
  document.documentElement.dataset.udtryk = UDTRYK;
  document.getElementById('planspalte').innerHTML = planspalte();
  document.getElementById('resultat').innerHTML =
    '<div class="resultathoved"><span class="titel">Resultatet</span>' +
    '<span class="omskifter"><button aria-pressed="true">Nutidskroner</button>' +
    '<button aria-pressed="false">Fremtidskroner</button></span></div>' +
    graf() + tabel();
  Array.prototype.forEach.call(document.querySelectorAll('.kappe nav button'), function (b) {
    b.setAttribute('aria-current', b.dataset.u === UDTRYK);
  });
}

function saetUdtryk(u) { UDTRYK = u; location.hash = u; tegnUdtryk(); }

document.addEventListener('DOMContentLoaded', function () {
  var h = (location.hash || '').replace('#', '');
  if (PALETTER[h]) UDTRYK = h;
  tegnUdtryk();
});
