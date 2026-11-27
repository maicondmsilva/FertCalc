/** Só aceita links http(s); qualquer outra coisa (javascript:, data:, texto) vira ''. */
export function sanitizeUrl(url?: string | null): string {
  if (!url) return '';
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
  } catch {
    return '';
  }
}
