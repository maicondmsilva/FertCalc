import React, { useState, useMemo, useEffect } from 'react';
import { RawMaterial, User as AppUser } from '../types';
import { Save, Package } from 'lucide-react';
import { useToast } from './Toast';
import { getSavedFormulas, createSavedFormula } from '../services/db';
import {
  getProdutosFormulados,
  createProdutoFormulado,
} from '../services/produtosFormuladosService';

interface ProdutoPuroModeProps {
  macros: RawMaterial[];
  micros: RawMaterial[];
  currentUser: AppUser;
  initialFreight?: number;
  initialTipoFrete?: 'CIF' | 'FOB';
}

function formatNpk(m: RawMaterial): string {
  const parts: string[] = [];
  if (m.n > 0) parts.push(`N${m.n}`);
  if (m.p > 0) parts.push(`P${m.p}`);
  if (m.k > 0) parts.push(`K${m.k}`);
  if (m.s > 0) parts.push(`S${m.s}`);
  if (m.ca > 0) parts.push(`Ca${m.ca}`);
  if (m.microGuarantees?.length) {
    m.microGuarantees.forEach((g) => {
      if (g.value > 0) parts.push(`${g.name} ${g.value}%`);
    });
  }
  return parts.length ? parts.join(' · ') : '—';
}

export default function ProdutoPuroMode({
  macros,
  micros,
  currentUser,
  initialFreight = 0,
  initialTipoFrete = 'FOB',
}: ProdutoPuroModeProps) {
  const { showSuccess, showError } = useToast();

  const allProducts = useMemo(
    () => [...macros, ...micros].filter((p) => p.name && p.price > 0),
    [macros, micros]
  );

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [custo, setCusto] = useState<number | ''>('');
  const [quantidade, setQuantidade] = useState<number | ''>(1);
  const [markup, setMarkup] = useState<number | ''>(10);
  const [tipoFrete, setTipoFrete] = useState<'CIF' | 'FOB'>(initialTipoFrete);
  const [valorFrete, setValorFrete] = useState<number | ''>(initialFreight || '');
  const [saving, setSaving] = useState(false);

  // When product changes, pre-fill cost from price list
  useEffect(() => {
    if (!selectedProductId) return;
    const product = allProducts.find((p) => p.id === selectedProductId);
    if (product) {
      setCusto(Math.round(product.price * 100) / 100);
    }
  }, [selectedProductId, allProducts]);

  const selectedProduct = allProducts.find((p) => p.id === selectedProductId) ?? null;

  // Calculations
  const custoNum = Number(custo) || 0;
  const qtdNum = Number(quantidade) || 0;
  const markupNum = Number(markup) || 0;
  const freteNum = tipoFrete === 'CIF' ? Number(valorFrete) || 0 : 0;

  const precoFinal = custoNum * (1 + markupNum / 100) + freteNum;
  const custoTotal = custoNum * qtdNum;
  const totalFinal = precoFinal * qtdNum;
  const margemReais = (precoFinal - custoNum) * qtdNum;
  const margemPct = custoNum > 0 ? ((precoFinal - custoNum) / custoNum) * 100 : 0;

  // Derive NPK string for the selected product
  const npkString = useMemo(() => {
    if (!selectedProduct) return '';
    if (selectedProduct.type === 'macro') {
      const n = selectedProduct.n || 0;
      const p = selectedProduct.p || 0;
      const k = selectedProduct.k || 0;
      return `${n}-${p}-${k}`;
    }
    // Micro — show guarantee values
    return formatNpk(selectedProduct);
  }, [selectedProduct]);

  const handleSave = async () => {
    if (!selectedProduct) {
      showError('Selecione um produto.');
      return;
    }
    if (!custo || custoNum <= 0) {
      showError('Informe o preço de custo.');
      return;
    }
    if (!quantidade || qtdNum <= 0) {
      showError('Informe a quantidade.');
      return;
    }

    setSaving(true);
    try {
      // Build a "batida" with just one product
      const formulaName = `${selectedProduct.name} (${npkString})`;
      const existing = await getSavedFormulas();
      const duplicate = existing.find(
        (f) =>
          f.targetFormula === npkString &&
          f.macros.length === 1 &&
          f.macros[0].id === selectedProduct.id
      );

      if (duplicate) {
        showError(
          'Já existe uma batida salva para este produto. Use a batida existente ou escolha outro nome.'
        );
        setSaving(false);
        return;
      }

      // Create a synthetic macro with the full product data
      const syntheticMacro: RawMaterial = {
        ...selectedProduct,
        quantity: qtdNum,
        selected: true,
        price: custoNum,
      };

      const savedFormula = await createSavedFormula({
        userId: currentUser.id,
        userName: currentUser.name,
        name: formulaName,
        date: new Date().toISOString(),
        targetFormula: npkString,
        macros: [syntheticMacro],
        micros: [],
      });

      // Also register in produtos_formulados
      try {
        const existingProdutos = await getProdutosFormulados();
        const alreadyExists = existingProdutos.find(
          (p) =>
            p.saved_formula_id === savedFormula.id ||
            (p.formula_npk === npkString && p.nome === formulaName)
        );
        if (!alreadyExists) {
          await createProdutoFormulado({
            nome: formulaName,
            formula_npk: npkString,
            saved_formula_id: savedFormula.id,
            linha_diferenciada: false,
            ativo: true,
            criado_por: currentUser.id,
          });
        }
      } catch (pfErr) {
        console.warn('[ProdutoPuroMode] Failed to create produto_formulado:', pfErr);
      }

      showSuccess('Produto Puro salvo com sucesso nas Fórmulas!');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Erro ao salvar produto puro.';
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Product select */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h3 className="text-base font-bold text-stone-700 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-600" />
          Selecionar Produto
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Produto (Macro / Micro) <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">— Selecionar produto —</option>
              {macros.length > 0 && (
                <optgroup label="Macros (Matérias-Primas)">
                  {macros
                    .filter((m) => m.name)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </optgroup>
              )}
              {micros.length > 0 && (
                <optgroup label="Micros">
                  {micros
                    .filter((m) => m.name)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>

          {selectedProduct && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-xs font-bold text-emerald-600 uppercase mb-1">
                {selectedProduct.type === 'macro' ? 'NPK (N-P-K)' : 'Garantias'}
              </p>
              <p className="font-mono font-bold text-emerald-800 text-sm">{npkString || '—'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Pricing inputs */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h3 className="text-base font-bold text-stone-700 mb-4">Parâmetros de Precificação</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Custo R$/ton
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={custo}
              onChange={(e) => setCusto(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Quantidade (ton)
            </label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="1.000"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Markup / Margem %
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={markup}
              onChange={(e) => setMarkup(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="10.00"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Tipo de Frete
            </label>
            <select
              value={tipoFrete}
              onChange={(e) => setTipoFrete(e.target.value as 'CIF' | 'FOB')}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="FOB">FOB (sem frete)</option>
              <option value="CIF">CIF (frete incluso)</option>
            </select>
          </div>
          {tipoFrete === 'CIF' && (
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Frete R$/ton
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={valorFrete}
                onChange={(e) =>
                  setValorFrete(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="0.00"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {selectedProduct && custoNum > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-200">
          <h3 className="text-base font-bold text-emerald-700 mb-4">Resultado</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
              <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Preço Final R$/ton</p>
              <p className="text-xl font-black text-emerald-800">R$ {fmtBRL(precoFinal)}</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
              <p className="text-xs font-bold text-stone-500 uppercase mb-1">Custo Total</p>
              <p className="text-xl font-black text-stone-800">R$ {fmtBRL(custoTotal)}</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
              <p className="text-xs font-bold text-stone-500 uppercase mb-1">Total Faturado</p>
              <p className="text-xl font-black text-stone-800">R$ {fmtBRL(totalFinal)}</p>
            </div>
            <div
              className={`rounded-lg p-3 border ${margemReais >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}
            >
              <p
                className={`text-xs font-bold uppercase mb-1 ${margemReais >= 0 ? 'text-blue-600' : 'text-red-600'}`}
              >
                Margem R$
              </p>
              <p
                className={`text-xl font-black ${margemReais >= 0 ? 'text-blue-800' : 'text-red-800'}`}
              >
                R$ {fmtBRL(margemReais)}
                <span className="text-sm font-bold ml-1">({margemPct.toFixed(1)}%)</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !selectedProduct || !custo}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Salvar como Batida
            </>
          )}
        </button>
      </div>
    </div>
  );
}
