import { venc, fecha } from './formato';

export async function descargarExcel(filas, canje, fechaCorte) {
  const XLSX = await import('xlsx');
  const datos = filas.map((r) => ({
    'Código': r.codigo,
    'Razon Social': r.razon_social,
    'Saldo Total': Number(r.saldo_total),
    'Saldo Vencido': venc(r),
    'Responsable': r.vendedor || 'SIN ASIGNAR',
    'Empresa': r.empresa || '',
    '30-60dias': Number(r.t30_60),
    '60-90dias': Number(r.t60_90),
    'Mas de 90 dias': Number(r.t90_mas),
    'Canje': canje.has(r.codigo) ? 'SI' : '',
  }));
  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 7 }];
  const rango = XLSX.utils.decode_range(ws['!ref']);
  for (let R = 1; R <= rango.e.r; R++) {
    for (const C of [2, 3, 6, 7, 8]) {
      const cel = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cel) cel.z = '#,##0';
    }
  }
  ws['!autofilter'] = { ref: ws['!ref'] };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ctas Ctes');
  XLSX.writeFile(wb, `Ctas Ctes ${fecha(fechaCorte).replace(/\//g, '-')}.xlsx`);
}
