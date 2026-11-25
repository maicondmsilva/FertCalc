/** Remove caracteres com significado no filtro do PostgREST (vírgula, parênteses, curingas). */
export const sanitizePricingSearchTerm = (term: string) =>
  term
    .replace(/[,()*%\\:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
