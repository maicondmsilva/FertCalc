export const LOGO_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const LOGO_MAX_FILE_BYTES = 2 * 1024 * 1024;
/** Maior lado da imagem salva: suficiente para tela e PDF, sem pesar no carregamento. */
export const LOGO_MAX_DIMENSION = 600;

/** Retorna a mensagem de erro, ou null se o arquivo pode ser usado. */
export function validateLogoFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!LOGO_ACCEPTED_TYPES.includes(file.type))
    return 'Use uma imagem PNG, JPG ou WEBP. SVG e outros formatos não aparecem nos PDFs.';
  if (file.size > LOGO_MAX_FILE_BYTES) return 'A imagem deve ter no máximo 2 MB.';
  return null;
}

export function fitWithin(width: number, height: number, max = LOGO_MAX_DIMENSION) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });

/**
 * Lê a logo e reduz para no máximo 600 px no maior lado, em PNG (mantém a
 * transparência). A logo é carregada em todas as telas e PDFs, por isso fica leve.
 */
export async function prepareLogo(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  const image = await new Promise<InstanceType<typeof window.Image>>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
    img.src = original;
  });
  const size = fitWithin(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return original;
  context.drawImage(image, 0, 0, size.width, size.height);
  return canvas.toDataURL('image/png');
}
