import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { TargetFormula, RawMaterial } from '../types';

interface CalculatorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  formula: TargetFormula | null;
  globalMacros: RawMaterial[];
  globalMicros: RawMaterial[];
  onConfirm: (updatedFormula: TargetFormula) => void;
}

export const CalculatorSettingsModal: React.FC<CalculatorSettingsModalProps> = ({
  isOpen,
  onClose,
  formula,
  globalMacros,
  globalMicros,
  onConfirm
}) => {
  const [activeTab, setActiveTab] = useState<'macros' | 'micros'>('macros');
  const [localFormula, setLocalFormula] = useState<TargetFormula | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen && formula) {
      setLocalFormula(JSON.parse(JSON.stringify(formula)));
      setSearch('');
      setActiveTab('macros');
    }
  }, [isOpen, formula]);

  if (!isOpen) return null;

  const handleSelectProduct = (productId: string, type: 'macro' | 'micro') => {
    if (!localFormula) return;
    
    const arrKey = type === 'macro' ? 'macros' : 'micros';
    const products = localFormula[arrKey].length > 0 ? localFormula[arrKey] : (type === 'macro' ? globalMacros : globalMicros);
    
    const updatedArr = products.map(p => 
      p.id === productId ? { 
        ...p, 
        selected: !p.selected, 
        minQty: !p.selected ? (p.minQuantity || 0) : (p.minQty || 0),
        quantity: !p.selected ? (p.minQuantity || 0) : (p.quantity || 0) 
      } : p
    );
    
    setLocalFormula({ ...localFormula, [arrKey]: updatedArr });
  };

  const handleConfirm = () => {
    if (localFormula) {
      onConfirm(localFormula);
    }
    onClose();
  };

  const renderProducts = (f: TargetFormula, type: 'macro' | 'micro') => {
    const products = type === 'macro' ? f.macros : f.micros;
    const globalSource = type === 'macro' ? globalMacros : globalMicros;
    
    const currentProducts = products.length > 0 ? products : globalSource;
    const filtered = currentProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        {filtered.map(p => (
          <div 
            key={p.id}
            onClick={() => handleSelectProduct(p.id, type)}
            className={`p-3 rounded-lg border cursor-pointer transition-colors flex flex-col justify-between ${
              p.selected 
                ? 'bg-blue-50 border-blue-500 text-blue-700' 
                : 'bg-white border-stone-200 text-stone-600 hover:border-blue-300'
            }`}
          >
            <div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs opacity-70 mt-1">
                {type === 'macro' 
                  ? `N: ${p.n}% | P: ${p.p}% | K: ${p.k}%` 
                  : `Garantias: ${p.microGuarantees?.length ? p.microGuarantees.map((g: any) => `${g.name} ${g.value}%`).join(', ') : 'N/A'}`}
              </div>
            </div>
            {p.selected && (
              <div className="mt-3 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs font-semibold">Qtd Mín. (kg):</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={p.quantity === 0 ? '' : p.quantity}
                    onChange={(e) => {
                      if (!localFormula) return;
                      const val = Number(e.target.value);
                      const arrKey = type === 'macro' ? 'macros' : 'micros';
                      const updatedArr = localFormula[arrKey].map((m: any) =>
                        m.id === p.id ? { ...m, quantity: val, minQty: val } : m
                      );
                      setLocalFormula({ ...localFormula, [arrKey]: updatedArr });
                    }}
                    placeholder={`Mín: ${p.minQuantity || 0}`}
                    min={0}
                    className="w-20 px-2 py-1 border border-blue-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h2 className="text-xl font-bold text-stone-800">Configurações de Produtos</h2>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-50">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-stone-100 flex gap-4">
          <button
            onClick={() => setActiveTab('macros')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'macros' ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Macros
          </button>
          <button
            onClick={() => setActiveTab('micros')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'micros' ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Micros
          </button>
          
          <div className="ml-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-stone-50/50">
          {!localFormula ? (
            <div className="text-center text-stone-500 py-8">Nenhuma fórmula encontrada.</div>
          ) : (
            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
              <h3 className="font-semibold text-stone-800 border-b border-stone-100 pb-3 mb-4">
                Fórmula: <span className="text-blue-600">{localFormula.formula || 'Sem nome'}</span>
              </h3>
              {renderProducts(localFormula, activeTab === 'macros' ? 'macro' : 'micro')}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-stone-100 flex justify-end gap-3 bg-white rounded-b-xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 border border-transparent transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
          >
            Confirmar Seleção
          </button>
        </div>
      </div>
    </div>
  );
};
