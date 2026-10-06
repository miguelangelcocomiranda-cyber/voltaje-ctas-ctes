'use client';
import { useState } from 'react';
import { supabase, traerTodo } from '../lib/supabase';
import { leerDetallado, armarInforme } from '../lib/procesar';
import { M, fecha, sumar } from '../lib/formato';

export default function Cargar({ informes, recargar, alTerminar, setSelId, perfil }) {
  const [over, setOver] = useState(false);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [res, setRes] = useState(null);
  const [archivo, setArchivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function procesar(file) {
    if (!file) return;
    setError(''); setRes(null); setArchivo(file.name);
    try {
      setEstado('Leyendo el archivo…');
      const buf = await file.arrayBuffer();
      const leido = leerDetallado(buf);
      setEstado('Trayendo configuración…');
      const [cfg, ven, cli] = await Promise.all([
        supabase.from('configuracion').select('*'),
        supabase.from('vendedores').select('*'),
        traerTodo(() => supabase.from('clientes').select('*')),
      ]);
      const config = Object.fromEntries((cfg.data || []).map((c) => [c.clave, c.valor]));
      setEstado('Calculando…');
      const inf = armarInforme({ leido, config, clientesDB: cli, vendedores: ven.data || [] });
      const docs = leido.clientes.reduce((a, c) => a + c.docs.length, 0);
      setRes({ ...inf, fechaCorte: leido.fechaCorte, totClientes: leido.clientes.length, docs });
      setEstado('');
    } catch (e) {
      setError(e.message); setEstado('');
    }
  }

  async function guardar() {
    setGuardando(true); setError('');
    try {
      const existente = informes.find((i) => i.fecha_corte === res.fechaCorte);
      if (existente) {
        const { error } = await supabase.from('informes').delete().eq('id', existente.id);
        if (error) throw error;
      }
      setEstado('Guardando clientes nuevos…');
      for (let i = 0; i < res.nuevos.length; i += 500) {
        const { error } = await supabase.from('clientes').upsert(res.nuevos.slice(i, i + 500), { onConflict: 'codigo', ignoreDuplicates: true });
        if (error) throw error;
      }
      setEstado('Guardando informe…');
      const { data: inf, error: e1 } = await supabase.from('informes')
        .insert({ fecha_corte: res.fechaCorte, archivo, origen: 'flexxus', creado_por: perfil.id }).select().single();
      if (e1) throw e1;
      const filas = res.filas.map((f) => ({ ...f, informe_id: inf.id }));
      for (let i = 0; i < filas.length; i += 500) {
        const { error } = await supabase.from('informe_filas').insert(filas.slice(i, i + 500));
        if (error) throw error;
      }
      setEstado('Guardando comprobantes…');
      const comps = res.comprobantes.map((c) => ({ ...c, informe_id: inf.id }));
      for (let i = 0; i < comps.length; i += 1000) {
        const { error } = await supabase.from('informe_comprobantes').insert(comps.slice(i, i + 1000));
        if (error) throw error;
      }
      setEstado('');
      await recargar();
      setSelId(inf.id);
      setRes(null);
      alTerminar();
    } catch (e) {
      setError('No se pudo guardar: ' + e.message); setEstado('');
    }
    setGuardando(false);
  }

  const asign = res ? res.filas.filter((f) => f.vendedor) : [];
  const sinV = res ? res.filas.filter((f) => !f.vendedor) : [];
  const t = sumar(asign);
  const existe = res && informes.some((i) => i.fecha_corte === res.fechaCorte);

  return (
    <div className="grid c2">
      <div className="card">
        <h3>Cargar semana</h3>
        <label
          className={'drop ' + (over ? 'over' : '')}
          style={{ display: 'block', cursor: 'pointer' }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); procesar(e.dataTransfer.files[0]); }}
        >
          📄 Arrastrá acá el <b>Deuda Total de Cliente Detallado</b> de Flexxus (.XLS)<br /><br />
          <span className="btn pri">Elegir archivo</span>
          <input type="file" accept=".xls,.xlsx" style={{ display: 'none' }} onChange={(e) => procesar(e.target.files[0])} />
        </label>
        {estado && <div className="muted" style={{ marginTop: 10 }}>{estado}</div>}
        {error && <div className="err">{error}</div>}
        {res && (
          <div style={{ marginTop: 12 }}>
            <div className="ok">
              Archivo leído: <b>{archivo}</b><br />
              Fecha de corte <b>{fecha(res.fechaCorte)}</b> · {res.docs.toLocaleString('es-AR')} comprobantes de {res.totClientes.toLocaleString('es-AR')} clientes
            </div>
            <table>
              <tbody>
                <tr><td>Clientes en el informe</td><td className="n"><b>{res.filas.length}</b></td></tr>
                <tr><td>Con vendedor</td><td className="n">{asign.length}</td></tr>
                <tr><td>Sin vendedor (para asignar)</td><td className="n">{sinV.length}</td></tr>
                <tr><td>Saldo total (con vendedor)</td><td className="n">{M(t.saldo)}</td></tr>
                <tr><td>Vencido (con vendedor)</td><td className="n">{M(t.venc)}</td></tr>
                <tr><td>30-60 / 60-90 / +90</td><td className="n">{M(t.t1)} / {M(t.t2)} / {M(t.t3)}</td></tr>
                <tr><td>Comprobantes guardados (composición de deuda)</td><td className="n">{res.comprobantes.length.toLocaleString('es-AR')}</td></tr>
                <tr><td className="muted">Excluidos por regla (VTJ) / a mano / saldo mínimo</td><td className="n muted">{res.excluidos.regla} / {res.excluidos.manual} / {res.excluidos.minimo}</td></tr>
              </tbody>
            </table>
            {existe && <div className="err">Ya existe un informe del {fecha(res.fechaCorte)}. Si guardás, se reemplaza (se pierden las ediciones a mano de esa semana).</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setRes(null)}>Cancelar</button>
              <button className="btn pri" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : existe ? 'Reemplazar semana' : 'Guardar semana'}</button>
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <h3>Qué hace la app al subirlo</h3>
        <ol>
          <li>Lee todos los comprobantes pendientes de cada cliente.</li>
          <li>Aplica recibos y notas de crédito sin imputar a la deuda más vieja primero.</li>
          <li>Calcula el vencido (30 días o más desde la factura) y los tramos 30-60 / 60-90 / +90.</li>
          <li>Excluye clientes según Configuración (VTJ, cuentas internas, saldo mínimo).</li>
          <li>Pone el vendedor guardado de cada cliente; los nuevos van a <b>Sin asignar</b>.</li>
          <li>Guarda la semana en el historial y actualiza el dashboard.</li>
        </ol>
        <h3 style={{ marginTop: 16 }}>Semanas cargadas</h3>
        <div className="chips">{informes.map((i) => <span key={i.id} className="tag n">{fecha(i.fecha_corte)}{i.origen === 'historico' ? ' (manual)' : ''}</span>)}</div>
      </div>
    </div>
  );
}
