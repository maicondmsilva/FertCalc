import { describe, expect, it, vi } from 'vitest';
import { saveOrSharePdf } from './pdfDelivery';

describe('entrega de PDF', () => {
  it('mantém o download como alternativa universal', async () => {
    const document = {
      output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
      save: vi.fn(),
    };
    const result = await saveOrSharePdf(document as never, 'proposta.pdf');

    expect(result).toBe('downloaded');
    expect(document.save).toHaveBeenCalledWith('proposta.pdf');
  });
});
