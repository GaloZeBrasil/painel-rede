/* Camada mínima que substitui o ambiente do Claude: lê os CSV de /data e desenha a página. */
(function () {
  const DATASETS = {vendas: 'data/vendas.csv', unidades: 'data/unidades.csv', hoje: 'data/hoje.csv', hoje_entrega: 'data/hoje_entrega.csv'};
  const REFRESH_MS = 5 * 60 * 1000;
  const raw = {}, calcs = {}, draws = {}, mounted = new Map();
  let cache = {}, status = 'loading';
  const parse = (txt) => d3.csvParse(txt, (r) => { Object.keys(r).forEach((k) => { if (r[k] === '') r[k] = null; }); return r; });
  const dash = window.dash = {
    colors: ['#7A1915', '#FF922D', '#252525', '#C0392B', '#F2C14E'],
    calc(id, def) { calcs[id] = def; },
    loader() {},
    data(id) {
      if (id in cache) return cache[id];
      let out;
      if (DATASETS[id]) {
        out = raw[id] ? {status: 'ok', data: raw[id], columns: raw[id].columns} : {status: status === 'error' ? 'error' : 'loading', data: []};
      } else if (calcs[id]) {
        const ins = calcs[id].inputs.map((i) => dash.data(i));
        const bad = ins.find((d) => d.status !== 'ok');
        if (bad) out = {status: bad.status, data: null};
        else { try { out = {status: 'ok', data: calcs[id].fn(...ins.map((d) => d.data))}; } catch (e) { console.error(id, e); out = {status: 'error', data: null, message: String(e)}; } }
      } else out = {status: 'missing', data: []};
      return (cache[id] = out);
    },
    draw(name, def) {
      if (def === undefined) return runDraw(name);
      draws[name] = def; if (status !== 'loading') runDraw(name);
    },
    onData(fn) { fn(); },
    refresh() { load(); },
    params() { return {}; }, setParams() {}, resetParams() {},
    setLink(name) { try { history.replaceState(null, '', name ? '#' + name : location.pathname); } catch (e) {} }
  };
  function runDraw(name) {
    const def = draws[name]; if (!def) return;
    document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
      try {
        if (typeof def === 'function') def(el);
        else {
          if (!mounted.has(el)) mounted.set(el, def.mount ? def.mount(el) : undefined);
          if (def.update) def.update(el, mounted.get(el));
        }
      } catch (e) { console.error('draw', name, e); }
    });
  }
  const runAll = () => { cache = {}; if (window.dashBeforeDraw) window.dashBeforeDraw(); Object.keys(draws).forEach(runDraw); };
  async function load() {
    try {
      const v = Date.now();
      await Promise.all(Object.entries(DATASETS).map(async ([id, url]) => {
        const r = await fetch(url + '?v=' + v, {cache: 'no-store'});
        if (!r.ok) throw new Error(url + ' ' + r.status);
        raw[id] = parse(await r.text());
      }));
      status = 'ok';
    } catch (e) { console.error(e); if (status === 'loading') status = 'error'; }
    runAll();
  }
  let w = 0;
  window.addEventListener('resize', () => { if (Math.abs(innerWidth - w) > 20) { w = innerWidth; runAll(); } });
  document.addEventListener('fullscreenchange', () => setTimeout(runAll, 300));
  window.addEventListener('DOMContentLoaded', () => { w = innerWidth; load(); setInterval(load, REFRESH_MS); });
})();
