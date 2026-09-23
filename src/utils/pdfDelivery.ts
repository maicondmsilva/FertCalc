import type jsPDF from 'jspdf';

export type PdfDeliveryResult = 'shared' | 'downloaded' | 'cancelled';

export async function saveOrSharePdf(
  document: jsPDF,
  fileName: string,
  title = 'Documento FertCalc'
): Promise<PdfDeliveryResult> {
  const canShareFiles =
    typeof File !== 'undefined' &&
    typeof navigator !== 'undefined' &&
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
