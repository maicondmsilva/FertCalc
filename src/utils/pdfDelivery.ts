import type jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';

export type PdfDeliveryResult = 'shared' | 'downloaded' | 'cancelled';

interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: { mobile?: boolean };
}

/**
 * O painel de compartilhamento só faz sentido no celular e no app. No computador
 * (ex.: Chrome no Windows) ele abre o painel do sistema em vez de baixar o arquivo.
 */
export function shouldSharePdf(): boolean {
  if (typeof navigator === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // Fora do app nativo o Capacitor pode não estar disponível.
  }
  const userAgentDataMobile = (navigator as NavigatorWithUserAgentData).userAgentData?.mobile;
  if (typeof userAgentDataMobile === 'boolean') return userAgentDataMobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

export async function saveOrSharePdf(
  document: jsPDF,
  fileName: string,
  title = 'Documento FertCalc'
): Promise<PdfDeliveryResult> {
  const canShareFiles =
    shouldSharePdf() &&
    typeof File !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';

  if (canShareFiles) {
    const file = new File([document.output('blob')], fileName, { type: 'application/pdf' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return 'shared';
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      }
    }
  }

  document.save(fileName);
  return 'downloaded';
}
