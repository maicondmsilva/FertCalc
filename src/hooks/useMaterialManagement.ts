import { useState } from 'react';

const useMaterialManagement = () => {
    const [macros, setMacros] = useState([]);
    const [micros, setMicros] = useState([]);

    const addMacro = (macro) => {
        setMacros((prevMacros) => [...prevMacros, macro]);
    };

    const removeMacro = (macroId) => {
        setMacros((prevMacros) => prevMacros.filter(macro => macro.id !== macroId));
    };

    const updateMacro = (updatedMacro) => {
        setMacros((prevMacros) => prevMacros.map(macro => (macro.id === updatedMacro.id ? updatedMacro : macro)));
    };

    const addMicro = (micro) => {
        setMicros((prevMicros) => [...prevMicros, micro]);
    };

    const removeMicro = (microId) => {
        setMicros((prevMicros) => prevMicros.filter(micro => micro.id !== microId));
    };

    const updateMicro = (updatedMicro) => {
        setMicros((prevMicros) => prevMicros.map(micro => (micro.id === updatedMicro.id ? updatedMicro : micro)));
    };

    const bulkUpdateMacros = (updatedMacros) => {
        setMacros((prevMacros) => {
            const macrosMap = Object.fromEntries(updatedMacros.map(m => [m.id, m]));
            return prevMacros.map(macro => macrosMap[macro.id] || macro);
        });
    };

    const bulkUpdateMicros = (updatedMicros) => {
        setMicros((prevMicros) => {
            const microsMap = Object.fromEntries(updatedMicros.map(m => [m.id, m]));
            return prevMicros.map(micro => microsMap[micro.id] || micro);
        });
    };

    return { macros, micros, addMacro, removeMacro, updateMacro, addMicro, removeMicro, updateMicro, bulkUpdateMacros, bulkUpdateMicros };
};

export default useMaterialManagement;