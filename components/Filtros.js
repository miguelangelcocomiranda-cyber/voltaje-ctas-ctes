'use client';
import { useEffect, useRef, useState } from 'react';
import { venc } from '../lib/formato';
import { Avatar, LogoEmp } from './ui';

export const FILTROS_INICIALES = { emp: '', vens: null, tra: '', can: '', q: '' };

export function filtrar(filas, S, canje) {
  const q = (S.q || '').toLowerCase();
  return filas.filter((r) => {
    if (S.emp && r.empresa !== S.emp) return false;
    if (S.vens && !S.vens.includes(r.vendedor)) return false;
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

function MultiVendedor({ S, setS, listaVend }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const cerrar = (e) => ref.current && !ref.current.contains(e.target) && setAbierto(false);
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);
  const todos = listaVend.map((v) => v.nombre);
  const sel = S.vens || todos;
  const fijar = (set) => setS((s) => ({ ...s, vens: set.size === todos.length ? null : [...set] }));
  const texto = !S.vens ? 'Todos los vendedores' : S.vens.length === 0 ? 'Ningún vendedor'
    : S.vens.length === 1 ? S.vens[0] : `${S.vens.length} de ${todos.length} vendedores`;

  return (
    <div className="ms" ref={ref}>
      <button className={'msb ' + (S.vens ? 'act' : '')} onClick={() => setAbierto((a) => !a)}><span>{texto}</span><span>▾</span></button>
      {abierto && (
        <div className="pan">
          <input type="search" placeholder="Buscar vendedor" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="acts">
            <button className="btn sm" onClick={() => setS((s) => ({ ...s, vens: null }))}>Todos</button>
            <button className="btn sm" onClick={() => setS((s) => ({ ...s, vens: [] }))}>Ninguno</button>
            <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setAbierto(false)}>Listo</button>
          </div>
          <div className="lst">
            {['voltaje', 'iluma'].filter((e) => !S.emp || S.emp === e).map((e) => {
              const vs = listaVend.filter((v) => v.empresa === e && v.nombre.toLowerCase().includes(q.toLowerCase())).map((v) => v.nombre);
              if (!vs.length) return null;
              const todosOn = vs.every((v) => sel.includes(v));
              return (
                <div key={e}>
                  <label className="grp">
                    <input type="checkbox" checked={todosOn} onChange={(ev) => {
                      const s = new Set(sel); vs.forEach((v) => (ev.target.checked ? s.add(v) : s.delete(v))); fijar(s);
                    }} />
                    <LogoEmp emp={e} /> <span>{vs.length} vendedores</span>
                  </label>
                  {vs.map((v) => (
                    <label key={v} className="op">
                      <input type="checkbox" checked={sel.includes(v)} onChange={(ev) => {
                        const s = new Set(sel); ev.target.checked ? s.add(v) : s.delete(v); fijar(s);
                      }} />
                      <Avatar nombre={v} size={22} />{v}
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Filtros({ S, setS, listaVend }) {
  const set = (k, v) => setS((s) => ({ ...s, [k]: v }));
  const chips = [];
  if (S.emp) chips.push(['emp', S.emp === 'voltaje' ? 'Voltaje' : 'Iluma']);
  if (S.vens) chips.push(['vens', S.vens.length === 1 ? S.vens[0] : `${S.vens.length} vendedores`]);
  if (S.tra) chips.push(['tra', { aldia: 'Al día', t1: '30-60', t2: '60-90', t3: '+90' }[S.tra]]);
  if (S.can) chips.push(['can', S.can === 'si' ? 'Con canje' : 'Sin canje']);
  if (S.q) chips.push(['q', `"${S.q}"`]);
  return (
    <div className="card filters">
      <div className="f"><label>Empresa</label>
        <Seg valor={S.emp} onChange={(v) => set('emp', v)} opciones={[['', 'Todas'], ['voltaje', 'Voltaje'], ['iluma', 'Iluma']]} /></div>
      <div className="f"><label>Vendedores</label><MultiVendedor S={S} setS={setS} listaVend={listaVend} /></div>
      <div className="f"><label>Tramo</label>
        <Seg valor={S.tra} onChange={(v) => set('tra', v)} opciones={[['', 'Todos'], ['aldia', 'Al día'], ['t1', '30-60'], ['t2', '60-90'], ['t3', '+90']]} /></div>
      <div className="f"><label>Canje</label>
        <Seg valor={S.can} onChange={(v) => set('can', v)} opciones={[['', 'Todos'], ['si', 'Con canje'], ['no', 'Sin canje']]} /></div>
      <div className="f" style={{ flex: 1, minWidth: 180 }}><label>Buscar cliente</label>
        <input type="search" placeholder="🔍 Nombre o código" value={S.q} onChange={(e) => set('q', e.target.value)} style={{ width: '100%' }} /></div>
      <div className="chips" style={{ width: '100%' }}>
        {chips.length === 0 ? <span>Sin filtros · mostrando todo</span> : <>
          Filtros activos:
          {chips.map(([k, l]) => (
            <span key={k} className="chip">{l}<b onClick={() => set(k, k === 'vens' ? null : '')}>✕</b></span>
          ))}
          <a style={{ color: 'var(--vol)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setS(FILTROS_INICIALES)}>Limpiar todo</a>
        </>}
      </div>
    </div>
  );
}
