import { F, fecha, venc } from './formato';

const TR = { aldia: 'Al día', t1: '30-60', t2: '60-90', t3: '+90', cubierta: 'Cubierta', credito: 'A cuenta' };

async function cargarLogo(emp) {
  const url = `/logos/${emp === 'iluma' ? 'iluma' : 'voltaje'}-color.png`;
  const blob = await (await fetch(url)).blob();
  const data = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  const dims = await new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = data; });
  return { data, w: dims[0], h: dims[1] };
}

// Genera y descarga el PDF "Resumen de cuenta" del cliente, con el logo de la empresa del vendedor
export async function descargarPDF({ r, facturas, creditos, fechaCorte }) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const emp = r.empresa || 'voltaje';
  const color = emp === 'iluma' ? [245, 167, 0] : [227, 20, 27];

  // Encabezado
  const logo = await cargarLogo(emp);
  const lh = emp === 'iluma' ? 11 : 14;
  doc.addImage(logo.data, 'PNG', 14, 12, (logo.w / logo.h) * lh, lh);
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(20);
  doc.text('Resumen de cuenta', W - 14, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110);
  doc.text(`Saldo al ${fecha(fechaCorte)}`, W - 14, 24, { align: 'right' });
  doc.setFillColor(...color).rect(14, 30, W - 28, 1.2, 'F');

  // Cliente
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(20).text(r.razon_social, 14, 40);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110)
    .text(`Cliente N° ${r.codigo}${r.vendedor ? '   ·   Vendedor: ' + r.vendedor : ''}`, 14, 46);

  // Cajas de totales
  const impagas = facturas.filter((c) => c.pendiente > 0);
  const aCuenta = -creditos.reduce((a, c) => a + Number(c.importe), 0);
  const cajas = [
    ['Saldo total', F(r.saldo_total)],
    ['Vencido', F(venc(r))],
    ['30-60 / 60-90 / +90', `${F(r.t30_60)} / ${F(r.t60_90)} / ${F(r.t90_mas)}`],
  ];
  const bw = (W - 28 - 8) / 3;
  cajas.forEach(([l, v], i) => {
    const x = 14 + i * (bw + 4);
    doc.setFillColor(246, 246, 244).roundedRect(x, 51, bw, 16, 2, 2, 'F');
    doc.setFontSize(8).setTextColor(120).text(l, x + 3, 56);
    doc.setFont('helvetica', 'bold').setFontSize(i === 2 ? 8.5 : 12).setTextColor(i === 1 ? 200 : 20, i === 1 ? 30 : 20, i === 1 ? 30 : 20).text(v, x + 3, 63);
    doc.setFont('helvetica', 'normal');
  });

  // Facturas pendientes
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20).text('Comprobantes pendientes', 14, 77);
  autoTable(doc, {
    startY: 80,
    head: [['Fecha', 'Comprobante', 'Vencimiento', 'Días', 'Pendiente', 'Estado']],
    body: impagas.sort((a, b) => b.dias - a.dias).map((c) => [fecha(c.fecha), `${c.tipo} ${c.numero}`, fecha(c.vencimiento), c.dias, F(c.pendiente), TR[c.tramo]]),
    foot: [['', '', '', 'Total', F(impagas.reduce((a, c) => a + Number(c.pendiente), 0)), '']],
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 32], textColor: 255 },
    footStyles: { fillColor: [246, 246, 244], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 5) {
        const v = d.cell.raw;
        if (v === '+90') d.cell.styles.textColor = [200, 30, 30];
        if (v === '60-90' || v === '30-60') d.cell.styles.textColor = [42, 120, 214];
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Pagos a cuenta
  if (creditos.length) {
    const y = doc.lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20).text('Pagos y notas de crédito sin imputar (aplicados a lo más antiguo)', 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [['Fecha', 'Comprobante', 'Importe', 'Aplicado a']],
      body: creditos.map((c) => [fecha(c.fecha), `${c.tipo} ${c.numero}`, F(-c.importe), c.detalle ? c.detalle.map((d) => d.n).join(', ') : '—']),
      foot: [['', 'Total', F(aCuenta), '']],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 32], textColor: 255 },
      footStyles: { fillColor: [246, 246, 244], textColor: 20, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' }, 3: { cellWidth: 80 } },
    });
  }

  // Pie
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5).setTextColor(150);
    doc.text(`${emp === 'iluma' ? 'Iluma' : 'Voltaje · materiales eléctricos e iluminación'} · Resumen generado el ${new Date().toLocaleDateString('es-AR')}`, 14, 290);
    doc.text(`Página ${i} de ${n}`, W - 14, 290, { align: 'right' });
  }
  doc.save(`Resumen de cuenta - ${r.razon_social} - ${fecha(fechaCorte).replace(/\//g, '-')}.pdf`);
}
