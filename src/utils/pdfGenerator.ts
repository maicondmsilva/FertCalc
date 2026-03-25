import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PricingRecord, AppSettings } from '../types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const generatePricingPDF = (record: PricingRecord, settings: AppSettings, showAgent: boolean = true) => {
  const el = document.createElement('div');
  el.style.cssText = [
    'font-family: "Segoe UI", Arial, sans-serif',
    'width: 297mm',
    'min-height: 210mm',
    'padding: 6mm 12mm 6mm',
    'color: #1a1a2e',
    'background: #ffffff',
    'box-sizing: border-box',
    'font-size: 10px',
    'line-height: 1.3',
  ].join(';');

  const cod = record.cod ? String(record.cod).padStart(4, '0') : record.id.slice(-8).toUpperCase();
  const dateStr = record.date ? new Date(record.date).toLocaleDateString('pt-BR') : '';

  const agentName = record.factors?.agent?.name || '—';
  const clientName = record.factors?.client?.name || '—';
  const clientIE = record.factors?.client?.stateRegistration || '—';
  const clientFazenda = record.factors?.client?.fazenda || '';
  const obs = record.factors?.commercialObservation || '—';

  // Formulas / calcs
  const calcs = record.calculations && record.calculations.length > 0
    ? record.calculations.filter(c => c.selected || true)
    : [];

  const validCalcs = calcs.filter(c => c.summary);

  // Build product rows: ONE ROW PER FORMULA (calculation)
  let productRows = '';
  let grandTotal = 0;

  if (validCalcs.length > 0) {
    validCalcs.forEach((calc, idx) => {
      // DATA HIERARCHY: calc.factors > record.factors
      const fCr = calc.factors || {};
      const fGl = record.factors || {};

      const rowDueDateStr = fCr.dueDate || fGl.dueDate;
      const rowDueDate = rowDueDateStr ? new Date(rowDueDateStr).toLocaleDateString('pt-BR') : '—';
      
      const rowFreightPerTon = fCr.freight ?? fGl.freight ?? 0;
      const rowFreightType = rowFreightPerTon > 0 ? 'CIF' : 'FOB';
      
      const qty = fCr.totalTons || fGl.totalTons || 0;
      const finalPrice = calc.summary?.finalPrice || 0;
      const totalRow = qty * finalPrice;
      grandTotal += totalRow;
      
      const priceWithoutFreight = finalPrice - rowFreightPerTon;
      const totalFreightLine = qty * rowFreightPerTon;

      const bg = idx % 2 === 0 ? '#fff' : '#f9fafb';
      productRows += `
            <tr style="background:${bg};border-bottom:1px solid #1a1a2e20;">
              <td style="padding:8px 6px;font-weight:700;font-size:11px;color:#1a1a2e;">${calc.formula}</td>
              <td style="padding:8px 6px;text-align:center;font-size:10px;color:#1a1a2e;">${rowDueDate}</td>
              <td style="padding:8px 6px;text-align:center;font-size:10px;font-weight:700;color:#1a1a2e;">${rowFreightType}</td>
              <td style="padding:8px 6px;text-align:center;font-size:11px;font-weight:700;">${fmtN(qty)}</td>
              <td style="padding:8px 6px;text-align:right;font-size:10px;">${fmt(totalFreightLine)}</td>
              <td style="padding:8px 6px;text-align:right;font-size:10px;">${fmt(priceWithoutFreight)}</td>
              <td style="padding:8px 6px;text-align:right;font-size:10px;">${fmt(rowFreightPerTon)}</td>
              <td style="padding:8px 6px;text-align:right;font-weight:800;font-size:11px;color:#1a1a2e;background:#f0f4f8;">${fmt(totalRow)}</td>
            </tr>`;
    });
  }

  if (productRows === '') {
    productRows = `<tr><td colspan="8" style="padding:24px;text-align:center;color:#aaa;font-style:italic;">Nenhum produto calculado</td></tr>`;
  }

  el.innerHTML = `
    <!-- HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a1a2e;padding-bottom:10px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:15px;">
        ${settings.companyLogo
      ? `<img src="${settings.companyLogo}" style="max-height:50px;max-width:150px;object-fit:contain;" />`
      : `<div style="width:45px;height:45px;background:#1a1a2e;border-radius:10px;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:22px;font-weight:900;">${(settings.companyName || 'E')[0]}</span></div>`}
        <div>
          <div style="font-size:18px;font-weight:900;color:#1a1a2e;letter-spacing:-0.5px;line-height:1;">${settings.companyName || 'EMPRESA'}</div>
          ${settings.companyCnpj ? `<div style="font-size:10px;color:#555;margin-top:4px;">CNPJ: ${settings.companyCnpj}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px;font-weight:950;color:#1a1a2e;letter-spacing:1px;margin-bottom:6px;">PROPOSTA COMERCIAL SIMPLIFICADA</div>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <div style="background:#f0f4f8;border-radius:6px;padding:4px 12px;text-align:center;border:1px solid #d1d9e6;">
            <span style="font-size:8px;color:#666;text-transform:uppercase;font-weight:700;display:block;margin-bottom:1px;">COD</span>
            <span style="font-size:13px;font-weight:900;color:#1a1a2e;">#${cod}</span>
          </div>
          <div style="background:#f0f4f8;border-radius:6px;padding:4px 12px;text-align:center;border:1px solid #d1d9e6;">
            <span style="font-size:8px;color:#666;text-transform:uppercase;font-weight:700;display:block;margin-bottom:1px;">Data</span>
            <span style="font-size:13px;font-weight:900;color:#1a1a2e;">${dateStr}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- CLIENTE / AGENTE INFO -->
    <div style="display:grid;grid-template-columns:${showAgent ? '1.2fr 0.8fr' : '1fr'};gap:10px;margin-bottom:12px;">
      <div style="background:#f9fafb;border-radius:10px;padding:12px 15px;border:1px solid #e5e7eb;border-left:6px solid #1a1a2e;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#666;margin-bottom:3px;letter-spacing:0.5px;">Informações do Cliente</div>
        <div style="font-size:16px;font-weight:950;color:#1a1a2e;">${clientName}</div>
        <div style="display:flex;gap:20px;margin-top:6px;">
          ${clientFazenda ? `<div style="font-size:11px;color:#444;"><span style="color:#888;font-weight:600;">Fazenda:</span> ${clientFazenda}</div>` : ''}
          <div style="font-size:11px;color:#444;"><span style="color:#888;font-weight:600;">IE:</span> ${clientIE}</div>
        </div>
      </div>
      ${showAgent ? `
      <div style="background:#f9fafb;border-radius:10px;padding:12px 15px;border:1px solid #e5e7eb;border-left:6px solid #4a90d9;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#666;margin-bottom:3px;letter-spacing:0.5px;">Representante Comercial</div>
        <div style="font-size:14px;font-weight:800;color:#1a1a2e;">${agentName}</div>
      </div>` : ''}
    </div>

    <!-- PRODUTOS TABLE -->
    <div style="margin-bottom:15px;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #1a1a2e;">
        <thead>
          <tr style="background:#1a1a2e;color:#fff;">
            <th style="padding:8px 6px;text-align:left;font-size:10px;text-transform:uppercase;">Produto (Formulação)</th>
            <th style="padding:8px 6px;text-align:center;font-size:10px;text-transform:uppercase;">Vencimento</th>
            <th style="padding:8px 6px;text-align:center;font-size:10px;text-transform:uppercase;">Tipo Frete</th>
            <th style="padding:8px 6px;text-align:center;font-size:10px;text-transform:uppercase;">Qtd (ton)</th>
            <th style="padding:8px 6px;text-align:right;font-size:10px;text-transform:uppercase;">Valor Frete</th>
            <th style="padding:8px 6px;text-align:right;font-size:10px;text-transform:uppercase;">Preço/Ton</th>
            <th style="padding:8px 6px;text-align:right;font-size:10px;text-transform:uppercase;">Frete/Ton</th>
            <th style="padding:8px 6px;text-align:right;font-size:11px;text-transform:uppercase;background:#0f172a;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
          <tr style="background:#f8fafc;border-top:2px solid #1a1a2e;">
            <td style="padding:10px 8px;font-weight:900;font-size:13px;color:#1a1a2e;" colspan="7">VALOR TOTAL DA COMPRA</td>
            <td style="padding:10px 8px;text-align:right;font-weight:900;font-size:14px;color:#fff;background:#1a1a2e;">${fmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- OBSERVAÇÃO COMERCIAL -->
    <div style="margin-bottom:15px;flex-grow:1;">
      <div style="background:#fffbeb;border-radius:12px;padding:18px;border:1px solid #fde68a;border-left:8px solid #f59e0b;min-height:120px;">
        <div style="font-size:11px;font-weight:900;text-transform:uppercase;color:#b45309;margin-bottom:10px;letter-spacing:1px;border-bottom:1px solid #fef3c7;padding-bottom:5px;">Observações Comerciais e Condições</div>
        <div style="font-size:13px;color:#451a03;white-space:pre-wrap;line-height:1.6;font-weight:500;">${obs}</div>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div style="margin-top:15px;display:grid;grid-template-columns:1fr 1fr;gap:50px;padding:0 30px;">
      <div style="text-align:center;">
        <div style="border-top:1.5px solid #000;width:90%;margin:0 auto;padding-top:6px;"> </div>
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;">${agentName}</div>
        <div style="font-size:10px;color:#888;">Assinatura do Vendedor</div>
      </div>
      <div style="text-align:center;">
        <div style="border-top:1.5px solid #000;width:90%;margin:0 auto;padding-top:6px;"> </div>
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;">${clientName}</div>
        <div style="font-size:10px;color:#888;">Assinatura do Cliente</div>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:10px;color:#aaa;">Documento gerado automaticamente pelo FertCalc — ${settings.companyName || ''}</div>
      <div style="font-size:10px;color:#aaa;">COD #${cod} | ${dateStr}</div>
    </div>
  `;

  document.body.appendChild(el);

  html2canvas(el, { scale: 2, useCORS: true, allowTaint: true }).then((canvas) => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4'); // landscape
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    const imgH = pageW / ratio;

    if (imgH <= pageH) {
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH);
    } else {
      // Multi-page
      let yOffset = 0;
      const pageImgH = pageH;
      const srcH = (pageH / pageW) * canvas.width;
      let page = 0;
      while (yOffset < canvas.height) {
        if (page > 0) pdf.addPage();
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(srcH, canvas.height - yOffset);
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageImgH);
        yOffset += srcH;
        page++;
      }
    }

    pdf.save(`proposta-simplificada-${cod}.pdf`);
    document.body.removeChild(el);
  });
};
