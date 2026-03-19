import { useState } from 'react';

const usePricingFactors = () => {
    const [client, setClient] = useState(null);
    const [agent, setAgent] = useState(null);
    const [calculationParameters, setCalculationParameters] = useState({});

    const updateClient = (newClient) => {
        setClient(newClient);
    };

    const updateAgent = (newAgent) => {
        setAgent(newAgent);
    };

    const updateCalculationParameters = (newParams) => {
        setCalculationParameters(prevParams => ({
            ...prevParams,
            ...newParams
        }));
    };

    return { client, agent, calculationParameters, updateClient, updateAgent, updateCalculationParameters };
};

export default usePricingFactors;