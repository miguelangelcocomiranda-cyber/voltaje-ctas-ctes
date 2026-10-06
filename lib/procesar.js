import * as XLSX from 'xlsx';

// ---------------------------------------------------------------
// Lee el "Deuda Total de Cliente Detallado" de Flexxus (.XLS)
// Devuelve { fechaCorte: 'AAAA-MM-DD', clientes: [{codigo, razon_social, docs:[...]}] }
// ---------------------------------------------------------------
const reFecha = /^(\d{2})\/(\d{2})\/(\d{4})/;

function aNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/,/g, '');
  if (s === '' || s === '-') return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function aFecha(v) {
  const m = String(v || '').trim().match(reFecha);
  if (!m) return null;
  return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
}

export function leerDetallado(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

  let fechaCorte = null;
  const clientes = new Map();
  let actual = null;

  for (let i = 0; i < filas.length; i++) {
    const r = filas[i].map((c) => (typeof c === 'string' ? c : c));
    const c0 = String(r[0] ?? '').trim();

    // Fecha de corte: "Hasta la Fecha:" | 05/10/2026
    if (!fechaCorte) {
      const idx = r.findIndex((c) => String(c).includes('Hasta la Fecha'));
      if (idx >= 0) {
        const f = aFecha(r[idx + 1]);
        if (f) fechaCorte = f;
      }
    }

    // Linea despues de "Cliente:" => codigo - razon social
    if (i > 0 && String(filas[i - 1][0] ?? '').trim() === 'Cliente:') {
      const codigo = parseInt(String(r[0]).trim(), 10);
      const razon = String(r[2] ?? '').trim();
      if (!isNaN(codigo)) {
        if (!clientes.has(codigo)) clientes.set(codigo, { codigo, razon_social: razon, docs: [] });
        actual = clientes.get(codigo);
      }
      continue;
    }

    // Linea de comprobante: empieza con fecha dd/mm/aaaa hh:mm:ss
    if (actual && reFecha.test(c0) && String(r[4] ?? '').trim() !== '') {
      const fechaDoc = aFecha(c0);
      const venc = aFecha(r[2]) || fechaDoc;
      const monto = aNumero(r[6]);
      const pagado = aNumero(r[8]) ?? 0;
      let debe = aNumero(r[10]);
      if (debe === null) debe = aNumero(r[11]);
      if (debe === null) debe = aNumero(r[12]);
      if (debe === null && monto !== null) debe = monto - pagado;
      if (debe === null) continue;
      actual.docs.push({
        fecha: fechaDoc,
        venc,
        tipo: String(r[4]).trim(),
        numero: String(r[5] ?? '').trim(),
        debe,
      });
    }
  }

  if (!fechaCorte) throw new Error('No encontré la "Hasta la Fecha" en el archivo. ¿Es el Deuda Total de Cliente Detallado?');
  if (clientes.size === 0) throw new Error('No encontré clientes en el archivo. ¿Es el Deuda Total de Cliente Detallado?');

  return { fechaCorte: fechaCorte.toISOString().slice(0, 10), clientes: [...clientes.values()] };
}

// ---------------------------------------------------------------
// Calcula saldo, vencido y tramos aplicando recibos/NC sin imputar
// a la deuda mas vieja primero (FIFO). Devuelve tambien el detalle
// comprobante por comprobante (para la pestaña Composicion de deuda)
// ---------------------------------------------------------------
const r2 = (x) => Math.round(x * 100) / 100;
const iso = (d) => (d ? d.toISOString().slice(0, 10) : null);

export function calcularCliente(docs, fechaCorteISO, diasVencido = 30) {
  const corte = new Date(fechaCorteISO + 'T00:00:00Z');
  const ordenados = [...docs].sort((a, b) => a.fecha - b.fecha || a.venc - b.venc);
  const saldo = ordenados.reduce((a, d) => a + d.debe, 0);
  const creditos = ordenados.filter((d) => d.debe < 0).map((d) => ({ d, libre: -d.debe, usos: [] }));
  const t = { t30_60: 0, t60_90: 0, t90_mas: 0 };
  const detalle = [];
  let ic = 0;

  for (const d of ordenados) {
    if (d.debe <= 0) continue;
    let pendiente = d.debe;
    const cubiertoPor = [];
    while (pendiente > 0.005 && ic < creditos.length) {
      const c = creditos[ic];
      const usa = Math.min(pendiente, c.libre);
      if (usa > 0.005) {
        pendiente -= usa; c.libre -= usa;
        cubiertoPor.push({ n: `${c.d.tipo} ${c.d.numero}`, m: r2(usa) });
        c.usos.push({ n: `${d.tipo} ${d.numero}`, m: r2(usa) });
      }
      if (c.libre <= 0.005) ic++;
    }
    const dias = Math.floor((corte - d.fecha) / 86400000);
    let tramo = 'cubierta';
    if (pendiente > 0.005) {
      if (dias >= diasVencido + 60) { t.t90_mas += pendiente; tramo = 't3'; }
      else if (dias >= diasVencido + 30) { t.t60_90 += pendiente; tramo = 't2'; }
      else if (dias >= diasVencido) { t.t30_60 += pendiente; tramo = 't1'; }
      else tramo = 'aldia';
    } else pendiente = 0;
    detalle.push({
      fecha: iso(d.fecha), vencimiento: iso(d.venc), tipo: d.tipo, numero: d.numero,
      importe: r2(d.debe), aplicado: r2(d.debe - pendiente), pendiente: r2(pendiente),
      dias, tramo, detalle: cubiertoPor.length ? cubiertoPor : null,
    });
  }
  for (const c of creditos) {
    const dias = Math.floor((corte - c.d.fecha) / 86400000);
    detalle.push({
      fecha: iso(c.d.fecha), vencimiento: iso(c.d.venc), tipo: c.d.tipo, numero: c.d.numero,
      importe: r2(c.d.debe), aplicado: r2(-c.d.debe - c.libre), pendiente: r2(-c.libre),
      dias, tramo: 'credito', detalle: c.usos.length ? c.usos : null,
    });
  }
  return {
    saldo_total: r2(saldo),
    t30_60: r2(t.t30_60),
    t60_90: r2(t.t60_90),
    t90_mas: r2(t.t90_mas),
    saldo_vencido: r2(t.t30_60 + t.t60_90 + t.t90_mas),
    detalle,
  };
}

// ---------------------------------------------------------------
// Arma el informe completo aplicando reglas de configuracion
// ---------------------------------------------------------------
export function armarInforme({ leido, config, clientesDB, vendedores }) {
  const patron = (config.patron_exclusion || '').trim().toUpperCase();
  const minimo = Number(config.saldo_minimo || 0);
  const dias = Number(config.dias_vencido || 30);
  const porCodigo = new Map(clientesDB.map((c) => [c.codigo, c]));
  // Respaldo: si Flexxus cambio el codigo, buscamos por razon social identica
  const porNombre = new Map(clientesDB.filter((c) => c.razon_social).map((c) => [c.razon_social.trim().toUpperCase(), c]));
  const venPorId = new Map(vendedores.map((v) => [v.id, v]));

  const filas = [];
  const comprobantes = [];
  const nuevos = [];
  const excluidos = { regla: 0, manual: 0, minimo: 0 };

  for (const c of leido.clientes) {
    const { detalle, ...calc } = calcularCliente(c.docs, leido.fechaCorte, dias);
    const porCod = porCodigo.get(c.codigo);
    const db = porCod || porNombre.get(c.razon_social.trim().toUpperCase());

    if (calc.saldo_total <= minimo) { excluidos.minimo++; continue; }
    const inclusion = db?.inclusion || 'auto';
    if (inclusion === 'excluir') { excluidos.manual++; continue; }
    if (inclusion !== 'incluir' && patron && c.razon_social.toUpperCase().includes(patron)) { excluidos.regla++; continue; }

    const v = db?.vendedor_id ? venPorId.get(db.vendedor_id) : null;
    // Cliente que no estaba en la base: se guarda (con el vendedor si lo encontramos por nombre)
    if (!porCod) nuevos.push({ codigo: c.codigo, razon_social: c.razon_social, vendedor_id: v ? v.id : null });
    filas.push({
      codigo: c.codigo,
      razon_social: c.razon_social,
      vendedor: v ? v.nombre : null,
      empresa: v ? v.empresa : null,
      ...calc,
    });
    detalle.forEach((d) => comprobantes.push({ codigo: c.codigo, ...d }));
  }
  filas.sort((a, b) => b.saldo_total - a.saldo_total);
  return { filas, comprobantes, nuevos, excluidos };
}
