'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/supabase';
import Modal from './Modal';

export default function Usuarios({ perfil }) {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'lector' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [clave, setClave] = useState(null);
  const [baja, setBaja] = useState(null);

  const cargar = () => api('/api/usuarios').then((r) => setLista(r.usuarios)).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function accion(fn, msj) {
    setError(''); setOk(''); setOcupado(true);
    try { await fn(); setOk(msj); await cargar(); } catch (e) { setError(e.message); }
    setOcupado(false);
  }

  return (
    <div className="grid c2">
      <div className="card">
        <h3>Usuarios</h3>
        {error && <div className="err">{error}</div>}
        {ok && <div className="ok">{ok}</div>}
        <div className="tw">
          <table>
            <thead><tr><th>Nombre</th><th>Mail</th><th>Rol</th><th></th></tr></thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td>{u.email}</td>
                  <td>
                    {u.id === perfil.id ? <span className="tag c">ADMIN</span> : (
                      <select value={u.rol} disabled={ocupado} onChange={(e) => accion(() => api('/api/usuarios', 'PATCH', { id: u.id, rol: e.target.value }), 'Rol actualizado')}>
                        <option value="admin">Admin</option>
                        <option value="lector">Solo lectura</option>
                      </select>
                    )}
                  </td>
                  <td>
                    <button className="btn sm" onClick={() => setClave({ id: u.id, email: u.email, password: '' })}>Cambiar clave</button>{' '}
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
        <div className="row"><label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Gerencia" /></div>
        <div className="row"><label>Mail</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="row"><label>Contraseña</label><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mínimo 8 caracteres" /></div>
        <div className="row"><label>Rol</label>
          <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            <option value="lector">Solo lectura</option>
            <option value="admin">Admin (todos los permisos)</option>
          </select></div>
        <button className="btn pri" disabled={ocupado} onClick={() => accion(async () => {
          await api('/api/usuarios', 'POST', form);
          setForm({ nombre: '', email: '', password: '', rol: 'lector' });
        }, `Usuario creado. Pasale el mail y la contraseña a la persona.`)}>Crear usuario</button>
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          <b>Admin:</b> carga semanas, edita, elimina, asigna vendedores, marca canje, configura y crea usuarios.<br />
          <b>Solo lectura:</b> ve el dashboard y los clientes, filtra y descarga Excel.
        </p>
      </div>

      {clave && (
        <Modal titulo={'Nueva contraseña para ' + clave.email} onCancelar={() => setClave(null)} ocupado={ocupado}
          onAceptar={() => accion(async () => { await api('/api/usuarios', 'PATCH', { id: clave.id, password: clave.password }); setClave(null); }, 'Contraseña cambiada')}>
          <div className="row"><label>Contraseña</label><input type="text" value={clave.password} onChange={(e) => setClave({ ...clave, password: e.target.value })} placeholder="mínimo 8 caracteres" /></div>
        </Modal>
      )}
      {baja && (
        <Modal titulo="Dar de baja" textoAceptar="Dar de baja" onCancelar={() => setBaja(null)} ocupado={ocupado}
          onAceptar={() => accion(async () => { await api('/api/usuarios', 'DELETE', { id: baja.id }); setBaja(null); }, 'Usuario dado de baja')}>
          <p>¿Dar de baja a <b>{baja.email}</b>? No va a poder ingresar más.</p>
        </Modal>
      )}
    </div>
  );
}
