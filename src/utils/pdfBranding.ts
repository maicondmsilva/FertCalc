import type { jsPDF } from 'jspdf';
import type { AppSettings } from '../types';

interface LogoBox {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
}

/**
 * Desenha o logo da empresa (Configurações > Personalização) dentro da área
 * indicada, mantendo a proporção original. Retorna a largura usada (0 sem logo
 * ou se a imagem não puder ser lida), para posicionar o texto ao lado.
 */
export function drawCompanyLogo(
  doc: jsPDF,
  settings: Pick<AppSettings, 'companyLogo'> | null | undefined,
  box: LogoBox
): number {
  const logo = settings?.companyLogo;
  if (!logo) return 0;
  try {
    const properties = doc.getImageProperties(logo);
    const ratio =
      properties.width > 0 && properties.height > 0
        ? properties.width / properties.height
        : box.maxWidth / box.maxHeight;
    const width = Math.min(box.maxWidth, box.maxHeight * ratio);
    const height = width / ratio;
    const format = /image\/jpe?g/i.test(logo) ? 'JPEG' : 'PNG';
    doc.addImage(
      logo,
      format,
      box.x,
      box.y + (box.maxHeight - height) / 2,
      width,
      height,
      undefined,
      'FAST'
    );
    return width;
  } catch {
    return 0;
  }
}
