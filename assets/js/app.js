/* Tribal Education in India — dashboard logic.
   Data come only from data/*.js, which are generated from the verified panels.
   The two sections keep fully separate state (metric, period, selection). */
(function () {
  'use strict';
  const META = window.META_DATA, GEO = window.GEO_DATA;
  const DATA = { emrs: window.EMRS_DATA, aishe: window.AISHE_DATA };
  const NAMES = META.names;
  const SHORT = { DH: 'DNH & Daman and Diu', AN: 'Andaman & Nicobar', DN: 'Dadra & N. Haveli (pre-2020)', DD: 'Daman & Diu (pre-2020)' };
  const shortName = (c) => SHORT[c] || NAMES[c];
  const REPORT = { '1712308115.pdf': 'NESTS AR 2022-23', '1755767035.pdf': 'NESTS AR 2023-24', '1688722020.pdf': 'NESTS AR 2021-22', '1692872562.pdf': 'NESTS AR 2020-21' };
  const loc = (l) => String(l || '').replace(/^(\d+\.pdf)/, (m) => REPORT[m] || m);
  const SMALL = ['CH', 'DL', 'DH', 'PY', 'LD', 'GA', 'AN'];
  const RAMPS = {
    emrs: ['#eef2ee', '#c4e3d5', '#8bcbb1', '#4aa98a', '#1e8064', '#0a5442'],
    aishe: ['#dbe8fa', '#a9c9f2', '#6aa1e6', '#3478cf', '#1c55a3', '#0d356f'],
    gpi: ['#b65418', '#efb086', '#e4e2dc', '#93bdf0', '#2e6fc6']
  };
  const NODATA = 'url(#hatch)', NA_FILL = '#d6d4ce';

  const TEXT = {
    emrs: {
      eyebrow: 'School Education · Eklavya Model Residential Schools',
      title: 'Where EMRSs are sanctioned and functioning',
      text: 'EMRSs are residential schools for Scheduled Tribe students (Classes VI–XII) run through the National Education Society for Tribal Students (NESTS). The map shows State/UT counts printed in the NESTS Annual Reports 2020-21 to 2023-24. Functional schools, sanctioned schools and building construction are separate measures.',
      download: 'downloads/emrs_state_summary.csv'
    },
    aishe: {
      eyebrow: 'Higher Education · All India Survey on Higher Education',
      title: 'Scheduled Tribe participation in higher education',
      text: 'State/UT indicators from the AISHE survey tables for 2019-20 to 2023-24. Enrolment is counted where institutions are located, not by students’ home state. Choose an indicator and year; the map and charts use the same selection.',
      download: 'downloads/aishe_state_year_enrolment.csv'
    }
  };

  const S = {
    section: 'emrs', view: 'chart', sort: { key: 'value', dir: -1 }, query: '', recQuery: '',
    emrs: { metric: 'functional', period: '2023-24', sel: null },
    aishe: { metric: 'st_share', period: '2023-24', sel: null }
  };

  // ---------------- helpers ----------------
  const $ = (id) => document.getElementById(id);
  const nfIN = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const D = () => DATA[S.section];
  const st = () => S[S.section];
  const M = (k) => D().metrics[k || st().metric];
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  function fmt(metric, v) {
    if (!isNum(v)) return '—';
    if (metric.kind === 'count') return nfIN.format(Math.round(v));
    if (metric.kind === 'pct') return v.toFixed(1) + '%';
    if (metric.kind === 'gpi') return v.toFixed(2);
    return v.toFixed(1);
  }
  function unitWord(metric, v) {
    if (metric.kind !== 'count') return '';
    return ' ' + (metric.unit || '');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* value + status for a state in the current section */
  function cell(code, metricKey, period) {
    const sec = S.section, m = M(metricKey), p = period || st().period;
    const vals = (m.values[p] || {});
    const v = vals[code];
    const stat = m.status && m.status[p] ? m.status[p][code] : '';
    if (sec === 'emrs' && D().statesCovered.indexOf(code) < 0) return { v: null, s: 'nodata', note: 'Not listed in the NESTS State/UT tables' };
    if (sec === 'aishe' && code === 'DH' && p === '2019-20') return { v: null, s: 'nodata', note: 'Reported as two pre-merger UTs in 2019-20 (see detail panel)' };
    if (stat && /^not applicable/.test(stat)) return { v: null, s: 'na', note: 'Not applicable: no ST population (18–23) in AISHE Table 38' };
    if (stat && /^suppressed/.test(stat)) return { v: null, s: 'suppressed', note: 'Suppressed: report lists more functional than sanctioned schools' };
    if (!isNum(v)) return { v: null, s: 'nodata', note: 'No value in source table' };
    let note = '';
    if (stat && /implied/.test(stat)) note = 'Printed as “–”; zero implied by the table’s own total';
    else if (stat && /^printed total column/.test(stat)) note = 'Source inconsistency: ' + stat.replace(/ \(source inconsistency, see issues register\)/, '');
    return { v: v, s: 'value', note: note };
  }

  function classIndex(metric, v) {
    const b = metric.breaks;
    let i = 0;
    while (i < b.length && v >= b[i]) i++;
    return i;
  }
  function colorFor(metric, c) {
    if (c.s === 'na' || c.s === 'suppressed') return NA_FILL;
    if (c.s !== 'value') return NODATA;
    if (metric.kind === 'gpi') return RAMPS.gpi[classIndex(metric, c.v)];
    const ramp = RAMPS[S.section];
    const i = classIndex(metric, c.v);
    const off = metric.breaks.length === 4 ? 1 : 0; // 5-class scales skip the palest step
    return ramp[Math.min(ramp.length - 1, i + off)];
  }
  function binLabels(metric) {
    const b = metric.breaks, k = metric.kind;
    const f = (x) => {
      if (k === 'pct') return x + '%';
      if (k === 'gpi') return x.toFixed(2);
      if (x >= 100000) return (x / 100000) + 'L';
      if (x >= 1000) return (x / 1000) + 'k';
      return String(x);
    };
    if (k === 'count' && b[0] === 1) {
      const out = ['0'];
      for (let i = 0; i < b.length - 1; i++) out.push(b[i] + '–' + (b[i + 1] - 1));
      out.push(b[b.length - 1] + '+');
      return out;
    }
    if (k === 'pct' && b[b.length - 1] === 100) {
      const out = ['< ' + f(b[0])];
      for (let i = 0; i < b.length - 2; i++) out.push(b[i] + '–' + (b[i + 1] - 1) + '%');
      out.push(b[b.length - 2] + '–99%');
      out.push('100%');
      return out;
    }
    const out = ['< ' + f(b[0])];
    for (let i = 0; i < b.length - 1; i++) out.push(f(b[i]) + '–' + f(b[i + 1]));
    out.push(f(b[b.length - 1]) + '+');
    return out;
  }

  // ---------------- URL hash ----------------
  function writeHash() {
    const s = st();
    const h = [S.section, s.metric, s.period, s.sel || ''].join('/');
    if (location.hash.slice(1) !== h) history.replaceState(null, '', '#' + h);
  }
  function readHash() {
    const p = location.hash.slice(1).split('/');
    if (!p[0] || !DATA[p[0]]) return;
    S.section = p[0];
    const s = S[p[0]], d = DATA[p[0]];
    if (p[1] && d.metrics[p[1]]) s.metric = p[1];
    if (p[2] && d.metrics[s.metric].periods.indexOf(p[2]) >= 0) s.period = p[2];
    if (p[3] && NAMES[p[3]]) s.sel = p[3];
  }

  // ---------------- controls ----------------
  function renderControls() {
    const d = D(), s = st();
    const ms = $('metricSeg');
    ms.innerHTML = '';
    Object.keys(d.metrics).forEach((k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(k === s.metric));
      b.textContent = d.metrics[k].short;
      b.title = d.metrics[k].label;
      b.onclick = () => {
        s.metric = k;
        if (M().periods.indexOf(s.period) < 0) s.period = M().periods[M().periods.length - 1];
        update();
      };
      ms.appendChild(b);
    });
    const ps = $('periodSeg');
    ps.innerHTML = '';
    d.periods.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(p === s.period));
      const ok = M().periods.indexOf(p) >= 0;
      b.disabled = !ok;
      b.textContent = p;
      if (!ok) b.title = 'Not available for this indicator (see definition)';
      b.onclick = () => { s.period = p; update(); };
      ps.appendChild(b);
    });
    $('periodLabel').textContent = S.section === 'emrs' ? 'Annual report (financial year)' : 'Academic year';
  }

  // ---------------- map ----------------
  const svg = d3.select('#map');
  const VW = 700, VH = 760;
  svg.attr('viewBox', `0 0 ${VW} ${VH}`);
  const defs = svg.append('defs');
  const pat = defs.append('pattern').attr('id', 'hatch').attr('patternUnits', 'userSpaceOnUse').attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
  pat.append('rect').attr('width', 6).attr('height', 6).attr('fill', '#f3f1ec');
  pat.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', '#c2bfb7').attr('stroke-width', 1.4);
  const proj = d3.geoMercator().fitExtent([[10, 10], [VW - 10, VH - 10]], GEO);
  const path = d3.geoPath(proj);
  const gStates = svg.append('g');
  const gDots = svg.append('g');
  gStates.selectAll('path').data(GEO.features).join('path')
    .attr('class', 'state').attr('d', path)
    .on('mousemove', (ev, f) => showTip(ev, f.properties.code))
    .on('mouseleave', hideTip)
    .on('click', (ev, f) => select(f.properties.code));
  const dotData = GEO.features.filter((f) => SMALL.indexOf(f.properties.code) >= 0).map((f) => {
    let geom = f.geometry;
    if (geom.type === 'MultiPolygon') {
      const polys = geom.coordinates.map((c) => ({ type: 'Polygon', coordinates: c }));
      geom = polys.sort((a, b) => d3.geoArea(b) - d3.geoArea(a))[0];
    }
    const c = path.centroid(geom);
    return { code: f.properties.code, x: c[0], y: c[1] };
  });
  gDots.selectAll('circle').data(dotData).join('circle')
    .attr('class', 'dot').attr('r', 6).attr('cx', (d) => d.x).attr('cy', (d) => d.y)
    .on('mousemove', (ev, d) => showTip(ev, d.code))
    .on('mouseleave', hideTip)
    .on('click', (ev, d) => select(d.code));

  function renderMap() {
    const m = M();
    gStates.selectAll('path')
      .attr('fill', (f) => colorFor(m, cell(f.properties.code)))
      .classed('is-selected', (f) => f.properties.code === st().sel)
      .attr('aria-label', (f) => NAMES[f.properties.code]);
    gStates.selectAll('path.is-selected').raise();
    gDots.selectAll('circle')
      .attr('fill', (d) => colorFor(m, cell(d.code)))
      .classed('is-selected', (d) => d.code === st().sel);
    svg.classed('has-selection', !!st().sel);
    const p = st().period;
    $('mapTitle').textContent = `${m.label}, by State/UT · ${p}`;
    $('mapDef').textContent = m.definition;
    $('mapNote').innerHTML = `Source: ${esc(D().periodSources[p])}. Boundaries: DataMeet (CC BY 4.0), post-2020 States/UTs; for representation only. Small UTs are also shown as dots.`;
    renderLegend(m);
  }

  function swatch(fill) {
    return `<svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" rx="2" fill="${fill === NODATA ? 'url(#hatchL)' : fill}" stroke="#c9c6bf"/></svg>`;
  }
  function renderLegend(m) {
    const labs = binLabels(m);
    const cols = labs.map((_, i) => colorFor(m, { s: 'value', v: i === 0 ? -Infinity : m.breaks[i - 1] }));
    const unit = m.kind === 'count' ? m.unit : (m.kind === 'pct' ? 'per cent' : (m.kind === 'gpi' ? 'female ÷ male GER; 1.00 = parity' : 'per 100 ST population aged 18–23'));
    let extra = `<span class="legend__item">${swatch(NODATA)}${S.section === 'emrs' ? 'Not listed in source' : 'No value in source'}</span>`;
    const anyNA = Object.keys(NAMES).some((c) => ['na', 'suppressed'].indexOf(cell(c).s) >= 0);
    if (anyNA) extra += `<span class="legend__item">${swatch(NA_FILL)}${S.section === 'emrs' ? 'Ratio suppressed' : 'Not applicable (no ST population)'}</span>`;
    $('legend').innerHTML =
      `<svg width="0" height="0" style="position:absolute"><defs><pattern id="hatchL" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><rect width="5" height="5" fill="#f3f1ec"/><line x1="0" y1="0" x2="0" y2="5" stroke="#b7b4ac" stroke-width="1.4"/></pattern></defs></svg>` +
      `<div class="legend__scale"><span class="legend__title">${esc(m.short)} <span style="font-weight:400;color:var(--ink-3)">(${esc(unit)})</span></span><div class="legend__bins">` +
      labs.map((l, i) => `<div class="legend__bin"><span class="legend__sw" style="background:${cols[i]}"></span><span class="legend__lab">${esc(l)}</span></div>`).join('') +
      `</div></div><div class="legend__extra">${extra}</div>`;
  }

  const tip = $('tooltip');
  function showTip(ev, code) {
    const m = M(), c = cell(code), wrap = tip.parentNode.getBoundingClientRect();
    let html = `<b>${esc(NAMES[code])}</b>`;
    if (c.s === 'value') html += `<span class="tt-v">${fmt(m, c.v)}</span>${esc(unitWord(m, c.v))}<br>`;
    html += `<span class="tt-n">${esc(m.short)} · ${esc(st().period)}${c.note ? '<br>' + esc(c.note) : ''}</span>`;
    tip.innerHTML = html;
    tip.hidden = false;
    const x = ev.clientX - wrap.left, y = ev.clientY - wrap.top;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(4, Math.min(wrap.width - tw - 4, x + 14)) + 'px';
    tip.style.top = Math.max(4, y - th - 10) + 'px';
  }
  function hideTip() { tip.hidden = true; }

  // ---------------- detail ----------------
  function select(code) {
    st().sel = (st().sel === code) ? null : code;
    S.recAll = false;
    update();
  }
  function fig(k, v, sub, na) {
    return `<div class="fig${na ? ' fig--na' : ''}"><p class="fig__k">${k}</p><p class="fig__v">${v}</p>${sub ? `<p class="fig__s">${sub}</p>` : ''}</div>`;
  }

  function renderPicker() {
    const sel = $('statePicker');
    const codes = META.states.map((s) => s.code).sort((a, b) => NAMES[a].localeCompare(NAMES[b]));
    sel.innerHTML = `<option value="">India — all States/UTs</option>` + codes.map((c) => `<option value="${c}">${esc(NAMES[c])}</option>`).join('');
    sel.value = st().sel || '';
  }

  function renderDetail() {
    const code = st().sel;
    $('clearSel').hidden = !code;
    $('detailKicker').textContent = code ? (META.states.find((s) => s.code === code) || {}).type || 'State/UT' : 'National view';
    $('detailTitle').textContent = code ? NAMES[code] : 'India';
    $('statePicker').value = code || '';
    if (S.section === 'emrs') emrsDetail(code); else aisheDetail(code);
  }

  function emrsDetail(code) {
    const d = DATA.emrs, p = st().period;
    const nat = d.national.find((r) => r.reference_period === p) || {};
    const figs = $('figures'), mini = $('mini');
    if (code && d.statesCovered.indexOf(code) < 0) {
      figs.innerHTML = fig('EMRS in NESTS tables', 'Not listed', 'This State/UT does not appear in any NESTS state-wise table for 2020-21 to 2023-24.', true);
      mini.innerHTML = '';
      $('detailNote').textContent = 'Absence from the tables is not reported as a zero by NESTS, so no count is shown.';
      return;
    }
    const f = code ? cell(code, 'functional') : { v: nat.functional_emrs_printed_total, s: 'value' };
    const sn = code ? cell(code, 'sanctioned') : { v: nat.sanctioned_emrs_printed_total, s: 'value' };
    const sh = code ? cell(code, 'share') : { v: (nat.functional_emrs_printed_total / nat.sanctioned_emrs_printed_total) * 100, s: 'value' };
    const cons = code ? (d.construction[p] || {})[code] : null;
    let completed = null;
    if (code && cons) completed = cons.buildings_completed_old + cons.buildings_completed_new;
    if (!code && isNum(nat.buildings_completed_sum)) completed = nat.buildings_completed_sum;
    const mf = d.metrics.functional, ms = d.metrics.share;
    figs.innerHTML =
      fig('Functional EMRSs', f.s === 'value' ? fmt(mf, f.v) : '—', p + (f.note ? ' · ' + esc(f.note) : '')) +
      fig('Sanctioned EMRSs', sn.s === 'value' ? fmt(mf, sn.v) : '—', code ? 'cumulative, ' + p + (sn.note ? ' · ' + esc(sn.note) : '') : 'printed national total, ' + p) +
      fig('Functional as % of sanctioned', sh.s === 'value' ? fmt(ms, sh.v) : 'Suppressed', sh.s === 'suppressed' ? esc(sh.note) : 'same report', sh.s !== 'value') +
      fig('School buildings completed', isNum(completed) ? nfIN.format(completed) : 'Not reported', isNum(completed) ? 'Art. 275(1) + new scheme, ' + p : 'no state construction table for ' + p, !isNum(completed));
    // trend: functional vs sanctioned
    const rows = d.periods.map((per) => {
      if (code) return { p: per, a: cell(code, 'functional', per).v, b: cell(code, 'sanctioned', per).v };
      const n = d.national.find((r) => r.reference_period === per);
      return { p: per, a: n.functional_emrs_printed_total, b: n.sanctioned_emrs_printed_total };
    });
    mini.innerHTML = '';
    lineChart(mini, {
      title: `Functional and sanctioned EMRSs${code ? '' : ', India'}`,
      sub: 'Number of schools by annual report',
      periods: d.periods,
      series: [{ name: 'Sanctioned', color: '#9aa29f', values: rows.map((r) => r.b), dash: '4 3' },
               { name: 'Functional', color: 'var(--emrs)', values: rows.map((r) => r.a) }],
      fmt: (v) => nfIN.format(v), zero: true
    });
    // construction stacked bars
    const cp = ['2021-22', '2022-23', '2023-24'];
    const crow = cp.map((per) => {
      const c = code ? (d.construction[per] || {})[code] : null;
      if (code) return c ? { p: per, done: c.buildings_completed_old + c.buildings_completed_new, uc: c.buildings_under_construction_old + c.buildings_under_construction_new, ys: c.buildings_yet_to_start_old + c.buildings_yet_to_start_new } : null;
      const all = Object.values(d.construction[per] || {});
      return { p: per, done: d3.sum(all, (x) => x.buildings_completed_old + x.buildings_completed_new), uc: d3.sum(all, (x) => x.buildings_under_construction_old + x.buildings_under_construction_new), ys: d3.sum(all, (x) => x.buildings_yet_to_start_old + x.buildings_yet_to_start_new) };
    }).filter(Boolean);
    const box = document.createElement('div'); box.className = 'mini'; mini.appendChild(box);
    stackChart(box, crow);
    const nEv = d.events.filter((e) => !code || e.state_code === code).length;
    const mism = code ? cp.map((per) => { const c = (d.construction[per] || {})[code]; if (!c) return null;
      const comp = c.buildings_completed_old + c.buildings_completed_new + c.buildings_under_construction_old + c.buildings_under_construction_new + c.buildings_yet_to_start_old + c.buildings_yet_to_start_new;
      const tot = c.sanctioned_old_art275 + c.sanctioned_new_scheme;
      return comp !== tot ? `${per}: status components add to ${comp} but the table’s total columns print ${tot}` : null; }).filter(Boolean) : [];
    $('detailNote').innerHTML = (code ? `${nEv} named-school record${nEv === 1 ? '' : 's'} for ${esc(NAMES[code])} in the reports — see <a href="#records">school records</a> below. ` : '') +
      (mism.length ? '<span class="chip">Source inconsistency</span> ' + esc(mism.join('; ')) + '. ' : '') +
      'Construction counts are building status (sum of Art. 275(1) and new-scheme components), not school functioning.' +
      (!code && p === '2023-24' ? ' 2023-24: state rows add to 694 sanctioned; the printed national total is 699.' : '');
  }

  function aisheDetail(code) {
    const d = DATA.aishe, p = st().period;
    const key = code || 'IN';
    const figs = $('figures'), mini = $('mini');
    const r = (d.detail[p] || {})[key];
    if (code === 'DH' && p === '2019-20') {
      const a = d.detail[p].DN || {}, b = d.detail[p].DD || {};
      figs.innerHTML = fig('ST enrolment, Dadra & Nagar Haveli', nfIN.format(a.st_enrolment_total), 'reported separately, 2019-20') +
        fig('ST enrolment, Daman & Diu', nfIN.format(b.st_enrolment_total), 'reported separately, 2019-20') +
        fig('ST share, DNH', a.st_share_of_total_pct.toFixed(1) + '%', '') + fig('ST share, Daman & Diu', b.st_share_of_total_pct.toFixed(1) + '%', '');
      mini.innerHTML = '';
      $('detailNote').textContent = 'The two UTs merged on 26 January 2020; AISHE 2019-20 reports them separately. They are not added together here.';
      trendCharts(code);
      return;
    }
    if (!r) { figs.innerHTML = fig('AISHE', 'No record', '', true); mini.innerHTML = ''; return; }
    let inst = r.all_institutions_registered, instNote = 'universities, colleges and standalone';
    if (!code && !isNum(inst)) {
      inst = d3.sum(Object.keys(d.detail[p]).filter((c) => c !== 'IN'), (c) => d.detail[p][c].all_institutions_registered || 0);
      instNote = 'sum of States/UTs (no All-India row in Table 1(a))';
    }
    const gerNA = r.st_ger_status && /^not applicable/.test(r.st_ger_status);
    const gerTxt = !r.ger_comparable ? 'Not comparable' : (gerNA ? 'Not applicable' : (isNum(r.ger_st_total) ? r.ger_st_total.toFixed(1) : '—'));
    const gpiTxt = !r.ger_comparable ? 'Not comparable' : (gerNA ? 'Not applicable' : (isNum(r.gpi_st) ? r.gpi_st.toFixed(2) : '—'));
    figs.innerHTML =
      fig('ST enrolment', nfIN.format(r.st_enrolment_total), isNum(r.st_female_share_pct) ? `${r.st_female_share_pct.toFixed(1)}% female · estimated` : '') +
      fig('ST share of enrolment', r.st_share_of_total_pct.toFixed(1) + '%', `of ${nfIN.format(r.total_enrolment)} students`) +
      fig('ST GER (18–23)', gerTxt, !r.ger_comparable ? '2019-20 uses an older population base' : (gerNA ? 'no ST population base' : `all categories: ${isNum(r.ger_all_total) ? r.ger_all_total.toFixed(1) : '—'}`), !r.ger_comparable || gerNA) +
      fig('ST GPI', gpiTxt, !r.ger_comparable || gerNA ? '' : '1.00 = parity', !r.ger_comparable || gerNA) +
      fig('Institutions on AISHE', isNum(inst) ? nfIN.format(inst) : '—', instNote);
    figs.lastElementChild.style.gridColumn = '1 / -1';
    mini.innerHTML = '';
    trendCharts(code);
    const tu = d.tribalUniversities.filter((u) => u.state_code === code);
    $('detailNote').innerHTML = (tu.length ? `<span class="chip">Tribal university</span> ${tu.map((u) => esc(u.university)).join(', ')} (statutory tribal mandate). ` : '') +
      'Enrolment counts are AISHE estimates and include fractional values; they are rounded here for display.';
  }

  function trendCharts(code) {
    const d = DATA.aishe, mini = $('mini'), key = code || 'IN';
    const per = d.periods;
    const sv = (c, f) => per.map((p) => { const r = (d.detail[p] || {})[c]; return r && isNum(r[f]) ? r[f] : null; });
    const series1 = [{ name: 'India', color: '#9aa29f', values: sv('IN', 'st_share_of_total_pct'), dash: '4 3' }];
    if (code && code !== 'IN') series1.push({ name: NAMES[code], color: 'var(--aishe)', values: sv(key, 'st_share_of_total_pct') });
    else series1[0] = { name: 'India', color: 'var(--aishe)', values: sv('IN', 'st_share_of_total_pct') };
    const b1 = document.createElement('div'); b1.className = 'mini'; mini.appendChild(b1);
    lineChart(b1, { title: 'ST share of enrolment', sub: 'Per cent of all students, by academic year', periods: per, series: series1, fmt: (v) => v.toFixed(1) + '%', zero: true });
    const p2 = per.slice(1);
    const gv = (c, f) => p2.map((p) => { const r = (d.detail[p] || {})[c]; return r && isNum(r[f]) && !/^not applicable/.test(r.st_ger_status || '') ? r[f] : null; });
    const series2 = code && code !== 'IN'
      ? [{ name: 'India ST', color: '#9aa29f', values: gv('IN', 'ger_st_total'), dash: '4 3' }, { name: NAMES[code] + ' ST', color: 'var(--aishe)', values: gv(key, 'ger_st_total') }]
      : [{ name: 'All categories', color: '#9aa29f', values: gv('IN', 'ger_all_total'), dash: '4 3' }, { name: 'ST', color: 'var(--aishe)', values: gv('IN', 'ger_st_total') }];
    const b2 = document.createElement('div'); b2.className = 'mini'; mini.appendChild(b2);
    if (series2.every((s) => s.values.every((v) => v == null))) {
      b2.innerHTML = '<h3>ST Gross Enrolment Ratio</h3><p class="empty">Not applicable: this State/UT has no ST population aged 18–23 in AISHE Table 38.</p>';
    } else {
      lineChart(b2, { title: 'Gross Enrolment Ratio (18–23)', sub: '2020-21 onward (Census-2011-based projections)', periods: p2, series: series2, fmt: (v) => v.toFixed(1), zero: true });
    }
  }

  // ---------------- mini charts ----------------
  function width(el) { return Math.max(260, Math.min(520, el.clientWidth || 340)); }
  function lineChart(el, o) {
    el.insertAdjacentHTML('beforeend', `<h3>${esc(o.title)}</h3><p class="mini__sub">${esc(o.sub)}</p>`);
    const W = width(el), H = 150, m = { t: 10, r: 46, b: 22, l: 40 };
    const all = o.series.flatMap((s) => s.values).filter(isNum);
    if (!all.length) { el.insertAdjacentHTML('beforeend', '<p class="empty">No values for this selection.</p>'); return; }
    const x = d3.scalePoint().domain(o.periods).range([m.l, W - m.r]).padding(0.2);
    const y = d3.scaleLinear().domain([o.zero ? 0 : d3.min(all), d3.max(all)]).nice(4).range([H - m.b, m.t]);
    const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', o.title);
    s.append('g').attr('class', 'grid').selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
    s.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickFormat((v) => o.fmt(v))).call((g) => g.select('.domain').remove());
    s.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickSize(0).tickPadding(6)).call((g) => g.select('.domain').remove());
    o.series.forEach((ser) => {
      const pts = o.periods.map((p, i) => ({ p, v: ser.values[i] }));
      const line = d3.line().defined((d) => isNum(d.v)).x((d) => x(d.p)).y((d) => y(d.v));
      s.append('path').attr('d', line(pts)).attr('fill', 'none').attr('stroke', ser.color).attr('stroke-width', 2).attr('stroke-dasharray', ser.dash || null);
      s.append('g').selectAll('circle').data(pts.filter((d) => isNum(d.v))).join('circle')
        .attr('cx', (d) => x(d.p)).attr('cy', (d) => y(d.v)).attr('r', 3.5).attr('fill', ser.color).attr('stroke', '#fff').attr('stroke-width', 1.5)
        .append('title').text((d) => `${ser.name}, ${d.p}: ${o.fmt(d.v)}`);
      const last = pts.filter((d) => isNum(d.v)).pop();
      if (last) s.append('text').attr('x', x(last.p) + 7).attr('y', y(last.v) + 4).attr('font-size', 11).attr('fill', 'var(--ink-2)').text(o.fmt(last.v));
    });
    el.insertAdjacentHTML('beforeend', `<div class="mini-legend">${o.series.map((s) => `<span><i style="background:${s.color}${s.dash ? ';background:repeating-linear-gradient(90deg,' + s.color + ' 0 4px,transparent 4px 7px)' : ''}"></i>${esc(s.name)}</span>`).join('')}</div>`);
  }
  function stackChart(el, rows) {
    el.innerHTML = '<h3>School buildings by construction status</h3><p class="mini__sub">Old (Art. 275(1)) + new-scheme schools, by annual report</p>';
    if (!rows.length) { el.insertAdjacentHTML('beforeend', '<p class="empty">No construction table for this State/UT.</p>'); return; }
    const W = width(el), rh = 22, H = rows.length * (rh + 8) + 6, l = 56;
    const max = d3.max(rows, (r) => r.done + r.uc + r.ys) || 1;
    const x = d3.scaleLinear().domain([0, max]).range([0, W - l - 40]);
    const cols = ['#0f6b53', '#6fbf9f', '#d9e9e1'];
    const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Construction status');
    rows.forEach((r, i) => {
      const g = s.append('g').attr('transform', `translate(0,${i * (rh + 8)})`);
      g.append('text').attr('x', 0).attr('y', rh / 2 + 4).attr('font-size', 11).attr('fill', 'var(--ink-3)').text(r.p);
      let x0 = l;
      [['Completed', r.done], ['Under construction', r.uc], ['Yet to start', r.ys]].forEach(([n, v], k) => {
        if (v > 0) {
          g.append('rect').attr('x', x0).attr('y', 0).attr('width', Math.max(0, x(v) - 2)).attr('height', rh).attr('fill', cols[k]).attr('rx', 2)
            .append('title').text(`${n}, ${r.p}: ${v}`);
          if (x(v) > 22) g.append('text').attr('x', x0 + 5).attr('y', rh / 2 + 4).attr('font-size', 11).attr('fill', k === 0 ? '#fff' : 'var(--ink)').text(v);
        }
        x0 += x(v);
      });
      g.append('text').attr('x', x0 + 4).attr('y', rh / 2 + 4).attr('font-size', 11).attr('fill', 'var(--ink-2)').text('= ' + (r.done + r.uc + r.ys));
    });
    el.insertAdjacentHTML('beforeend', `<div class="mini-legend"><span><i class="sq" style="background:${cols[0]}"></i>Completed</span><span><i class="sq" style="background:${cols[1]}"></i>Under construction</span><span><i class="sq" style="background:${cols[2]};outline:1px solid #b9cfc4"></i>Yet to start</span></div>`);
  }

  // ---------------- ranking / table ----------------
  function rankRows() {
    const m = M();
    const codes = S.section === 'emrs' ? DATA.emrs.statesCovered.slice() : META.states.map((s) => s.code).filter((c) => !(c === 'DH' && st().period === '2019-20'));
    if (S.section === 'aishe' && st().period === '2019-20') codes.push('DN', 'DD');
    return codes.map((c) => ({ code: c, name: NAMES[c], short: shortName(c), c: cell(c) }));
  }
  function renderRank() {
    const m = M(), p = st().period;
    $('compareTitle').textContent = `Compare States/UTs: ${m.label}`;
    const missing = S.section === 'emrs' ? META.states.filter((s) => DATA.emrs.statesCovered.indexOf(s.code) < 0).map((s) => s.name) : [];
    $('compareSub').textContent = `${p}. Click a bar to select a State/UT.` + (missing.length ? ` Not listed in NESTS tables: ${missing.join(', ')}.` : '');
    $('downloadLink').href = TEXT[S.section].download;
    $('downloadLink').textContent = S.section === 'emrs' ? 'Download EMRS CSV' : 'Download AISHE CSV';
    const rows = rankRows().sort((a, b) => (b.c.s === 'value') - (a.c.s === 'value') || (b.c.v || 0) - (a.c.v || 0) || a.name.localeCompare(b.name));
    const el = $('rankChart');
    el.innerHTML = '';
    const W = Math.max(300, el.clientWidth || 800), narrow = W < 560;
    const lw = narrow ? 128 : 190, vw = narrow ? 64 : 84, rh = 22, H = rows.length * rh + 24;
    const vals = rows.filter((r) => r.c.s === 'value').map((r) => r.c.v);
    const gpi = m.kind === 'gpi';
    const x = gpi ? d3.scaleLinear().domain([Math.min(0.6, d3.min(vals)), Math.max(1.6, d3.max(vals))]).nice().range([lw, W - vw])
      : d3.scaleLinear().domain([0, d3.max(vals) || 1]).nice().range([lw, W - vw]);
    const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', `${m.label} by State/UT, ${p}`);
    s.append('g').attr('class', 'axis').attr('transform', `translate(0,${rows.length * rh + 4})`)
      .call(d3.axisBottom(x).ticks(narrow ? 3 : 6).tickSize(-rows.length * rh - 4).tickFormat((v) => m.kind === 'pct' ? v + '%' : (m.kind === 'count' && v >= 1000 ? d3.format('~s')(v) : v)))
      .call((g) => g.select('.domain').remove());
    const g = s.selectAll('g.row').data(rows).join('g').attr('class', (d) => 'row' + (d.code === st().sel ? ' is-selected' : ''))
      .attr('transform', (d, i) => `translate(0,${i * rh})`).on('click', (ev, d) => select(d.code));
    g.append('rect').attr('class', 'bg').attr('x', 0).attr('y', 0).attr('width', W).attr('height', rh).attr('fill', 'transparent');
    g.append('text').attr('x', lw - 8).attr('y', rh / 2 + 4).attr('text-anchor', 'end')
      .attr('font-size', narrow ? 11.5 : null)
      .text((d) => { const t = narrow ? ({ DH: 'DNH & DD', AN: 'A & N Islands', DN: 'DNH (pre-2020)', DD: 'Daman & Diu (pre-2020)', JK: 'Jammu & Kashmir' }[d.code] || d.short) : d.short; return t.length > 19 ? t.slice(0, 18) + '…' : t; }).append('title').text((d) => d.name);
    if (gpi) {
      s.append('line').attr('x1', x(1)).attr('x2', x(1)).attr('y1', 0).attr('y2', rows.length * rh).attr('stroke', 'var(--ink-3)').attr('stroke-dasharray', '3 3');
      g.filter((d) => d.c.s === 'value').append('line').attr('x1', x(1)).attr('x2', (d) => x(d.c.v)).attr('y1', rh / 2).attr('y2', rh / 2).attr('stroke', '#c9c6bf').attr('stroke-width', 2);
      g.filter((d) => d.c.s === 'value').append('circle').attr('cx', (d) => x(d.c.v)).attr('cy', rh / 2).attr('r', 5).attr('fill', (d) => colorFor(m, d.c)).attr('stroke', 'var(--ink)').attr('stroke-width', 0.8);
    } else {
      g.filter((d) => d.c.s === 'value').append('rect').attr('x', lw).attr('y', 4).attr('height', rh - 8).attr('rx', 2)
        .attr('width', (d) => Math.max(d.c.v > 0 ? 2 : 0, x(d.c.v) - lw)).attr('fill', (d) => colorFor(m, d.c)).attr('stroke', (d) => d.c.v === 0 ? 'none' : 'rgba(0,0,0,.08)');
    }
    g.append('text').attr('class', (d) => 'val' + (d.c.s === 'value' ? '' : ' na'))
      .attr('x', (d) => d.c.s === 'value' && !gpi ? x(d.c.v) + 6 : (gpi && d.c.s === 'value' ? W - vw + 8 : lw + 4))
      .attr('y', rh / 2 + 4)
      .text((d) => d.c.s === 'value' ? fmt(m, d.c.v) : (d.c.s === 'na' ? 'not applicable' : d.c.s === 'suppressed' ? 'suppressed' : 'no value'));
    renderTable(rows);
  }

  function tableCols() {
    const p = st().period;
    if (S.section === 'emrs') {
      return [
        { k: 'name', l: 'State/UT' },
        { k: 'f', l: 'Functional', v: (c) => cell(c, 'functional').v, f: (v) => nfIN.format(v) },
        { k: 's', l: 'Sanctioned', v: (c) => cell(c, 'sanctioned').v, f: (v) => nfIN.format(v) },
        { k: 'r', l: '% functional', v: (c) => cell(c, 'share').v, f: (v) => v.toFixed(1) + '%' },
        { k: 'b', l: 'Buildings completed', v: (c) => { const x = (DATA.emrs.construction[p] || {})[c]; return x ? x.buildings_completed_old + x.buildings_completed_new : null; }, f: (v) => nfIN.format(v) }
      ];
    }
    const dd = (c) => (DATA.aishe.detail[p] || {})[c] || {};
    const gerOk = (c) => dd(c).ger_comparable && !/^not applicable/.test(dd(c).st_ger_status || '');
    return [
      { k: 'name', l: 'State/UT' },
      { k: 'e', l: 'ST enrolment', v: (c) => dd(c).st_enrolment_total, f: (v) => nfIN.format(Math.round(v)) },
      { k: 't', l: 'Total enrolment', v: (c) => dd(c).total_enrolment, f: (v) => nfIN.format(Math.round(v)) },
      { k: 'sh', l: 'ST share', v: (c) => dd(c).st_share_of_total_pct, f: (v) => v.toFixed(2) + '%' },
      { k: 'g', l: 'ST GER', v: (c) => gerOk(c) ? dd(c).ger_st_total : null, f: (v) => v.toFixed(1) },
      { k: 'gp', l: 'ST GPI', v: (c) => gerOk(c) ? dd(c).gpi_st : null, f: (v) => v.toFixed(2) },
      { k: 'i', l: 'Institutions', v: (c) => dd(c).all_institutions_registered, f: (v) => nfIN.format(v) }
    ];
  }
  function renderTable(rows) {
    const cols = tableCols(), t = $('dataTable');
    const q = S.query.trim().toLowerCase();
    let data = rows.filter((r) => !q || r.name.toLowerCase().indexOf(q) >= 0).map((r) => {
      const o = { code: r.code, name: r.name };
      cols.slice(1).forEach((c) => { const v = c.v(r.code); o[c.k] = isNum(v) ? v : null; });
      return o;
    });
    const sk = cols.some((c) => c.k === S.sort.key) ? S.sort.key : cols[1].k;
    data.sort((a, b) => {
      if (sk === 'name') return S.sort.dir * a.name.localeCompare(b.name);
      if (a[sk] == null) return 1; if (b[sk] == null) return -1;
      return S.sort.dir * (a[sk] - b[sk]);
    });
    t.innerHTML = `<caption class="visually-hidden">${esc(M().label)} and related values, ${esc(st().period)}</caption><thead><tr>${cols.map((c) =>
      `<th scope="col" aria-sort="${c.k === sk ? (S.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-k="${c.k}">${esc(c.l)}</button></th>`).join('')}</tr></thead><tbody>` +
      data.map((r) => `<tr data-code="${r.code}" class="${r.code === st().sel ? 'is-selected' : ''}">${cols.map((c, i) => i === 0 ? `<td>${esc(r.name)}</td>` :
        (r[c.k] == null ? '<td class="na">–</td>' : `<td>${c.f(r[c.k])}</td>`)).join('')}</tr>`).join('') + '</tbody>';
    t.querySelectorAll('th button').forEach((b) => b.onclick = () => {
      const k = b.dataset.k;
      S.sort = { key: k, dir: S.sort.key === k ? -S.sort.dir : (k === 'name' ? 1 : -1) };
      renderTable(rankRows());
    });
    t.querySelectorAll('tbody tr').forEach((tr) => tr.onclick = () => select(tr.dataset.code));
  }

  // ---------------- records ----------------
  function renderRecords() {
    const code = st().sel, body = $('recordsBody');
    if (S.section === 'emrs') {
      const ev = DATA.emrs.events.filter((e) => !code || e.state_code === code);
      $('recordsTitle').textContent = `Schools named in NESTS reports${code ? ' — ' + NAMES[code] : ''}`;
      $('recordsSub').textContent = 'Only schools that the 2022-23 and 2023-24 reports name individually (buildings completed, foundation stones, inaugurations). This is not a complete school list; names, districts and blocks are as printed. No coordinates are published, so schools are not mapped as points.';
      if (!ev.length) { body.innerHTML = `<p class="empty">No school is named for ${esc(NAMES[code])} in these lists.</p>`; return; }
      const q = S.recQuery.toLowerCase();
      const match = ev.filter((e) => !q || [e.school_name_as_printed, e.district_as_printed, e.block_as_printed, NAMES[e.state_code]].join(' ').toLowerCase().indexOf(q) >= 0);
      const shown = S.recAll ? match : match.slice(0, 12);
      body.innerHTML = (ev.length > 15 ? `<label class="search"><span class="visually-hidden">Search school records</span><input id="recSearch" type="search" placeholder="Search school, district or State" value="${esc(S.recQuery)}"></label>` : '') +
        `<table class="data-table records-table"><thead><tr><th>School (as printed)</th><th>District (as printed)</th><th>State/UT</th><th>Record</th><th>Sanctioned</th><th>Date</th><th>Source</th></tr></thead><tbody>` +
        shown.map((e) => `<tr><td class="wrap"><b>${esc(e.school_name_as_printed)}</b>${e.flags && /DUPLICATE/.test(e.flags) ? ' <span class="chip">listed twice in source</span>' : ''}</td><td class="wrap">${esc(e.district_as_printed || '—')}</td><td>${esc(NAMES[e.state_code])}</td><td>${esc(e.event)}<br><span style="color:var(--ink-3)">${esc(e.event_period)}${e.scheme ? ' · ' + esc(e.scheme) : ''}</span></td><td>${esc(e.sanction_year || '—')}</td><td>${esc(e.event_date || '—')}</td><td class="wrap" style="color:var(--ink-3);font-size:12px">${esc(loc(e.locator))}</td></tr>`).join('') +
        `</tbody></table><p class="compare__sub">${shown.length} of ${match.length} matching records shown${match.length > shown.length ? ` · <button type="button" class="btn-clear" id="recMore">Show all ${match.length}</button>` : ''}</p>`;
      const more = $('recMore'); if (more) more.onclick = () => { S.recAll = true; renderRecords(); };
      const rs = $('recSearch');
      if (rs) rs.oninput = (e) => { S.recQuery = e.target.value; const pos = e.target.selectionStart; renderRecords(); const n = $('recSearch'); n.focus(); n.setSelectionRange(pos, pos); };
    } else {
      const tu = DATA.aishe.tribalUniversities;
      $('recordsTitle').textContent = 'Universities with a statutory tribal mandate';
      $('recordsSub').textContent = 'Public universities whose constituting Act expressly makes higher education of the tribal population a primary object. A tribal name or location alone does not qualify. Verified against the Act texts on 11 October 2026.';
      body.innerHTML = `<table class="data-table records-table"><thead><tr><th>University</th><th>Type</th><th>State</th><th>Legislation</th><th>Provision</th><th>Act text</th></tr></thead><tbody>` +
        tu.map((u) => `<tr class="${u.state_code === code ? 'is-selected' : ''}"><td class="wrap"><b>${esc(u.university)}</b><br><span style="color:var(--ink-3)">${esc(u.seat)}</span></td><td>${esc(u.type)}</td><td>${esc(u.state)}</td><td class="wrap">${esc(u.legislation)}</td><td class="wrap">${esc(u.provision)}</td><td><a href="${esc(u.verification_source)}" rel="noopener">Source</a></td></tr>`).join('') + '</tbody></table>';
    }
  }

  // ---------------- section + update ----------------
  function setSection(sec) {
    if (sec === S.section) return;
    const prevSel = st().sel;
    S.section = sec;
    // carry the selected State/UT only if it has a record in the new section's tables
    if (prevSel) {
      const ok = sec === 'emrs' ? DATA.emrs.statesCovered.indexOf(prevSel) >= 0 : !!(DATA.aishe.detail[S.aishe.period] || {})[prevSel];
      st().sel = ok ? prevSel : null;
    }
    S.sort = { key: 'value', dir: -1 }; S.query = ''; S.recQuery = ''; S.recAll = false; $('tableSearch').value = '';
    hideTip();
    update();
  }
  function update() {
    document.body.dataset.section = S.section;
    document.querySelectorAll('.switch button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.section === S.section)));
    const t = TEXT[S.section];
    $('introEyebrow').textContent = t.eyebrow; $('introTitle').textContent = t.title; $('introText').textContent = t.text;
    renderControls(); renderMap(); renderPicker(); renderDetail(); renderRank(); renderRecords();
    document.querySelectorAll('.compare .seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.view === S.view)));
    $('rankChart').hidden = S.view !== 'chart'; $('rankTable').hidden = S.view !== 'table';
    writeHash();
  }

  document.querySelectorAll('.switch button').forEach((b) => b.addEventListener('click', () => setSection(b.dataset.section)));
  document.querySelector('.switch').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = S.section === 'emrs' ? 'aishe' : 'emrs'; setSection(n); document.querySelector(`.switch button[data-section="${n}"]`).focus(); }
  });
  $('clearSel').onclick = () => { st().sel = null; update(); };
  $('statePicker').onchange = (e) => { st().sel = e.target.value || null; update(); };
  document.querySelectorAll('.compare .seg button').forEach((b) => b.onclick = () => { S.view = b.dataset.view; update(); });
  $('tableSearch').oninput = (e) => { S.query = e.target.value; renderTable(rankRows()); };
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { renderDetail(); renderRank(); }, 150); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st().sel) { st().sel = null; update(); } });
  readHash();
  update();
  window.__dash = { S, cell, M, DATA };  // exposed for automated tests
})();
