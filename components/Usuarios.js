'use client';
import { useEffect, useState } from 'react';
import { api, supabase } from '../lib/supabase';
import Modal from './Modal';
import { Avatar, LogoEmp } from './ui';
import { deEmail } from '../lib/usuario';

const ROLES = { admin: 'Admin', lector: 'Solo lectura', vendedor: 'Vendedor' };

export default function Usuarios({ perfil }) {
  const [lista, setLista] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [form, setForm] = useState({ nombre: '', usuario: '', password: '', rol: 'lector', vendedor: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [clave, setClave] = useState(null);
  const [baja, setBaja] = useState(null);
  const [rolEdit, setRolEdit] = useState(null);

  const cargar = () => api('/api/usuarios').then((r) => setLista(r.usuarios)).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
    supabase.from('vendedores').select('*').eq('activo', true).order('nombre').then(({ data }) => setVendedores(data || []));
  }, []);

  async function accion(fn, msj) {
    setError(''); setOk(''); setOcupado(true);
    try { await fn(); setOk(msj); await cargar(); } catch (e) { setError(e.message); }
    setOcupado(false);
  }

  const SelVendedor = ({ valor, onChange }) => (
    <select value={valor} onChange={(e) => onChange(e.target.value)}>
      <option value="">— elegir vendedor —</option>
      <optgroup label="Voltaje">{vendedores.filter((v) => v.empresa === 'voltaje').map((v) => <option key={v.id} value={v.nombre}>{v.nombre}</option>)}</optgroup>
      <optgroup label="Iluma">{vendedores.filter((v) => v.empresa === 'iluma').map((v) => <option key={v.id} value={v.nombre}>{v.nombre}</option>)}</optgroup>
    </select>
  );
  const empDe = (n) => vendedores.find((v) => v.nombre === n)?.empresa;

  return (
    <div className="grid c2">
      <div className="card">
        <h3>Usuarios <small>{lista.length} usuarios</small></h3>
        {error && <div className="err">{error}</div>}
        {ok && <div className="ok">{ok}</div>}
        <div className="tw">
          <table>
            <thead><tr><th>Usuario</th><th>Rol</th><th></th></tr></thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id}>
                  <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Avatar nombre={u.nombre || deEmail(u.email)} size={30} />
                    <div><b>{u.nombre}</b><br /><small className="muted">usuario: {deEmail(u.email)}</small></div></div></td>
                  <td>
                    <span className={'pill ' + (u.rol === 'admin' ? 'bad' : u.rol === 'vendedor' ? 'warn' : 'eq')} style={{ margin: 0 }}>{ROLES[u.rol]}</span>
                    {u.rol === 'vendedor' && <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>{u.vendedor} <LogoEmp emp={empDe(u.vendedor)} /></div>}
                  </td>
                  <td>
                    <button className="btn sm" onClick={() => setRolEdit({ id: u.id, email: deEmail(u.email), usuario: deEmail(u.email), rol: u.rol, vendedor: u.vendedor || '', yo: u.id === perfil.id })}>Editar</button>{' '}
                    <button className="btn sm" onClick={() => setClave({ id: u.id, email: deEmail(u.email), password: '' })}>Cambiar clave</button>{' '}
                    {u.id !== perfil.id && <button className="btn sm" onClick={() => setBaja(u)}>Dar de baja</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3>Nuevo usuario</h3>
        <div className="row"><label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Tomás Marimón" /></div>
        <div className="row"><label>Usuario</label><input type="text" autoComplete="off" autoCapitalize="none" placeholder="ej: tomasm" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value.toLowerCase().replace(/\s/g, '') })} /></div>
        <div className="row"><label>Contraseña</label><input type="text" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mínimo 8 caracteres" /></div>
        <div className="row"><label>Rol</label>
          <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            <option value="lector">Solo lectura (ve todo)</option>
            <option value="vendedor">Vendedor (ve solo sus clientes)</option>
            <option value="admin">Admin (todos los permisos)</option>
          </select></div>
        {form.rol === 'vendedor' && (
          <div className="row"><label>¿Qué vendedor es?</label><SelVendedor valor={form.vendedor} onChange={(v) => setForm({ ...form, vendedor: v })} /></div>
        )}
        <button className="btn pri" disabled={ocupado} onClick={() => accion(async () => {
          await api('/api/usuarios', 'POST', form);
          setForm({ nombre: '', usuario: '', password: '', rol: 'lector', vendedor: '' });
        }, `Usuario "${form.usuario.trim()}" creado con la contraseña "${form.password.trim()}". Pasale esos datos a la persona.`)}>Crear usuario</button>
        <div style={{ marginTop: 16, display: 'grid', gap: 8, fontSize: 12.5 }}>
          <div><span className="pill bad" style={{ margin: 0 }}>Admin</span> carga semanas, edita, elimina, asigna vendedores, marca canje, configura y crea usuarios.</div>
          <div><span className="pill eq" style={{ margin: 0 }}>Solo lectura</span> ve todo (dashboard, clientes y composición de deuda), filtra y descarga Excel.</div>
          <div><span className="pill warn" style={{ margin: 0 }}>Vendedor</span> ve <b>solo sus clientes</b>: su dashboard, su lista y la composición de deuda de cada uno.</div>
        </div>
      </div>

      {rolEdit && (
        <Modal titulo={'Editar ' + rolEdit.email} onCancelar={() => setRolEdit(null)} ocupado={ocupado}
          onAceptar={() => accion(async () => {
            await api('/api/usuarios', 'PATCH', {
              id: rolEdit.id,
              ...(rolEdit.yo ? {} : { rol: rolEdit.rol, vendedor: rolEdit.vendedor }),
              ...(rolEdit.usuario !== rolEdit.email ? { usuario: rolEdit.usuario } : {}),
            });
            setRolEdit(null);
          }, 'Usuario actualizado')}>
          <div className="row"><label>Usuario para ingresar</label>
            <input type="text" autoCapitalize="none" value={rolEdit.usuario} onChange={(e) => setRolEdit({ ...rolEdit, usuario: e.target.value.toLowerCase().replace(/\s/g, '') })} /></div>
          {!rolEdit.yo && <div className="row"><label>Rol</label>
            <select value={rolEdit.rol} onChange={(e) => setRolEdit({ ...rolEdit, rol: e.target.value })}>
              <option value="lector">Solo lectura</option><option value="vendedor">Vendedor</option><option value="admin">Admin</option>
            </select></div>}
          {!rolEdit.yo && rolEdit.rol === 'vendedor' && <div className="row"><label>¿Qué vendedor es?</label><SelVendedor valor={rolEdit.vendedor} onChange={(v) => setRolEdit({ ...rolEdit, vendedor: v })} /></div>}
        </Modal>
      )}
      {clave && (
        <Modal titulo={'Nueva contraseña para ' + clave.email} onCancelar={() => setClave(null)} ocupado={ocupado}
          onAceptar={() => accion(async () => { await api('/api/usuarios', 'PATCH', { id: clave.id, password: clave.password }); setClave(null); }, 'Contraseña cambiada')}>
          <div className="row"><label>Contraseña</label><input type="text" autoComplete="new-password" value={clave.password} onChange={(e) => setClave({ ...clave, password: e.target.value })} placeholder="mínimo 8 caracteres" /></div>
        </Modal>
      )}
      {baja && (
        <Modal titulo="Dar de baja" textoAceptar="Dar de baja" onCancelar={() => setBaja(null)} ocupado={ocupado}
          onAceptar={() => accion(async () => { await api('/api/usuarios', 'DELETE', { id: baja.id }); setBaja(null); }, 'Usuario dado de baja')}>
          <p>¿Dar de baja a <b>{deEmail(baja.email)}</b>? No va a poder ingresar más.</p>
        </Modal>
      )}
    </div>
  );
}
