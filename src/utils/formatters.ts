import { logger } from './logger';

export const formatDocument = (value: string) => {
  const cleanValue = value.replace(/\D/g, '');
  if (cleanValue.length <= 11) {
    return cleanValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  }
  return cleanValue
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const formatPhone = (value: string) => {
  const cleanValue = value.replace(/\D/g, '');
  if (cleanValue.length <= 10) {
    return cleanValue
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  }
  return cleanValue
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

export const formatCEP = (value: string) => {
  const cleanValue = value.replace(/\D/g, '');
  return cleanValue.replace(/(\d{5})(\d{1,3})/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');
};

/** Os serviços de CEP não responderam (rede/serviço fora do ar), diferente de "não encontrado". */
export class CepServiceUnavailableError extends Error {
  constructor() {
    super('Serviço de CEP indisponível');
    this.name = 'CepServiceUnavailableError';
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 4000) {
  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return { answered: response.status < 500, data: null };
    return { answered: true, data: (await response.json()) as Record<string, unknown> };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca direta nos serviços públicos (plano B quando a função do servidor falha).
 * null = CEP não encontrado; CepServiceUnavailableError = nenhum serviço respondeu.
 */
export const lookupCEP = async (cep: string) => {
  const cleanCEP = cep.replace(/\D/g, '');
  if (cleanCEP.length !== 8) return null;

  const providers = [
    {
      url: `https://viacep.com.br/ws/${cleanCEP}/json/`,
      parse: (data: Record<string, unknown>) =>
        data.erro
          ? null
          : {
              street: data.logradouro as string,
              neighborhood: data.bairro as string,
              city: data.localidade as string,
              state: data.uf as string,
            },
    },
    {
      url: `https://brasilapi.com.br/api/cep/v2/${cleanCEP}`,
      parse: (data: Record<string, unknown>) =>
        data.city
          ? {
              street: data.street as string,
              neighborhood: data.neighborhood as string,
              city: data.city as string,
              state: data.state as string,
            }
          : null,
    },
  ];

  let anyAnswered = false;
  for (const provider of providers) {
    try {
      const { answered, data } = await fetchJsonWithTimeout(provider.url);
      anyAnswered = anyAnswered || answered;
      const result = data ? provider.parse(data) : null;
      if (result?.city) return result;
    } catch (error) {
      logger.warn(`CEP lookup failed for ${provider.url}:`, error);
    }
  }

  if (!anyAnswered) throw new CepServiceUnavailableError();
  return null;
};

/**
 * Garantia exibida: corta nas casas decimais pedidas, sem arredondar para cima,
 * para nunca mostrar mais nutriente do que a mistura realmente entrega.
 * O pequeno ajuste evita que 24,999999 (precisão do otimizador) apareça como 24,99.
 */
export const truncateGuarantee = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  // Tolera imprecisões de até 0,000001 ponto (do otimizador e de ponto flutuante).
  return Math.floor((Number(value) || 0) * factor + 1e-4) / factor;
};

/** Garantia formatada em pt-BR com casas fixas e sem arredondar para cima. */
export const formatGuarantee = (value: number | undefined, decimals = 2): string =>
  truncateGuarantee(Number(value) || 0, decimals).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const formatNPK = (
  targetFormula: string,
  resultingN: number,
  resultingP: number,
  resultingK: number
) => {
  const parts = targetFormula.split(/[- ]/);
  const tN = parts[0] || '0';
  const tP = parts[1] || '0';
  const tK = parts[2] || '0';

  const formatPart = (targetPart: string, val: number) => {
    // Garantia real: corta na 2ª casa, nunca arredonda para cima (5,9548 → 5,95).
    const truncated = truncateGuarantee(val);
    if (Number.isInteger(truncated)) {
      if (Number(targetPart) === truncated) return targetPart;
      return truncated.toString();
    }
    return truncated.toString().replace('.', ',');
  };

  return `${formatPart(tN, resultingN)}-${formatPart(tP, resultingP)}-${formatPart(tK, resultingK)}`;
};
