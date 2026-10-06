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
  const [ver, setVer] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError(''); setOk(''); setOcupado(true);
    try {
      if (modo === 'setup') {
        await api('/api/setup', 'POST', { nombre, email: email.trim().toLowerCase(), password: password.trim() });
        setOk('Administrador creado. Ahora ingresá con tu mail y contraseña.');
        onSetupHecho();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: password.trim() });
        if (error) {
          const m = error.message || '';
          if (m.includes('Invalid login')) throw new Error('Mail o contraseña incorrectos. Escribí la contraseña a mano (sin autocompletar) o pedile al admin que te la cambie.');
          if (m.includes('not confirmed')) throw new Error('El usuario no está confirmado. Pedile al admin que lo vuelva a crear.');
          throw new Error('No se pudo ingresar: ' + m);
        }
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
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="sub">Contraseña {modo === 'setup' && '(mínimo 8 caracteres)'}</label>
        <input type={ver ? 'text' : 'password'} required autoComplete={modo === 'setup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        <label className="sub" style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '-4px 0 10px' }}>
          <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar contraseña
        </label>
        {error && <div className="err">{error}</div>}
        {ok && <div className="ok">{ok}</div>}
        <button className="btn pri" disabled={ocupado}>{ocupado ? 'Un momento…' : modo === 'setup' ? 'Crear administrador' : 'Ingresar'}</button>
      </form>
    </div>
  );
}
