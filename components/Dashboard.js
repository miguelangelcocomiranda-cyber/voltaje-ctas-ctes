'use client';
import { useState } from 'react';
import { M, P, F, venc, sumar, fecha } from '../lib/formato';
import { filtrar } from './Filtros';

function Delta({ a, b, etiqueta }) {
  if (b == null) return <div className="delta eq">sin semana anterior</div>;
  const d = a - b;
  if (Math.abs(d) < 1) return <div className="delta eq">= vs {etiqueta}</div>;
  const p = b ? Math.abs(d / b) : 0;
  return (
    <div className={'delta ' + (d > 0 ? 'up' : 'down')}>
      {d > 0 ? '▲' : '▼'} {M(Math.abs(d))} ({P(p)}) vs {etiqueta}
    </div>
  );
}

const TRAMOS = [['t30_60', 't1', '30-60'], ['t60_90', 't2', '60-90'], ['t90_mas', 't3', '+90']];

export default function Dashboard({ vista, vistaPrev, asignadas, asignadasPrev, S, setS, canje, hist, prev }) {
  const [orden, setOrden] = useState('venc');
  const [alerta, setAlerta] = useState('a90');
  const et = prev ? fecha(prev.fecha_corte).slice(0, 5) : '';
  const c = sumar(vista);
  const o = vistaPrev ? sumar(vistaPrev) : null;

  // ---- tarjetas ----
  const K = [
    ['Saldo total', c.saldo, o?.saldo, 'var(--ink)', <>{c.n} clientes</>],
    ['Vencido', c.venc, o?.venc, 'var(--t2)', <><b>{P(c.venc / c.saldo)}</b> del saldo</>],
    ['30 a 60 días', c.t1, o?.t1, 'var(--t1)', <><b>{P(c.t1 / c.saldo)}</b> del saldo · {P(c.t1 / c.venc)} del vencido</>],
    ['60 a 90 días', c.t2, o?.t2, 'var(--t2)', <><b>{P(c.t2 / c.saldo)}</b> del saldo · {P(c.t2 / c.venc)} del vencido</>],
    ['Más de 90 días', c.t3, o?.t3, 'var(--t3)', <><b>{P(c.t3 / c.saldo)}</b> del saldo · {P(c.t3 / c.venc)} del vencido</>],
  ];

  // ---- empresas ----
  const emp = ['voltaje', 'iluma'].map((e) => {
    const s2 = { ...S, emp: e, ven: '' };
    return [e, sumar(filtrar(asignadas, s2, canje)), vistaPrev ? sumar(filtrar(asignadasPrev, s2, canje)) : null];
  });
  const totEmp = emp[0][1].saldo + emp[1][1].saldo;

  // ---- ranking ----
  const g = {};
  filtrar(asignadas, { ...S, ven: '' }, canje).forEach((r) => {
    const x = (g[r.vendedor] ??= { ven: r.vendedor, emp: r.empresa, saldo: 0, t30_60: 0, t60_90: 0, t90_mas: 0 });
    x.saldo += +r.saldo_total; x.t30_60 += +r.t30_60; x.t60_90 += +r.t60_90; x.t90_mas += +r.t90_mas;
  });
  const rk = Object.values(g).map((x) => ({ ...x, venc: x.t30_60 + x.t60_90 + x.t90_mas, pct: (x.t30_60 + x.t60_90 + x.t90_mas) / x.saldo }));
  rk.sort((a, b) => b[orden] - a[orden]);
  const mx = Math.max(...rk.map((x) => x.venc), 1);

  // ---- evolucion ----
  const porFecha = {};
  hist.filter((h) => h.vendedor && (!S.emp || h.empresa === S.emp) && (!S.ven || h.vendedor === S.ven)).forEach((h) => {
    const x = (porFecha[h.fecha_corte] ??= { saldo: 0, venc: 0, t3: 0 });
    x.saldo += +h.saldo_total; x.venc += +h.saldo_vencido; x.t3 += +h.t90_mas;
  });
  const pts = Object.entries(porFecha).sort(([a], [b]) => (a < b ? -1 : 1));

  // ---- concentracion / top ----
  const conV = vista.filter((r) => venc(r) > 0).sort((a, b) => venc(b) - venc(a));
  const tv = conV.reduce((a, r) => a + venc(r), 0);
  const conc = (k) => (tv ? conV.slice(0, k).reduce((a, r) => a + venc(r), 0) / tv : 0);

  // ---- alertas ----
  const pm = {};
  (vistaPrev || []).forEach((r) => (pm[r.codigo] = r));
  let AL = [];
  if (vistaPrev) {
    if (alerta === 'a90') AL = vista.filter((r) => r.t90_mas > 0 && pm[r.codigo] && !(pm[r.codigo].t90_mas > 0)).sort((a, b) => b.t90_mas - a.t90_mas).map((r) => [r, <>+90: <b>{F(r.t90_mas)}</b></>]);
    if (alerta === 'nue') AL = vista.filter((r) => !pm[r.codigo]).sort((a, b) => b.saldo_total - a.saldo_total).map((r) => [r, <>saldo <b>{F(r.saldo_total)}</b></>]);
    if (alerta === 'emp' || alerta === 'mej') {
      AL = vista.filter((r) => pm[r.codigo]).map((r) => [r, venc(r) - venc(pm[r.codigo])])
        .filter(([, d]) => (alerta === 'emp' ? d > 0 : d < 0))
        .sort((a, b) => (alerta === 'emp' ? b[1] - a[1] : a[1] - b[1])).slice(0, 30)
        .map(([r, d]) => [r, <b style={{ color: d > 0 ? 'var(--up)' : 'var(--down)' }}>vencido {d > 0 ? '▲' : '▼'} {F(Math.abs(d))}</b>]);
    }
  }

  const segs = [['Al día', c.aldia, 'var(--t0)'], ['30-60', c.t1, 'var(--t1)'], ['60-90', c.t2, 'var(--t2)'], ['+90', c.t3, 'var(--t3)']];

  return (
    <>
      <div className="grid k5">
        {K.map((k) => (
          <div className="card kpi" key={k[0]}>
            <div className="lab"><i className="sw" style={{ background: k[3] }} />{k[0]}</div>
            <div className="val">{M(k[1])}</div>
            <div className="sub">{k[4]}</div>
            <Delta a={k[1]} b={k[2]} etiqueta={et} />
          </div>
        ))}
      </div>

      <div className="grid c2 mt">
        <div className="card">
          <h3>Voltaje vs Iluma <small>tocá una para filtrar</small></h3>
          <div className="emp">
            {emp.map(([e, s, p]) => (
              <div key={e} className={'box ' + (S.emp === e ? 'on' : '')} onClick={() => setS((x) => ({ ...x, emp: x.emp === e ? '' : e, ven: '' }))}>
                <div className="nm"><i className="sw" style={{ background: `var(--${e === 'voltaje' ? 'vol' : 'ilu'})` }} />{e === 'voltaje' ? 'Voltaje' : 'Iluma'} <span className="muted" style={{ fontWeight: 400 }}>· {P(s.saldo / totEmp)} del total</span></div>
                <div className="big">{M(s.saldo)}</div>
                <div className="sub">Vencido <b>{M(s.venc)}</b> · <b style={{ color: 'var(--t2)' }}>{P(s.venc / s.saldo)}</b></div>
                <div className="stack" style={{ height: 12, marginTop: 8 }}>
                  {[[s.aldia, 't0', 'Al día'], [s.t1, 't1', '30-60'], [s.t2, 't2', '60-90'], [s.t3, 't3', '+90']].map(([v, t, l]) => (
                    <div key={t} style={{ flex: Math.max(v, 0), background: `var(--${t})` }} title={`${l}: ${F(v)} · ${P(v / s.saldo)}`} />
                  ))}
                </div>
                <div className="sub" style={{ marginTop: 6 }}>+90: <b>{M(s.t3)}</b> ({P(s.t3 / s.saldo)}) · {s.n} clientes</div>
                <Delta a={s.venc} b={p?.venc} etiqueta={et} />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Composición del saldo <small>{M(c.saldo)}</small></h3>
          <div className="stack">
            {segs.map(([l, v, col]) => <div key={l} style={{ flex: Math.max(v, 0), background: col }} title={`${l}: ${F(v)} · ${P(v / c.saldo)} del saldo`} />)}
          </div>
          <div className="legend">{segs.map(([l, v, col]) => <span key={l}><i className="sw" style={{ background: col }} />{l} <b>{P(v / c.saldo)}</b></span>)}</div>
          <table style={{ marginTop: 12 }}>
            <thead><tr><th>Tramo</th><th className="n">Monto</th><th className="n">% saldo</th><th className="n">Clientes</th></tr></thead>
            <tbody>
              {[['Al día', c.aldia, (r) => venc(r) <= 0], ['30-60', c.t1, (r) => r.t30_60 > 0], ['60-90', c.t2, (r) => r.t60_90 > 0], ['+90', c.t3, (r) => r.t90_mas > 0]].map(([l, v, fn]) => (
                <tr key={l}><td>{l}</td><td className="n">{F(v)}</td><td className="n">{P(v / c.saldo)}</td><td className="n">{vista.filter(fn).length}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid c3 mt">
        <div className="card">
          <h3>Ranking de vendedores
            <small>ordenar: <select value={orden} onChange={(e) => setOrden(e.target.value)}>
              <option value="venc">$ vencido</option><option value="pct">% vencido</option><option value="t90_mas">$ +90</option><option value="saldo">$ saldo</option>
            </select> · tocá uno para filtrar</small></h3>
          <div className="rk muted" style={{ cursor: 'default', fontSize: 11 }}><span>VENDEDOR</span><span>VENCIDO POR TRAMO</span><span className="num">VENCIDO</span><span className="num">% VENC.</span></div>
          {rk.length === 0 && <div className="muted">Sin datos con estos filtros</div>}
          {rk.map((x) => (
            <div key={x.ven} className={'rk ' + (S.ven === x.ven ? 'on' : '')} onClick={() => setS((s) => ({ ...s, ven: s.ven === x.ven ? '' : x.ven }))}>
              <span><span className={'tag ' + (x.emp === 'voltaje' ? 'v' : 'i')}>{x.emp === 'voltaje' ? 'V' : 'I'}</span> {x.ven}</span>
              <div className="bar" style={{ width: Math.max((x.venc / mx) * 100, 0.5) + '%' }}>
                {TRAMOS.filter(([k]) => x[k] > 0).map(([k, t, l]) => (
                  <div key={k} style={{ flex: x[k], background: `var(--${t})` }} title={`${x.ven} · ${l}: ${F(x[k])} (${P(x[k] / x.venc)} de su vencido)`} />
                ))}
              </div>
              <span className="num">{M(x.venc)}</span>
              <span className="num pct" style={{ color: x.pct > 0.5 ? 'var(--up)' : 'var(--ink)' }}>{P(x.pct)}</span>
            </div>
          ))}
          <div className="legend">{TRAMOS.map(([k, t, l]) => <span key={k}><i className="sw" style={{ background: `var(--${t})` }} />{l}</span>)}</div>
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h3>Evolución semanal</h3>
            <Evolucion pts={pts} />
            <div className="legend"><span><i className="sw" style={{ background: 'var(--ink)' }} />Saldo</span><span><i className="sw" style={{ background: 'var(--t2)' }} />Vencido</span><span><i className="sw" style={{ background: 'var(--t3)' }} />+90</span></div>
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Filtra por empresa y vendedor. Cada semana cargada suma un punto.</div>
          </div>
          <div className="card">
            <h3>Concentración</h3>
            {[[5, 'Top 5'], [10, 'Top 10'], [20, 'Top 20']].map(([k, l]) => (
              <div key={k} style={{ margin: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{l} clientes</span><b>{P(conc(k))} del vencido</b></div>
                <div className="stack" style={{ height: 8 }}><div style={{ flex: conc(k), background: 'var(--t2)' }} /><div style={{ flex: 1 - conc(k), background: 'var(--chip)' }} /></div>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{conV.length} clientes con deuda vencida</div>
          </div>
        </div>
      </div>

      <div className="grid c2 mt">
        <div className="card">
          <h3>Top 10 deudores vencidos</h3>
          <div className="tw">
            <table>
              <thead><tr><th>Cliente</th><th>Vendedor</th><th className="n">Vencido</th><th className="n">+90</th><th className="n">% del venc.</th></tr></thead>
              <tbody>
                {conV.slice(0, 10).map((r) => (
                  <tr key={r.codigo} className={canje.has(r.codigo) ? 'canje' : ''}>
                    <td className="rs">{r.razon_social} {canje.has(r.codigo) && <span className="tag c">CANJE</span>}</td>
                    <td>{r.vendedor}</td><td className="n">{M(venc(r))}</td><td className="n">{r.t90_mas > 0 ? M(r.t90_mas) : '—'}</td><td className="n">{P(venc(r) / tv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Alertas de la semana {prev && <small>vs {fecha(prev.fecha_corte)}</small>}</h3>
          <div className="seg" style={{ marginBottom: 8 }}>
            {[['a90', 'Pasaron a +90'], ['nue', 'Nuevos con deuda'], ['emp', 'Más empeoraron'], ['mej', 'Más mejoraron']].map(([v, l]) => (
              <button key={v} className={alerta === v ? 'on' : ''} onClick={() => setAlerta(v)}>{l}</button>
            ))}
          </div>
          <div className="al"><ul>
            {!vistaPrev && <li className="muted">Necesita una semana anterior para comparar</li>}
            {vistaPrev && AL.length === 0 && <li className="muted">Nada para mostrar con estos filtros</li>}
            {AL.map(([r, t]) => (
              <li key={r.codigo}><span className="rs">{r.razon_social} <span className="muted">· {r.vendedor}</span></span><span>{t}</span></li>
            ))}
          </ul></div>
        </div>
      </div>
    </>
  );
}

function Evolucion({ pts }) {
  if (pts.length === 0) return <div className="muted">Sin datos</div>;
  const w = 380, h = 180, pl = 52, pr = 66, pt = 10, pb = 24;
  const mx = Math.max(...pts.map(([, p]) => p.saldo), 1) * 1.1;
  const x = (i) => (pts.length === 1 ? (pl + w - pr) / 2 : pl + (i * (w - pl - pr)) / (pts.length - 1));
  const y = (v) => pt + (h - pt - pb) * (1 - v / mx);
  const ser = [['saldo', 'var(--ink)', 'Saldo'], ['venc', 'var(--t2)', 'Vencido'], ['t3', 'var(--t3)', '+90']];
  const paso = Math.ceil(pts.length / 8);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%">
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (mx * i) / 4;
        return <g key={i}><line x1={pl} x2={w - pr} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={pl - 6} y={y(v) + 4} textAnchor="end">{Math.round(v / 1e6)}M</text></g>;
      })}
      {pts.map(([f], i) => (i % paso === 0 || i === pts.length - 1) && <text key={f} x={x(i)} y={h - 6} textAnchor="middle">{fecha(f).slice(0, 5)}</text>)}
      {ser.map(([k, col, l]) => (
        <g key={k}>
          <polyline fill="none" stroke={col} strokeWidth="2" points={pts.map(([, p], i) => `${x(i)},${y(p[k])}`).join(' ')} />
          {pts.map(([f, p], i) => (
            <circle key={f} cx={x(i)} cy={y(p[k])} r="5" fill={col} stroke="var(--card)" strokeWidth="2">
              <title>{`${l} ${fecha(f)}: ${F(p[k])}${k !== 'saldo' ? ` (${P(p[k] / p.saldo)} del saldo)` : ''}`}</title>
            </circle>
          ))}
          <text x={x(pts.length - 1) + 8} y={y(pts[pts.length - 1][1][k]) + 4}>{l}</text>
        </g>
      ))}
    </svg>
  );
}
