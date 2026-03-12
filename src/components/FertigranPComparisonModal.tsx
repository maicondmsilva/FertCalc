import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Calculator, Check, ArrowRight, Save, Info, AlertTriangle } from 'lucide-react';
import { getFertigranPFormulas, saveComparisonHistory } from '../services/db';
import { FertigranPFormula, User as AppUser, RawMaterial, TargetFormula } from '../types';
import solver from 'javascript-lp-solver';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  originalFormulaName: string;
  originalN: number;
  originalP: number;
  originalK: number;
  currentUser: AppUser;
  macros: RawMaterial[];
  micros: RawMaterial[];
  onApplyFertigranP: (calculation: Omit<TargetFormula, 'id'>) => void;
}

export function FertigranPComparisonModal({ isOpen, onClose, originalFormulaName, originalN, originalP, originalK, currentUser, macros, micros, onApplyFertigranP }: Props) {
  const [hectares, setHectares] = useState<number>(0);
  const [dose, setDose] = useState<number>(0);

  const [reductionN, setReductionN] = useState<number>(0);
  const [reductionP, setReductionP] = useState<number>(0);
  const [reductionK, setReductionK] = useState<number>(0);

  const [includeInPdf, setIncludeInPdf] = useState(true);
  const [localMicros, setLocalMicros] = useState<RawMaterial[]>(micros);
  const [commercialFactors, setCommercialFactors] = useState({
    factor: 0.8,
    margin: 0,
    discount: 0,
    freight: 0,
    commission: 0,
  });

  const [formulas, setFormulas] = useState<FertigranPFormula[]>([]);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [optimizedDose, setOptimizedDose] = useState<number>(0);
  const [optimizedFormulaTarget, setOptimizedFormulaTarget] = useState<string>('0-0-0');
  const [optimizedComposition, setOptimizedComposition] = useState<{material: RawMaterial, qtd: number}[]>([]);
  const [resultingGuarantees, setResultingGuarantees] = useState<{s: number, ca: number, micros: {name: string, value: number}[]}>({s: 0, ca: 0, micros: []});

  useEffect(() => {
    if (isOpen) {
      loadFormulas();
      setSaveSuccess(false);
      setLocalMicros(micros.map(m => ({ ...m })));
    }
  }, [isOpen, micros]);

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

  // LP Optimization when formula or targets change
  useEffect(() => {
    if (!selectedFormulaId && dose > 0 && (targetN > 0 || targetP > 0 || targetK > 0)) {
      // Find optimal dose and mix for theoretical target using LP
      const model: any = {
        optimize: "cost",
        opType: "min",
        constraints: {
          n_eq: { min: targetN * 10, max: (targetN * 10) + 1 }, // precision to 1 decimal place (multiply by 10)
          p_eq: { min: targetP * 10, max: (targetP * 10) + 1 },
          k_eq: { min: targetK * 10, max: (targetK * 10) + 1 },
        },
        variables: {},
        ints: {}
      };

      const availableMaterials = [...macros, ...localMicros].filter(m => m.selected);
      availableMaterials.forEach(m => {
        model.variables[m.id] = {
          cost: m.price / 1000,
          n_eq: m.n / 10, // adjusting scale
          p_eq: m.p / 10,
          k_eq: m.k / 10,
          weight: 1
        };
      });

      const result = solver.Solve(model);
      
      if (result.feasible) {
        let totalWeight = 0;
        const comp: {material: RawMaterial, qtd: number}[] = [];
        let resS = 0;
        let resCa = 0;
        const microSums: { [key: string]: number } = {};

        availableMaterials.forEach(m => {
          if (result[m.id] && result[m.id] > 0) {
            const qtd = result[m.id];
            totalWeight += qtd;
            comp.push({ material: m, qtd });
            
            // Calculate resulting secondary/micros based on quantities per hectare
            resS += qtd * (m.s / 100);
            resCa += qtd * (m.ca / 100);
            m.microGuarantees?.forEach(micro => {
              microSums[micro.name] = (microSums[micro.name] || 0) + qtd * (micro.value / 100);
            });
          }
        });

        setOptimizedDose(totalWeight);
        setOptimizedComposition(comp);
        
        if (totalWeight > 0) {
          const fn = (targetN / totalWeight) * 100;
          const fp = (targetP / totalWeight) * 100;
          const fk = (targetK / totalWeight) * 100;
          setOptimizedFormulaTarget(`${fn.toFixed(1)}-${fp.toFixed(1)}-${fk.toFixed(1)}`);
          
          setResultingGuarantees({
            s: (resS / totalWeight) * 100,
            ca: (resCa / totalWeight) * 100,
            micros: Object.entries(microSums).map(([name, val]) => ({
              name,
              value: (val / totalWeight) * 100
            }))
          });
        }
      } else {
        setOptimizedDose(0);
        setOptimizedComposition([]);
        setResultingGuarantees({s: 0, ca: 0, micros: []});
      }
    } else {
        // If a pre-defined formula is selected, we just adjust the dose based on P
        if (selectedFormula && targetP > 0 && selectedFormula.npk_p > 0) {
          const fixedNewDose = targetP / (selectedFormula.npk_p / 100);
          setOptimizedDose(fixedNewDose);
          setOptimizedFormulaTarget(selectedFormula.nome);
          setResultingGuarantees({
            s: selectedFormula.s || 0,
            ca: selectedFormula.ca || 0,
            micros: [] // predefined formulas in current schema might not have micros list yet or it's empty
          });
        } else {
          setOptimizedDose(0);
          setOptimizedComposition([]);
          setResultingGuarantees({s: 0, ca: 0, micros: []});
        }
    }
  }, [selectedFormulaId, targetN, targetP, targetK, macros, localMicros]);

  if (optimizedDose > 0) {
    newDose = optimizedDose;
    newQuantityTons = (newDose * hectares) / 1000;
    
    if (selectedFormula) {
      simulatedProvidedN = newDose * (selectedFormula.npk_n / 100);
      simulatedProvidedP = newDose * (selectedFormula.npk_p / 100);
      simulatedProvidedK = newDose * (selectedFormula.npk_k / 100);
    } else {
      simulatedProvidedN = targetN;
      simulatedProvidedP = targetP;
      simulatedProvidedK = targetK;
    }
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
        reducoes_aplicadas: { 
          n: reductionN, 
          p: reductionP, 
          k: reductionK,
          fatores_comerciais: commercialFactors,
          incluir_pdf: includeInPdf,
          composicao: optimizedComposition.map(c => ({ material: c.material.name, qtd: c.qtd })),
          garantias_finais: resultingGuarantees
        }
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

  const handleSendToPricing = async () => {
    // Save history first
    await handleSave();
    
    if (!selectedFormulaId && optimizedDose > 0) {
       // Send theoretical mixed formula to pricing
       const matchedFormula = optimizedFormulaTarget.match(/(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)/);
       let nNum = 0, pNum = 0, kNum = 0;
       if (matchedFormula) {
           nNum = parseFloat(matchedFormula[1].replace(',', '.'));
           pNum = parseFloat(matchedFormula[2].replace(',', '.'));
           kNum = parseFloat(matchedFormula[3].replace(',', '.'));
       }

       // Map global macros/micros, marking only the composition ones as selected 
       const mappedMacros = macros.map(m => ({
           ...m,
           selected: optimizedComposition.some(c => c.material.id === m.id)
       }));
       const mappedMicros = localMicros.map(m => ({
           ...m,
           selected: optimizedComposition.some(c => c.material.id === m.id)
       }));

       onApplyFertigranP({
         formula: optimizedFormulaTarget,
         selected: includeInPdf,
         targetN: nNum,
         targetP: pNum,
         targetK: kNum,
         targetS: resultingGuarantees.s,
         targetCa: resultingGuarantees.ca,
         macros: mappedMacros,
         micros: mappedMicros,
         factors: {
             targetFormula: optimizedFormulaTarget,
             factor: commercialFactors.factor,
             discount: commercialFactors.discount,
             margin: commercialFactors.margin,
             freight: commercialFactors.freight,
             taxRate: 0,
             commission: commercialFactors.commission,
             monthlyInterestRate: 0,
             dueDate: '',
             exemptCurrentMonth: false,
             client: { id: '', code: '', name: '', document: '' },
             agent: { id: '', code: '', name: '', document: '' },
             branchId: '',
             priceListId: '',
             totalTons: newQuantityTons > 0 ? newQuantityTons : 1000
         }
       });
    } else if (selectedFormula) {
      // Send certified formula to pricing
      onApplyFertigranP({
         formula: selectedFormula.nome,
         selected: includeInPdf,
         targetN: selectedFormula.npk_n,
         targetP: selectedFormula.npk_p,
         targetK: selectedFormula.npk_k,
         targetCa: selectedFormula.ca,
         targetS: selectedFormula.s,
         macros: macros.map(m => ({ ...m })),
         micros: localMicros.map(m => ({ ...m })),
         factors: {
             targetFormula: selectedFormula.nome,
             factor: commercialFactors.factor,
             discount: commercialFactors.discount,
             margin: commercialFactors.margin,
             freight: commercialFactors.freight,
             taxRate: 0,
             commission: commercialFactors.commission,
             monthlyInterestRate: 0,
             dueDate: '',
             exemptCurrentMonth: false,
             client: { id: '', code: '', name: '', document: '' },
             agent: { id: '', code: '', name: '', document: '' },
             branchId: '',
             priceListId: '',
             totalTons: newQuantityTons > 0 ? newQuantityTons : 1000
         }
       });
    }
    
    onClose();
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

          {/* Section 3: Micro Selection (NEW) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-amber-600 uppercase flex items-center gap-2">
              <span className="bg-amber-100 text-amber-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
              Seleção de Micronutrientes
            </h3>
            <div className="p-4 bg-amber-50/30 rounded-lg border border-amber-100">
              <p className="text-[10px] text-stone-500 mb-3 font-medium">Selecione os micros que deseja incluir na nova formulação Fertigran P:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {localMicros.map(m => (
                  <label key={m.id} className="flex items-center gap-2 p-2 bg-white border border-amber-100 rounded-lg cursor-pointer hover:bg-amber-50 transition-colors">
                    <input 
                      type="checkbox"
                      checked={m.selected}
                      onChange={() => {
                        setLocalMicros(prev => prev.map(mm => mm.id === m.id ? { ...mm, selected: !mm.selected } : mm));
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-stone-700 truncate">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Commercial Factors (NEW) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-600 uppercase flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
              Fatores Comerciais Personalizados
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-blue-50/30 rounded-lg border border-blue-100">
              <div>
                <label className="block text-[10px] text-blue-700 font-bold mb-1">Fator (Ex: 0.8)</label>
                <input 
                  type="number" step="0.01"
                  value={commercialFactors.factor}
                  onChange={e => setCommercialFactors({ ...commercialFactors, factor: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-blue-700 font-bold mb-1">Margem %</label>
                <input 
                  type="number"
                  value={commercialFactors.margin}
                  onChange={e => setCommercialFactors({ ...commercialFactors, margin: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-blue-700 font-bold mb-1">Desconto %</label>
                <input 
                  type="number"
                  value={commercialFactors.discount}
                  onChange={e => setCommercialFactors({ ...commercialFactors, discount: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-blue-700 font-bold mb-1">Frete (R$/Ton)</label>
                <input 
                  type="number"
                  value={commercialFactors.freight}
                  onChange={e => setCommercialFactors({ ...commercialFactors, freight: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-blue-700 font-bold mb-1">Comissão %</label>
                <input 
                  type="number"
                  value={commercialFactors.commission}
                  onChange={e => setCommercialFactors({ ...commercialFactors, commission: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Fertigran Selection & Results (was 3) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-indigo-600 uppercase flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">5</span>
              Resultado e Formulação Final
            </h3>
            
            <div className="p-4 bg-indigo-50/30 rounded-lg border border-indigo-100 space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[300px]">
                  <label className="block text-xs text-indigo-700 font-bold mb-2">Selecione uma fórmula padrão existente:</label>
                  <select
                    value={selectedFormulaId}
                    onChange={e => setSelectedFormulaId(e.target.value)}
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Fórmula Customizada (Baseada nas reduções e Solver)</option>
                    {formulas.map(f => (
                      <option key={f.id} value={f.id}>{f.nome} (N:{f.npk_n} P:{f.npk_p} K:{f.npk_k})</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input 
                    type="checkbox" 
                    id="includeInPdf"
                    checked={includeInPdf}
                    onChange={e => setIncludeInPdf(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <label htmlFor="includeInPdf" className="text-xs font-bold text-stone-700 cursor-pointer">Aparecer no PDF / Comparativo</label>
                </div>
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
                          {dose > 0 ? optimizedFormulaTarget : '0-0-0'}
                        </span>
                        <p className="text-[10px] text-stone-500 mt-1">Fórmula Otimizada (Dose Mínima Fertigran)</p>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                        <span className="text-sm text-stone-500 font-medium">Nova Dose Otimizada:</span>
                        <span className="text-lg font-bold text-indigo-700">{dose > 0 ? optimizedDose.toFixed(1) : 0} kg/ha</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500 font-medium">Novo Volume Mínimo:</span>
                        <span className="text-lg font-bold text-emerald-600">{newQuantityTons.toFixed(2)} Tons</span>
                      </div>

                      {optimizedComposition.length > 0 && (
                        <div className="mt-3 space-y-3">
                          <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                            <p className="text-[10px] uppercase font-bold text-stone-500 mb-2">Composição da Batida (1.000 kg):</p>
                            <div className="space-y-1">
                              {optimizedComposition.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-xs text-stone-600">
                                  <span>{item.material.name}</span>
                                  <span className="font-mono text-emerald-600 font-bold">
                                    {((item.qtd / optimizedDose) * 1000).toFixed(1)} kg
                                  </span>
                                </div>
                              ))}
                              <div className="pt-1 mt-1 border-t border-stone-200 flex justify-between text-[10px] font-bold text-stone-700">
                                <span>TOTAL BATIDA</span>
                                <span>1.000 kg</span>
                              </div>
                            </div>
                          </div>

                          <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                            <p className="text-[10px] uppercase font-bold text-indigo-500 mb-2">Garantias Resultantes:</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-stone-500">N Total:</span>
                                <span className="font-bold text-indigo-700">{(targetN/optimizedDose*100).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-stone-500">P₂O₅ Sol. CNA+água:</span>
                                <span className="font-bold text-indigo-700">{(targetP/optimizedDose*100).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-stone-500">K₂O Sol. água:</span>
                                <span className="font-bold text-indigo-700">{(targetK/optimizedDose*100).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-stone-500">S Total:</span>
                                <span className="font-bold text-amber-600">{resultingGuarantees.s.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-stone-500">Ca Total:</span>
                                <span className="font-bold text-amber-600">{resultingGuarantees.ca.toFixed(1)}%</span>
                              </div>
                              {resultingGuarantees.micros.map((m, idx) => (
                                <div key={idx} className="flex justify-between text-[10px]">
                                  <span className="text-stone-500">{m.name}:</span>
                                  <span className="font-bold text-emerald-600">{m.value.toFixed(3)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
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
              onClick={handleSendToPricing}
              disabled={isSaving || dose === 0 || hectares === 0}
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Processando...' : (
                <>
                  <Save className="w-4 h-4 mr-2" /> Enviar para Precificação
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
