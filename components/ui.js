'use client';
import { useEffect, useRef, useState } from 'react';
import { P, M } from '../lib/formato';

const AVC = ['#e3141b', '#2a78d6', '#1baf7a', '#f5a700', '#7c4dff', '#d55181', '#0f8a8a', '#8a5a00'];
export const avColor = (n = '') => AVC[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AVC.length];
export const iniciales = (n = '') => n.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();

export function Avatar({ nombre, size = 28 }) {
  return (
    <div className="av" style={{ width: size, height: size, fontSize: size * 0.38, background: avColor(nombre) }}>
      {iniciales(nombre)}
    </div>
  );
}

export function LogoEmp({ emp }) {
  if (emp === 'voltaje') return <span className="lg-emp v" title="Voltaje"><i className="lgv" /></span>;
  if (emp === 'iluma') return <span className="lg-emp i" title="Iluma"><i className="lgi" /></span>;
  return null;
}

export function Semaforo({ p, style }) {
  if (!isFinite(p)) return <span className="pill eq" style={style}>—</span>;
  if (p < 0.3) return <span className="pill ok" style={style}>● {P(p)}</span>;
  if (p <= 0.5) return <span className="pill warn" style={style}>▲ {P(p)}</span>;
  return <span className="pill bad" style={style}>■ {P(p)}</span>;
}

export function Delta({ a, b }) {
  if (b == null) return <span className="pill eq">primera semana</span>;
  const d = a - b;
  if (Math.abs(d) < 1) return <span className="pill eq">= sin cambios</span>;
  const p = b ? Math.abs(d / b) : 0;
  return <span className={'pill ' + (d > 0 ? 'bad' : 'ok')}>{d > 0 ? '▲' : '▼'} {M(Math.abs(d))} · {P(p)}</span>;
}

export function Sparkline({ serie, color }) {
  if (!serie || serie.length < 2) return null;
  const mx = Math.max(...serie), mn = Math.min(...serie);
  const x = (i) => 2 + (i * 80) / (serie.length - 1);
  const y = (v) => (mx === mn ? 17 : 30 - ((v - mn) / (mx - mn)) * 26);
  const pts = serie.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 84 34">
      <path d={`M2 34 L${pts.replace(/ /g, ' L')} L82 34Z`} fill={color} opacity=".12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(serie.length - 1)} cy={y(serie[serie.length - 1])} r="3" fill={color} />
    </svg>
  );
}

// Numero que se anima al cambiar
export function Contador({ valor }) {
  const [v, setV] = useState(valor);
  const desde = useRef(valor);
  useEffect(() => {
    const a = desde.current, b = valor, t0 = performance.now();
    let id;
    const paso = (t) => {
      const k = Math.min((t - t0) / 500, 1), e = 1 - Math.pow(1 - k, 3);
      setV(a + (b - a) * e);
      if (k < 1) id = requestAnimationFrame(paso); else desde.current = b;
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [valor]);
  return <>{M(v)}</>;
}

export const IC = {
  saldo: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20" /></svg>,
  venc: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  bolt: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>,
  dash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></svg>,
  cli: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>,
  sin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>,
  det: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>,
  carga: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>,
  usr: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  cfg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
};
