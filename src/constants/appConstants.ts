export const CURRENCIES = ['BRL', 'USD'] as const;

export const DEFAULT_PRICING_FACTORS = {
  factor: 1,
  discount: 0,
  margin: 0,
  freight: 0,
};

export const PRICING_STATUS = ['Em Andamento', 'Fechada', 'Perdida'] as const;
export const APPROVAL_STATUS = ['Pendente', 'Aprovada', 'Reprovada'] as const;

export const VALIDATION = {
  maxMaterials: 200,
  minPrice: 0,
  maxPrice: 100000,
};