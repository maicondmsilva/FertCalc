import React, { useState, useEffect, useRef } from 'react';
import { PedidoVenda, Client } from '../types';
import { X, GitBranch, Search, AlertTriangle } from 'lucide-react';
import { getClients } from '../services/db';
import { getProdutosFormulados, ProdutoFormulado } from '../services/produtosFormuladosService';
import { executarCancSubstitui } from '../services/pedidosVendaService';
import { useToast } from './Toast';

interface CancSubstituiModalProps {
  pedido: PedidoVenda;
  currentUser: { id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}

function fmtQtd(n?: number | null) {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) + ' ton';
}

export default function CancSubstituiModal({
  pedido,
  currentUser,
  onClose,
  onSuccess,
}: CancSubstituiModalProps) {
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);

  // Client autocomplete
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState(pedido.cliente_nome ?? '');
  const [clientId, setClientId] = useState<string>(pedido.cliente_id ?? '');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);

  // Produtos
  const [produtosFormulados, setProdutosFormulados] = useState<ProdutoFormulado[]>([]);
  const [produtoId, setProdutoId] = useState<string>('');
  const [produtoNome, setProdutoNome] = useState(pedido.produto_nome ?? '');

  // Form
  const [quantidade, setQuantidade] = useState<string>('');
  const [valorUnitario, setValorUnitario] = useState<string>(
    pedido.preco_unitario != null ? String(pedido.preco_unitario) : ''
  );
  const [tipoFrete, setTipoFrete] = useState<'CIF' | 'FOB'>(
    (pedido.tipo_frete as 'CIF' | 'FOB') ?? 'FOB'
  );
  const [valorFrete, setValorFrete] = useState<string>(
    pedido.valor_frete != null ? String(pedido.valor_frete) : ''
  );
  const [vencimento, setVencimento] = useState(pedido.data_vencimento ?? pedido.data_pedido ?? '');
  const [emitente, setEmitente] = useState<string>(String((pedido.emitente ?? 1) + 1));
  const [motivo, setMotivo] = useState('');

  const saldo =
    pedido.saldo_disponivel ??
    (pedido.quantidade_original ?? pedido.quantidade_real ?? 0) -
      (pedido.quantidade_desmembrada ?? 0) -
      (pedido.quantidade_cancelada_definitiva ?? 0);

  const numeroPai =
    pedido.barra_pedido ||
    (pedido.numero_pedido ? `${pedido.numero_pedido}/${pedido.emitente ?? 1}` : '—');

  const novaBarraPedido = pedido.numero_pedido ? `${pedido.numero_pedido}/${emitente}` : '';

  useEffect(() => {
    getClients()
      .then(setClients)
      .catch(() => {});
    getProdutosFormulados()
      .then(setProdutosFormulados)
      .catch(() => {});
  }, []);

  const filteredClients =
    clientSearch.length >= 2
      ? clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
      : [];

  const handleSelectClient = (c: Client) => {
    setClientSearch(c.name);
    setClientId(c.id);
    setShowClientDropdown(false);
  };

  const handleSelectProduto = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setProdutoId(val);
    const found = produtosFormulados.find((p) => p.id === val);
    if (found) {
      setProdutoNome(found.formula_npk ? `${found.nome} (${found.formula_npk})` : found.nome);
    } else {
      setProdutoNome('');
    }
  };

  const handleSave = async () => {
    const qtd = parseFloat(quantidade.replace(',', '.'));
    if (!quantidade || isNaN(qtd) || qtd <= 0) {
      showError('Informe uma quantidade válida.');
      return;
    }
    if (qtd > saldo) {
      showError('Quantidade desmembrada maior que o saldo disponível.');
      return;
    }
    if (!produtoNome.trim()) {
      showError('Informe o produto.');
      return;
    }
    if (!motivo.trim()) {
      showError('Informe o motivo.');
      return;
    }
    const emitenteNum = parseInt(emitente, 10);
    if (isNaN(emitenteNum) || emitenteNum < 1) {
      showError('Informe um emitente válido.');
      return;
    }

    setSaving(true);
    try {
      await executarCancSubstitui({
        pedidoPai: pedido,
        filho: {
          precificacao_id: pedido.precificacao_id,
          numero_pedido: pedido.numero_pedido,
          barra_pedido: novaBarraPedido || undefined,
          emitente: emitenteNum,
          cliente_id: clientId || pedido.cliente_id,
          cliente_nome: clientSearch.trim() || pedido.cliente_nome,
          produto_nome: produtoNome.trim(),
          quantidade_real: qtd,
          preco_unitario:
            valorUnitario !== '' ? parseFloat(valorUnitario.replace(',', '.')) : undefined,
          tipo_frete: tipoFrete,
          valor_frete:
            tipoFrete === 'CIF' && valorFrete !== ''
              ? parseFloat(valorFrete.replace(',', '.'))
              : undefined,
          data_vencimento: vencimento || undefined,
          data_pedido: pedido.data_pedido,
          status: 'pendente',
          filial_id: pedido.filial_id,
          condicao_pagamento: pedido.condicao_pagamento,
        },
        motivo: motivo.trim(),
        usuarioId: currentUser.id,
        usuarioNome: currentUser.name,
      });
      showSuccess('Canc/Substitui realizado com sucesso!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Erro ao executar Canc/Substitui.';
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

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
        <div className="p-5 border-b border-stone-100 flex justify-between items-center bg-orange-600 text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Canc / Substitui
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
          {/* Origin pedido info (readonly) */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">
              Pedido Origem (somente leitura)
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase mb-0.5">Nº / Emitente</p>
                <p className="font-mono font-bold text-stone-800">{numeroPai}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase mb-0.5">Cliente</p>
                <p className="text-stone-700 truncate">{pedido.cliente_nome || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase mb-0.5">Produto</p>
                <p className="text-stone-700 truncate">{pedido.produto_nome || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase mb-0.5">Qtd. Original</p>
                <p className="font-mono text-stone-700">
                  {fmtQtd(pedido.quantidade_original ?? pedido.quantidade_real)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-bold text-stone-500 uppercase mb-0.5">
                  Saldo Disponível
                </p>
                <p
                  className={`font-mono font-bold text-base ${saldo > 0 ? 'text-emerald-700' : 'text-red-600'}`}
                >
                  {fmtQtd(saldo)}
                </p>
              </div>
            </div>
          </div>

          {saldo <= 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Saldo zerado. Não é possível desmembrar este pedido.</span>
            </div>
          )}

          {/* New child pedido fields */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">
              Novo Pedido Filho
            </p>

            {/* Cliente */}
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
                  className="w-full pl-9 pr-8 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
                {clientSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setClientSearch('');
                      setClientId('');
                      clientInputRef.current?.focus();
                    }}
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
                        className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 hover:text-orange-700 transition-colors"
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Produto */}
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Produto <span className="text-red-500">*</span>
              </label>
              <select
                value={produtoId}
                onChange={handleSelectProduto}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="">Selecione o produto...</option>
                {produtoOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {!produtoId && (
                <input
                  type="text"
                  value={produtoNome}
                  onChange={(e) => setProdutoNome(e.target.value)}
                  placeholder="Ou digite o nome do produto"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none text-stone-600"
                />
              )}
            </div>

            {/* Quantidade + Emitente */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Qtd. Desmembrada (ton) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  max={saldo}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="0.000"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
                {quantidade && parseFloat(quantidade) > saldo && (
                  <p className="text-xs text-red-500 mt-1">
                    Máx: {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ton
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Novo Emitente
                </label>
                <input
                  type="number"
                  min="1"
                  value={emitente}
                  onChange={(e) => setEmitente(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
                {novaBarraPedido && (
                  <p className="text-xs text-orange-600 mt-1 font-mono">→ {novaBarraPedido}</p>
                )}
              </div>
            </div>

            {/* Valor unitário + Vencimento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Valor Unitário (R$/ton)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorUnitario}
                  onChange={(e) => setValorUnitario(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Vencimento
                </label>
                <input
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>

            {/* Tipo de Frete */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Tipo de Frete
                </label>
                <select
                  value={tipoFrete}
                  onChange={(e) => setTipoFrete(e.target.value as 'CIF' | 'FOB')}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="CIF">CIF</option>
                  <option value="FOB">FOB</option>
                </select>
              </div>
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
                    onChange={(e) => setValorFrete(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Motivo <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Descreva o motivo do Canc/Substitui..."
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-stone-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saldo <= 0}
            className="px-5 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <GitBranch className="w-4 h-4" />
                Confirmar Canc/Substitui
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
