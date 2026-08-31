import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, History, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { Branch, Client, PedidoVenda, PedidoVendaItem, PricingRecord, User } from '../types';
import {
  getPedidoVendaAudit,
  getPedidoVendaEditContext,
  PedidoVendaAuditEntry,
  updatePedidoVendaProtegido,
} from '../services/pedidosVendaService';
import { useToast } from './Toast';

interface Props {
  pedido: PedidoVenda;
  items: PedidoVendaItem[];
  clients: Client[];
  pricingRecords: PricingRecord[];
  branches: Branch[];
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

const inputClass =
  'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-100 disabled:text-stone-500';

export default function EditarPedidoVendaModal({
  pedido,
  items,
  clients,
  pricingRecords,
  branches,
  currentUser,
  onClose,
  onSuccess,
}: Props) {
  const { showSuccess, showError } = useToast();
  const [header, setHeader] = useState({
    numero_pedido: pedido.numero_pedido ?? '',
    emitente: pedido.emitente ?? 1,
    data_pedido: pedido.data_pedido ?? '',
    data_vencimento: pedido.data_vencimento ?? '',
    cliente_id: pedido.cliente_id ?? '',
    precificacao_id: pedido.precificacao_id ?? '',
    filial_id: pedido.filial_id ?? '',
    tipo_frete: pedido.tipo_frete ?? '',
    valor_frete: pedido.valor_frete ?? 0,
    preco_unitario: pedido.preco_unitario ?? 0,
    condicao_pagamento: pedido.condicao_pagamento ?? '',
    observacoes: pedido.observacoes ?? '',
  });
  const [editItems, setEditItems] = useState<PedidoVendaItem[]>(items.map((item) => ({ ...item })));
  const [context, setContext] = useState({ hasRequest: false, hasProgress: false });
  const [audit, setAudit] = useState<PedidoVendaAuditEntry[]>([]);
  const [reason, setReason] = useState('');
  const [force, setForce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingRules, setLoadingRules] = useState(true);
  const isManager = ['master', 'admin', 'manager'].includes(currentUser.role);
  const isClosed = ['concluido', 'cancelado'].includes(pedido.status);
  const locksComposition = isClosed || (context.hasRequest && !force);

  useEffect(() => {
    Promise.all([getPedidoVendaEditContext(pedido.id), getPedidoVendaAudit(pedido.id)])
      .then(([nextContext, nextAudit]) => {
        setContext(nextContext);
        setAudit(nextAudit);
      })
      .catch(() => showError('Não foi possível carregar todas as regras de edição.'))
      .finally(() => setLoadingRules(false));
  }, [pedido.id, showError]);

  const changes = useMemo(() => {
    const labels: string[] = [];
    const original = {
      numero_pedido: pedido.numero_pedido ?? '',
      emitente: pedido.emitente ?? 1,
      data_pedido: pedido.data_pedido ?? '',
      data_vencimento: pedido.data_vencimento ?? '',
      cliente_id: pedido.cliente_id ?? '',
      precificacao_id: pedido.precificacao_id ?? '',
      filial_id: pedido.filial_id ?? '',
      tipo_frete: pedido.tipo_frete ?? '',
      valor_frete: pedido.valor_frete ?? 0,
      preco_unitario: pedido.preco_unitario ?? 0,
      condicao_pagamento: pedido.condicao_pagamento ?? '',
      observacoes: pedido.observacoes ?? '',
    };
    const names: Record<string, string> = {
      numero_pedido: 'número',
      emitente: 'emitente',
      data_pedido: 'data',
      data_vencimento: 'vencimento',
      cliente_id: 'cliente',
      precificacao_id: 'precificação',
      filial_id: 'filial',
      tipo_frete: 'frete',
      valor_frete: 'valor do frete',
      preco_unitario: 'preço',
      condicao_pagamento: 'pagamento',
      observacoes: 'observações',
    };
    Object.keys(original).forEach((key) => {
      if (
        String(header[key as keyof typeof header]) !==
        String(original[key as keyof typeof original])
      )
        labels.push(names[key]);
    });
    if (
      JSON.stringify(
        editItems.map(
          ({ id, produto_nome, quantidade_ton, preco_unitario, embalagem, precificacao_id }) => ({
            id,
            produto_nome,
            quantidade_ton,
            preco_unitario,
            embalagem,
            precificacao_id,
          })
        )
      ) !==
      JSON.stringify(
        items.map(
          ({ id, produto_nome, quantidade_ton, preco_unitario, embalagem, precificacao_id }) => ({
            id,
            produto_nome,
            quantidade_ton,
            preco_unitario,
            embalagem,
            precificacao_id,
          })
        )
      )
    )
      labels.push('produtos');
    return labels;
  }, [editItems, header, items, pedido]);

  const setItem = (index: number, patch: Partial<PedidoVendaItem>) =>
    setEditItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );

  const save = async () => {
    if (reason.trim().length < 5)
      return showError('Informe um motivo com pelo menos 5 caracteres.');
    if (!header.numero_pedido.trim() || header.emitente < 1)
      return showError('Informe número e emitente válidos.');
    if (!header.cliente_id || !header.filial_id || !header.precificacao_id)
      return showError('Cliente, filial e precificação são obrigatórios.');
    if (
      !editItems.length ||
      editItems.some((item) => !item.produto_nome.trim() || Number(item.quantidade_ton) <= 0)
    )
      return showError('Informe ao menos um produto com quantidade válida.');
    if (!changes.length) return showError('Nenhuma alteração foi feita.');
    setSaving(true);
    try {
      await updatePedidoVendaProtegido({
        pedidoId: pedido.id,
        expectedUpdatedAt: pedido.atualizado_em,
        reason: reason.trim(),
        force,
        header,
        items: editItems,
      });
      showSuccess('Pedido atualizado e alteração registrada no histórico.');
      await onSuccess();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível atualizar o pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-3"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-stone-800">
              Editar pedido {pedido.numero_pedido}/{pedido.emitente ?? 1}
            </h2>
            <p className="text-xs text-stone-500">Alterações protegidas, validadas e auditadas.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          {(context.hasRequest || isClosed) && (
            <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>
                {isClosed
                  ? 'Pedido encerrado: somente vencimento e observações podem ser corrigidos.'
                  : `Já existe solicitação de carregamento${context.hasProgress ? ' com movimentação' : ''}. Identificação e composição estão bloqueadas.`}
              </p>
            </div>
          )}
          {context.hasRequest && isManager && !isClosed && (
            <label className="flex items-start gap-2 rounded-xl border border-stone-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong>Correção excepcional de gestor</strong>
                <br />
                <span className="text-xs text-stone-500">
                  Libera campos protegidos; saldos já reservados continuam bloqueados no banco.
                </span>
              </span>
            </label>
          )}

          <section>
            <h3 className="mb-3 font-bold text-stone-700">Dados do pedido</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-bold text-stone-500">
                Número
                <input
                  className={inputClass}
                  disabled={loadingRules || locksComposition}
                  value={header.numero_pedido}
                  onChange={(e) => setHeader({ ...header, numero_pedido: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold text-stone-500">
                Emitente
                <input
                  type="number"
                  min="1"
                  className={inputClass}
                  disabled={loadingRules || locksComposition}
                  value={header.emitente}
                  onChange={(e) => setHeader({ ...header, emitente: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs font-bold text-stone-500">
                Data
                <input
                  type="date"
                  className={inputClass}
                  disabled={isClosed}
                  value={header.data_pedido}
                  onChange={(e) => setHeader({ ...header, data_pedido: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold text-stone-500">
                Vencimento
                <input
                  type="date"
                  className={inputClass}
                  value={header.data_vencimento}
                  onChange={(e) => setHeader({ ...header, data_vencimento: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold text-stone-500 sm:col-span-2">
                Cliente
                <select
                  className={inputClass}
                  disabled={loadingRules || locksComposition}
                  value={header.cliente_id}
                  onChange={(e) => setHeader({ ...header, cliente_id: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-stone-500">
                Filial
                <select
                  className={inputClass}
                  disabled={loadingRules || locksComposition}
                  value={header.filial_id}
                  onChange={(e) => setHeader({ ...header, filial_id: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-stone-500">
                Precificação
                <select
                  className={inputClass}
                  disabled={loadingRules || locksComposition}
                  value={header.precificacao_id}
                  onChange={(e) => setHeader({ ...header, precificacao_id: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {pricingRecords.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.formattedCod || p.cod || p.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-stone-500">
                Frete
                <select
                  className={inputClass}
                  disabled={isClosed}
                  value={header.tipo_frete}
                  onChange={(e) => setHeader({ ...header, tipo_frete: e.target.value })}
                >
                  <option value="">Não informado</option>
                  <option>CIF</option>
                  <option>FOB</option>
                </select>
              </label>
              <label className="text-xs font-bold text-stone-500">
                Valor frete
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  disabled={isClosed}
                  value={header.valor_frete}
                  onChange={(e) => setHeader({ ...header, valor_frete: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs font-bold text-stone-500">
                Preço unitário
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  disabled={isClosed}
                  value={header.preco_unitario}
                  onChange={(e) => setHeader({ ...header, preco_unitario: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs font-bold text-stone-500">
                Pagamento
                <input
                  className={inputClass}
                  disabled={isClosed}
                  value={header.condicao_pagamento}
                  onChange={(e) => setHeader({ ...header, condicao_pagamento: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold text-stone-500 sm:col-span-2 lg:col-span-4">
                Observações
                <textarea
                  className={inputClass}
                  rows={2}
                  value={header.observacoes}
                  onChange={(e) => setHeader({ ...header, observacoes: e.target.value })}
                />
              </label>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-stone-700">Produtos</h3>
              {!locksComposition && !isClosed && (
                <button
                  type="button"
                  onClick={() =>
                    setEditItems((x) => [
                      ...x,
                      {
                        produto_nome: '',
                        quantidade_ton: 0,
                        preco_unitario: 0,
                        embalagem: '',
                        precificacao_id: header.precificacao_id,
                      },
                    ])
                  }
                  className="flex items-center gap-1 text-xs font-bold text-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              )}
            </div>
            <div className="space-y-2">
              {editItems.map((item, index) => (
                <div
                  key={item.id ?? index}
                  className="grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-12"
                >
                  <input
                    aria-label="Produto"
                    className={`${inputClass} sm:col-span-4`}
                    disabled={locksComposition}
                    value={item.produto_nome}
                    onChange={(e) => setItem(index, { produto_nome: e.target.value })}
                    placeholder="Produto"
                  />
                  <input
                    aria-label="Quantidade"
                    type="number"
                    min="0.001"
                    step="0.001"
                    className={`${inputClass} sm:col-span-2`}
                    disabled={locksComposition}
                    value={item.quantidade_ton}
                    onChange={(e) => setItem(index, { quantidade_ton: Number(e.target.value) })}
                  />
                  <input
                    aria-label="Preço"
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${inputClass} sm:col-span-2`}
                    disabled={isClosed}
                    value={item.preco_unitario ?? 0}
                    onChange={(e) => setItem(index, { preco_unitario: Number(e.target.value) })}
                  />
                  <input
                    aria-label="Embalagem"
                    className={`${inputClass} sm:col-span-3`}
                    disabled={isClosed}
                    value={item.embalagem ?? ''}
                    onChange={(e) => setItem(index, { embalagem: e.target.value })}
                    placeholder="Embalagem"
                  />
                  <button
                    aria-label="Remover produto"
                    type="button"
                    disabled={locksComposition || editItems.length === 1}
                    onClick={() => setEditItems((x) => x.filter((_, i) => i !== index))}
                    className="flex items-center justify-center rounded-lg text-red-600 disabled:text-stone-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              <div className="flex-1">
                <label className="text-sm font-bold text-emerald-900">Motivo da alteração *</label>
                <textarea
                  className={`${inputClass} mt-2 bg-white`}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explique por que o pedido precisa ser corrigido"
                />
                <p className="mt-2 text-xs text-emerald-800">
                  <strong>Revisão:</strong>{' '}
                  {changes.length ? changes.join(', ') : 'nenhuma alteração identificada'}.
                </p>
              </div>
            </div>
          </section>

          {audit.length > 0 && (
            <details className="rounded-xl border p-4">
              <summary className="flex cursor-pointer items-center gap-2 font-bold text-stone-700">
                <History className="h-4 w-4" />
                Histórico de alterações ({audit.length})
              </summary>
              <div className="mt-3 space-y-2">
                {audit.map((entry) => (
                  <div key={entry.id} className="rounded-lg bg-stone-50 p-3 text-xs">
                    <strong>{new Date(entry.criado_em).toLocaleString('pt-BR')}</strong> —{' '}
                    {entry.motivo}
                    <div className="text-stone-500">
                      Campos: {entry.campos_alterados.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white px-5 py-4">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-bold">
            Cancelar
          </button>
          <button
            onClick={() => void save()}
            disabled={saving || loadingRules}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Revisar e salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
