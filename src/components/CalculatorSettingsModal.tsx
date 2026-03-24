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
    const savedArr = localFormula[arrKey] || [];
    const globalSource = type === 'macro' ? globalMacros : globalMicros;
    
    const isSelected = savedArr.some(p => p.id === productId);
    
    if (isSelected) {
      // Deselect -> remove from array
      setLocalFormula({ 
        ...localFormula, 
        [arrKey]: savedArr.filter(p => p.id !== productId) 
      });
    } else {
      // Select -> add to array
      const globalP = globalSource.find(p => p.id === productId);
      if (globalP) {
        setLocalFormula({ 
          ...localFormula, 
          [arrKey]: [
            ...savedArr, 
            { 
              ...globalP, 
              selected: true, 
              minQty: globalP.minQuantity || 0,
              maxQty: 0,
              quantity: 0
            }
          ] 
        });
      }
    }
  };

  const handleConfirm = () => {
    if (localFormula) {
      onConfirm(localFormula);
    }
    onClose();
  };

  const renderProducts = (f: TargetFormula, type: 'macro' | 'micro') => {
    const savedProducts = type === 'macro' ? (f.macros || []) : (f.micros || []);
    const globalSource = type === 'macro' ? globalMacros : globalMicros;
    
    // Map all global products to show them all, but inject state if they are selected
    const currentProducts = globalSource.map(globalP => {
      const savedP = savedProducts.find(s => s.id === globalP.id);
      return savedP ? savedP : { ...globalP, selected: false, minQty: 0, maxQty: 0, quantity: 0 };
    });

    const filtered = currentProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
        {filtered.map(p => (
          <div 
            key={p.id}
            className={`p-3 rounded-lg border transition-colors flex flex-col ${
              p.selected 
                ? 'bg-blue-50 border-blue-500' 
                : 'bg-white border-stone-200 hover:border-blue-300'
            }`}
          >
            {/* Header / Selection Toggle */}
            <div 
              className="flex items-start gap-3 cursor-pointer" 
              onClick={() => handleSelectProduct(p.id, type)}
            >
              <div className="mt-1">
                <input 
                  type="checkbox" 
                  checked={!!p.selected} 
                  readOnly 
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <div className={`text-sm font-medium ${p.selected ? 'text-blue-800' : 'text-stone-700'}`}>
                  {p.name}
                </div>
                <div className="text-xs opacity-70 mt-1 pb-2">
                  {type === 'macro' 
                    ? `N: ${p.n}% | P: ${p.p}% | K: ${p.k}%` 
                    : `Garantias: ${p.microGuarantees?.length ? p.microGuarantees.map((g: any) => `${g.name} ${g.value}%`).join(', ') : 'N/A'}`}
                </div>
              </div>
            </div>
            
            {/* Extended Input Fields */}
            {p.selected && (
              <div className="mt-2 pt-3 border-t border-blue-200/50 flex flex-wrap gap-2 text-xs">
                <div className="flex flex-col flex-1 min-w-[30%]">
                  <label className="text-stone-500 font-semibold mb-1">Mínimo (kg)</label>
                  <input
                    type="number"
                    value={p.minQty === 0 && p.minQuantity === 0 ? '' : p.minQty}
                    onChange={(e) => {
                      if (!localFormula) return;
                      const val = Number(e.target.value);
                      const arrKey = type === 'macro' ? 'macros' : 'micros';
                      setLocalFormula({
                        ...localFormula,
                        [arrKey]: localFormula[arrKey].map(m => m.id === p.id ? { ...m, minQty: val } : m)
                      });
                    }}
                    placeholder={`Ex: ${p.minQuantity || 0}`}
                    min={0}
                    className="w-full px-2 py-1.5 border border-blue-300 rounded focus:outline-none focus:border-blue-500 bg-white text-stone-800"
                  />
                </div>
                
                <div className="flex flex-col flex-1 min-w-[30%]">
                  <label className="text-stone-500 font-semibold mb-1">Máximo (kg)</label>
                  <input
                    type="number"
                    value={p.maxQty === 0 ? '' : p.maxQty}
                    onChange={(e) => {
                      if (!localFormula) return;
                      const val = Number(e.target.value);
                      const arrKey = type === 'macro' ? 'macros' : 'micros';
                      setLocalFormula({
                        ...localFormula,
                        [arrKey]: localFormula[arrKey].map(m => m.id === p.id ? { ...m, maxQty: val } : m)
                      });
                    }}
                    placeholder="Sem Limite"
                    min={0}
                    className="w-full px-2 py-1.5 border border-blue-300 rounded focus:outline-none focus:border-blue-500 bg-white text-stone-800"
                  />
                </div>
                
                <div className="flex flex-col flex-1 min-w-[30%]">
                  <label className="text-stone-500 font-semibold mb-1">Fixo (kg)</label>
                  <input
                    type="number"
                    value={(p.minQty === p.maxQty && p.minQty > 0) ? p.minQty : ''}
                    onChange={(e) => {
                      if (!localFormula) return;
                      const val = Number(e.target.value);
                      const arrKey = type === 'macro' ? 'macros' : 'micros';
                      setLocalFormula({
                        ...localFormula,
                        [arrKey]: localFormula[arrKey].map(m => m.id === p.id ? { ...m, minQty: val, maxQty: val } : m)
                      });
                    }}
                    placeholder="Auto"
                    min={0}
                    className="w-full px-2 py-1.5 border border-blue-300 rounded focus:outline-none focus:border-blue-500 bg-white text-stone-800"
                    title="Preencher isso força a usar exatamente essa quantidade (iguala min e max)"
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
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h2 className="text-xl font-bold text-stone-800">Produtos da Fórmula</h2>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-50">
            <X size={20} />
          </button>
        </div>

        {/* Filters/Tabs */}
        <div className="p-4 border-b border-stone-100 flex gap-4">
          <button
            onClick={() => setActiveTab('macros')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'macros' ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Matérias-Primas (Macro)
          </button>
          <button
            onClick={() => setActiveTab('micros')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'micros' ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Micronutrientes
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-stone-50/50">
          {!localFormula ? (
            <div className="text-center text-stone-500 py-8">Nenhuma fórmula selecionada.</div>
          ) : (
            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
              <h3 className="font-semibold text-stone-800 border-b border-stone-100 pb-3 mb-4 flex justify-between items-center">
                <span>
                  Configurando Fórmula: <span className="text-blue-600">{localFormula.formula || 'Sem nome'}</span>
                </span>
                <span className="text-xs font-normal text-stone-500 hidden sm:block">
                  Selecione os produtos e defina suas restrições (Mín/Máx/Fixo)
                </span>
              </h3>
              {renderProducts(localFormula, activeTab === 'macros' ? 'macro' : 'micro')}
            </div>
          )}
        </div>

        {/* Footer */}
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
