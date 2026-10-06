'use client';
import { useState } from 'react';
import { M, P, F, venc, sumar, fecha } from '../lib/formato';
import { filtrar } from './Filtros';
import { Avatar, LogoEmp, Semaforo, Delta, Sparkline, Contador, IC } from './ui';

const TRAMOS = [['t30_60', 't1', '30-60'], ['t60_90', 't2', '60-90'], ['t90_mas', 't3', '+90']];

export default function Dashboard({ vista, vistaPrev, asignadas, asignadasPrev, S, setS, canje, hist, prev }) {
  const [orden, setOrden] = useState('venc');
  const [alerta, setAlerta] = useState('a90');
  const c = sumar(vista);
  const o = vistaPrev ? sumar(vistaPrev) : null;

  // ---- historial filtrado por empresa / vendedores ----
  const porFecha = {};
  hist.filter((h) => h.vendedor && (!S.emp || h.empresa === S.emp) && (!S.vens || S.vens.includes(h.vendedor))).forEach((h) => {
    const x = (porFecha[h.fecha_corte] ??= { saldo: 0, venc: 0, t1: 0, t2: 0, t3: 0 });
    x.saldo += +h.saldo_total; x.venc += +h.saldo_vencido; x.t1 += +h.t30_60; x.t2 += +h.t60_90; x.t3 += +h.t90_mas;
  });
  const pts = Object.entries(porFecha).sort(([a], [b]) => (a < b ? -1 : 1));
  const serie = (k) => pts.slice(-8).map(([, p]) => p[k]);

  const K = [
    ['Saldo total', c.saldo, o?.saldo, 'var(--ink)', IC.saldo, <>{c.n} clientes</>, 'saldo'],
    ['Vencido', c.venc, o?.venc, 'var(--bad)', IC.venc, <><b>{P(c.venc / c.saldo)}</b> del saldo</>, 'venc'],
    ['30 a 60 días', c.t1, o?.t1, 'var(--t1)', IC.bolt, <><b>{P(c.t1 / c.venc)}</b> del vencido</>, 't1'],
    ['60 a 90 días', c.t2, o?.t2, 'var(--t2)', IC.bolt, <><b>{P(c.t2 / c.venc)}</b> del vencido</>, 't2'],
    ['Más de 90 días', c.t3, o?.t3, 'var(--t3)', IC.bolt, <><b>{P(c.t3 / c.venc)}</b> del vencido</>, 't3'],
  ];

  // ---- empresas ----
  const emp = ['voltaje', 'iluma'].map((e) => {
    const s2 = { ...S, emp: e, vens: null };
    return [e, sumar(filtrar(asignadas, s2, canje)), vistaPrev ? sumar(filtrar(asignadasPrev, s2, canje)) : null];
  });
  const totEmp = emp[0][1].saldo + emp[1][1].saldo;

  // ---- ranking ----
  const g = {};
  filtrar(asignadas, { ...S, vens: null }, canje).forEach((r) => {
    const x = (g[r.vendedor] ??= { ven: r.vendedor, emp: r.empresa, saldo: 0, t30_60: 0, t60_90: 0, t90_mas: 0 });
    x.saldo += +r.saldo_total; x.t30_60 += +r.t30_60; x.t60_90 += +r.t60_90; x.t90_mas += +r.t90_mas;
  });
  const rk = Object.values(g).map((x) => ({ ...x, venc: x.t30_60 + x.t60_90 + x.t90_mas, pct: (x.t30_60 + x.t60_90 + x.t90_mas) / x.saldo }));
  rk.sort((a, b) => b[orden] - a[orden]);
  const mx = Math.max(...rk.map((x) => x.venc), 1);
  const soloUno = (v) => S.vens && S.vens.length === 1 && S.vens[0] === v;

  // ---- concentracion / top ----
  const conV = vista.filter((r) => venc(r) > 0).sort((a, b) => venc(b) - venc(a));
  const tv = conV.reduce((a, r) => a + venc(r), 0);
  const conc = (k) => (tv ? conV.slice(0, k).reduce((a, r) => a + venc(r), 0) / tv : 0);

  // ---- alertas ----
  const pm = {};
  (vistaPrev || []).forEach((r) => (pm[r.codigo] = r));
  let AL = [];
  if (vistaPrev) {
    if (alerta === 'a90') AL = vista.filter((r) => r.t90_mas > 0 && pm[r.codigo] && !(pm[r.codigo].t90_mas > 0)).sort((a, b) => b.t90_mas - a.t90_mas).map((r) => [r, <b>{M(r.t90_mas)}</b>]);
    if (alerta === 'nue') AL = vista.filter((r) => !pm[r.codigo]).sort((a, b) => b.saldo_total - a.saldo_total).map((r) => [r, <b>{M(r.saldo_total)}</b>]);
    if (alerta === 'emp' || alerta === 'mej') {
      AL = vista.filter((r) => pm[r.codigo]).map((r) => [r, venc(r) - venc(pm[r.codigo])])
        .filter(([, d]) => (alerta === 'emp' ? d > 0 : d < 0))
        .sort((a, b) => (alerta === 'emp' ? b[1] - a[1] : a[1] - b[1])).slice(0, 30)
        .map(([r, d]) => [r, <b style={{ color: d > 0 ? 'var(--bad)' : 'var(--ok)' }}>{d > 0 ? '+' : '−'}{M(Math.abs(d))}</b>]);
    }
  }
  const icA = { a90: ['⏰', 'var(--bad-bg)'], nue: ['✦', 'var(--soft)'], emp: ['↗', 'var(--bad-bg)'], mej: ['↘', 'var(--ok-bg)'] }[alerta];

  const segs = [['Al día', c.aldia, 'var(--t0)'], ['30-60 días', c.t1, 'var(--t1)'], ['60-90 días', c.t2, 'var(--t2)'], ['+90 días', c.t3, 'var(--t3)']];

  return (
    <>
      <div className="grid k5">
        {K.map((k) => (
          <div className="card kpi" key={k[0]}>
            <div className="ic" style={{ background: `color-mix(in srgb, ${k[3]} 14%, transparent)`, color: k[3] }}>{k[4]}</div>
            <Sparkline serie={serie(k[6])} color={k[3]} />
            <div className="lab">{k[0]}</div>
            <div className="val"><Contador valor={k[1]} /></div>
            <div className="sub">{k[5]}</div>
            <Delta a={k[1]} b={k[2]} />
          </div>
        ))}
      </div>

      <div className="grid c2 mt">
        <div className="card">
          <h3>Voltaje vs Iluma <small>tocá una para filtrar</small></h3>
          <div className="emp">
            {emp.map(([e, s, p]) => (
              <div key={e} className={'ebox ' + (S.emp === e ? 'on' : '')} style={{ '--c': `var(--${e === 'voltaje' ? 'vol' : 'ilu'})` }}
                onClick={() => setS((x) => ({ ...x, emp: x.emp === e ? '' : e, vens: null }))}>
                <img className="lt" src={`/logos/${e}-color.png`} alt={e} />
                <img className="dk" src={`/logos/${e}-blanco.png`} alt={e} />
                <div className="big">{M(s.saldo)}</div>
                <div className="row2"><span>{P(s.saldo / totEmp)} del total</span><span>{s.n} clientes</span></div>
                <div className="bar">
                  {[[s.aldia, 't0', 'Al día'], [s.t1, 't1', '30-60'], [s.t2, 't2', '60-90'], [s.t3, 't3', '+90']].map(([v, t, l]) => (
                    <div key={t} style={{ flex: Math.max(v, 0), background: `var(--${t})` }} title={`${l}: ${F(v)} · ${P(v / s.saldo)}`} />
                  ))}
                </div>
                <div className="row2"><span>Vencido <b style={{ color: 'var(--ink)' }}>{M(s.venc)}</b></span><Semaforo p={s.venc / s.saldo} /></div>
                <Delta a={s.venc} b={p?.venc} />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Composición del saldo <small>{M(c.saldo)}</small></h3>
          <div className="donutw">
            <Dona segs={segs} total={c.saldo} pct={c.venc / c.saldo} />
            <div className="lg">
              {segs.map(([l, v, col]) => (
                <div className="it" key={l}><i className="sw" style={{ background: col }} />{l}<span className="a">{M(v)}</span><span className="p">{P(v / c.saldo)}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid c3 mt">
        <div className="card">
          <h3>Ranking de vendedores
            <small>ordenar <select value={orden} onChange={(e) => setOrden(e.target.value)} style={{ padding: '4px 6px' }}>
              <option value="venc">$ vencido</option><option value="pct">% vencido</option><option value="t90_mas">$ +90</option><option value="saldo">$ saldo</option>
            </select> · tocá uno para filtrar</small></h3>
          {rk.length === 0 && <div className="muted">Sin datos con estos filtros</div>}
          {rk.map((x) => (
            <div key={x.ven} className={'rk ' + (soloUno(x.ven) ? 'on' : '')} onClick={() => setS((s) => ({ ...s, vens: soloUno(x.ven) ? null : [x.ven] }))}>
              <Avatar nombre={x.ven} />
              <div><div className="nm">{x.ven}</div><div style={{ marginTop: 3 }}><LogoEmp emp={x.emp} /></div></div>
              <div className="b" style={{ width: Math.max((x.venc / mx) * 100, 1) + '%' }}>
                {TRAMOS.filter(([k]) => x[k] > 0).map(([k, t, l]) => (
                  <div key={k} style={{ flex: x[k], background: `var(--${t})` }} title={`${x.ven} · ${l}: ${F(x[k])} (${P(x[k] / x.venc)})`} />
                ))}
              </div>
              <div className="num">{M(x.venc)}</div>
              <Semaforo p={x.pct} />
            </div>
          ))}
          <div className="legend">
            {TRAMOS.map(([k, t, l]) => <span key={k}><i className="sw" style={{ background: `var(--${t})` }} />{l}</span>)}
            <span style={{ marginLeft: 'auto', gap: 6 }}>
              <span className="pill ok" style={{ margin: 0 }}>● Sano &lt;30%</span>
              <span className="pill warn" style={{ margin: 0 }}>▲ Atención 30-50%</span>
              <span className="pill bad" style={{ margin: 0 }}>■ Crítico &gt;50%</span>
            </span>
          </div>
        </div>
        <div className="card">
          <h3>Evolución semanal <small>saldo y vencido</small></h3>
          <Evolucion pts={pts} />
          <div className="legend"><span><i className="sw" style={{ background: 'var(--ink)' }} />Saldo</span><span><i className="sw" style={{ background: 'var(--t2)' }} />Vencido</span><span><i className="sw" style={{ background: 'var(--t3)' }} />+90</span></div>
        </div>
      </div>

      <div className="grid c31 mt">
        <div className="card">
          <h3>Top 10 deudores vencidos</h3>
          <div className="tw">
            <table>
              <thead><tr><th>#</th><th>Cliente</th><th className="n">Vencido</th><th className="n">% del venc.</th></tr></thead>
              <tbody>
                {conV.slice(0, 10).map((r, i) => (
                  <tr key={r.codigo} className={canje.has(r.codigo) ? 'canje' : ''}>
                    <td className="muted">{i + 1}</td>
                    <td className="rs"><div style={{ fontWeight: 600 }}>{r.razon_social} {canje.has(r.codigo) && <span className="tag c">CANJE</span>}</div>
                      <small className="muted">{r.vendedor}{r.t90_mas > 0 ? ` · +90 ${M(r.t90_mas)}` : ''}</small></td>
                    <td className="n"><b>{M(venc(r))}</b></td><td className="n">{P(venc(r) / tv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card conc">
          <h3>Concentración del vencido</h3>
          {[[5, 'Top 5'], [10, 'Top 10'], [20, 'Top 20']].map(([k, l]) => (
            <div className="it" key={k}>
              <div className="h"><span>{l} clientes</span><b>{P(conc(k))}</b></div>
              <div className="bar" style={{ height: 10, margin: 0 }}>
                <div style={{ flex: conc(k), background: 'linear-gradient(90deg,var(--t2),var(--t3))' }} /><div style={{ flex: 1 - conc(k) }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: 'var(--soft)', fontSize: 13 }}>
            <b style={{ fontSize: 20 }}>{conV.length}</b> clientes con deuda vencida<br />
            <span className="muted">El top 10 concentra {P(conc(10))} del vencido</span>
          </div>
        </div>
        <div className="card">
          <h3>Alertas {prev && <small>vs {fecha(prev.fecha_corte)}</small>}</h3>
          <div className="seg" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
            {[['a90', 'Pasaron a +90'], ['nue', 'Nuevos'], ['emp', 'Empeoraron'], ['mej', 'Mejoraron']].map(([v, l]) => (
              <button key={v} className={alerta === v ? 'on' : ''} onClick={() => setAlerta(v)}>{l}</button>
            ))}
          </div>
          <ul className="al">
            {!vistaPrev && <li className="muted">Necesita una semana anterior para comparar</li>}
            {vistaPrev && AL.length === 0 && <li className="muted">Nada para mostrar con estos filtros</li>}
            {AL.map(([r, t]) => (
              <li key={r.codigo}>
                <div className="dot" style={{ background: icA[1] }}>{icA[0]}</div>
                <div className="t"><div><b>{r.razon_social}</b></div><small>{r.vendedor}</small></div>{t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function Dona({ segs, total, pct }) {
  const R = 72, r = 50, cx = 85, cy = 85, tot = Math.max(total, 1);
  let a0 = -Math.PI / 2;
  const p = (rr, a) => `${cx + rr * Math.cos(a)} ${cy + rr * Math.sin(a)}`;
  const arcos = segs.filter(([, v]) => v > 0).map(([l, v, col]) => {
    const a1 = a0 + (v / tot) * Math.PI * 2 - 0.02;
    const lg = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M${p(R, a0)} A${R} ${R} 0 ${lg} 1 ${p(R, a1)} L${p(r, a1)} A${r} ${r} 0 ${lg} 0 ${p(r, a0)}Z`;
    a0 = a1 + 0.02;
    return <path key={l} d={d} fill={col}><title>{`${l}: ${F(v)} · ${P(v / total)}`}</title></path>;
  });
  return (
    <svg viewBox="0 0 170 170">
      {arcos}
      <text x="85" y="80" textAnchor="middle" style={{ fontSize: 24, fontWeight: 800, fill: 'var(--ink)' }}>{P(pct)}</text>
      <text x="85" y="99" textAnchor="middle">vencido</text>
    </svg>
  );
}

function Evolucion({ pts }) {
  if (pts.length === 0) return <div className="muted">Sin datos</div>;
  const w = 420, h = 210, pl = 46, pr = 62, pt = 14, pb = 26;
  const mx = Math.max(...pts.map(([, p]) => p.saldo), 1) * 1.12;
  const x = (i) => (pts.length === 1 ? (pl + w - pr) / 2 : pl + (i * (w - pl - pr)) / (pts.length - 1));
  const y = (v) => pt + (h - pt - pb) * (1 - v / mx);
  const ser = [['saldo', 'ink', 'Saldo'], ['venc', 't2', 'Vencido'], ['t3', 't3', '+90']];
  const paso = Math.ceil(pts.length / 8);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%">
      <defs>
        {ser.map(([, c]) => (
          <linearGradient key={c} id={'g' + c} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`var(--${c})`} stopOpacity=".25" /><stop offset="1" stopColor={`var(--${c})`} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (mx * i) / 4;
        return <g key={i}><line x1={pl} x2={w - pr} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={i ? '3 4' : ''} /><text x={pl - 8} y={y(v) + 4} textAnchor="end">{Math.round(v / 1e6)}M</text></g>;
      })}
      {pts.map(([f], i) => (i % paso === 0 || i === pts.length - 1) && <text key={f} x={x(i)} y={h - 6} textAnchor="middle">{fecha(f).slice(0, 5)}</text>)}
      {ser.map(([k, c, l]) => {
        const line = pts.map(([, p], i) => `${x(i)},${y(p[k])}`);
        return (
          <g key={k}>
            {pts.length > 1 && <path d={`M${x(0)},${y(0)} L${line.join(' L')} L${x(pts.length - 1)},${y(0)}Z`} fill={`url(#g${c})`} />}
            <polyline points={line.join(' ')} fill="none" stroke={`var(--${c})`} strokeWidth="2.5" strokeLinejoin="round" />
            {pts.map(([f, p], i) => (
              <circle key={f} cx={x(i)} cy={y(p[k])} r="5" fill={`var(--${c})`} stroke="var(--card)" strokeWidth="2"><title>{`${l} ${fecha(f)}: ${F(p[k])}`}</title></circle>
            ))}
            <text x={x(pts.length - 1) + 10} y={y(pts[pts.length - 1][1][k]) + 4} style={{ fill: 'var(--ink2)', fontWeight: 600 }}>{l}</text>
          </g>
        );
      })}
    </svg>
  );
}
