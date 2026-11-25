dash.calc('mes_atual', {
  title: 'Unidades no mês atual',
  description: 'Cada unidade no último mês com dados: faturamento, pedidos, ticket, faturamento por dia e a variação dele sobre a média diária do mês anterior, e a parte de cada canal.',
  inputs: ['vendas'],
  fn: (vendas) => {
    const meses = [...new Set(vendas.map((r) => r.mes))].sort();
    const atual = meses[meses.length - 1], ant = meses[meses.length - 2];
    const prev = new Map(vendas.filter((r) => r.mes === ant).map((r) => [r.unidade, r]));
    return vendas.filter((r) => r.mes === atual).map((r) => {
      const t = +r.total_valor, dias = +r.dias, p = prev.get(r.unidade);
      const pdia = Math.round(t / dias);
      const ppdia = p ? +p.total_valor / +p.dias : null;
      return {unidade: r.unidade, mes: r.mes, dias, total: Math.round(t), pedidos: +r.total_pedidos,
        ticket: Math.round(t / +r.total_pedidos * 100) / 100, por_dia: pdia,
        ritmo_pct: ppdia ? Math.round((t / dias / ppdia - 1) * 1000) / 10 : null,
        loja_pct: Math.round(+r.loja_valor / t * 1000) / 10, ifood_pct: Math.round(+r.ifood_valor / t * 1000) / 10, f99_pct: Math.round(+r.f99_valor / t * 1000) / 10};
    }).sort((a, b) => b.total - a.total);
  }
});

dash.calc('rede_atual', {
  title: 'Rede no mês atual',
  description: 'Soma das unidades no último mês com dados, comparada por dia com o mês anterior.',
  inputs: ['vendas'],
  fn: (vendas) => {
    const meses = [...new Set(vendas.map((r) => r.mes))].sort();
    const atual = meses[meses.length - 1], ant = meses[meses.length - 2];
    const soma = (m) => {
      const rs = vendas.filter((r) => r.mes === m);
      return {t: d3.sum(rs, (r) => +r.total_valor), q: d3.sum(rs, (r) => +r.total_pedidos), apps: d3.sum(rs, (r) => +r.ifood_valor + +r.f99_valor), dias: d3.max(rs, (r) => +r.dias), n: rs.length};
    };
    const a = soma(atual), p = soma(ant);
    return [{mes: atual, dias: a.dias, unidades: a.n, total: Math.round(a.t), pedidos: a.q, ticket: Math.round(a.t / a.q * 100) / 100,
      por_dia: Math.round(a.t / a.dias), apps_pct: Math.round(a.apps / a.t * 1000) / 10,
      ritmo_pct: Math.round((a.t / a.dias / (p.t / p.dias) - 1) * 1000) / 10,
      pedidos_dia_pct: Math.round((a.q / a.dias / (p.q / p.dias) - 1) * 1000) / 10,
      ticket_pct: Math.round((a.t / a.q / (p.t / p.q) - 1) * 1000) / 10}];
  }
});

const tvRede = () => { const d = dash.data('rede_atual'); return d.status === 'ok' && d.data && d.data[0] ? d.data[0] : null; };
const tvUn = () => { const d = dash.data('mes_atual'); return d.status === 'ok' ? d.data : null; };
const tvShort = (v) => v >= 1e6 ? 'R$ ' + gzL.format(',.2f')(v / 1e6) + ' mi' : v >= 1e4 ? 'R$ ' + gzL.format(',.0f')(v / 1e3) + ' mil' : v >= 1e3 ? 'R$ ' + gzL.format(',.1f')(v / 1e3) + ' mil' : gzR(v);
const tvSet = (name, field, fmt, signed) => dash.draw(name, (el) => {
  const r = tvRede();
  el.classList.remove('tv-up', 'tv-down');
  if (!r || r[field] == null) { el.textContent = '—'; return; }
  el.textContent = fmt(r[field]);
  if (signed) el.classList.add(r[field] >= 0 ? 'tv-up' : 'tv-down');
});
tvSet('tv-total', 'total', tvShort);
tvSet('tv-nunid', 'unidades', String);
tvSet('tv-pordia', 'por_dia', gzR);
tvSet('tv-pordia-v', 'ritmo_pct', gzP, true);
tvSet('tv-ped', 'pedidos', gzN);
tvSet('tv-ped-v', 'pedidos_dia_pct', gzP, true);
tvSet('tv-tk', 'ticket', gzR2);
tvSet('tv-tk-v', 'ticket_pct', gzP, true);
tvSet('tv-apps', 'apps_pct', gzP0);
dash.draw('tv-mes', (el) => { const r = tvRede(); el.textContent = r ? gzMeses[+r.mes.slice(5) - 1].replace(/^./, (c) => c.toUpperCase()) : '—'; });
dash.draw('tv-ate', (el) => { const r = tvRede(); el.textContent = r ? String(r.dias).padStart(2, '0') + '/' + r.mes.slice(5) : '—'; });
dash.draw('tv-foot', (el) => { const r = tvRede(); el.textContent = r ? 'Dados até ' + String(r.dias).padStart(2, '0') + '/' + r.mes.slice(5) + '/' + r.mes.slice(0, 4) + ' · Consumer, iFood e 99Food' : '—'; });

const tvSvg = (el) => {
  el.replaceChildren();
  const W = el.clientWidth || 800, H = el.clientHeight || 400;
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H).attr('role', 'img');
  return {svg, W, H};
};
const tvFs = (W) => Math.max(10, W / 60);

dash.draw('tv-rank', (el) => {
  const d = dash.data('metas'); if (d.status !== 'ok') { el.replaceChildren(); return; }
  const u = d.data;
  const {svg, W, H} = tvSvg(el); svg.attr('aria-label', 'Barras do faturamento de cada unidade no mês com a meta e quanto falta');
  const fs = Math.min(tvFs(W), H / u.length * 0.55), lw = fs * 11, vw = fs * 25;
  const y = d3.scaleBand().domain(u.map((r) => r.unidade)).range([0, H]).padding(0.22);
  const x = d3.scaleLinear().domain([0, d3.max(u, (r) => Math.max(r.total, r.meta || 0))]).range([0, W - lw - vw]);
  const g = svg.selectAll('g').data(u).join('g').attr('transform', (r) => `translate(0,${y(r.unidade)})`);
  g.append('text').attr('x', lw - fs * 0.6).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').style('font-size', fs + 'px').style('font-weight', 700).style('fill', '#252525').text((r) => r.unidade);
  g.filter((r) => r.meta).append('rect').attr('x', lw).attr('height', y.bandwidth()).attr('width', (r) => x(r.meta)).attr('rx', 4).style('fill', 'rgba(122,25,21,.12)');
  g.append('rect').attr('x', lw).attr('height', y.bandwidth()).attr('width', (r) => Math.max(2, x(r.total))).attr('rx', 4).style('fill', (r) => r.meta && r.total >= r.meta ? '#FF922D' : '#7A1915');
  g.filter((r) => r.meta).append('line').attr('x1', (r) => lw + x(r.meta)).attr('x2', (r) => lw + x(r.meta)).attr('y1', -2).attr('y2', y.bandwidth() + 2).style('stroke', '#252525').style('stroke-width', 2);
  const t = g.append('text').attr('x', (r) => lw + x(Math.max(r.total, r.meta || 0)) + fs * 0.6).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').style('font-size', fs + 'px').style('fill', '#252525');
  t.append('tspan').style('font-family', '"GZ Matiz", sans-serif').text((r) => tvShort(r.total));
  t.append('tspan').style('font-weight', 700).style('fill', (r) => r.falta === 0 ? '#167a3a' : '#7A1915').text((r) => r.meta == null ? '' : r.falta === 0 ? '  meta batida' : '  faltam ' + tvShort(r.falta) + ' (' + tvShort(r.falta_dia) + '/dia)');
});

dash.draw('tv-ritmo-ch', (el) => {
  const u0 = tvUn(); if (!u0) { el.replaceChildren(); return; }
  const u = u0.filter((r) => r.ritmo_pct != null).sort((a, b) => b.ritmo_pct - a.ritmo_pct);
  const {svg, W, H} = tvSvg(el); svg.attr('aria-label', 'Variação do faturamento por dia de cada unidade sobre a média diária do mês anterior');
  const fs = Math.min(tvFs(W), H / u.length * 0.55), lw = fs * 11, pad = fs * 5;
  const m = d3.max(u, (r) => Math.abs(r.ritmo_pct)) || 1;
  const x = d3.scaleLinear().domain([-m, m]).range([lw + pad, W - pad]);
  const y = d3.scaleBand().domain(u.map((r) => r.unidade)).range([0, H]).padding(0.22);
  svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', H).style('stroke', 'rgba(255,255,255,.4)');
  const g = svg.selectAll('g.r').data(u).join('g').attr('class', 'r').attr('transform', (r) => `translate(0,${y(r.unidade)})`);
  g.append('text').attr('x', lw - fs * 0.6).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').style('font-size', fs + 'px').style('font-weight', 700).style('fill', '#fff').text((r) => r.unidade);
  g.append('rect').attr('x', (r) => Math.min(x(0), x(r.ritmo_pct))).attr('width', (r) => Math.max(2, Math.abs(x(r.ritmo_pct) - x(0)))).attr('height', y.bandwidth()).attr('rx', 4).style('fill', (r) => r.ritmo_pct >= 0 ? '#FF922D' : '#C0392B');
  g.append('text').attr('x', (r) => r.ritmo_pct >= 0 ? x(r.ritmo_pct) + fs * 0.4 : x(r.ritmo_pct) - fs * 0.4).attr('text-anchor', (r) => r.ritmo_pct >= 0 ? 'start' : 'end').attr('y', y.bandwidth() / 2).attr('dy', '0.35em').style('font-size', fs + 'px').style('fill', '#fff').style('font-weight', 700).text((r) => gzP(r.ritmo_pct));
});

dash.draw('tv-apps-ch', (el) => {
  const u = tvUn(); if (!u) { el.replaceChildren(); return; }
  const v = u.slice().sort((a, b) => (b.ifood_pct + b.f99_pct) - (a.ifood_pct + a.f99_pct));
  const {svg, W, H} = tvSvg(el); svg.attr('aria-label', 'Parte do faturamento de cada unidade que vem da loja, do iFood e do 99Food');
  const fs = Math.min(tvFs(W), H / (v.length + 1.5) * 0.55), lw = fs * 11, rw = fs * 7.5;
  const leg = svg.append('g');
  [['Loja', '#7A1915'], ['iFood', '#FF922D'], ['99Food', '#252525']].forEach(([n, c], i) => {
    leg.append('rect').attr('x', lw + i * fs * 8).attr('y', 0).attr('width', fs).attr('height', fs).style('fill', c);
    leg.append('text').attr('x', lw + i * fs * 8 + fs * 1.4).attr('y', fs * 0.85).style('font-size', fs + 'px').style('fill', '#252525').text(n);
  });
  const y = d3.scaleBand().domain(v.map((r) => r.unidade)).range([fs * 2, H]).padding(0.22);
  const x = d3.scaleLinear().domain([0, 100]).range([lw, W - rw]);
  const g = svg.selectAll('g.r').data(v).join('g').attr('class', 'r').attr('transform', (r) => `translate(0,${y(r.unidade)})`);
  g.append('text').attr('x', lw - fs * 0.6).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').style('font-size', fs + 'px').style('font-weight', 700).style('fill', '#252525').text((r) => r.unidade);
  g.each(function (r) {
    let x0 = 0;
    [['loja_pct', '#7A1915'], ['ifood_pct', '#FF922D'], ['f99_pct', '#252525']].forEach(([k, c]) => {
      d3.select(this).append('rect').attr('x', x(x0)).attr('width', Math.max(0, x(x0 + r[k]) - x(x0))).attr('height', y.bandwidth()).style('fill', c);
      x0 += r[k];
    });
  });
  g.append('text').attr('x', W - rw + fs * 0.5).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').style('font-size', fs + 'px').style('font-weight', 700).style('fill', '#252525').text((r) => gzL.format(',.0f')(r.ifood_pct + r.f99_pct) + '% apps');
});

dash.draw('tv-notas', (el) => {
  const d = dash.data('unidades'); el.replaceChildren();
  if (d.status !== 'ok') return;
  const num = (x) => (x === null || x === undefined || x === '') ? null : +x;
  d.data.forEach((u) => {
    const c = document.createElement('div'); c.className = 'tv-card';
    const n = document.createElement('p'); n.className = 'tv-un'; n.textContent = u.unidade;
    const ns = document.createElement('div'); ns.className = 'tv-notes';
    [['Google', num(u.nota_google)], ['iFood', num(u.nota_ifood)]].forEach(([lab, v]) => {
      const b = document.createElement('div'); b.className = 'tv-note';
      const s = document.createElement('small'); s.textContent = lab;
      const p = document.createElement('span'); p.className = 'tv-num ' + (v == null ? 'tv-na' : v >= 4.5 ? 'tv-ok' : 'tv-bad');
      p.textContent = v == null ? '—' : gzL.format(',.1f')(v);
      b.append(s, p); ns.append(b);
    });
    c.append(n, ns); el.append(c);
  });
});

dash.draw('tv-al', (ul) => {
  const u = tvUn(), d = dash.data('unidades'); ul.replaceChildren();
  if (!u || d.status !== 'ok') return;
  const info = new Map(d.data.map((r) => [r.unidade, r]));
  const num = (x) => (x === null || x === undefined || x === '') ? null : +x;
  const mesNome = gzMeses[+u[0].mes.slice(5) - 1];
  const lst = u.map((r) => {
    const i = info.get(r.unidade) || {}, a = [];
    if (r.ritmo_pct != null && r.ritmo_pct <= -10) a.push('faturamento por dia ' + gzP(r.ritmo_pct) + ' vs mês anterior');
    const g = num(i.nota_google); if (g != null && g < 4.5) a.push('nota ' + gzL.format(',.1f')(g) + ' no Google');
    const pr = num(i.promocoes_ifood_out_pct); if (pr != null && pr > 18) a.push('promoções em ' + gzP0(pr) + ' das vendas do iFood');
    const po = num(i.posts_instagram_nov); if (po != null && po < 4) a.push(po + (po === 1 ? ' post' : ' posts') + ' no Instagram em ' + mesNome + ' (meta 4)');
    return [r.unidade, a];
  }).filter(([, a]) => a.length).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  if (!lst.length) { const li = document.createElement('li'); li.textContent = 'Nenhuma unidade com alerta.'; ul.append(li); return; }
  lst.forEach(([n, a]) => { const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = n; li.append(b, document.createTextNode(a.join(' · '))); ul.append(li); });
});

dash.draw('tv-dots', (el) => {
  const n = el.closest('.tv-stage') ? el.closest('.tv-stage').querySelectorAll('.tv-slide').length : 0;
  el.replaceChildren(...Array.from({length: n}, (_, i) => { const s = document.createElement('i'); s.className = 'tv-dot' + (i === (window.tvIdx || 0) ? ' tv-on' : ''); return s; }));
});

dash.draw('tv-rot', {
  mount: (el) => {
    const stage = el.closest('.tv-stage');
    const show = (i) => {
      if (!stage) return;
      const ss = stage.querySelectorAll('.tv-slide'), ds = stage.querySelectorAll('.tv-dot');
      if (!ss.length) return;
      window.tvIdx = i % ss.length;
      ss.forEach((s, k) => s.classList.toggle('tv-on', k === window.tvIdx));
      ds.forEach((s, k) => s.classList.toggle('tv-on', k === window.tvIdx));
    };
    show(window.tvIdx || 0);
    const t = setInterval(() => show((window.tvIdx || 0) + 1), 12000);
    return {t};
  },
  update: () => {},
  unmount: (el, made) => { if (made) clearInterval(made.t); }
});

const tvRoot = document.querySelector('.gz-root');
const tvOn = (on) => { if (!tvRoot) return; tvRoot.classList.toggle('tv-mode', on); if (dash.setLink) dash.setLink(on ? 'tv' : null); };
document.querySelectorAll('#abrir-tv').forEach((b) => b.addEventListener('click', () => tvOn(true)));
document.querySelectorAll('.tv-exit').forEach((b) => b.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); tvOn(false); }));
document.querySelectorAll('.tv-full').forEach((b) => b.addEventListener('click', () => { const s = document.querySelector('.tv-stage'); if (s && s.requestFullscreen) s.requestFullscreen().catch(() => {}); }));
if (location.hash === '#tv') tvOn(true);
