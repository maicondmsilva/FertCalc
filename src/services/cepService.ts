import { supabase } from './supabase';
import { lookupCEP } from '../utils/formatters';
import { logger } from '../utils/logger';

export interface EnderecoCep {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

/**
 * Busca o endereço pelo CEP. Primeiro pela função do servidor (buscar-cep), que
 * consulta vários serviços sem depender do navegador; se ela falhar, consulta os
 * serviços diretamente. null = CEP não encontrado.
 */
export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const { data, error } = await supabase.functions.invoke('buscar-cep', {
      body: { cep: digits },
    });
    if (!error && data && 'endereco' in data) {
      return (data.endereco as EnderecoCep | null) ?? null;
    }
    logger.warn('[cepService] função buscar-cep falhou; usando busca direta', error);
  } catch (error) {
    logger.warn('[cepService] função buscar-cep indisponível; usando busca direta', error);
  }
  return lookupCEP(digits);
}
