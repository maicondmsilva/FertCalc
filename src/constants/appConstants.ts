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

export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export const PEDIDO_VENDA_STATUS = [
  'pendente',
  'em_carregamento',
  'concluido',
  'cancelado',
] as const;
