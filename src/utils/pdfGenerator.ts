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
    'padding: 10mm 14mm 8mm',
    'color: #1a1a2e',
    'background: #ffffff',
    'box-sizing: border-box',
    'font-size: 11px',
    'line-height: 1.5',
  ].join(';');

  const cod = record.cod ? String(record.cod).padStart(4, '0') : record.id.slice(-8).toUpperCase();
  const dateStr = record.date ? new Date(record.date).toLocaleDateString('pt-BR') : '';

  // Formulas / calcs
  const calcs = record.calculations && record.calculations.length > 0
    ? record.calculations.filter(c => c.selected || true)
    : [];

  // Compute grand totals
  const grandTotal = calcs.reduce((s, c) => s + (c.summary?.totalSaleValue || 0), 0);
  const totalTons = calcs.reduce((s, c) => s + (c.factors?.totalTons || 0), 0);

  // DueDate from factors
  const dueDate = record.factors?.dueDate
    ? new Date(record.factors.dueDate).toLocaleDateString('pt-BR')
    : '—';

  const agentName = record.factors?.agent?.name || '—';
  const clientName = record.factors?.client?.name || '—';
  const clientIE = record.factors?.client?.stateRegistration || '—';
  const clientFazenda = record.factors?.client?.fazenda || '';
  const freight = record.factors?.freight ?? 0;
  const obs = record.factors?.commercialObservation || '—';
  const terms = settings.pricingTerms || '—';

  const freightLabel = freight > 0 ? `CIF (${fmt(freight)})` : 'FOB';

  el.innerHTML = `
    <!-- HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1a1a2e;padding-bottom:8px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${settings.companyLogo
      ? `<img src="${settings.companyLogo}" style="max-height:44px;max-width:120px;object-fit:contain;" />`
      : `<div style="width:44px;height:44px;background:#1a1a2e;border-radius:8px;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:18px;font-weight:900;">${(settings.companyName || 'E')[0]}</span></div>`}
        <div>
          <div style="font-size:16px;font-weight:900;color:#1a1a2e;letter-spacing:-0.5px;">${settings.companyName || 'EMPRESA'}</div>
          ${settings.companyCnpj ? `<div style="font-size:10px;color:#555;">CNPJ: ${settings.companyCnpj}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px;font-weight:900;color:#1a1a2e;letter-spacing:1px;">PROPOSTA COMERCIAL</div>
        <div style="display:flex;gap:20px;justify-content:flex-end;margin-top:4px;">
          <div style="background:#f0f4f8;border-radius:6px;padding:4px 12px;text-align:center;">
            <div style="font-size:9px;color:#888;text-transform:uppercase;font-weight:700;">COD</div>
            <div style="font-size:14px;font-weight:900;color:#1a1a2e;">#${cod}</div>
          </div>
          <div style="background:#f0f4f8;border-radius:6px;padding:4px 12px;text-align:center;">
            <div style="font-size:9px;color:#888;text-transform:uppercase;font-weight:700;">Data</div>
            <div style="font-size:12px;font-weight:700;color:#1a1a2e;">${dateStr}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- CLIENTE / AGENTE INFO -->
    <div style="display:grid;grid-template-columns:${showAgent ? '1fr 1fr' : '1fr'};gap:12px;margin-bottom:10px;">
      <div style="background:#f9fafb;border-radius:8px;padding:8px 12px;border-left:4px solid #1a1a2e;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#888;margin-bottom:6px;letter-spacing:0.5px;">Cliente</div>
        <div style="font-size:13px;font-weight:700;color:#1a1a2e;">${clientName}</div>
        ${clientFazenda ? `<div style="font-size:10px;color:#555;">🌿 ${clientFazenda}</div>` : ''}
        <div style="font-size:10px;color:#555;margin-top:2px;">IE: ${clientIE}</div>
      </div>
      ${showAgent ? `
      <div style="background:#f9fafb;border-radius:8px;padding:8px 12px;border-left:4px solid #4a90d9;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#888;margin-bottom:6px;letter-spacing:0.5px;">Representante</div>
        <div style="font-size:13px;font-weight:700;color:#1a1a2e;">${agentName}</div>
        <div style="font-size:10px;color:#555;margin-top:2px;"></div>
      </div>` : ''}
    </div>

    <!-- FRETE / VENCIMENTO INFO -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:10px;">
      <div style="background:#f0f4f8;border-radius:8px;padding:8px 12px;text-align:center;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#888;margin-bottom:4px;letter-spacing:0.5px;">Tipo de Frete</div>
        <div style="font-size:13px;font-weight:700;color:#1a1a2e;">${freightLabel}</div>
      </div>
      <div style="background:#f0f4f8;border-radius:8px;padding:8px 12px;text-align:center;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#888;margin-bottom:4px;letter-spacing:0.5px;">Valor do Frete</div>
        <div style="font-size:13px;font-weight:700;color:#1a1a2e;">${freight > 0 ? fmt(freight) + '/ton' : '—'}</div>
      </div>
      <div style="background:#f0f4f8;border-radius:8px;padding:8px 12px;text-align:center;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#888;margin-bottom:4px;letter-spacing:0.5px;">Vencimento</div>
        <div style="font-size:13px;font-weight:700;color:#1a1a2e;">${dueDate}</div>
      </div>
    </div>

    <!-- PRODUTOS TABLE -->
    <div style="margin-bottom:10px;">
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#888;letter-spacing:0.5px;margin-bottom:6px;">Produtos / Formulações</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#1a1a2e;color:#fff;">
            <th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:700;border-radius:0;">Produto / Fórmula</th>
            <th style="padding:6px 8px;text-align:center;font-size:10px;font-weight:700;">Qtd. (ton)</th>
            <th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:700;">Preço/ton</th>
            <th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:700;">Frete/ton</th>
            <th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:700;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${calcs.length > 0
      ? calcs.map((calc, i) => `
              <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};border-bottom:1px solid #eee;">
                <td style="padding:6px 8px;font-weight:600;font-size:11px;color:#1a1a2e;">${calc.formula || record.factors?.targetFormula || '—'}</td>
                <td style="padding:6px 8px;text-align:center;font-size:11px;font-weight:700;">${fmtN(calc.factors?.totalTons || 0)}</td>
                <td style="padding:6px 8px;text-align:right;font-size:11px;">${fmt(calc.summary?.finalPrice || 0)}</td>
                <td style="padding:6px 8px;text-align:right;font-size:11px;">${fmt(freight)}</td>
                <td style="padding:6px 8px;text-align:right;font-weight:700;font-size:11px;">${fmt(calc.summary?.totalSaleValue || 0)}</td>
              </tr>`).join('')
      : `<tr><td colspan="5" style="padding:16px;text-align:center;color:#aaa;font-style:italic;">Nenhuma fórmula calculada</td></tr>`}
          <tr style="background:#1a1a2e;color:#fff;">
            <td style="padding:6px 8px;font-weight:800;font-size:11px;" colspan="2">TOTAL GERAL</td>
            <td style="padding:6px 8px;text-align:center;font-weight:800;font-size:11px;">${fmtN(totalTons)} ton</td>
            <td style="padding:6px 8px;"></td>
            <td style="padding:6px 8px;text-align:right;font-weight:900;font-size:13px;">${fmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- OBSERVAÇÃO COMERCIAL -->
    <div style="margin-bottom:10px;">
      <div style="background:#fffbeb;border-radius:8px;padding:10px 14px;border-left:4px solid #f59e0b;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#888;margin-bottom:6px;letter-spacing:0.5px;">Observação Comercial</div>
        <div style="font-size:10px;color:#444;white-space:pre-wrap;">${obs}</div>
      </div>
    </div>

    <!-- TERMOS COMERCIAIS -->
    <div style="background:#f0f4f8;border-radius:8px;padding:8px 12px;border-top:3px solid #1a1a2e;">
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#888;margin-bottom:6px;letter-spacing:0.5px;">Termos e Condições Comerciais</div>
      <div style="font-size:9px;color:#555;white-space:pre-wrap;line-height:1.6;">${terms}</div>
    </div>

    <!-- SIGNATURES -->
    <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:60px;">
      <div style="text-align:center;">
        <div style="border-top:1px solid #000;width:80%;margin:0 auto;padding-top:4px;"> </div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;">${agentName}</div>
        <div style="font-size:9px;color:#888;">Assinatura do Vendedor</div>
      </div>
      <div style="text-align:center;">
        <div style="border-top:1px solid #000;width:80%;margin:0 auto;padding-top:4px;"> </div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;">${clientName}</div>
        <div style="font-size:9px;color:#888;">Assinatura do Cliente</div>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="margin-top:12px;padding-top:8px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:9px;color:#aaa;">Documento gerado automaticamente — ${settings.companyName || ''}</div>
      <div style="font-size:9px;color:#aaa;">COD #${cod} | ${dateStr}</div>
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

    pdf.save(`proposta-${cod}.pdf`);
    document.body.removeChild(el);
  });
};
