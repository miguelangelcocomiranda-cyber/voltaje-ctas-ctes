'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, traerTodo, api } from '../lib/supabase';
import { fecha } from '../lib/formato';
import Acceso from '../components/Acceso';
import Filtros, { FILTROS_INICIALES, filtrar } from '../components/Filtros';
import Dashboard from '../components/Dashboard';
import Clientes from '../components/Clientes';
import SinAsignar from '../components/SinAsignar';
import Cargar from '../components/Cargar';
import Usuarios from '../components/Usuarios';
import Configuracion from '../components/Configuracion';

export default function Inicio() {
  const [estado, setEstado] = useState('cargando'); // cargando | setup | login | app | error
  const [errorInicio, setErrorInicio] = useState('');
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api('/api/setup');
        if (r.necesitaSetup) return setEstado('setup');
      } catch (e) {
        setErrorInicio(e.message);
        return setEstado('error');
      }
      const { data } = await supabase.auth.getSession();
      setSesion(data.session);
      setEstado(data.session ? 'app' : 'login');
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSesion(s);
      if (!s) setEstado((x) => (x === 'setup' ? x : 'login'));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sesion) return setPerfil(null);
    supabase.from('perfiles').select('*').eq('id', sesion.user.id).single().then(({ data }) => setPerfil(data));
  }, [sesion]);

  if (estado === 'cargando') return <div className="center muted">Cargando…</div>;
  if (estado === 'error') return <div className="center"><div className="err">{errorInicio}</div></div>;
  if (estado === 'setup' || estado === 'login')
    return <Acceso modo={estado} onListo={() => setEstado('app')} onSetupHecho={() => setEstado('login')} />;
  if (!sesion || !perfil) return <div className="center muted">Cargando…</div>;
  return <App perfil={perfil} />;
}

function App({ perfil }) {
  const admin = perfil.rol === 'admin';
  const [tab, setTab] = useState('dash');
  const [informes, setInformes] = useState([]);
  const [selId, setSelId] = useState(null);
  const [filas, setFilas] = useState([]);
  const [filasPrev, setFilasPrev] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [config, setConfig] = useState({});
  const [hist, setHist] = useState([]);
  const [S, setS] = useState(FILTROS_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarBase = useCallback(async () => {
    try {
      const [inf, ven, cli, cfg, h] = await Promise.all([
        supabase.from('informes').select('*').order('fecha_corte', { ascending: false }),
        supabase.from('vendedores').select('*').order('nombre'),
        traerTodo(() => supabase.from('clientes').select('*').order('codigo')),
        supabase.from('configuracion').select('*'),
        traerTodo(() => supabase.from('v_historial').select('*').order('fecha_corte')),
      ]);
      if (inf.error) throw inf.error;
      setInformes(inf.data);
      setVendedores(ven.data || []);
      setClientes(cli);
      setConfig(Object.fromEntries((cfg.data || []).map((c) => [c.clave, c.valor])));
      setHist(h);
      setSelId((id) => (id && inf.data.some((i) => i.id === id) ? id : inf.data[0]?.id ?? null));
    } catch (e) {
      setError('Error cargando datos: ' + e.message);
    }
  }, []);

  useEffect(() => { cargarBase(); }, [cargarBase]);

  const sel = informes.find((i) => i.id === selId);
  const prev = sel ? informes.find((i) => i.fecha_corte < sel.fecha_corte) : null;

  const cargarFilas = useCallback(async () => {
    if (!selId) { setFilas([]); setFilasPrev([]); setCargando(false); return; }
    setCargando(true);
    try {
      const f = await traerTodo(() => supabase.from('informe_filas').select('*').eq('informe_id', selId).order('saldo_total', { ascending: false }));
      setFilas(f);
      if (prev) {
        const p = await traerTodo(() => supabase.from('informe_filas').select('*').eq('informe_id', prev.id));
        setFilasPrev(p);
      } else setFilasPrev([]);
    } catch (e) {
      setError('Error cargando el informe: ' + e.message);
    }
    setCargando(false);
  }, [selId, prev?.id]);

  useEffect(() => { cargarFilas(); }, [cargarFilas]);

  const recargar = useCallback(async () => { await cargarBase(); await cargarFilas(); }, [cargarBase, cargarFilas]);

  const canje = useMemo(() => new Set(clientes.filter((c) => c.canje).map((c) => c.codigo)), [clientes]);
  const asignadas = useMemo(() => filas.filter((f) => f.vendedor), [filas]);
  const asignadasPrev = useMemo(() => filasPrev.filter((f) => f.vendedor), [filasPrev]);
  const sinAsignar = useMemo(() => filas.filter((f) => !f.vendedor), [filas]);

  const vista = filtrar(asignadas, S, canje);
  const vistaPrev = prev ? filtrar(asignadasPrev, S, canje) : null;

  const tabs = [
    ['dash', 'Dashboard'],
    ['cli', 'Clientes'],
    ...(admin
      ? [['sin', `Sin asignar (${sinAsignar.length})`], ['carga', 'Cargar semana'], ['usr', 'Usuarios'], ['cfg', 'Configuración']]
      : []),
  ];
  const conFiltros = tab === 'dash' || tab === 'cli';

  return (
    <>
      <header>
        <div className="logo">VOLTAJE <b>·</b> ILUMA &nbsp;<span>Cuentas Corrientes</span></div>
        <nav>
          {tabs.map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <div className="user">
          {perfil.nombre || perfil.email} · {admin ? 'Admin' : 'Solo lectura'}
          <button onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>
      {conFiltros && informes.length > 0 && (
        <Filtros S={S} setS={setS} informes={informes} selId={selId} setSelId={setSelId} filas={asignadas} />
      )}
      <main>
        {error && <div className="err">{error}</div>}
        {informes.length === 0 && tab !== 'carga' && tab !== 'usr' && tab !== 'cfg' && (
          <div className="card">Todavía no hay informes cargados. {admin ? 'Andá a "Cargar semana".' : ''}</div>
        )}
        {informes.length > 0 && cargando && conFiltros && <div className="muted">Cargando informe…</div>}
        {!cargando && sel && tab === 'dash' && (
          <Dashboard
            vista={vista} vistaPrev={vistaPrev} asignadas={asignadas} asignadasPrev={asignadasPrev}
            S={S} setS={setS} canje={canje} hist={hist} sel={sel} prev={prev}
          />
        )}
        {!cargando && sel && tab === 'cli' && (
          <Clientes
            vista={vista} admin={admin} canje={canje} vendedores={vendedores} clientes={clientes}
            sel={sel} recargar={recargar}
          />
        )}
        {admin && tab === 'sin' && sel && (
          <SinAsignar filas={sinAsignar} vendedores={vendedores} clientes={clientes} sel={sel} recargar={recargar} />
        )}
        {admin && tab === 'carga' && (
          <Cargar informes={informes} recargar={recargar} alTerminar={() => { setTab('dash'); }} setSelId={setSelId} perfil={perfil} />
        )}
        {admin && tab === 'usr' && <Usuarios perfil={perfil} />}
        {admin && tab === 'cfg' && (
          <Configuracion
            vendedores={vendedores} clientes={clientes} config={config} informes={informes} recargar={recargar}
          />
        )}
        <div className="muted" style={{ fontSize: 11, marginTop: 20 }}>
          {sel ? `Informe del ${fecha(sel.fecha_corte)}${prev ? ` · comparado con ${fecha(prev.fecha_corte)}` : ''}` : ''}
        </div>
      </main>
    </>
  );
}
