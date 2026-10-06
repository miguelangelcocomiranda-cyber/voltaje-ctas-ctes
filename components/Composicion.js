'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { F, M, P, fecha, venc } from '../lib/formato';
import { Avatar, LogoEmp } from './ui';
import { descargarPDF } from '../lib/pdf';

const TRAMO_TXT = { aldia: 'Al día', t1: '30-60', t2: '60-90', t3: '+90', cubierta: 'Cubierta', credito: 'A cuenta' };
const clave = (c) => `${c.tipo} ${c.numero}`;

export default function Composicion({ filas, sel, prev, canje }) {
  const [q, setQ] = useState('');
  const [soloVenc, setSoloVenc] = useState(false);
  const [cod, setCod] = useState(null);
  const [comps, setComps] = useState(null);
  const [compsPrev, setCompsPrev] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [verCub, setVerCub] = useState(false);
  const [pdfOcupado, setPdfOcupado] = useState(false);

  const lista = useMemo(() => {
    const qq = q.toLowerCase();
    return filas
      .filter((r) => (!qq || r.razon_social.toLowerCase().includes(qq) || String(r.codigo).includes(qq)) && (!soloVenc || venc(r) > 0))
      .sort((a, b) => venc(b) - venc(a) || b.saldo_total - a.saldo_total);
  }, [filas, q, soloVenc]);

  useEffect(() => {
    if (lista.length && !lista.some((x) => x.codigo === cod)) setCod(lista[0].codigo);
  }, [lista, cod]);

  useEffect(() => {
    if (!cod || !sel) return;
    let vivo = true;
    setCargando(true);
    (async () => {
      const a = await supabase.from('informe_comprobantes').select('*').eq('informe_id', sel.id).eq('codigo', cod).order('fecha');
      const b = prev ? await supabase.from('informe_comprobantes').select('*').eq('informe_id', prev.id).eq('codigo', cod) : { data: [] };
      if (!vivo) return;
      setComps(a.data || []);
      setCompsPrev(b.data || []);
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [cod, sel?.id, prev?.id]);

  const r = filas.find((f) => f.codigo === cod);
  const facturas = (comps || []).filter((c) => c.tramo !== 'credito');
  const creditos = (comps || []).filter((c) => c.tramo === 'credito');
  const aCuenta = -creditos.reduce((a, c) => a + Number(c.importe), 0);
  const aFavor = -creditos.reduce((a, c) => a + Number(c.pendiente), 0);
  const impagas = facturas.filter((c) => c.pendiente > 0);
  const masVieja = impagas.reduce((m, c) => Math.max(m, c.dias || 0), 0);
  const prevMap = new Map(compsPrev.map((c) => [clave(c), c]));
  const actMap = new Map((comps || []).map((c) => [clave(c), c]));
  const hayPrev = compsPrev.length > 0;
  const cubiertas = facturas.filter((c) => !(c.pendiente > 0));
  const visibles = [...impagas].sort((a, b) => b.dias - a.dias).concat(verCub ? cubiertas : []);
  const pagadas = compsPrev.filter((c) => c.tramo !== 'credito' && c.pendiente > 0 && !(actMap.get(clave(c))?.pendiente > 0));

  async function excel() {
    const XLSX = await import('xlsx');
    const filasX = [
      ['Resumen de cuenta', r.razon_social], ['Código', r.codigo], ['Vendedor', r.vendedor || ''], ['Fecha de corte', fecha(sel.fecha_corte)],
      ['Saldo', Number(r.saldo_total)], ['Vencido', venc(r)], [],
      ['Fecha', 'Comprobante', 'Vencimiento', 'Días', 'Importe', 'Cubierto por pagos a cuenta', 'Pendiente', 'Estado'],
      ...facturas.map((c) => [fecha(c.fecha), clave(c), fecha(c.vencimiento), c.dias, Number(c.importe), Number(c.aplicado), Number(c.pendiente), TRAMO_TXT[c.tramo]]),
      [], ['Pagos / NC sin imputar'], ['Fecha', 'Comprobante', 'Importe', 'Aplicado', 'Saldo a favor'],
      ...creditos.map((c) => [fecha(c.fecha), clave(c), Number(c.importe), Number(c.aplicado), Number(c.pendiente)]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(filasX);
    ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 8 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
    XLSX.writeFile(wb, `Resumen ${r.razon_social} ${fecha(sel.fecha_corte).replace(/\//g, '-')}.xlsx`);
  }

  return (
    <div className="comp">
      <div className="card noprint">
        <h3>Clientes <small>{lista.length}</small></h3>
        <input type="search" placeholder="🔍 Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: 'var(--ink2)', marginBottom: 8 }}>
          <input type="checkbox" checked={soloVenc} onChange={(e) => setSoloVenc(e.target.checked)} /> Solo con deuda vencida
        </label>
        <div className="clist">
          {lista.map((x) => (
            <a key={x.codigo} className={'citem ' + (x.codigo === cod ? 'on' : '')} onClick={() => setCod(x.codigo)}>
              <div className="t"><b>{x.razon_social}</b><span className="num">{M(x.saldo_total)}</span></div>
              <div className="s">
                {x.vendedor ? <><Avatar nombre={x.vendedor} size={16} />{x.vendedor}</> : 'sin vendedor'}
                <span style={{ marginLeft: 'auto', color: venc(x) > 0 ? 'var(--bad)' : 'var(--ok)', fontWeight: 600 }}>
                  {venc(x) > 0 ? `venc. ${M(venc(x))}` : 'al día'}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="card">
        {!r && <div className="muted">Elegí un cliente de la lista.</div>}
        {r && (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.3px' }}>{r.razon_social} {canje.has(r.codigo) && <span className="tag c">CANJE</span>}</div>
                <div className="sub" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  Código {r.codigo} · semana {fecha(sel.fecha_corte)}
                  {r.vendedor && <><Avatar nombre={r.vendedor} size={20} />{r.vendedor}</>} <LogoEmp emp={r.empresa} />
                </div>
              </div>
              <div className="noprint" style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={excel} disabled={!comps?.length}>⬇ Excel</button>
                <button className="btn pri" disabled={!comps?.length || pdfOcupado} onClick={async () => { setPdfOcupado(true); try { await descargarPDF({ r, facturas, creditos, fechaCorte: sel.fecha_corte }); } finally { setPdfOcupado(false); } }}>{pdfOcupado ? 'Generando…' : '⬇ PDF'}</button>
              </div>
            </div>

            <div className="mini">
              <div><small>Saldo</small><b>{F(r.saldo_total)}</b></div>
              <div><small>Vencido</small><b style={{ color: venc(r) > 0 ? 'var(--bad)' : 'var(--ok)' }}>{F(venc(r))}</b><small>{P(venc(r) / r.saldo_total)} del saldo</small></div>
              <div><small>Pagos / NC sin imputar</small><b>{F(aCuenta)}</b><small>{creditos.length} comprobantes{aFavor > 0.5 ? ` · saldo a favor ${F(aFavor)}` : ''}</small></div>
              <div><small>Factura impaga más vieja</small><b>{impagas.length ? `${masVieja} días` : '—'}</b></div>
            </div>
            <div className="bar" style={{ height: 10 }}>
              {[[r.saldo_total - venc(r), 't0', 'Al día'], [r.t30_60, 't1', '30-60'], [r.t60_90, 't2', '60-90'], [r.t90_mas, 't3', '+90']].map(([v, t, l]) => (
                <div key={t} style={{ flex: Math.max(Number(v), 0), background: `var(--${t})` }} title={`${l}: ${F(v)}`} />
              ))}
            </div>
            <div className="legend">
              {[['t0', 'Al día', r.saldo_total - venc(r)], ['t1', '30-60', r.t30_60], ['t2', '60-90', r.t60_90], ['t3', '+90', r.t90_mas]].map(([t, l, v]) => (
                <span key={t}><i className="sw" style={{ background: `var(--${t})` }} />{l} <b>{M(v)}</b></span>
              ))}
            </div>

            {cargando && <div className="skel" style={{ height: 200, marginTop: 14 }} />}
            {!cargando && comps && comps.length === 0 && (
              <div className="err" style={{ marginTop: 14 }}>Esta semana se cargó antes de que existiera esta pestaña. Para ver el detalle, volvé a subir el archivo de esa semana en <b>Cargar semana</b>.</div>
            )}
            {!cargando && comps && comps.length > 0 && (
              <>
                <h3 style={{ marginTop: 18 }}>Facturas impagas <small>{impagas.length} comprobantes · de la más vieja a la más nueva
                  {cubiertas.length > 0 && <> · <a style={{ color: 'var(--vol)', cursor: 'pointer', fontWeight: 600 }} className="noprint" onClick={() => setVerCub((v) => !v)}>{verCub ? 'ocultar' : 'ver'} {cubiertas.length} cubiertas con pagos a cuenta</a></>}</small></h3>
                <div className="tw" style={{ maxHeight: 460 }}>
                  <table>
                    <thead><tr><th>Fecha</th><th>Comprobante</th><th className="n">Días</th><th>Estado</th><th className="n">Pendiente</th><th className="n">Importe</th><th>Cubierto con pagos a cuenta</th><th>Vence</th></tr></thead>
                    <tbody>
                      {visibles.map((c) => (
                        <tr key={c.id} className={c.tramo === 'cubierta' ? 'cub' : ''}>
                          <td>{fecha(c.fecha)}</td>
                          <td><b>{clave(c)}</b> {hayPrev && !prevMap.has(clave(c)) && <span className="tag nueva">NUEVA</span>}</td>
                          <td className="n"><b>{c.dias}</b></td>
                          <td><span className={'tr ' + c.tramo}>{TRAMO_TXT[c.tramo]}</span>
                            {hayPrev && prevMap.get(clave(c)) && prevMap.get(clave(c)).tramo !== c.tramo && c.tramo !== 'cubierta' && <small className="muted"> (antes {TRAMO_TXT[prevMap.get(clave(c)).tramo]})</small>}
                          </td>
                          <td className="n"><b>{c.pendiente > 0 ? F(c.pendiente) : '—'}</b></td>
                          <td className="n muted">{F(c.importe)}</td>
                          <td className="det">{c.detalle ? c.detalle.map((d) => `${d.n} (${F(d.m)})`).join(' · ') : '—'}</td>
                          <td className="muted">{fecha(c.vencimiento)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {creditos.length > 0 && (
                  <>
                    <h3 style={{ marginTop: 18 }}>Pagos y notas de crédito sin imputar <small>se aplican a la deuda más vieja primero</small></h3>
                    <table>
                      <thead><tr><th>Fecha</th><th>Comprobante</th><th className="n">Importe</th><th>Se aplicó a</th><th className="n">Saldo a favor</th></tr></thead>
                      <tbody>
                        {creditos.map((c) => (
                          <tr key={c.id}>
                            <td>{fecha(c.fecha)}</td>
                            <td><b>{clave(c)}</b></td>
                            <td className="n">{F(-c.importe)}</td>
                            <td className="det">{c.detalle ? c.detalle.map((d) => `${d.n} (${F(d.m)})`).join(' · ') : 'sin aplicar'}</td>
                            <td className="n">{c.pendiente < 0 ? F(-c.pendiente) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {hayPrev && pagadas.length > 0 && (
                  <>
                    <h3 style={{ marginTop: 18 }}>Canceladas desde el {fecha(prev.fecha_corte)} <small>{pagadas.length} comprobantes · {F(pagadas.reduce((a, c) => a + Number(c.pendiente), 0))}</small></h3>
                    <table>
                      <thead><tr><th>Fecha</th><th>Comprobante</th><th className="n">Pendiente la semana anterior</th></tr></thead>
                      <tbody>
                        {pagadas.map((c) => (
                          <tr key={c.id}><td>{fecha(c.fecha)}</td><td>{clave(c)}</td><td className="n" style={{ color: 'var(--ok)', fontWeight: 600 }}>{F(c.pendiente)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
