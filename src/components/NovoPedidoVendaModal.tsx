import React, { useState, useEffect, useRef } from 'react';
import { PricingRecord, Client } from '../types';
import { X, ClipboardList, Search } from 'lucide-react';
import { getClients } from '../services/db';
import { createPedidoVenda } from '../services/pedidosVendaService';
import { useToast } from './Toast';

interface NovoPedidoVendaModalProps {
  pricing?: PricingRecord | null;
  currentUser: { id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
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
  const [produtoNome, setProdutoNome] = useState(
    pricing?.calculations?.[0]?.formula ?? (pricing?.factors as any)?.targetFormula ?? ''
  );
  const [quantidadeReal, setQuantidadeReal] = useState<number | ''>('');
  const [precoUnitario, setPrecoUnitario] = useState<number | ''>(
    pricing?.calculations?.[0]?.summary?.finalPrice ?? ''
  );
  const [condicaoPagamento, setCondicaoPagamento] = useState('');
  const [tipoFrete, setTipoFrete] = useState<'CIF' | 'FOB'>(
    (pricing?.factors as any)?.tipoFrete ?? ((pricing?.factors?.freight ?? 0) > 0 ? 'CIF' : 'FOB')
  );
  const [valorFrete, setValorFrete] = useState<number | ''>(
    pricing?.factors?.freight ?? ''
  );
  const [observacoes, setObservacoes] = useState('');

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

  const handleSave = async () => {
    if (!numeroPedido.trim()) {
      showError('Informe o número do pedido.');
      return;
    }
    if (!produtoNome.trim()) {
      showError('Informe o produto.');
      return;
    }
    if (!quantidadeReal || Number(quantidadeReal) <= 0) {
      showError('Informe a quantidade.');
      return;
    }
    if (!precoUnitario || Number(precoUnitario) <= 0) {
      showError('Informe o preço unitário.');
      return;
    }

    setSaving(true);
    try {
      await createPedidoVenda({
        precificacao_id: pricing?.id ?? '',
        numero_pedido: numeroPedido.trim(),
        data_pedido: dataPedido || undefined,
        cliente_id: clientId || undefined,
        cliente_nome: clientSearch.trim() || undefined,
        produto_nome: produtoNome.trim(),
        quantidade_real: Number(quantidadeReal),
        preco_unitario: Number(precoUnitario),
        tipo_frete: tipoFrete,
        valor_frete: tipoFrete === 'CIF' && valorFrete !== '' ? Number(valorFrete) : undefined,
        condicao_pagamento: condicaoPagamento.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
        status: 'pendente',
        importado_por: currentUser.id,
      });
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

          {/* Data */}
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

          {/* Produto */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Produto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={produtoNome}
              onChange={(e) => setProdutoNome(e.target.value)}
              placeholder="Nome do produto / fórmula"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Quantidade (ton) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={quantidadeReal}
              onChange={(e) =>
                setQuantidadeReal(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="0.000"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Preço Unitário */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Preço Unitário (R$/ton) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={precoUnitario}
              onChange={(e) =>
                setPrecoUnitario(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="0.00"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
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

          {/* Tipo frete */}
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

          {/* Valor frete (CIF only) */}
          {tipoFrete === 'CIF' && (
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Valor do Frete (R$/ton)
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
