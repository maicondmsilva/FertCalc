import { useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const solver = require('javascript-lp-solver') as {
  Solve: (model: Record<string, unknown>) => Record<string, unknown>;
};

type FormulaResult = Record<string, unknown>;

const useCalculatorFormulas = () => {
  const [calculations, setCalculations] = useState<FormulaResult[]>([]);

  const calculateFormula = (formulaParams: Record<string, unknown>): FormulaResult => {
    // Using LP solver to calculate optimal formula composition
    const results = solver.Solve(formulaParams);
    setCalculations((prev) => [...prev, results]);
    return results;
  };

  return {
    calculations,
    calculateFormula,
  };
};

export default useCalculatorFormulas;
