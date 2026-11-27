/** QR code como imagem (data URL PNG), para PDF e tela. */
export async function qrDataUrl(texto: string, tamanho = 240): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(texto, { margin: 1, width: tamanho, errorCorrectionLevel: 'M' });
}
