import { useState, useCallback } from 'react';
import { RawMaterial } from '../types';

const generateId = (prefix = 'm') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const useMaterialManagement = (initial: { macros?: RawMaterial[]; micros?: RawMaterial[] } = {}) => {
  const [macros, setMacros] = useState<RawMaterial[]>(initial.macros || []);
  const [micros, setMicros] = useState<RawMaterial[]>(initial.micros || []);

  const addMacro = useCallback((m?: Partial<RawMaterial>) => {
    const newM: RawMaterial = {
      id: generateId('macro'),
      type: 'macro',
      name: m?.name || '',
      price: m?.price ?? 0,
      n: m?.n ?? 0,
      p: m?.p ?? 0,
      k: m?.k ?? 0,
      s: m?.s ?? 0,
      ca: m?.ca ?? 0,
      microGuarantees: m?.microGuarantees || [],
      minQty: m?.minQty ?? 0,
      maxQty: m?.maxQty ?? 0,
      selected: m?.selected ?? false,
      quantity: m?.quantity ?? 0,
      isPremiumLine: m?.isPremiumLine ?? false,
    };
    setMacros((prev) => [...prev, newM]);
    return newM;
  }, []);

  const updateMacro = useCallback((id: string, patch: Partial<RawMaterial>) => {
    setMacros((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const removeMacro = useCallback((id: string) => {
    setMacros((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const addMicro = useCallback((m?: Partial<RawMaterial>) => {
    const newM: RawMaterial = {
      id: generateId('micro'),
      type: 'micro',
      name: m?.name || '',
      price: m?.price ?? 0,
      n: 0,
      p: 0,
      k: 0,
      s: 0,
      ca: 0,
      microGuarantees: m?.microGuarantees || [],
      minQty: m?.minQty ?? 0,
      maxQty: m?.maxQty ?? 0,
      selected: m?.selected ?? false,
      quantity: m?.quantity ?? 0,
      isPremiumLine: m?.isPremiumLine ?? false,
    };
    setMicros((prev) => [...prev, newM]);
    return newM;
  }, []);

  const updateMicro = useCallback((id: string, patch: Partial<RawMaterial>) => {
    setMicros((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const removeMicro = useCallback((id: string) => {
    setMicros((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const bulkUpdateMacros = useCallback((patches: Array<{ id: string; patch: Partial<RawMaterial> }>) => {
    setMacros((prev) => prev.map((m) => {
      const p = patches.find((x) => x.id === m.id);
      return p ? { ...m, ...p.patch } : m;
    }));
  }, []);

  const bulkUpdateMicros = useCallback((patches: Array<{ id: string; patch: Partial<RawMaterial> }>) => {
    setMicros((prev) => prev.map((m) => {
      const p = patches.find((x) => x.id === m.id);
      return p ? { ...m, ...p.patch } : m;
    }));
  }, []);

  return {
    macros,
    micros,
    addMacro,
    updateMacro,
    removeMacro,
    addMicro,
    updateMicro,
    removeMicro,
    bulkUpdateMacros,
    bulkUpdateMicros,
  };
};

export default useMaterialManagement;