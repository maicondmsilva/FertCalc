import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Calculator, Check, ArrowRight, Save } from 'lucide-react';
import { getFertigranPFormulas, saveComparisonHistory } from '../services/db';
import { FertigranPFormula, User as AppUser } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  originalFormulaName: string;
  originalN: number;
  originalP: number;
  originalK: number;
  currentUser: AppUser;
}

export function FertigranPComparisonModal({ isOpen, onClose, originalFormulaName, originalN, originalP, originalK, currentUser }: Props) {
  const [hectares, setHectares] = useState<number>(0);
  const [dose, setDose] = useState<number>(0);

  const [reductionN, setReductionN] = useState<number>(0);
  const [reductionP, setReductionP] = useState<number>(0);
  const [reductionK, setReductionK] = useState<number>(0);

  const [formulas, setFormulas] = useState<FertigranPFormula[]>([]);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFormulas();
      setSaveSuccess(false);
    }
  }, [isOpen]);

  const loadFormulas = async () => {
    try {
      const data = await getFertigranPFormulas();
      setFormulas(data);
    } catch (err) {
      console.error('Error loading formulas:', err);
    }
  };

  const selectedFormula = useMemo(() => formulas.find(f => f.id === selectedFormulaId), [formulas, selectedFormulaId]);

  // Calculations
  const originalQuantityTons = (hectares * dose) / 1000;

  // Nutrients supplied per HA by original 
  const suppliedN = dose * (originalN / 100);
  const suppliedP = dose * (originalP / 100);
  const suppliedK = dose * (originalK / 100);

  // Target nutrients per HA after reduction
  const targetN = suppliedN * (1 - reductionN / 100);
  const targetP = suppliedP * (1 - reductionP / 100);
  const targetK = suppliedK * (1 - reductionK / 100);

  let newDose = 0;
  let newQuantityTons = 0;
  let simulatedProvidedN = 0;
  let simulatedProvidedP = 0;
  let simulatedProvidedK = 0;

  let idealNewN = 0;
  let idealNewP = 0;
  let idealNewK = 0;

  if (dose > 0) {
    idealNewN = (targetN / dose) * 100;
    idealNewP = (targetP / dose) * 100;
    idealNewK = (targetK / dose) * 100;
  }

  if (selectedFormula && targetP > 0 && selectedFormula.npk_p > 0) {
    // Calculate new dose based on limiting factor P
    newDose = targetP / (selectedFormula.npk_p / 100);
    newQuantityTons = (newDose * hectares) / 1000;
    simulatedProvidedN = newDose * (selectedFormula.npk_n / 100);
    simulatedProvidedP = newDose * (selectedFormula.npk_p / 100);
    simulatedProvidedK = newDose * (selectedFormula.npk_k / 100);
  }

  const handleSave = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await saveComparisonHistory({
        usuario_id: currentUser.id,
        usuario_nome: currentUser.name,
        formula_original: originalFormulaName || `${originalN}-${originalP}-${originalK}`,
        formula_nova: selectedFormula ? selectedFormula.nome : `${idealNewN.toFixed(1)}-${idealNewP.toFixed(1)}-${idealNewK.toFixed(1)}`,
        hectares,
        dose_original: dose,
        dose_nova: newDose > 0 ? newDose : dose,
        reducoes_aplicadas: { n: reductionN, p: reductionP, k: reductionK }
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving history:', err);
      alert('Erro ao salvar histórico de comparação.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-stone-800">Comparação Fertigran P</h2>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Section 1: Application Data */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-stone-500 uppercase flex items-center gap-2">
              <span className="bg-stone-200 text-stone-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
              Dados de Aplicação
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
              <div className="col-span-1 md:col-span-2">
                <p className="text-xs text-stone-500 font-bold mb-1">Fórmula Original</p>
                <div className="px-3 py-2 bg-white border border-stone-300 rounded-lg font-bold text-stone-700">
                  {originalFormulaName || `${originalN}-${originalP}-${originalK}`}
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone-500 font-bold mb-1">Área (Hectares)</label>
                <input 
                  type="number" 
                  value={hectares === 0 ? '' : hectares}
                  onChange={e => setHectares(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 font-bold mb-1">Dose Original (kg/ha)</label>
                <input 
                  type="number" 
                  value={dose === 0 ? '' : dose}
                  onChange={e => setDose(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <span className="text-sm font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                Volume Original: <span className="text-emerald-700">{originalQuantityTons.toFixed(2)} Toneladas</span>
              </span>
            </div>
          </div>

          {/* Section 2: Reductions */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-emerald-600 uppercase flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
              Parâmetros de Redução
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
              {/* N */}
              <div>
                <label className="block text-xs text-emerald-700 font-bold mb-1">Redução Nitrogênio (N) %</label>
                <input 
                  type="number" 
                  value={reductionN === 0 ? '' : reductionN}
                  onChange={e => setReductionN(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ex: 10"
                />
                <div className="mt-2 text-[10px] text-stone-500">
                  <p>Original: <strong className="text-stone-700">{suppliedN.toFixed(1)} kg/ha</strong></p>
                  <p>Alvo: <strong className="text-emerald-700">{targetN.toFixed(1)} kg/ha</strong></p>
                </div>
              </div>
              {/* P */}
              <div>
                <label className="block text-xs text-emerald-700 font-bold mb-1">Redução Fósforo (P) %</label>
                <input 
                  type="number" 
                  value={reductionP === 0 ? '' : reductionP}
                  onChange={e => setReductionP(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ex: 30"
                />
                <div className="mt-2 text-[10px] text-stone-500">
                  <p>Original: <strong className="text-stone-700">{suppliedP.toFixed(1)} kg/ha</strong></p>
                  <p>Alvo: <strong className="text-emerald-700">{targetP.toFixed(1)} kg/ha</strong></p>
                </div>
              </div>
              {/* K */}
              <div>
                <label className="block text-xs text-emerald-700 font-bold mb-1">Redução Potássio (K) %</label>
                <input 
                  type="number" 
                  value={reductionK === 0 ? '' : reductionK}
                  onChange={e => setReductionK(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ex: 20"
                />
                <div className="mt-2 text-[10px] text-stone-500">
                  <p>Original: <strong className="text-stone-700">{suppliedK.toFixed(1)} kg/ha</strong></p>
                  <p>Alvo: <strong className="text-emerald-700">{targetK.toFixed(1)} kg/ha</strong></p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Fertigran Selection & Results */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-indigo-600 uppercase flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
              Fórmula Fertigran P
            </h3>
            
            <div className="p-4 bg-indigo-50/30 rounded-lg border border-indigo-100 space-y-4">
              <div>
                <label className="block text-xs text-indigo-700 font-bold mb-2">Selecione uma fórmula padrão existente:</label>
                <select
                  value={selectedFormulaId}
                  onChange={e => setSelectedFormulaId(e.target.value)}
                  className="w-full md:w-1/2 px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Fórmula Customizada (Baseada nas reduções)</option>
                  {formulas.map(f => (
                    <option key={f.id} value={f.id}>{f.nome} (N:{f.npk_n} P:{f.npk_p} K:{f.npk_k})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Result Block */}
                <div className="bg-white p-4 rounded-lg border border-indigo-200 shadow-sm">
                  <h4 className="text-xs font-bold text-stone-400 uppercase mb-3 text-center">Resultado Reformulado</h4>
                  
                  {selectedFormulaId ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <span className="text-2xl font-black text-indigo-700">{selectedFormula?.nome}</span>
                        <p className="text-[10px] text-stone-500 mt-1">N:{selectedFormula?.npk_n} P:{selectedFormula?.npk_p} K:{selectedFormula?.npk_k}</p>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                        <span className="text-sm text-stone-500 font-medium">Nova Dose:</span>
                        <span className="text-lg font-bold text-indigo-700">{newDose.toFixed(1)} kg/ha</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500 font-medium">Novo Volume Mínimo:</span>
                        <span className="text-lg font-bold text-emerald-600">{newQuantityTons.toFixed(2)} Tons</span>
                      </div>

                      <div className="bg-stone-50 p-3 rounded text-xs text-stone-600 space-y-1">
                        <p><strong>P fornecido:</strong> {simulatedProvidedP.toFixed(1)} kg/ha <span className="text-[10px]">(Exatamente o alvo)</span></p>
                        <p><strong>N fornecido:</strong> {simulatedProvidedN.toFixed(1)} kg/ha <span className="text-[10px]">({(((simulatedProvidedN) / targetN || 1) * 100).toFixed(0)}% do alvo)</span></p>
                        <p><strong>K fornecido:</strong> {simulatedProvidedK.toFixed(1)} kg/ha <span className="text-[10px]">({(((simulatedProvidedK) / targetK || 1) * 100).toFixed(0)}% do alvo)</span></p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center">
                        <span className="text-2xl font-black text-indigo-700">
                          {dose > 0 ? `${idealNewN.toFixed(1)}-${idealNewP.toFixed(1)}-${idealNewK.toFixed(1)}` : '0-0-0'}
                        </span>
                        <p className="text-[10px] text-stone-500 mt-1">Fórmula teórica para manter dose de {dose} kg/ha</p>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                        <span className="text-sm text-stone-500 font-medium">Dose Mantida:</span>
                        <span className="text-lg font-bold text-indigo-700">{dose} kg/ha</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500 font-medium">Volume Mantido:</span>
                        <span className="text-lg font-bold text-emerald-600">{originalQuantityTons.toFixed(2)} Tons</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Comparison Block */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-lg border border-emerald-200 shadow-sm flex flex-col justify-center">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase mb-4 text-center">Ganhos de Eficiência</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-stone-600">Redução de Volume:</span>
                      <span className="text-md font-bold text-emerald-700">
                        {selectedFormulaId ? (
                          <>
                            {(originalQuantityTons - newQuantityTons).toFixed(2)} Tons 
                            <span className="text-xs ml-1">
                              ({((1 - newQuantityTons / originalQuantityTons) * 100).toFixed(1)}%)
                            </span>
                          </>
                        ) : '0 Tons (0%)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-stone-600">Economia Logística:</span>
                      <span className="text-md font-bold text-emerald-700 text-right">
                        Menos frete, armazenamento<br className="visible md:hidden"/> e paradas na plantadeira
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-stone-200 bg-stone-50 rounded-b-xl">
          <div>
            {saveSuccess && (
              <span className="text-sm font-bold text-emerald-600 flex items-center">
                <Check className="w-4 h-4 mr-1" /> Histórico Salvo!
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-stone-600 font-medium hover:bg-stone-200 rounded-lg transition-colors"
            >
              Fechar
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || dose === 0 || hectares === 0}
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Salvando...' : (
                <>
                  <Save className="w-4 h-4 mr-2" /> Salvar Histórico
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
