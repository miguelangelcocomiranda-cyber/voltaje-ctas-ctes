'use client';
import { useState } from 'react';
import { supabase, api } from '../lib/supabase';

export default function Acceso({ modo, onListo, onSetupHecho }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError(''); setOk(''); setOcupado(true);
    try {
      if (modo === 'setup') {
        await api('/api/setup', 'POST', { nombre, email, password });
        setOk('Administrador creado. Ahora ingresá con tu mail y contraseña.');
        onSetupHecho();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error('Mail o contraseña incorrectos');
        onListo();
      }
    } catch (e) {
      setError(e.message);
    }
    setOcupado(false);
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={enviar}>
        <div className="logo" style={{ color: 'var(--ink)', marginBottom: 4 }}>VOLTAJE <b style={{ color: 'var(--brand)' }}>·</b> ILUMA</div>
        <h3>{modo === 'setup' ? 'Crear administrador' : 'Cuentas Corrientes'}</h3>
        {modo === 'setup' && (
          <p className="sub">Es la primera vez que se usa la app. Creá el usuario administrador (tiene todos los permisos).</p>
        )}
        {modo === 'setup' && (
          <>
            <label className="sub">Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Facundo" />
          </>
        )}
        <label className="sub">Mail</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="sub">Contraseña {modo === 'setup' && '(mínimo 8 caracteres)'}</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="err">{error}</div>}
        {ok && <div className="ok">{ok}</div>}
        <button className="btn pri" disabled={ocupado}>{ocupado ? 'Un momento…' : modo === 'setup' ? 'Crear administrador' : 'Ingresar'}</button>
      </form>
    </div>
  );
}
