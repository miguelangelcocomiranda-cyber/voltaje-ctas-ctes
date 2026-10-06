'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { M, P, F, venc, sumar, fecha } from '../lib/formato';
import { filtrar } from './Filtros';
import { Avatar, LogoEmp, Semaforo, Delta, Sparkline, Contador, IC } from './ui';

const MIN_ALERTA = 30000; // las alertas ignoran montos menores a $30.000
const TRAMOS = [['t30_60', 't1', '30-60'], ['t60_90', 't2', '60-90'], ['t90_mas', 't3', '+90']];

export default function Dashboard({ vista, vistaPrev, asignadas, asignadasPrev, S, setS, canje, hist, prev, sel, onAbrir }) {
  const [orden, setOrden] = useState('venc');
  const [alerta, setAlerta] = useState('a90');
  const [rango, setRango] = useState(13);
  const c = sumar(vista);
  const o = vistaPrev ? sumar(vistaPrev) : null;

  // ---- historial filtrado por empresa / vendedores ----
  const porFecha = {};
  filtrar(hist, S, canje).forEach((h) => {
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
    const s2 = { ...S, emp: e };
    return [e, sumar(filtrar(asignadas, s2, canje)), vistaPrev ? sumar(filtrar(asignadasPrev, s2, canje)) : null];
  });
  const totEmp = emp[0][1].saldo + emp[1][1].saldo;

  // ---- ranking ----
  const g = {};
  vista.forEach((r) => {
    const x = (g[r.vendedor] ??= { ven: r.vendedor, emp: r.empresa, saldo: 0, t30_60: 0, t60_90: 0, t90_mas: 0 });
    x.saldo += +r.saldo_total; x.t30_60 += +r.t30_60; x.t60_90 += +r.t60_90; x.t90_mas += +r.t90_mas;
  });
  const rk = Object.values(g).map((x) => ({ ...x, venc: x.t30_60 + x.t60_90 + x.t90_mas, pct: (x.t30_60 + x.t60_90 + x.t90_mas) / x.saldo }));
  rk.sort((a, b) => b[orden] - a[orden]);
  const mx = Math.max(...rk.map((x) => x.saldo), 1);
  const totR = rk.reduce((a, x) => ({ saldo: a.saldo + x.saldo, venc: a.venc + x.venc }), { saldo: 0, venc: 0 });
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
    if (alerta === 'a90') AL = vista.filter((r) => r.t90_mas >= MIN_ALERTA && pm[r.codigo] && !(pm[r.codigo].t90_mas > 0)).sort((a, b) => b.t90_mas - a.t90_mas).map((r) => [r, <b>{M(r.t90_mas)}</b>]);
    if (alerta === 'nue') AL = vista.filter((r) => !pm[r.codigo] && r.saldo_total >= MIN_ALERTA).sort((a, b) => b.saldo_total - a.saldo_total).map((r) => [r, <b>{M(r.saldo_total)}</b>]);
    if (alerta === 'emp' || alerta === 'mej') {
      AL = vista.filter((r) => pm[r.codigo]).map((r) => [r, venc(r) - venc(pm[r.codigo])])
        .filter(([, d]) => (alerta === 'emp' ? d >= MIN_ALERTA : d <= -MIN_ALERTA))
        .sort((a, b) => (alerta === 'emp' ? b[1] - a[1] : a[1] - b[1])).slice(0, 30)
        .map(([r]) => [r, null]);
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
                onClick={() => setS((x) => ({ ...x, emp: x.emp === e ? '' : e }))}>
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

      <div className="grid mt">
        <div className="card">
          <h3>Ranking de vendedores
            <small>ordenar de mayor a menor por <select value={orden} onChange={(e) => setOrden(e.target.value)} style={{ padding: '4px 6px' }}>
              <option value="saldo">Saldo</option><option value="venc">Saldo vencido</option><option value="pct">% vencido</option>
            </select> · tocá uno para filtrar</small></h3>
          <div className="rk muted" style={{ cursor: 'default', fontSize: 10.5, fontWeight: 600, letterSpacing: '.4px' }}>
            <span /><span>VENDEDOR</span><span>COMPOSICIÓN DEL SALDO</span><span className="num">SALDO</span><span className="num">VENCIDO</span><span style={{ textAlign: 'center' }}>% VENCIDO</span>
          </div>
          {rk.length === 0 && <div className="muted">Sin datos con estos filtros</div>}
          {rk.map((x) => (
            <div key={x.ven} className={'rk ' + (soloUno(x.ven) ? 'on' : '')} onClick={() => setS((s) => ({ ...s, vens: soloUno(x.ven) ? null : [x.ven] }))}>
              <Avatar nombre={x.ven} />
              <div><div className="nm">{x.ven}</div><div style={{ marginTop: 3 }}><LogoEmp emp={x.emp} /></div></div>
              <div className="b" style={{ width: Math.max((x.saldo / mx) * 100, 1) + '%' }}>
                {x.saldo - x.venc > 0 && <div style={{ flex: x.saldo - x.venc, background: 'var(--t0)' }} title={`${x.ven} · Al día: ${F(x.saldo - x.venc)}`} />}
                {TRAMOS.filter(([k]) => x[k] > 0).map(([k, t, l]) => (
                  <div key={k} style={{ flex: x[k], background: `var(--${t})` }} title={`${x.ven} · ${l}: ${F(x[k])} (${P(x[k] / x.saldo)} del saldo)`} />
                ))}
              </div>
              <div className="num" style={{ fontWeight: orden === 'saldo' ? 800 : 600 }}>{M(x.saldo)}</div>
              <div className="num" style={{ color: 'var(--bad)', fontWeight: orden === 'venc' ? 800 : 600 }}>{M(x.venc)}</div>
              <Semaforo p={x.pct} />
            </div>
          ))}
          {rk.length > 1 && (
            <div className="rk" style={{ cursor: 'default', borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 10 }}>
              <span /><b>Total</b><span className="muted" style={{ fontSize: 12 }}>{P(totR.venc / totR.saldo)} del saldo está vencido</span>
              <div className="num" style={{ fontWeight: 800 }}>{M(totR.saldo)}</div>
              <div className="num" style={{ color: 'var(--bad)', fontWeight: 800 }}>{M(totR.venc)}</div>
              <Semaforo p={totR.venc / totR.saldo} />
            </div>
          )}
          <div className="legend">
            <span><i className="sw" style={{ background: 'var(--t0)' }} />Al día</span>
            {TRAMOS.map(([k, t, l]) => <span key={k}><i className="sw" style={{ background: `var(--${t})` }} />{l}</span>)}
            <span style={{ marginLeft: 'auto', gap: 6 }}>
              <span className="pill ok" style={{ margin: 0 }}>● Sano &lt;30%</span>
              <span className="pill warn" style={{ margin: 0 }}>▲ Atención 30-50%</span>
              <span className="pill bad" style={{ margin: 0 }}>■ Crítico &gt;50%</span>
            </span>
          </div>
        </div>
        <div className="card">
          <h3>Evolución semanal
            <small>ver <select value={rango} onChange={(e) => setRango(+e.target.value)} style={{ padding: '4px 6px' }}>
              <option value={8}>últimas 8 semanas</option><option value={13}>últimos 3 meses</option><option value={26}>últimos 6 meses</option><option value={0}>todo el historial</option>
            </select></small></h3>
          <Evolucion pts={rango ? pts.slice(-rango) : pts} />
          <div className="legend"><span><i className="sw" style={{ background: 'var(--ink)' }} />Saldo</span><span><i className="sw" style={{ background: 'var(--t2)' }} />Vencido</span><span><i className="sw" style={{ background: 'var(--t3)' }} />+90</span></div>
        </div>
      </div>

      <div className="grid c2 mt">
        <div className="card">
          <h3>Top 10 deudores vencidos</h3>
          <div className="tw">
            <table>
              <thead><tr><th>#</th><th>Cliente</th><th className="n">Vencido</th><th className="n">% del venc.</th></tr></thead>
              <tbody>
                {conV.slice(0, 10).map((r, i) => (
                  <tr key={r.codigo} className={canje.has(r.codigo) ? 'canje' : ''}>
                    <td className="muted">{i + 1}</td>
                    <td className="rs"><div style={{ fontWeight: 600 }}><a className="link-cli" onClick={() => onAbrir(r.codigo)} title="Ver composición de deuda">{r.razon_social}</a> {canje.has(r.codigo) && <span className="tag c">CANJE</span>}</div>
                      <small className="muted" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}><LogoEmp emp={r.empresa} />{r.vendedor}{r.t90_mas > 0 ? ` · +90 ${M(r.t90_mas)}` : ''}</small></td>
                    <td className="n"><b>{M(venc(r))}</b></td><td className="n">{P(venc(r) / tv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Alertas {prev && <small>vs {fecha(prev.fecha_corte)}</small>}</h3>
          <div className="seg" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
            {[['a90', 'Pasaron a +90'], ['nue', 'Nuevos'], ['emp', 'Empeoraron'], ['mej', 'Mejoraron']].map(([v, l]) => (
              <button key={v} className={alerta === v ? 'on' : ''} onClick={() => setAlerta(v)}>{l}</button>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Tocá una cuenta para ver por qué cambió</div>
          <ul className="al" style={{ maxHeight: 520 }}>
            {!vistaPrev && <li className="muted">Necesita una semana anterior para comparar</li>}
            {vistaPrev && AL.length === 0 && <li className="muted">Nada para mostrar con estos filtros</li>}
            {AL.map(([r, t]) => (
              <AlertaItem key={alerta + r.codigo} r={r} p={pm[r.codigo]} tipo={alerta} ic={icA} sel={sel} prev={prev} />
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
  const w = 1100, h = 280, pl = 110, pr = 80, pt = 16, pb = 30;
  const mx = Math.max(...pts.map(([, p]) => p.saldo), 1) * 1.12;
  const x = (i) => (pts.length === 1 ? (pl + w - pr) / 2 : pl + (i * (w - pl - pr)) / (pts.length - 1));
  const y = (v) => pt + (h - pt - pb) * (1 - v / mx);
  const ser = [['saldo', 'ink', 'Saldo'], ['venc', 't2', 'Vencido'], ['t3', 't3', '+90']];
  const paso = Math.ceil(pts.length / 14);
  const ini = pts[0][1], fin = pts[pts.length - 1][1];
  const resumen = pts.length > 1 && (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
      {ser.map(([k, c, l]) => {
        const d = fin[k] - ini[k];
        return (
          <div key={k} style={{ flex: '1 1 220px', background: 'var(--soft)', borderRadius: 12, padding: '10px 12px', fontSize: 12.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink2)' }}><i className="sw" style={{ background: `var(--${c})` }} />{l} · desde el {fecha(pts[0][0]).slice(0, 5)}</div>
            <div style={{ marginTop: 3 }}><b>{F(ini[k])}</b> → <b>{F(fin[k])}</b></div>
            <div style={{ fontWeight: 700, color: Math.abs(d) < 1 ? 'var(--ink3)' : d > 0 ? 'var(--bad)' : 'var(--ok)' }}>
              {Math.abs(d) < 1 ? 'sin cambios' : `${d > 0 ? '▲ subió' : '▼ bajó'} ${F(Math.abs(d))}${ini[k] ? ` (${P(Math.abs(d / ini[k]))})` : ''}`}
            </div>
          </div>
        );
      })}
    </div>
  );
  return (
    <>
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
        return <g key={i}><line x1={pl} x2={w - pr} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={i ? '3 4' : ''} /><text x={pl - 8} y={y(v) + 4} textAnchor="end">{F(v)}</text></g>;
      })}
      {pts.map(([f], i) => (i % paso === 0 || i === pts.length - 1) && <text key={f} x={x(i)} y={h - 6} textAnchor="middle">{fecha(f).slice(0, 5)}</text>)}
      {ser.map(([k, c, l]) => {
        const line = pts.map(([, p], i) => `${x(i)},${y(p[k])}`);
        return (
          <g key={k}>
            {pts.length > 1 && <path d={`M${x(0)},${y(0)} L${line.join(' L')} L${x(pts.length - 1)},${y(0)}Z`} fill={`url(#g${c})`} />}
            <polyline points={line.join(' ')} fill="none" stroke={`var(--${c})`} strokeWidth="2.5" strokeLinejoin="round" />
            {pts.map(([f, p], i) => (
              <circle key={f} cx={x(i)} cy={y(p[k])} r="5" fill={`var(--${c})`} stroke="var(--card)" strokeWidth="2"><title>{`${l} ${fecha(f)}: ${F(p[k])}${k !== 'saldo' ? ` (${P(p[k] / p.saldo)} del saldo)` : ''}`}</title></circle>
            ))}
            <text x={x(pts.length - 1) + 10} y={y(pts[pts.length - 1][1][k]) + 4} style={{ fill: 'var(--ink2)', fontWeight: 600 }}>{l}</text>
          </g>
        );
      })}
    </svg>
    {resumen}
    </>
  );
}

const TR = { aldia: 'al día', t1: '30-60', t2: '60-90', t3: '+90', cubierta: 'cubierta', credito: 'a cuenta' };
const k = (c) => `${c.tipo} ${c.numero}`;

// Motivo corto de la alerta (sin abrir)
function motivo(tipo, r, p) {
  if (tipo === 'nue') return [['bad', `Cliente nuevo con deuda ${F(r.saldo_total)}`]];
  const d = (c) => +r[c] - (p ? +p[c] : 0);
  const ds = d('saldo_total'), d1 = d('t30_60'), d2 = d('t60_90'), d3 = d('t90_mas');
  const dv = d1 + d2 + d3;
  const U = 1000; // ignora diferencias menores a $1.000 (redondeos)
  const out = [];
  if (tipo === 'a90') return [['bad', `Pasó a +90 días: ${F(r.t90_mas)}`]];
  if (tipo === 'emp') {
    if (d3 >= U) out.push(['bad', p && +p.t90_mas > 0 ? `Creció lo de +90 en ${F(d3)}` : `Pasó deuda a +90: ${F(d3)}`]);
    if (d2 >= U) out.push(['bad', `Pasó deuda a 60-90: ${F(d2)}`]);
    if (d1 >= U) out.push(['bad', `Facturas que se vencieron (30-60): ${F(d1)}`]);
    if (ds >= U) out.push(['bad', `Sumó deuda: ${F(ds)}`]);
    if (!out.length) out.push(['bad', `Subió el vencido ${F(dv)}`]);
  } else {
    if (ds <= -U) out.push(['ok', `Pagó / bajó la deuda: ${F(-ds)}`]);
    if (dv <= -U && ds > -U) out.push(['ok', `Bajó el vencido: ${F(-dv)}`]);
    if (d3 <= -U) out.push(['ok', `Bajó lo de +90: ${F(-d3)}`]);
    if (!out.length) out.push(['ok', `Bajó el vencido ${F(-dv)}`]);
  }
  return out.slice(0, 2);
}

function AlertaItem({ r, p, tipo, ic, sel, prev }) {
  const [abierto, setAbierto] = useState(false);
  const [det, setDet] = useState(null);

  async function abrir() {
    const n = !abierto;
    setAbierto(n);
    if (n && !det && sel && prev) {
      const [a, b] = await Promise.all([
        supabase.from('informe_comprobantes').select('*').eq('informe_id', sel.id).eq('codigo', r.codigo),
        supabase.from('informe_comprobantes').select('*').eq('informe_id', prev.id).eq('codigo', r.codigo),
      ]);
      setDet({ cur: a.data || [], ant: b.data || [] });
    }
  }

  // diferencias por tramo (siempre disponibles)
  const tramos = [['Saldo total', 'saldo_total'], ['30-60', 't30_60'], ['60-90', 't60_90'], ['+90', 't90_mas']].map(([l, c]) => {
    const a = p ? +p[c] : 0, b = +r[c];
    return [l, a, b, b - a];
  });

  // explicacion comprobante por comprobante
  let ev = null;
  if (det && det.cur.length && det.ant.length) {
    const ant = new Map(det.ant.map((c) => [k(c), c]));
    const cur = new Map(det.cur.map((c) => [k(c), c]));
    ev = [];
    det.cur.filter((c) => c.tramo === 'credito' && !ant.has(k(c))).forEach((c) =>
      ev.push(['ok', `Pago / NC nuevo ${k(c)} por ${F(-c.importe)}`]));
    det.ant.filter((c) => c.tramo !== 'credito' && c.pendiente > 0 && !(cur.get(k(c))?.pendiente > 0)).forEach((c) =>
      ev.push(['ok', `Se canceló ${k(c)} (${F(c.pendiente)}, estaba en ${TR[c.tramo]})`]));
    det.cur.filter((c) => ['t1', 't2', 't3'].includes(c.tramo)).forEach((c) => {
      const a = ant.get(k(c));
      if (!a || a.tramo === 'aldia' || a.tramo === 'cubierta') ev.push(['bad', `${k(c)} cumplió ${c.dias} días y pasó a vencida ${TR[c.tramo]} (${F(c.pendiente)})`]);
      else if (a.tramo !== c.tramo) ev.push(['bad', `${k(c)} pasó de ${TR[a.tramo]} a ${TR[c.tramo]} (${F(c.pendiente)}, ${c.dias} días)`]);
    });
    const nuevas = det.cur.filter((c) => c.tramo === 'aldia' && !ant.has(k(c)));
    if (nuevas.length) ev.push(['eq', `${nuevas.length} factura${nuevas.length > 1 ? 's' : ''} nueva${nuevas.length > 1 ? 's' : ''} al día por ${F(nuevas.reduce((a, c) => a + +c.pendiente, 0))}`]);
  }

  return (
    <li style={{ display: 'block', cursor: 'pointer' }} onClick={abrir}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div className="dot" style={{ background: ic[1] }}>{ic[0]}</div>
        <div className="t">
          <div><b>{r.razon_social}</b></div>
          <small style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}><LogoEmp emp={r.empresa} />{r.vendedor}</small>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5, whiteSpace: 'normal', overflow: 'visible' }}>
            {motivo(tipo, r, p).map(([tp, txt], i) => (
              <span key={i} className={'pill ' + tp} style={{ margin: 0, whiteSpace: 'normal' }}>{txt}</span>
            ))}
          </div>
        </div>
        <span className="muted" style={{ fontSize: 11 }}>{abierto ? '▲' : '▼'}</span>
      </div>
      {abierto && (
        <div onClick={(e) => e.stopPropagation()} style={{ margin: '10px 0 4px 40px', padding: 12, borderRadius: 12, background: 'var(--soft)', cursor: 'default' }}>
          <table style={{ fontSize: 12 }}>
            <thead><tr><th></th><th className="n">Semana anterior</th><th className="n">Esta semana</th><th className="n">Diferencia</th></tr></thead>
            <tbody>
              {tramos.map(([l, a, b, d]) => (
                <tr key={l}><td>{l}</td><td className="n">{F(a)}</td><td className="n">{F(b)}</td>
                  <td className="n" style={{ fontWeight: 700, color: Math.abs(d) < 1 ? 'var(--ink3)' : d > 0 ? 'var(--bad)' : 'var(--ok)' }}>{Math.abs(d) < 1 ? '=' : (d > 0 ? '+' : '−') + F(Math.abs(d)).slice(2)}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 12.5 }}>
            {!det && <span className="muted">Buscando comprobantes…</span>}
            {ev && ev.length === 0 && <span className="muted">Sin movimientos de comprobantes: el cambio es solo por el paso del tiempo.</span>}
            {ev && ev.map(([tp, txt], i) => (
              <div key={i} style={{ display: 'flex', gap: 6, padding: '3px 0' }}>
                <span style={{ color: tp === 'ok' ? 'var(--ok)' : tp === 'bad' ? 'var(--bad)' : 'var(--ink3)', fontWeight: 700 }}>{tp === 'ok' ? '▼' : tp === 'bad' ? '▲' : '•'}</span>{txt}
              </div>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
