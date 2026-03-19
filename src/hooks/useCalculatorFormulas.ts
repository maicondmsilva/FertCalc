import { useState } from 'react';
import { Solver } from 'javascript-lp-solver';

const useCalculatorFormulas = () => {
    const [calculations, setCalculations] = useState([]);

    const calculateFormula = (formulaParams) => {
        // Example: Using LP solver to calculate results based on params
        const results = Solver.Solve(formulaParams);
        setCalculations((prev) => [...prev, results]);
        return results;
    };

    return {
        calculations,
        calculateFormula,
    };
};

export default useCalculatorFormulas;
