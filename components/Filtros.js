'use client';
import { fecha, venc } from '../lib/formato';

export const FILTROS_INICIALES = { emp: '', ven: '', tra: '', can: '', q: '' };

export function filtrar(filas, S, canje) {
  const q = (S.q || '').toLowerCase();
  return filas.filter((r) => {
    if (S.emp && r.empresa !== S.emp) return false;
    if (S.ven && r.vendedor !== S.ven) return false;
    if (S.can === 'si' && !canje.has(r.codigo)) return false;
    if (S.can === 'no' && canje.has(r.codigo)) return false;
    if (S.tra === 'aldia' && venc(r) > 0) return false;
    if (S.tra === 't1' && !(r.t30_60 > 0)) return false;
    if (S.tra === 't2' && !(r.t60_90 > 0)) return false;
    if (S.tra === 't3' && !(r.t90_mas > 0)) return false;
    if (q && !(String(r.razon_social).toLowerCase().includes(q) || String(r.codigo).includes(q))) return false;
    return true;
  });
}

function Seg({ valor, opciones, onChange }) {
  return (
    <div className="seg">
      {opciones.map(([v, l]) => (
        <button key={v} className={valor === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export default function Filtros({ S, setS, informes, selId, setSelId, filas }) {
  const vendedores = [...new Set(filas.filter((r) => !S.emp || r.empresa === S.emp).map((r) => r.vendedor))].sort();
  const set = (k, v) => setS((s) => ({ ...s, [k]: v, ...(k === 'emp' ? { ven: '' } : {}) }));
  return (
    <div className="filters">
      <div className="f">
        <label>Semana</label>
        <select value={selId || ''} onChange={(e) => setSelId(Number(e.target.value))}>
          {informes.map((i) => <option key={i.id} value={i.id}>{fecha(i.fecha_corte)}</option>)}
        </select>
      </div>
      <div className="f"><label>Empresa</label>
        <Seg valor={S.emp} onChange={(v) => set('emp', v)} opciones={[['', 'Todas'], ['voltaje', 'Voltaje'], ['iluma', 'Iluma']]} /></div>
      <div className="f"><label>Vendedor</label>
        <select value={S.ven} onChange={(e) => set('ven', e.target.value)}>
          <option value="">Todos</option>
          {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
        </select></div>
      <div className="f"><label>Tramo</label>
        <Seg valor={S.tra} onChange={(v) => set('tra', v)} opciones={[['', 'Todos'], ['aldia', 'Al día'], ['t1', '30-60'], ['t2', '60-90'], ['t3', '+90']]} /></div>
      <div className="f"><label>Canje</label>
        <Seg valor={S.can} onChange={(v) => set('can', v)} opciones={[['', 'Todos'], ['si', 'Con canje'], ['no', 'Sin canje']]} /></div>
      <div className="f"><label>Cliente</label>
        <input type="search" placeholder="Nombre o código" value={S.q} onChange={(e) => set('q', e.target.value)} /></div>
      <button className="clear" onClick={() => setS(FILTROS_INICIALES)}>Limpiar filtros</button>
    </div>
  );
}
