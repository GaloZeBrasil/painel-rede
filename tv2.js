window.GZ_META_CRESC = 10;

dash.calc('metas', {
  title: 'Meta do mês por unidade',
  description: 'Meta de cada unidade no mês atual: faturamento do mês anterior mais o crescimento combinado (GZ_META_CRESC, em %). Mostra quanto falta e quanto precisa vender por dia nos dias que restam.',
  inputs: ['vendas'],
  fn: (vendas) => {
    const meses = [...new Set(vendas.map((r) => r.mes))].sort();
    const atual = meses[meses.length - 1], ant = meses[meses.length - 2];
    const prev = new Map(vendas.filter((r) => r.mes === ant).map((r) => [r.unidade, +r.total_valor]));
    const [y, m] = atual.split('-').map(Number), diasMes = new Date(y, m, 0).getDate();
    return vendas.filter((r) => r.mes === atual).map((r) => {
      const t = +r.total_valor, p = prev.get(r.unidade), dias = +r.dias;
      const meta = p ? Math.round(p * (1 + window.GZ_META_CRESC / 100)) : null;
      const falta = meta == null ? null : Math.max(0, meta - Math.round(t));
      const rest = Math.max(1, diasMes - dias);
      return {unidade: r.unidade, mes: r.mes, total: Math.round(t), meta, falta,
        meta_pct: meta ? Math.round(t / meta * 1000) / 10 : null,
        falta_dia: falta == null ? null : Math.round(falta / rest), dias_restantes: diasMes - dias};
    }).sort((a, b) => b.total - a.total);
  }
});

const GZ_CANAIS = [['Loja', '#7A1915'], ['Cardápio digital', '#FF922D'], ['iFood', '#C0392B'], ['99Food', '#F2C14E'], ['Apps integrados', '#252525']];

dash.calc('hoje_un', {
  title: 'Vendas do dia por unidade',
  description: 'Faturamento, pedidos, ticket médio e participação de cada canal de venda de cada unidade no dia mais recente coletado, com o tempo mediano dos pedidos delivery.',
  inputs: ['hoje', 'hoje_entrega'],
  fn: (hoje, hoje_entrega) => {
    const tempo = new Map(hoje_entrega.map((r) => [r.unidade, r.tempo_min == null ? null : +r.tempo_min]));
    return d3.rollups(hoje, (rs) => {
      const valor = d3.sum(rs, (r) => +r.valor), pedidos = d3.sum(rs, (r) => +r.pedidos);
      const o = {data: rs[0].data, atualizado: rs[0].atualizado, valor: Math.round(valor * 100) / 100, pedidos,
        ticket: pedidos ? Math.round(valor / pedidos * 100) / 100 : null};
      GZ_CANAIS.forEach(([c]) => { o['pct_' + c] = valor ? Math.round(d3.sum(rs.filter((r) => r.canal === c), (r) => +r.valor) / valor * 1000) / 10 : 0; });
      return o;
    }, (r) => r.unidade).map(([unidade, o]) => ({unidade, ...o, tempo_min: tempo.has(unidade) ? tempo.get(unidade) : null}))
      .sort((a, b) => b.valor - a.valor);
  }
});

dash.calc('hoje_rede', {
  title: 'Vendas do dia na rede',
  description: 'Soma das unidades no dia mais recente coletado: faturamento, pedidos, ticket médio e participação de cada canal de venda.',
  inputs: ['hoje'],
  fn: (hoje) => {
    const valor = d3.sum(hoje, (r) => +r.valor), pedidos = d3.sum(hoje, (r) => +r.pedidos);
    const o = {data: hoje[0] ? hoje[0].data : null, atualizado: hoje[0] ? hoje[0].atualizado : null,
      valor: Math.round(valor * 100) / 100, pedidos, ticket: pedidos ? Math.round(valor / pedidos * 100) / 100 : null,
      unidades: new Set(hoje.map((r) => r.unidade)).size};
    GZ_CANAIS.forEach(([c]) => { o['pct_' + c] = valor ? Math.round(d3.sum(hoje.filter((r) => r.canal === c), (r) => +r.valor) / valor * 1000) / 10 : 0; });
    return [o];
  }
});

const hjRede = () => { const d = dash.data('hoje_rede'); return d.status === 'ok' && d.data && d.data[0] && d.data[0].data ? d.data[0] : null; };
const hjDia = (r) => { const [y, m, d] = r.data.split('-'); return d + '/' + m; };
dash.draw('hj-tit', (el) => {
  const r = hjRede(); if (!r) { el.textContent = '—'; return; }
  const hojeLocal = new Date().toLocaleDateString('sv-SE', {timeZone: 'America/Sao_Paulo'});
  el.textContent = r.data === hojeLocal ? 'Hoje, até ' + r.atualizado.slice(11, 16) : 'Dia ' + hjDia(r) + ' (último dia coletado)';
});
const hjSet = (name, field, fmt) => dash.draw(name, (el) => { const r = hjRede(); el.textContent = r && r[field] != null ? fmt(r[field]) : '—'; });
hjSet('hj-valor', 'valor', gzR);
hjSet('hj-ped', 'pedidos', gzN);
hjSet('hj-tk', 'ticket', gzR2);
dash.draw('hj-canais', (el) => {
  const r = hjRede(); el.replaceChildren(); if (!r) return;
  GZ_CANAIS.filter(([c]) => r['pct_' + c] > 0).forEach(([c, cor]) => {
    const s = document.createElement('span'); s.className = 'hj-ch';
    const i = document.createElement('i'); i.style.background = cor;
    const b = document.createElement('b'); b.className = 'tv-num'; b.textContent = gzL.format(',.0f')(r['pct_' + c]) + '%';
    s.append(i, b, document.createTextNode(' ' + c)); el.append(s);
  });
});
dash.draw('hj-tab', (el) => {
  const d = dash.data('hoje_un'); el.replaceChildren();
  if (d.status !== 'ok') return;
  const ativos = GZ_CANAIS.filter(([c]) => d.data.some((r) => r['pct_' + c] > 0));
  const t = document.createElement('table'); t.className = 'hj-t';
  const th = t.createTHead().insertRow();
  ['Unidade', 'Faturamento', 'Pedidos', 'Ticket', 'Tempo delivery', 'Canais de venda'].forEach((h) => { const c = document.createElement('th'); c.textContent = h; th.append(c); });
  const tb = t.createTBody();
  d.data.forEach((r) => {
    const tr = tb.insertRow();
    [r.unidade, gzR(r.valor), gzN(r.pedidos), r.ticket == null ? '—' : gzR2(r.ticket), r.tempo_min == null ? '—' : r.tempo_min + ' min'].forEach((v, i) => { const c = tr.insertCell(); c.textContent = v; if (i) c.className = 'tv-num'; });
    const c = tr.insertCell(); const bar = document.createElement('div'); bar.className = 'hj-bar';
    ativos.forEach(([k, cor]) => {
      const p = r['pct_' + k]; if (!p) return;
      const s = document.createElement('span'); s.style.width = p + '%'; s.style.background = cor;
      if (p >= 12) s.textContent = gzL.format(',.0f')(p) + '%';
      s.title = k + ': ' + gzL.format(',.1f')(p) + '%';
      bar.append(s);
    });
    c.append(bar);
  });
  el.append(t);
});
dash.draw('meta-pct', (el) => { el.textContent = window.GZ_META_CRESC + '%'; });
