import { useState, useCallback } from 'react';
import { PricingFactors, Client, Agent } from '../types';

const defaultFactors: PricingFactors = {
  targetFormula: '00-00-00',
  factor: 1,
  discount: 0,
  margin: 0,
  freight: 0,
  tipoFrete: 'CIF',
  taxRate: 0,
  commission: 0,
  monthlyInterestRate: 0,
  dueDate: '',
  exemptCurrentMonth: false,
  client: { id: '', code: '', name: '', document: '' },
  agent: { id: '', code: '', name: '', document: '' },
  branchId: '',
  priceListId: '',
  totalTons: 0,
};

const usePricingFactors = (initial?: Partial<PricingFactors>) => {
  const [factors, setFactors] = useState<PricingFactors>({ ...defaultFactors, ...(initial || {}) });

  const updateFactor = useCallback(
    (patch: Partial<PricingFactors>) => setFactors((prev) => ({ ...prev, ...patch })),
    []
  );
  const setClient = useCallback((c: Client) => setFactors((prev) => ({ ...prev, client: c })), []);
  const setAgent = useCallback((a: Agent) => setFactors((prev) => ({ ...prev, agent: a })), []);
  const resetFactors = useCallback(() => setFactors({ ...defaultFactors }), []);

  return { factors, updateFactor, setClient, setAgent, resetFactors };
};

export default usePricingFactors;
