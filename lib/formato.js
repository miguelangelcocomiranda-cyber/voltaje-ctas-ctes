export const M = (v) =>
  '$ ' + ((v || 0) / 1e6).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' M';

export const P = (v) =>
  isFinite(v) ? (v * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '—';

export const F = (v) => '$ ' + Math.round(v || 0).toLocaleString('es-AR');

export const fecha = (iso) => {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

export const venc = (r) => Number(r.t30_60) + Number(r.t60_90) + Number(r.t90_mas);

export function sumar(filas) {
  const o = { saldo: 0, t1: 0, t2: 0, t3: 0, n: filas.length };
  filas.forEach((r) => {
    o.saldo += Number(r.saldo_total);
    o.t1 += Number(r.t30_60);
    o.t2 += Number(r.t60_90);
    o.t3 += Number(r.t90_mas);
  });
  o.venc = o.t1 + o.t2 + o.t3;
  o.aldia = o.saldo - o.venc;
  return o;
}
