import React, { useState, useEffect, useRef } from 'react';
import { PricingRecord, Client } from '../types';
import { X, ClipboardList, Search, Plus, Trash2, Zap } from 'lucide-react';
import { getClients } from '../services/db';
import { createPedidoVenda, createPedidoVendaItens } from '../services/pedidosVendaService';
import { getProdutosFormulados, ProdutoFormulado } from '../services/produtosFormuladosService';
import { useToast } from './Toast';

interface NovoPedidoVendaModalProps {
  pricing?: PricingRecord | null;
  currentUser: { id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}

interface ItemLocal {
  id: string;
  produto_nome: string;
  produto_id?: string;
  quantidade_ton: number | '';
  preco_unitario: number | '';
  autoFilled?: boolean;
}

/** Derive initial tipoFrete from pricing */
function getInitialTipoFrete(pricing?: PricingRecord | null): 'CIF' | 'FOB' {
  if (pricing?.factors?.tipoFrete) return pricing.factors.tipoFrete;
  if ((pricing?.factors?.freight ?? 0) > 0) return 'CIF';
  return 'FOB';
}

/** Derive initial valorFrete from pricing (only when CIF) */
function getInitialValorFrete(pricing?: PricingRecord | null): number | '' {
  const tipo = getInitialTipoFrete(pricing);
  if (tipo === 'CIF' && pricing?.factors?.freight) return pricing.factors.freight;
  return '';
}

/** Derive initial dataVencimento from pricing */
function getInitialVencimento(pricing?: PricingRecord | null): string {
  const due = pricing?.factors?.dueDate;
  if (!due) return '';
  // Accept ISO date strings (YYYY-MM-DD) directly; otherwise return as-is
  return due;
}

const EMITENTE_OPTIONS = Array.from({ length: 200 }, (_, i) => i + 1);

export default function NovoPedidoVendaModal({
  pricing,
  currentUser,
  onClose,
  onSuccess,
}: NovoPedidoVendaModalProps) {
  const { showSuccess, showError } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [produtosFormulados, setProdutosFormulados] = useState<ProdutoFormulado[]>([]);
  const [saving, setSaving] = useState(false);

  // Client autocomplete
  const [clientSearch, setClientSearch] = useState(pricing?.factors?.client?.name ?? '');
  const [clientId, setClientId] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const today = new Date().toISOString().split('T')[0];
  const [numeroPedido, setNumeroPedido] = useState('');
  const [emitente, setEmitente] = useState<number | 'custom'>(1);
  const [emitenteCustom, setEmitenteCustom] = useState('');
  const [dataPedido, setDataPedido] = useState(today);

  const autoVencimento = !!pricing && !!getInitialVencimento(pricing);
  const [dataVencimento, setDataVencimento] = useState(getInitialVencimento(pricing));

  const [condicaoPagamento, setCondicaoPagamento] = useState('');

  const autoTipoFrete = !!pricing;
  const [tipoFrete, setTipoFrete] = useState<'CIF' | 'FOB'>(getInitialTipoFrete(pricing));

  const autoValorFrete = !!pricing && getInitialTipoFrete(pricing) === 'CIF';
  const [valorFrete, setValorFrete] = useState<number | ''>(getInitialValorFrete(pricing));

  const [observacoes, setObservacoes] = useState('');

  // Embalagem — pre-fill from pricing if available
  const pricingEmbalagem = (pricing?.factors as any)?.embalagem_nome ?? (pricing?.factors as any)?.embalagem ?? '';
  const [embalagem, setEmbalagem] = useState<string>(pricingEmbalagem);
  const [embalagemOutro, setEmbalagemOutro] = useState('');
  const autoEmbalagem = !!pricing && !!pricingEmbalagem;

  const EMBALAGEM_OPTIONS = ['Granel', 'Big Bag', 'Saco 50kg', 'Saco 25kg', 'Outro'];

  const getEmbalagemValue = (): string | undefined => {
    if (embalagem === 'Outro') return embalagemOutro.trim() || undefined;
    return embalagem || undefined;
  };

  /** Round price to 2 decimal places when initializing from pricing */
  const roundPrice = (v: number | undefined): number | '' => {
    if (v == null) return '';
    return Math.round(v * 100) / 100;
  };

  // Multi-product items — initialize immediately with formula text, then match products
  const [itens, setItens] = useState<ItemLocal[]>(() => {
    if (pricing?.calculations && pricing.calculations.length > 0) {
      return pricing.calculations.map((calc) => ({
        id: crypto.randomUUID(),
        produto_nome: calc.formula ?? '',
        produto_id: undefined,
        quantidade_ton:
          (calc.factors?.totalTons ?? 0) > 0 ? (calc.factors?.totalTons as number) : '',
        preco_unitario: roundPrice(calc.summary?.finalPrice),
        autoFilled: true,
      }));
    }
    const formulaNpk = (pricing?.factors as any)?.targetFormula ?? '';
    const qtd =
      (pricing?.factors?.totalTons ?? 0) > 0 ? (pricing?.factors?.totalTons as number) : '';
    return [
      {
        id: crypto.randomUUID(),
        produto_nome: formulaNpk,
        produto_id: undefined,
        quantidade_ton: qtd,
        preco_unitario: roundPrice(pricing?.calculations?.[0]?.summary?.finalPrice),
        autoFilled: !!pricing,
      },
    ];
  });

  const precificacaoCod = pricing ? pricing.formattedCod || `#${pricing.cod}` : null;

  useEffect(() => {
    getClients()
      .then(setClients)
      .catch(() => {});
    getProdutosFormulados()
      .then(setProdutosFormulados)
      .catch(() => {});
  }, []);

  // When produtosFormulados loads, match unmatched items to products
  useEffect(() => {
    if (produtosFormulados.length === 0) return;
    setItens((prev) =>
      prev.map((item) => {
        if (item.produto_id) return item; // already matched
        const formulaNpk = (item.produto_nome ?? '').trim();
        if (!formulaNpk) return item;
        const matched = produtosFormulados.find(
          (p) =>
            (p.formula_npk && p.formula_npk.trim() === formulaNpk) ||
            (p.nome && p.nome.trim() === formulaNpk)
        );
        if (!matched) return item;
        return {
          ...item,
          produto_id: matched.id,
          produto_nome: matched.formula_npk
            ? `${matched.nome} (${matched.formula_npk})`
            : matched.nome,
        };
      })
    );
  }, [produtosFormulados]);

  const filteredClients =
    clientSearch.length >= 2
      ? clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
      : [];

  const handleSelectClient = (c: Client) => {
    setClientSearch(c.name);
    setClientId(c.id);
    setShowClientDropdown(false);
  };

  const handleClearClient = () => {
    setClientSearch('');
    setClientId('');
    clientInputRef.current?.focus();
  };

  const addItem = () => {
    setItens((prev) => [
      ...prev,
      { id: crypto.randomUUID(), produto_nome: '', quantidade_ton: '', preco_unitario: '' },
    ]);
  };

  const removeItem = (id: string) => {
    setItens((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof ItemLocal, value: string | number | boolean) => {
    setItens((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value, autoFilled: false } : item))
    );
  };

  /** Limit preco_unitario to max 2 decimal places */
  const handlePrecoUnitarioChange = (id: string, raw: string) => {
    if (raw === '') {
      updateItem(id, 'preco_unitario', '');
      return;
    }
    // Only allow at most 2 decimal places
    const match = raw.match(/^(\d+)([.,](\d{0,2})?)?$/);
    if (!match) return;
    const num = Number(raw.replace(',', '.'));
    if (!isNaN(num)) updateItem(id, 'preco_unitario', num);
  };

  const getEmitenteValue = (): number => {
    if (emitente === 'custom') {
      const n = parseInt(emitenteCustom, 10);
      return isNaN(n) || n < 1 ? 1 : n;
    }
    return emitente;
  };

  const totalTon = itens.reduce((sum, item) => sum + (Number(item.quantidade_ton) || 0), 0);

  const handleSave = async () => {
    if (!numeroPedido.trim()) {
      showError('Informe o número do pedido.');
      return;
    }
    if (emitente === 'custom' && (!emitenteCustom || parseInt(emitenteCustom, 10) < 1)) {
      showError('Informe um emitente válido.');
      return;
    }
    if (itens.length === 0) {
      showError('Adicione pelo menos um produto.');
      return;
    }
    const itensInvalidos = itens.filter(
      (item) =>
        !item.produto_nome.trim() || !item.quantidade_ton || Number(item.quantidade_ton) <= 0
    );
    if (itensInvalidos.length > 0) {
      showError('Preencha o produto e a quantidade de todos os itens.');
      return;
    }

    const emitenteNum = getEmitenteValue();
    const barraPedido = `${numeroPedido.trim()}/${emitenteNum}`;

    setSaving(true);
    try {
      const produtoPrincipal = itens[0].produto_nome;
      const precoPrincipal =
        itens[0].preco_unitario !== '' ? Number(itens[0].preco_unitario) : undefined;

      const pedidoCriado = await createPedidoVenda({
        precificacao_id: pricing?.id ?? undefined,
        numero_pedido: numeroPedido.trim(),
        barra_pedido: barraPedido,
        emitente: emitenteNum,
        data_pedido: dataPedido || undefined,
        data_vencimento: dataVencimento || undefined,
        cliente_id: clientId || undefined,
        cliente_nome: clientSearch.trim() || undefined,
        produto_nome: produtoPrincipal,
        quantidade_real: totalTon,
        preco_unitario: precoPrincipal,
        tipo_frete: tipoFrete,
        valor_frete: tipoFrete === 'CIF' && valorFrete !== '' ? Number(valorFrete) : undefined,
        condicao_pagamento: condicaoPagamento.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
        embalagem: getEmbalagemValue(),
        status: 'pendente',
        importado_por: currentUser.id,
      });

      await createPedidoVendaItens(
        pedidoCriado.id,
        itens.map((item) => ({
          produto_nome: item.produto_nome.trim(),
          quantidade_ton: Number(item.quantidade_ton),
          preco_unitario: item.preco_unitario !== '' ? Number(item.preco_unitario) : undefined,
          precificacao_id: pricing?.id || undefined,
        }))
      );

      showSuccess('Pedido de Venda criado com sucesso!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Erro ao criar pedido de venda.';
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  /** CSS classes for auto-filled fields */
  const autoClass = 'border-emerald-400 bg-emerald-50 focus:ring-emerald-500';
  const normalClass = 'border-stone-300 bg-white focus:ring-emerald-500';

  /** Product display options for dropdown (with "other" as free text) */
  const produtoOptions = produtosFormulados
    .filter((p) => p.ativo)
    .map((p) => ({
      value: p.id,
      label: p.formula_npk ? `${p.nome} (${p.formula_npk})` : p.nome,
    }));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex justify-between items-center bg-emerald-600 text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Novo Pedido de Venda
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Precificação ref */}
          {precificacaoCod && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">
              <span className="font-bold text-xs uppercase tracking-wider text-emerald-500">
                Precificação:{' '}
              </span>
              <span className="font-mono font-bold">{precificacaoCod}</span>
            </div>
          )}

          {/* Cliente autocomplete */}
          <div className="relative">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Cliente
            </label>
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                ref={clientInputRef}
                type="text"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setClientId('');
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 150)}
                placeholder="Buscar cliente..."
                className="w-full pl-9 pr-8 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              {clientSearch && (
                <button
                  type="button"
                  onClick={handleClearClient}
                  className="absolute right-2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {showClientDropdown && filteredClients.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredClients.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={() => handleSelectClient(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Nº Pedido + Emitente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Nº Pedido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={numeroPedido}
                onChange={(e) => setNumeroPedido(e.target.value)}
                placeholder="600500"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Emitente
              </label>
              <div className="flex gap-1">
                <select
                  value={emitente}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEmitente(v === 'custom' ? 'custom' : Number(v));
                  }}
                  className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {EMITENTE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                  <option value="custom">Outro...</option>
                </select>
                {emitente === 'custom' && (
                  <input
                    type="number"
                    min="1"
                    value={emitenteCustom}
                    onChange={(e) => setEmitenteCustom(e.target.value)}
                    placeholder="Nº"
                    className="w-20 px-2 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                )}
              </div>
              {numeroPedido && (
                <p className="text-xs text-emerald-600 mt-1 font-mono">
                  Pedido: {numeroPedido}/{getEmitenteValue()}
                </p>
              )}
            </div>
          </div>

          {/* Data do Pedido + Vencimento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Data do Pedido
              </label>
              <input
                type="date"
                value={dataPedido}
                onChange={(e) => setDataPedido(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Vencimento
                {autoVencimento && <Zap className="w-3 h-3 text-emerald-500" />}
              </label>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 outline-none ${autoVencimento ? autoClass : normalClass}`}
              />
            </div>
          </div>

          {/* Condição de pagamento */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Condição de Pagamento
            </label>
            <input
              type="text"
              value={condicaoPagamento}
              onChange={(e) => setCondicaoPagamento(e.target.value)}
              placeholder="30/60/90 dias"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Tipo frete + valor frete */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Tipo de Frete <span className="text-red-500">*</span>
                {autoTipoFrete && <Zap className="w-3 h-3 text-emerald-500" />}
              </label>
              <select
                value={tipoFrete}
                onChange={(e) => setTipoFrete(e.target.value as 'CIF' | 'FOB')}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 outline-none ${autoTipoFrete ? autoClass : normalClass}`}
              >
                <option value="CIF">CIF</option>
                <option value="FOB">FOB</option>
              </select>
            </div>
            {tipoFrete === 'CIF' && (
              <div>
                <label className="flex items-center gap-1 text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Valor Frete R$/ton
                  {autoValorFrete && <Zap className="w-3 h-3 text-emerald-500" />}
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
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 outline-none ${autoValorFrete ? autoClass : normalClass}`}
                />
              </div>
            )}
          </div>

          {/* Produtos do Pedido */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Produtos do Pedido <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-stone-400">
                Total: <strong>{totalTon.toFixed(3)} ton</strong>
              </span>
            </div>

            <div className="space-y-2">
              {itens.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex gap-2 items-start p-3 rounded-lg border ${item.autoFilled ? 'bg-emerald-50 border-emerald-200' : 'bg-stone-50 border-stone-200'}`}
                >
                  <div className="flex-1 min-w-0">
                    {produtoOptions.length > 0 ? (
                      <select
                        value={item.produto_id ?? ''}
                        onChange={(e) => {
                          const selected = produtosFormulados.find((p) => p.id === e.target.value);
                          updateItem(item.id, 'produto_id', e.target.value);
                          updateItem(
                            item.id,
                            'produto_nome',
                            selected
                              ? selected.formula_npk
                                ? `${selected.nome} (${selected.formula_npk})`
                                : selected.nome
                              : ''
                          );
                        }}
                        className={`w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none ${item.autoFilled ? 'border-emerald-300 bg-emerald-50' : 'border-stone-300 bg-white'}`}
                      >
                        <option value="">— Selecionar produto —</option>
                        {produtoOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                        <option value="__outro__">Outro (digitar manualmente)</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={item.produto_nome}
                        onChange={(e) => updateItem(item.id, 'produto_nome', e.target.value)}
                        placeholder={`Produto ${index + 1} / Formulação`}
                        className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    )}
                    {item.produto_id === '__outro__' && (
                      <input
                        type="text"
                        value={item.produto_nome}
                        onChange={(e) => updateItem(item.id, 'produto_nome', e.target.value)}
                        placeholder="Nome do produto"
                        className="w-full mt-1 px-2 py-1.5 border border-stone-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    )}
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={item.quantidade_ton}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          'quantidade_ton',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      placeholder="Qtd (ton)"
                      className={`w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none ${item.autoFilled ? 'border-emerald-300 bg-emerald-50' : 'border-stone-300 bg-white'}`}
                    />
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.preco_unitario}
                      onChange={(e) => handlePrecoUnitarioChange(item.id, e.target.value)}
                      placeholder="R$/ton"
                      className={`w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none ${item.autoFilled ? 'border-emerald-300 bg-emerald-50' : 'border-stone-300 bg-white'}`}
                    />
                  </div>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItem}
              className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600 font-bold hover:text-emerald-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Produto
            </button>
          </div>

          {/* Embalagem */}
          <div>
            <label className="flex items-center gap-1 text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Tipo de Embalagem
              {autoEmbalagem && <Zap className="w-3 h-3 text-emerald-500" />}
            </label>
            <select
              value={embalagem}
              onChange={(e) => setEmbalagem(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 outline-none ${autoEmbalagem ? autoClass : normalClass}`}
            >
              <option value="">— Selecionar embalagem —</option>
              {EMBALAGEM_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {embalagem === 'Outro' && (
              <input
                type="text"
                value={embalagemOutro}
                onChange={(e) => setEmbalagemOutro(e.target.value)}
                placeholder="Descreva a embalagem..."
                className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-stone-100 bg-stone-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              'Criar Pedido'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
