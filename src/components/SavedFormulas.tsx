import React, { useState, useEffect } from 'react';
import { getSavedFormulas, deleteSavedFormula, getPriceLists, getBranches } from '../services/db';
import { SavedFormula, User, PriceList, Branch } from '../types';
import {
  Beaker,
  Trash2,
  ArrowRight,
  Save,
  Calendar,
  Database,
  User as UserIcon,
  Building2,
  Package,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from './Toast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface SavedFormulasProps {
  currentUser: User;
  onSendToCalculator: (formula: SavedFormula, branchId: string, priceListId: string) => void;
}

export default function SavedFormulas({ currentUser, onSendToCalculator }: SavedFormulasProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [formulas, setFormulas] = useState<SavedFormula[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allFormulas, allLists, allBranches] = await Promise.all([
        getSavedFormulas(),
        getPriceLists(),
        getBranches(),
      ]);

      let filtered = allFormulas;
      if (
        currentUser.role !== 'master' &&
        currentUser.role !== 'admin' &&
        currentUser.role !== 'manager'
      ) {
        filtered = allFormulas.filter((f) => f.userId === currentUser.id);
      }
      setFormulas(filtered);
      setPriceLists(allLists);
      setBranches(allBranches);

      if (allBranches.length > 0) {
        setSelectedBranchId(allBranches[0].id);
        const listsForBranch = allLists.filter((l) => l.branchId === allBranches[0].id);
        if (listsForBranch.length > 0) {
          setSelectedPriceListId(listsForBranch[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading formulas data:', error);
      showError('Erro ao carregar fórmulas salvas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Excluir Fórmula',
      message: `Tem certeza que deseja excluir a fórmula "${name}"?`,
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await deleteSavedFormula(id);
      showSuccess('Fórmula excluída com sucesso!');
      await loadData();
    } catch (error) {
      showError('Erro ao excluir fórmula');
    }
  };

  const getFormulaCost = (formula: SavedFormula, priceList: PriceList | undefined) => {
    if (!priceList) return { total: 0, missingItems: [] };

    let totalCustoMat = 0;
    const missingItems: string[] = [];

    formula.macros.forEach((macro) => {
      if (!macro.quantity || macro.quantity <= 0) return;
      // Tenta vincular por ID primeiro, depois por nome (fallback para tabelas diferentes)
      const priceListItem = priceList.macros.find(
        (m) => m.id === macro.id || m.name.trim().toLowerCase() === macro.name.trim().toLowerCase()
      );
      if (priceListItem && priceListItem.price) {
        totalCustoMat += (macro.quantity / 1000) * Number(priceListItem.price);
      } else {
        missingItems.push(macro.name);
      }
    });

    formula.micros.forEach((micro) => {
      if (!micro.quantity || micro.quantity <= 0) return;
      const priceListItem = priceList.micros.find(
        (m) => m.id === micro.id || m.name.trim().toLowerCase() === micro.name.trim().toLowerCase()
      );
      if (priceListItem && priceListItem.price) {
        totalCustoMat += (micro.quantity / 1000) * Number(priceListItem.price);
      } else {
        missingItems.push(micro.name);
      }
    });

    return { total: totalCustoMat, missingItems };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const availableLists = priceLists.filter((l) => l.branchId === selectedBranchId);
  const selectedList = availableLists.find((l) => l.id === selectedPriceListId);

  return (
    <React.Fragment>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
              <Beaker className="w-6 h-6 text-emerald-600" />
              Fórmulas Salvas (Batidas)
            </h2>
            <p className="text-stone-500">
              Gerencie suas configurações e simule custos rapidamente alterando tabelas de preço.
            </p>
          </div>

          {branches.length > 0 && (
            <div className="flex gap-2">
              <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-stone-200 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-stone-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    Filial
                  </span>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => {
                      const newBranchId = e.target.value;
                      setSelectedBranchId(newBranchId);
                      const branchLists = priceLists.filter((l) => l.branchId === newBranchId);
                      if (branchLists.length > 0) {
                        setSelectedPriceListId(branchLists[0].id);
                      } else {
                        setSelectedPriceListId('');
                      }
                    }}
                    className="bg-transparent text-stone-700 font-medium outline-none text-sm cursor-pointer max-w-[120px]"
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-stone-200 flex items-center gap-2">
                <Database className="w-5 h-5 text-stone-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    Tabela de Preços
                  </span>
                  <select
                    value={selectedPriceListId}
                    onChange={(e) => setSelectedPriceListId(e.target.value)}
                    className="bg-transparent text-stone-700 font-medium outline-none text-sm cursor-pointer"
                  >
                    {availableLists.length > 0 ? (
                      availableLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))
                    ) : (
                      <option value="">Sem tabela na filial</option>
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {formulas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 text-center">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Save className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="text-lg font-bold text-stone-800 mb-2">Nenhuma fórmula salva</h3>
            <p className="text-stone-500 max-w-md mx-auto">
              Você ainda não possui fórmulas salvas. Para criar uma predefinição, acesse a
              Calculadora, faça uma batida e clique em "Salvar Batida".
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {formulas.map((formula) => {
              const results = getFormulaCost(formula, selectedList);
              return (
                <div
                  key={formula.id}
                  className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="p-5 border-b border-stone-100 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-lg text-stone-800">{formula.name}</h3>
                      <button
                        onClick={() => handleDelete(formula.id, formula.name)}
                        className="text-stone-400 hover:text-red-500 transition-colors p-1"
                        title="Excluir fórmula"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center text-xs text-stone-500 mb-4 gap-2">
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3" /> {formula.userName}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{' '}
                        {new Date(formula.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <div className="bg-stone-50 p-3 rounded-lg border border-stone-100 mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                          Fórmula Alvo
                        </p>
                        <p className="text-[10px] text-stone-400 font-mono">
                          #{formula.id.slice(-4)}
                        </p>
                      </div>
                      <p className="font-mono text-emerald-700 font-bold text-lg mb-3">
                        {formula.targetFormula}
                      </p>

                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 border-t border-stone-200 pt-2">
                        Composição (kg)
                      </p>
                      <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                        {formula.macros
                          .filter((m) => m.quantity > 0)
                          .map((m) => (
                            <div
                              key={m.id}
                              className="flex justify-between items-center text-[11px]"
                            >
                              <span className="text-stone-600 flex items-center gap-1 truncate pr-2">
                                <Package className="w-3 h-3 text-stone-400 flex-shrink-0" />
                                {m.name}
                              </span>
                              <span className="font-mono font-bold text-stone-800">
                                {m.quantity.toFixed(0)}
                              </span>
                            </div>
                          ))}
                        {formula.micros
                          .filter((m) => m.quantity > 0)
                          .map((m) => (
                            <div
                              key={m.id}
                              className="flex justify-between items-center text-[11px]"
                            >
                              <span className="text-emerald-700 flex items-center gap-1 truncate pr-2">
                                <Zap className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                {m.name}
                              </span>
                              <span className="font-mono font-bold text-emerald-800">
                                {m.quantity.toFixed(0)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {results.missingItems.length > 0 && selectedList && (
                      <div className="mb-4 p-2 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex flex-col">
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-tighter">
                            Itens Não Disponíveis
                          </p>
                          <p className="text-[10px] text-red-500 leading-tight">
                            {results.missingItems.join(', ')} não encontrado(s) nesta tabela.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-end mt-4">
                      <div>
                        <p className="text-xs text-stone-500">Custo Total (por Ton)</p>
                        <p className="text-lg font-black text-stone-800">
                          {selectedList
                            ? results.total.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })
                            : 'Selecione uma tabela'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-stone-50 p-3 border-t border-stone-100">
                    <button
                      onClick={() =>
                        onSendToCalculator(formula, selectedBranchId, selectedPriceListId)
                      }
                      className="w-full flex justify-center items-center gap-2 bg-white border border-stone-200 hover:border-emerald-500 hover:text-emerald-600 text-stone-700 font-medium py-2 rounded-lg transition-colors text-sm shadow-sm"
                    >
                      Usar na Calculadora
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </React.Fragment>
  );
}
