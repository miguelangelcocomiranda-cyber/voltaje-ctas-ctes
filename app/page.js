'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, traerTodo, api } from '../lib/supabase';
import { fecha } from '../lib/formato';
import { descargarExcel } from '../lib/excel';
import Acceso from '../components/Acceso';
import Filtros, { FILTROS_INICIALES, filtrar } from '../components/Filtros';
import Dashboard from '../components/Dashboard';
import Clientes from '../components/Clientes';
import SinAsignar from '../components/SinAsignar';
import Cargar from '../components/Cargar';
import Usuarios from '../components/Usuarios';
import Configuracion from '../components/Configuracion';
import { IC, avColor, iniciales } from '../components/ui';

export default function Inicio() {
  const [estado, setEstado] = useState('cargando');
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
      if (!s) setEstado((x) => (x === 'setup' || x === 'cargando' || x === 'error' ? x : 'login'));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sesion) return setPerfil(null);
    supabase.from('perfiles').select('*').eq('id', sesion.user.id).single().then(({ data }) => setPerfil(data));
  }, [sesion]);

  if (estado === 'cargando') return <div className="center"><div className="skel" style={{ width: 360, height: 220 }} /></div>;
  if (estado === 'error') return <div className="center"><div className="err">{errorInicio}</div></div>;
  if (estado === 'setup' || estado === 'login')
    return <Acceso modo={estado} onListo={() => setEstado('app')} onSetupHecho={() => setEstado('login')} />;
  if (!sesion || !perfil) return <div className="center"><div className="skel" style={{ width: 360, height: 220 }} /></div>;
  return <App perfil={perfil} />;
}

const TITULOS = { dash: 'Dashboard', cli: 'Clientes', sin: 'Sin asignar', carga: 'Cargar semana', usr: 'Usuarios', cfg: 'Configuración' };

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
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => { setOscuro(document.documentElement.dataset.theme === 'dark'); }, []);
  const cambiarTema = () => {
    const n = !oscuro;
    setOscuro(n);
    document.documentElement.dataset.theme = n ? 'dark' : 'light';
    try { localStorage.setItem('tema', n ? 'dark' : 'light'); } catch (e) {}
  };

  const cargarBase = useCallback(async () => {
    try {
      const [inf, ven, cli, cfg, h] = await Promise.all([
        supabase.from('informes').select('*').order('fecha_corte', { ascending: false }),
        supabase.from('vendedores').select('*').order('nombre'),
        traerTodo(() => supabase.from('clientes').select('*').order('codigo')),
        supabase.from('configuracion').select('*'),
        // historial: todas las filas con vendedor de todas las semanas (para evolucion y mini graficos)
        traerTodo(() => supabase.from('informe_filas')
          .select('id,informe_id,codigo,razon_social,empresa,vendedor,saldo_total,saldo_vencido,t30_60,t60_90,t90_mas')
          .not('vendedor', 'is', null).order('id')).catch(() => []),
      ]);
      if (inf.error) throw inf.error;
      const fechaDe = Object.fromEntries(inf.data.map((i) => [i.id, i.fecha_corte]));
      h.forEach((r) => (r.fecha_corte = fechaDe[r.informe_id]));
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
      if (prev) setFilasPrev(await traerTodo(() => supabase.from('informe_filas').select('*').eq('informe_id', prev.id)));
      else setFilasPrev([]);
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

  // Vendedores para el filtro: los de la tabla + los que aparezcan en el informe
  const listaVend = useMemo(() => {
    const m = new Map(vendedores.map((v) => [v.nombre, v.empresa]));
    asignadas.forEach((r) => !m.has(r.vendedor) && m.set(r.vendedor, r.empresa));
    const enUso = new Set(asignadas.concat(asignadasPrev).map((r) => r.vendedor));
    return [...m.entries()].filter(([n]) => enUso.has(n)).map(([nombre, empresa]) => ({ nombre, empresa })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [vendedores, asignadas, asignadasPrev]);

  const vista = filtrar(asignadas, S, canje);
  const vistaPrev = prev ? filtrar(asignadasPrev, S, canje) : null;

  const nav = [
    ['dash', IC.dash], ['cli', IC.cli],
    ...(admin ? [['sin', IC.sin], ['carga', IC.carga], ['usr', IC.usr], ['cfg', IC.cfg]] : []),
  ];
  const conFiltros = tab === 'dash' || tab === 'cli';
  const nombre = perfil.nombre || perfil.email;

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <img className="v" src="/logos/voltaje-blanco.png" alt="Voltaje" />
          <div className="x">junto a <img className="i" src="/logos/iluma-blanco.png" alt="Iluma" /></div>
        </div>
        <div className="nav">
          {nav.map(([k, ic]) => (
            <a key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {ic}{TITULOS[k]}
              {k === 'sin' && sinAsignar.length > 0 && <span className="badge">{sinAsignar.length}</span>}
            </a>
          ))}
        </div>
        <div className="me">
          <div className="av" style={{ background: avColor(nombre) }}>{iniciales(nombre)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="n" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{nombre}</div>
            <div className="r">{admin ? 'Administrador' : 'Solo lectura'}</div>
          </div>
          <button onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </aside>
      <main>
        <div className="top">
          <div>
            <h1>{TITULOS[tab]}</h1>
            {sel && <div className="sub">Cuentas corrientes · semana <b>{fecha(sel.fecha_corte)}</b>{prev ? ` · comparado con ${fecha(prev.fecha_corte)}` : ''}</div>}
          </div>
          <div className="r">
            {informes.length > 0 && (
              <select value={selId || ''} onChange={(e) => setSelId(Number(e.target.value))}>
                {informes.map((i) => <option key={i.id} value={i.id}>Semana {fecha(i.fecha_corte)}</option>)}
              </select>
            )}
            <button className="ibtn" onClick={cambiarTema} title="Modo claro / oscuro">{oscuro ? '☀️' : '🌙'}</button>
            {sel && <button className="btn" onClick={() => descargarExcel(vista, canje, sel.fecha_corte)}>⬇ Excel</button>}
          </div>
        </div>
        {error && <div className="err">{error}</div>}
        {conFiltros && informes.length > 0 && <Filtros S={S} setS={setS} listaVend={listaVend} />}

        {informes.length === 0 && !['carga', 'usr', 'cfg'].includes(tab) && (
          <div className="card mt">Todavía no hay informes cargados. {admin ? 'Andá a "Cargar semana".' : ''}</div>
        )}
        {informes.length > 0 && cargando && conFiltros && (
          <div className="grid k5 mt">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="skel" style={{ height: 150 }} />)}</div>
        )}
        <div className="mt">
          {!cargando && sel && tab === 'dash' && (
            <Dashboard vista={vista} vistaPrev={vistaPrev} asignadas={asignadas} asignadasPrev={asignadasPrev}
              S={S} setS={setS} canje={canje} hist={hist} prev={prev} />
          )}
          {!cargando && sel && tab === 'cli' && (
            <Clientes vista={vista} admin={admin} canje={canje} vendedores={vendedores} clientes={clientes} sel={sel} recargar={recargar} />
          )}
          {admin && tab === 'sin' && sel && (
            <SinAsignar filas={sinAsignar} vendedores={vendedores} clientes={clientes} sel={sel} recargar={recargar} />
          )}
          {admin && tab === 'carga' && (
            <Cargar informes={informes} recargar={recargar} alTerminar={() => setTab('dash')} setSelId={setSelId} perfil={perfil} />
          )}
          {admin && tab === 'usr' && <Usuarios perfil={perfil} />}
          {admin && tab === 'cfg' && (
            <Configuracion vendedores={vendedores} clientes={clientes} config={config} informes={informes} recargar={recargar} />
          )}
        </div>
      </main>
    </div>
  );
}
