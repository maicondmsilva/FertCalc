import React, { useState, useEffect, useRef } from 'react';
import { PricingRecord, Client } from '../types';
import { X, ClipboardList, Search, Plus, Trash2 } from 'lucide-react';
import { getClients } from '../services/db';
import { createPedidoVenda, createPedidoVendaItens } from '../services/pedidosVendaService';
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
  quantidade_ton: number | '';
  preco_unitario: number | '';
}

export default function NovoPedidoVendaModal({
  pricing,
  currentUser,
  onClose,
  onSuccess,
}: NovoPedidoVendaModalProps) {
  const { showSuccess, showError } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);

  // Client autocomplete
  const [clientSearch, setClientSearch] = useState(
    pricing?.factors?.client?.name ?? ''
  );
  const [clientId, setClientId] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const today = new Date().toISOString().split('T')[0];
  const [numeroPedido, setNumeroPedido] = useState('');
  const [dataPedido, setDataPedido] = useState(today);
  const [dataVencimento, setDataVencimento] = useState('');
  const [condicaoPagamento, setCondicaoPagamento] = useState('');
  const [tipoFrete, setTipoFrete] = useState<'CIF' | 'FOB'>(
    (pricing?.factors as any)?.tipoFrete ?? ((pricing?.factors?.freight ?? 0) > 0 ? 'CIF' : 'FOB')
  );
  const [valorFrete, setValorFrete] = useState<number | ''>(
    pricing?.factors?.freight ?? ''
  );
  const [observacoes, setObservacoes] = useState('');

  // Multi-product items
  const [itens, setItens] = useState<ItemLocal[]>(() => {
    if (pricing?.calculations && pricing.calculations.length > 0) {
      return pricing.calculations.map((calc, i) => ({
        id: `local-${i}`,
        produto_nome: calc.formula ?? '',
        quantidade_ton: '',
        preco_unitario: calc.summary?.finalPrice ?? '',
      }));
    }
    return [
      {
        id: 'local-0',
        produto_nome: pricing?.calculations?.[0]?.formula ?? (pricing?.factors as any)?.targetFormula ?? '',
        quantidade_ton: '',
        preco_unitario: pricing?.calculations?.[0]?.summary?.finalPrice ?? '',
      },
    ];
  });

  const precificacaoCod = pricing
    ? pricing.formattedCod || `#${pricing.cod}`
    : null;

  useEffect(() => {
    getClients().then(setClients).catch(() => {});
  }, []);

  const filteredClients =
    clientSearch.length >= 2
      ? clients.filter((c) =>
          c.name.toLowerCase().includes(clientSearch.toLowerCase())
        )
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
      { id: `local-${Date.now()}`, produto_nome: '', quantidade_ton: '', preco_unitario: '' },
    ]);
  };

  const removeItem = (id: string) => {
    setItens((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof ItemLocal, value: string | number) => {
    setItens((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const totalTon = itens.reduce((sum, item) => sum + (Number(item.quantidade_ton) || 0), 0);

  const handleSave = async () => {
    if (!numeroPedido.trim()) {
      showError('Informe o número do pedido.');
      return;
    }
    if (itens.length === 0) {
      showError('Adicione pelo menos um produto.');
      return;
    }
    const itensInvalidos = itens.filter(
      (item) => !item.produto_nome.trim() || !item.quantidade_ton || Number(item.quantidade_ton) <= 0
    );
    if (itensInvalidos.length > 0) {
      showError('Preencha o produto e a quantidade de todos os itens.');
      return;
    }

    setSaving(true);
    try {
      const quantidadeTotal = totalTon;
      const produtoPrincipal = itens[0].produto_nome;
      const precoPrincipal = itens[0].preco_unitario !== '' ? Number(itens[0].preco_unitario) : undefined;

      const pedidoCriado = await createPedidoVenda({
        precificacao_id: pricing?.id ?? '',
        numero_pedido: numeroPedido.trim(),
        data_pedido: dataPedido || undefined,
        data_vencimento: dataVencimento || undefined,
        cliente_id: clientId || undefined,
        cliente_nome: clientSearch.trim() || undefined,
        produto_nome: produtoPrincipal,
        quantidade_real: quantidadeTotal,
        preco_unitario: precoPrincipal,
        tipo_frete: tipoFrete,
        valor_frete: tipoFrete === 'CIF' && valorFrete !== '' ? Number(valorFrete) : undefined,
        condicao_pagamento: condicaoPagamento.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
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
    } catch {
      showError('Erro ao criar pedido de venda.');
    } finally {
      setSaving(false);
    }
  };

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

          {/* Nº Pedido */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Nº Pedido <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={numeroPedido}
              onChange={(e) => setNumeroPedido(e.target.value)}
              placeholder="PV-2026-001"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
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
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Vencimento
              </label>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
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
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Tipo de Frete <span className="text-red-500">*</span>
              </label>
              <select
                value={tipoFrete}
                onChange={(e) => setTipoFrete(e.target.value as 'CIF' | 'FOB')}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="CIF">CIF</option>
                <option value="FOB">FOB</option>
              </select>
            </div>
            {tipoFrete === 'CIF' && (
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Valor Frete R$/ton
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
                  className="flex gap-2 items-start p-3 bg-stone-50 rounded-lg border border-stone-200"
                >
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={item.produto_nome}
                      onChange={(e) => updateItem(item.id, 'produto_nome', e.target.value)}
                      placeholder={`Produto ${index + 1} / Formulação`}
                      className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
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
                      className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.preco_unitario}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          'preco_unitario',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      placeholder="R$/ton"
                      className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
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
