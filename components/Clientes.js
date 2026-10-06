'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { F, M, venc, sumar } from '../lib/formato';
import Modal from './Modal';
import { Avatar, LogoEmp } from './ui';

const COLS = [
  ['codigo', 'Código'], ['razon_social', 'Razón social'], ['vendedor', 'Vendedor'], ['empresa', 'Empresa'],
  ['saldo_total', 'Saldo total', 1], ['venc', 'Vencido', 1], ['t30_60', '30-60', 1], ['t60_90', '60-90', 1], ['t90_mas', '+90', 1],
];

export default function Clientes({ vista, admin, canje, vendedores, clientes, sel, recargar }) {
  const [orden, setOrden] = useState({ k: 'saldo_total', d: -1 });
  const [editando, setEditando] = useState(null);
  const [borrando, setBorrando] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const filas = [...vista].sort((a, b) => {
    const va = orden.k === 'venc' ? venc(a) : a[orden.k];
    const vb = orden.k === 'venc' ? venc(b) : b[orden.k];
    const na = typeof va === 'number' || !isNaN(Number(va)) ? Number(va) : va;
    const nb = typeof vb === 'number' || !isNaN(Number(vb)) ? Number(vb) : vb;
    return (na > nb ? 1 : na < nb ? -1 : 0) * orden.d;
  });
  const tot = sumar(vista);

  async function toggleCanje(r) {
    setError('');
    const nuevo = !canje.has(r.codigo);
    const existe = clientes.some((c) => c.codigo === r.codigo);
    const { error } = existe
      ? await supabase.from('clientes').update({ canje: nuevo, actualizado: new Date().toISOString() }).eq('codigo', r.codigo)
      : await supabase.from('clientes').insert({ codigo: r.codigo, razon_social: r.razon_social, canje: nuevo });
    if (error) setError(error.message);
    await recargar();
  }

  async function guardarEdicion() {
    setOcupado(true); setError('');
    const e = editando;
    const v = vendedores.find((x) => x.nombre === e.vendedor);
    const t1 = +e.t30_60 || 0, t2 = +e.t60_90 || 0, t3 = +e.t90_mas || 0;
    const { error } = await supabase.from('informe_filas').update({
      vendedor: v?.nombre || null, empresa: v?.empresa || null,
      saldo_total: +e.saldo_total || 0, t30_60: t1, t60_90: t2, t90_mas: t3, saldo_vencido: t1 + t2 + t3, editado: true,
    }).eq('id', e.id);
    if (!error && v && e.vendedorOriginal !== v.nombre) {
      // el cambio de vendedor queda para las proximas semanas
      await supabase.from('clientes').upsert({ codigo: e.codigo, razon_social: e.razon_social, vendedor_id: v.id }, { onConflict: 'codigo' });
    }
    if (error) setError(error.message);
    setOcupado(false); setEditando(null);
    await recargar();
  }

  async function borrar() {
    setOcupado(true); setError('');
    const { error } = await supabase.from('informe_filas').delete().eq('id', borrando.id);
    if (error) setError(error.message);
    setOcupado(false); setBorrando(null);
    await recargar();
  }

  return (
    <div className="card">
      <h3>Clientes <small>{vista.length} clientes · saldo {M(tot.saldo)} · vencido {M(tot.venc)}</small></h3>
      {error && <div className="err">{error}</div>}
      <div className="tw">
        <table>
          <thead><tr>
            {COLS.map(([k, l, n]) => (
              <th key={k} className={'sort ' + (n ? 'n' : '')} onClick={() => setOrden((o) => ({ k, d: o.k === k ? -o.d : -1 }))}>
                {l}{orden.k === k ? (orden.d > 0 ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
            <th>Canje</th><th></th>
          </tr></thead>
          <tbody>
            {filas.map((r) => {
              const cj = canje.has(r.codigo);
              return (
                <tr key={r.id} className={cj ? 'canje' : ''}>
                  <td className="muted">{r.codigo}</td>
                  <td className="rs" title={r.razon_social}><b>{r.razon_social}</b> {r.editado && <span className="tag e" title="Editado a mano">EDITADO</span>}</td>
                  <td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Avatar nombre={r.vendedor} size={24} />{r.vendedor}</div></td>
                  <td><LogoEmp emp={r.empresa} /></td>
                  <td className="n"><b>{F(r.saldo_total)}</b></td>
                  <td className="n">{venc(r) ? F(venc(r)) : '—'}</td>
                  <td className="n">{+r.t30_60 ? F(r.t30_60) : '—'}</td>
                  <td className="n">{+r.t60_90 ? F(r.t60_90) : '—'}</td>
                  <td className="n" style={+r.t90_mas ? { color: 'var(--bad)', fontWeight: 600 } : {}}>{+r.t90_mas ? F(r.t90_mas) : '—'}</td>
                  <td>{admin
                    ? <button className="btn sm" onClick={() => toggleCanje(r)}>{cj ? '✓ CANJE' : 'Marcar'}</button>
                    : cj && <span className="tag c">CANJE</span>}</td>
                  <td>{admin
                    ? <><button className="btn sm" title="Editar" onClick={() => setEditando({ ...r, vendedorOriginal: r.vendedor })}>✎</button> <button className="btn sm" title="Eliminar de esta semana" onClick={() => setBorrando(r)}>🗑</button></>
                    : <span className="lock">🔒</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal titulo={'Editar ' + editando.razon_social} onCancelar={() => setEditando(null)} onAceptar={guardarEdicion} ocupado={ocupado}>
          <div className="row"><label>Vendedor</label>
            <select value={editando.vendedor || ''} onChange={(e) => setEditando({ ...editando, vendedor: e.target.value })}>
              {vendedores.filter((v) => v.activo).map((v) => <option key={v.id} value={v.nombre}>{v.nombre} ({v.empresa})</option>)}
            </select></div>
          {[['saldo_total', 'Saldo total'], ['t30_60', '30-60 días'], ['t60_90', '60-90 días'], ['t90_mas', '+90 días']].map(([k, l]) => (
            <div className="row" key={k}><label>{l}</label>
              <input type="number" value={editando[k]} onChange={(e) => setEditando({ ...editando, [k]: e.target.value })} /></div>
          ))}
          <p className="muted" style={{ fontSize: 12 }}>Los montos cambian solo esta semana. El vendedor queda para las próximas. Todo queda en auditoría.</p>
        </Modal>
      )}
      {borrando && (
        <Modal titulo="Eliminar fila" onCancelar={() => setBorrando(null)} onAceptar={borrar} textoAceptar="Eliminar" ocupado={ocupado}>
          <p>¿Eliminar <b>{borrando.razon_social}</b> del informe de esta semana?</p>
          <p className="muted" style={{ fontSize: 12 }}>Solo se borra de esta semana. Si querés que no aparezca nunca más, excluilo desde Configuración. Queda registrado en auditoría.</p>
        </Modal>
      )}
    </div>
  );
}
