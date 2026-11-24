import { describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { drawCompanyLogo } from './pdfBranding';
import { SAMPLE_LOGO } from './__fixtures__/sampleLogo';

describe('logo da empresa no PDF', () => {
  it('sem logo não desenha nada', () => {
    const doc = new jsPDF();
    expect(
      drawCompanyLogo(doc, { companyLogo: '' }, { x: 10, y: 10, maxWidth: 45, maxHeight: 18 })
    ).toBe(0);
  });

  it('mantém a proporção da imagem dentro da área', () => {
    const doc = new jsPDF();
    const spy = vi.spyOn(doc, 'addImage');
    const width = drawCompanyLogo(
      doc,
      { companyLogo: SAMPLE_LOGO },
      { x: 10, y: 10, maxWidth: 45, maxHeight: 18 }
    );
    const props = doc.getImageProperties(SAMPLE_LOGO);
    const [, , , , w, h] = spy.mock.calls[0] as unknown as number[];
    expect(width).toBe(w);
    expect(w).toBeLessThanOrEqual(45);
    expect(h).toBeLessThanOrEqual(18);
    expect(w / h).toBeCloseTo(props.width / props.height, 5);
  });

  it('imagem inválida não quebra o PDF', () => {
    const doc = new jsPDF();
    expect(
      drawCompanyLogo(
        doc,
        { companyLogo: 'data:image/png;base64,xxx' },
        { x: 0, y: 0, maxWidth: 10, maxHeight: 10 }
      )
    ).toBe(0);
  });
});
