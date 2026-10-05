'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fecha } from '../lib/formato';
import Modal from './Modal';

export default function Configuracion({ vendedores, clientes, config, informes, recargar }) {
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [cfg, setCfg] = useState(config);
  const [nuevoV, setNuevoV] = useState({ nombre: '', empresa: 'voltaje' });
  const [codigoEx, setCodigoEx] = useState('');
  const [tipoEx, setTipoEx] = useState('excluir');
  const [aud, setAud] = useState([]);
  const [borrarInf, setBorrarInf] = useState(null);

  useEffect(() => setCfg(config), [config]);
  useEffect(() => {
    supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(60).then(({ data }) => setAud(data || []));
  }, [vendedores, clientes, informes]);

  async function correr(fn, msj) {
    setError(''); setOk('');
    try { const r = await fn(); if (r?.error) throw r.error; setOk(msj); await recargar(); } catch (e) { setError(e.message); }
  }

  const cambiarEmpresa = (v, empresa) => correr(async () => {
    const a = await supabase.from('vendedores').update({ empresa }).eq('id', v.id);
    if (a.error) return a;
    return supabase.from('informe_filas').update({ empresa }).eq('vendedor', v.nombre);
  }, `${v.nombre} ahora es de ${empresa === 'voltaje' ? 'Voltaje' : 'Iluma'}`);

  const especiales = clientes.filter((c) => c.inclusion !== 'auto');

  async function agregarEspecial() {
    const cod = parseInt(codigoEx, 10);
    if (isNaN(cod)) return setError('Poné un código de cliente válido');
    const existe = clientes.find((c) => c.codigo === cod);
    let razon = existe?.razon_social;
    if (!razon) {
      const { data } = await supabase.from('informe_filas').select('razon_social').eq('codigo', cod).limit(1);
      razon = data?.[0]?.razon_social;
    }
    if (!razon) return setError('No encontré ese código en ningún informe cargado');
    const cambio = { inclusion: tipoEx };
    await correr(() => supabase.from('clientes').upsert({ codigo: cod, razon_social: razon, ...cambio }, { onConflict: 'codigo' }), `${razon} actualizado. Se aplica desde la próxima carga.`);
    setCodigoEx('');
  }

  return (
    <div className="grid c2">
      <div className="card">
        <h3>Vendedores y empresa <small>cambiar la empresa actualiza también el historial</small></h3>
        {error && <div className="err">{error}</div>}
        {ok && <div className="ok">{ok}</div>}
        <div className="tw" style={{ maxHeight: 420 }}>
          <table>
            <thead><tr><th>Vendedor</th><th>Empresa</th><th>Activo</th></tr></thead>
            <tbody>
              {vendedores.map((v) => (
                <tr key={v.id}>
                  <td>{v.nombre}</td>
                  <td><select value={v.empresa} onChange={(e) => cambiarEmpresa(v, e.target.value)}>
                    <option value="voltaje">Voltaje</option><option value="iluma">Iluma</option></select></td>
                  <td><input type="checkbox" checked={v.activo} onChange={(e) => correr(() => supabase.from('vendedores').update({ activo: e.target.checked }).eq('id', v.id), 'Vendedor actualizado')} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row">
          <input placeholder="Nuevo vendedor" value={nuevoV.nombre} onChange={(e) => setNuevoV({ ...nuevoV, nombre: e.target.value })} />
          <select value={nuevoV.empresa} onChange={(e) => setNuevoV({ ...nuevoV, empresa: e.target.value })}><option value="voltaje">Voltaje</option><option value="iluma">Iluma</option></select>
          <button className="btn" onClick={() => nuevoV.nombre.trim() && correr(async () => {
            const r = await supabase.from('vendedores').insert({ nombre: nuevoV.nombre.trim().toLowerCase(), empresa: nuevoV.empresa });
            if (!r.error) setNuevoV({ nombre: '', empresa: 'voltaje' });
            return r;
          }, 'Vendedor agregado')}>Agregar</button>
        </div>

        <h3 style={{ marginTop: 18 }}>Semanas cargadas</h3>
        <table>
          <tbody>
            {informes.map((i) => (
              <tr key={i.id}><td>{fecha(i.fecha_corte)}</td><td className="muted">{i.origen === 'historico' ? 'Excel manual' : i.archivo}</td>
                <td><button className="btn sm" onClick={() => setBorrarInf(i)}>🗑 Eliminar</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Reglas</h3>
        <div className="row"><label>Excluir si el nombre contiene</label><input value={cfg.patron_exclusion || ''} onChange={(e) => setCfg({ ...cfg, patron_exclusion: e.target.value })} /></div>
        <div className="row"><label>Saldo mínimo $</label><input type="number" value={cfg.saldo_minimo || ''} onChange={(e) => setCfg({ ...cfg, saldo_minimo: e.target.value })} /></div>
        <div className="row"><label>Vence a los (días)</label><input type="number" value={cfg.dias_vencido || ''} onChange={(e) => setCfg({ ...cfg, dias_vencido: e.target.value })} /></div>
        <button className="btn pri" onClick={() => correr(() => supabase.from('configuracion').upsert(
          ['patron_exclusion', 'saldo_minimo', 'dias_vencido'].map((k) => ({ clave: k, valor: String(cfg[k] ?? '') }))
        ), 'Reglas guardadas. Se aplican desde la próxima carga.')}>Guardar reglas</button>

        <h3 style={{ marginTop: 18 }}>Clientes con tratamiento especial</h3>
        <table>
          <thead><tr><th>Cliente</th><th>Regla</th><th></th></tr></thead>
          <tbody>
            {especiales.map((c) => (
              <tr key={c.codigo}>
                <td className="rs" title={c.razon_social}>{c.codigo} · {c.razon_social}</td>
                <td>{c.inclusion === 'excluir' && <span className="tag n">EXCLUIDO</span>} {c.inclusion === 'incluir' && <span className="tag n">INCLUIDO (excepción)</span>}</td>
                <td><button className="btn sm" onClick={() => correr(() => supabase.from('clientes').update({ inclusion: 'auto' }).eq('codigo', c.codigo), `${c.razon_social} vuelve a la regla normal`)}>Quitar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row">
          <input placeholder="Código cliente" value={codigoEx} onChange={(e) => setCodigoEx(e.target.value)} style={{ width: 130 }} />
          <select value={tipoEx} onChange={(e) => setTipoEx(e.target.value)}>
            <option value="excluir">Excluir del informe</option>
            <option value="incluir">Incluir aunque tenga el texto excluido</option>
          </select>
          <button className="btn" onClick={agregarEspecial}>Agregar</button>
        </div>

        <h3 style={{ marginTop: 18 }}>Auditoría <small>últimos 60 cambios</small></h3>
        <div className="tw" style={{ maxHeight: 300 }}>
          <table>
            <tbody>
              {aud.length === 0 && <tr><td className="muted">Sin cambios todavía</td></tr>}
              {aud.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{new Date(a.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{a.email || 'sistema'}</td>
                  <td>{a.accion === 'UPDATE' ? 'modificó' : a.accion === 'DELETE' ? 'eliminó' : 'creó'} {a.tabla.replace('_', ' ')}</td>
                  <td className="rs muted">{(a.despues || a.antes)?.razon_social || (a.despues || a.antes)?.nombre || (a.despues || a.antes)?.clave || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {borrarInf && (
        <Modal titulo="Eliminar semana" textoAceptar="Eliminar" onCancelar={() => setBorrarInf(null)}
          onAceptar={async () => { const i = borrarInf; setBorrarInf(null); await correr(() => supabase.from('informes').delete().eq('id', i.id), `Semana ${fecha(i.fecha_corte)} eliminada`); }}>
          <p>¿Eliminar el informe del <b>{fecha(borrarInf.fecha_corte)}</b> con todas sus filas? No se puede deshacer.</p>
        </Modal>
      )}
    </div>
  );
}
