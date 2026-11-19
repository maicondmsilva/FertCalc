import { afterEach, describe, expect, it, vi } from 'vitest';
import type jsPDF from 'jspdf';
import { saveOrSharePdf, shouldSharePdf } from './pdfDelivery';

const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

const setUserAgent = (value: string) =>
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(value);

const fakePdf = () =>
  ({
    output: vi.fn(() => new Blob(['%PDF'], { type: 'application/pdf' })),
    save: vi.fn(),
  }) as unknown as jsPDF & { save: ReturnType<typeof vi.fn> };

const share = vi.fn();
const canShare = vi.fn(() => true);

afterEach(() => {
  vi.restoreAllMocks();
  share.mockReset();
  Reflect.deleteProperty(window.navigator, 'share');
  Reflect.deleteProperty(window.navigator, 'canShare');
});

const enableWebShare = () => {
  Object.defineProperty(window.navigator, 'share', { value: share, configurable: true });
  Object.defineProperty(window.navigator, 'canShare', { value: canShare, configurable: true });
};

describe('entrega do PDF', () => {
  it('baixa direto no computador mesmo quando o navegador oferece compartilhar', async () => {
    setUserAgent(WINDOWS_CHROME);
    enableWebShare();
    const pdf = fakePdf();

    await expect(saveOrSharePdf(pdf, 'proposta.pdf')).resolves.toBe('downloaded');

    expect(shouldSharePdf()).toBe(false);
    expect(share).not.toHaveBeenCalled();
    expect(pdf.save).toHaveBeenCalledWith('proposta.pdf');
  });

  it('usa o compartilhamento no celular', async () => {
    setUserAgent(ANDROID_CHROME);
    enableWebShare();
    share.mockResolvedValue(undefined);
    const pdf = fakePdf();

    await expect(saveOrSharePdf(pdf, 'proposta.pdf')).resolves.toBe('shared');
    expect(pdf.save).not.toHaveBeenCalled();
  });

  it('baixa no celular quando o compartilhamento não existe', async () => {
    setUserAgent(ANDROID_CHROME);
    const pdf = fakePdf();

    await expect(saveOrSharePdf(pdf, 'proposta.pdf')).resolves.toBe('downloaded');
    expect(pdf.save).toHaveBeenCalled();
  });
});
