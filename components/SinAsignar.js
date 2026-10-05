'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { F, venc, fecha } from '../lib/formato';

export default function SinAsignar({ filas, vendedores, sel, recargar }) {
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(null);
  const lista = [...filas].sort((a, b) => b.saldo_total - a.saldo_total);

  async function asignar(r, vendedorId) {
    const v = vendedores.find((x) => x.id === Number(vendedorId));
    if (!v) return;
    setOcupado(r.codigo); setError('');
    const a = await supabase.from('clientes').upsert(
      { codigo: r.codigo, razon_social: r.razon_social, vendedor_id: v.id, actualizado: new Date().toISOString() },
      { onConflict: 'codigo' }
    );
    const b = await supabase.from('informe_filas').update({ vendedor: v.nombre, empresa: v.empresa })
      .eq('codigo', r.codigo).is('vendedor', null);
    if (a.error || b.error) setError((a.error || b.error).message);
    await recargar();
    setOcupado(null);
  }

  async function excluir(r) {
    setOcupado(r.codigo); setError('');
    const a = await supabase.from('clientes').upsert(
      { codigo: r.codigo, razon_social: r.razon_social, inclusion: 'excluir', actualizado: new Date().toISOString() },
      { onConflict: 'codigo' }
    );
    const b = await supabase.from('informe_filas').delete().eq('codigo', r.codigo).is('vendedor', null);
    if (a.error || b.error) setError((a.error || b.error).message);
    await recargar();
    setOcupado(null);
  }

  return (
    <div className="card">
      <h3>Clientes sin vendedor · semana {fecha(sel.fecha_corte)}
        <small>al asignarlo pasa a Clientes y al Dashboard, y queda guardado para las próximas semanas</small></h3>
      {error && <div className="err">{error}</div>}
      {lista.length === 0 && <div className="ok">Todos los clientes tienen vendedor asignado.</div>}
      {lista.length > 0 && (
        <div className="tw">
          <table>
            <thead><tr><th>Código</th><th>Razón social</th><th className="n">Saldo</th><th className="n">Vencido</th><th>Asignar a</th><th></th></tr></thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td>{r.codigo}</td>
                  <td className="rs" title={r.razon_social}>{r.razon_social}</td>
                  <td className="n">{F(r.saldo_total)}</td>
                  <td className="n">{venc(r) ? F(venc(r)) : '—'}</td>
                  <td>
                    <select disabled={ocupado === r.codigo} defaultValue="" onChange={(e) => asignar(r, e.target.value)}>
                      <option value="">— elegir vendedor —</option>
                      <optgroup label="Voltaje">
                        {vendedores.filter((v) => v.activo && v.empresa === 'voltaje').map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                      </optgroup>
                      <optgroup label="Iluma">
                        {vendedores.filter((v) => v.activo && v.empresa === 'iluma').map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                      </optgroup>
                    </select>
                  </td>
                  <td><button className="btn sm" disabled={ocupado === r.codigo} onClick={() => excluir(r)}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
