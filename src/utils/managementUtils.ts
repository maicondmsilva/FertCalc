import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Indicador, Categoria } from '../types';

// Utility for tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Visual ID generation ---
export const CATEGORIA_PREFIXOS: Record<string, string> = {
  Faturamento: 'f',
  Carregamento: 'c',
  Rentabilidade: 'r',
  Cancelamentos: 'n',
  'Entrada de Pedidos': 'e',
  'Carteira de Pedidos': 't',
  Produção: 'p',
};

export function gerarPrefixoCategoria(categoriaNome: string, prefixosUsados: Set<string>): string {
  const padrao = CATEGORIA_PREFIXOS[categoriaNome];
  if (padrao && !prefixosUsados.has(padrao)) return padrao;

  const nome = categoriaNome.toLowerCase().replace(/\s/g, '');
  for (const char of nome) {
    if (/[a-z]/.test(char) && !prefixosUsados.has(char)) return char;
  }
  // Last resort: find any unused letter a-z
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(97 + i);
    if (!prefixosUsados.has(c)) return c;
  }
  return 'x';
}

export function gerarIdsVisuais(
  indicadores: Indicador[],
  categorias: Categoria[]
): { visualIdMap: Record<string, string>; reverseVisualIdMap: Record<string, string> } {
  const visualIdMap: Record<string, string> = {};
  const reverseVisualIdMap: Record<string, string> = {};
  const prefixosUsados = new Set<string>();

  const categoriaPrefixo: Record<string, string> = {};
  [...categorias]
    .sort((a, b) => a.ordem - b.ordem)
    .forEach((cat) => {
      const prefixo = gerarPrefixoCategoria(cat.nome, prefixosUsados);
      categoriaPrefixo[cat.nome] = prefixo;
      prefixosUsados.add(prefixo);
    });

  const contadores: Record<string, number> = {};
  [...indicadores]
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .forEach((ind) => {
      const prefixo = categoriaPrefixo[ind.categoria] || 'x';
      contadores[prefixo] = (contadores[prefixo] || 0) + 1;
      const visualId = `${prefixo}${contadores[prefixo]}`;
      visualIdMap[ind.id] = visualId;
      reverseVisualIdMap[visualId] = ind.id;
    });

  return { visualIdMap, reverseVisualIdMap };
}
