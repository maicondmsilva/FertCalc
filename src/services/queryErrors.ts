/**
 * Para consultas que mostram lista vazia quando falham: registra o erro no
 * console (antes era descartado e a tela ficava vazia sem explicação).
 */
export function emptyOnError<T>(error: unknown, context?: string): T[] {
  if (error) console.error(`[consulta${context ? `: ${context}` : ''}]`, error);
  return [];
}
