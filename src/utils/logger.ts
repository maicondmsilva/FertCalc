/**
 * FertCalc Pro — Logger utilitário
 *
 * Em produção (import.meta.env.PROD), console.log e console.warn são silenciados.
 * console.error sempre é emitido para capturar falhas reais.
 *
 * Uso:
 *   import { logger } from '../utils/logger';
 *   logger.log('carregou', data);
 *   logger.warn('atenção', value);
 *   logger.error('falha crítica', err);
 */

/* eslint-disable no-console */

const isDev = import.meta.env.DEV;

export const logger = {
  // Informações de debug — só aparecem em desenvolvimento
  log: (...args: unknown[]): void => {
    if (isDev) console.log(...args);
  },

  // Avisos — só aparecem em desenvolvimento
  warn: (...args: unknown[]): void => {
    if (isDev) console.warn(...args);
  },

  // Erros reais — sempre emitidos (produção + desenvolvimento)
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
