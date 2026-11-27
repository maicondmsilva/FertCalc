import React, { useEffect, useState } from 'react';
import { Ban, GitBranch, Pencil, Truck, X } from 'lucide-react';
import type { CancelamentoPedido, Client, PedidoVenda, PedidoVendaItem } from '../../types';
import {
  getCancelamentos,
  getPedidoVendaAudit,
  updateDadosComerciaisPedido,
  type PedidoSaldoAlertaPreferencia,
  type PedidoVendaAuditEntry,
} from '../../services/pedidosVendaService';
import HistoricoCarregamentosPedido from '../HistoricoCarregamentosPedido';
import EntregaCarregamento from './EntregaCarregamento';
import { useToast } from '../Toast';
import {
  STATUS_LABEL,
  STATUS_STYLE,
  buildPedidoTimeline,
  diasSemMovimento,
  formatDate,
  formatMoney,
  formatTon,
  pedidoLabel,
  pedidoProgress,
} from './pedidosVendaModel';

interface PedidoDetailPanelProps {
  pedido: PedidoVenda;
  itens: PedidoVendaItem[];
  client?: Client;
  pricingCode?: string;
  parentLabel?: string;
  filialNome?: string;
  alerta: PedidoSaldoAlertaPreferencia;
  podeReceberAlerta: boolean;
  onSaveAlerta: (preferencia: PedidoSaldoAlertaPreferencia) => void;
  onClose: () => void;
  onEdit: () => void;
  onSolicitarCarregamento: () => void;
  onCancSubstitui: () => void;
  onCancelamentoDefinitivo: () => void;
  onChanged: () => void;
}

const sectionTitle = 'text-xs font-bold uppercase tracking-widest text-stone-400';

function Info({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className="text-[14px] font-medium text-stone-800">{value || '—'}</p>
    </div>
  );
}

function DadosComerciais({ pedido, onSaved }: { pedido: PedidoVenda; onSaved: () => void }) {
  const { showSuccess, showError } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    safra: pedido.safra || '',
    previsao_entrega: pedido.previsao_entrega || '',
    local_entrega: pedido.local_entrega || '',
    numero_contrato: pedido.numero_contrato || '',
  });

  useEffect(() => {
    setEditing(false);
    setForm({
      safra: pedido.safra || '',
      previsao_entrega: pedido.previsao_entrega || '',
      local_entrega: pedido.local_entrega || '',
      numero_contrato: pedido.numero_contrato || '',
    });
  }, [pedido]);

  const save = async () => {
    setSaving(true);
    try {
      await updateDadosComerciaisPedido(pedido.id, form);
      showSuccess('Dados comerciais salvos.');
      setEditing(false);
      onSaved();
    } catch (error) {
      showError(
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Não foi possível salvar os dados comerciais.'
      );
    } finally {
      setSaving(false);
    }
  };

  const input =
    'h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={sectionTitle}>Dados comerciais</h3>
        {!editing && pedido.status !== 'cancelado' && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            Editar
          </button>
        )}
      </div>
      {editing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-stone-500">
            Safra
            <input
              value={form.safra}
              onChange={(event) => setForm({ ...form, safra: event.target.value })}
              placeholder="Ex.: 2026/27"
              className={input}
            />
          </label>
          <label className="text-xs font-semibold text-stone-500">
            Previsão de entrega
            <input
              type="date"
              value={form.previsao_entrega}
              onChange={(event) => setForm({ ...form, previsao_entrega: event.target.value })}
              className={input}
            />
          </label>
          <label className="text-xs font-semibold text-stone-500">
            Local de entrega
            <input
              value={form.local_entrega}
              onChange={(event) => setForm({ ...form, local_entrega: event.target.value })}
              placeholder="Fazenda, cidade ou armazém"
              className={input}
            />
          </label>
          <label className="text-xs font-semibold text-stone-500">
            Nº do contrato
            <input
              value={form.numero_contrato}
              onChange={(event) => setForm({ ...form, numero_contrato: event.target.value })}
              className={input}
            />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="h-9 rounded-lg border border-stone-300 px-4 text-sm font-bold text-stone-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Info label="Safra" value={pedido.safra} />
          <Info label="Previsão de entrega" value={formatDate(pedido.previsao_entrega)} />
          <Info label="Local de entrega" value={pedido.local_entrega} />
          <Info label="Nº do contrato" value={pedido.numero_contrato} />
        </div>
      )}
    </section>
  );
}

/** Painel lateral com tudo sobre o pedido aberto. */
export function PedidoDetailPanel({
  pedido,
  itens,
  client,
  pricingCode,
  parentLabel,
  filialNome,
  alerta,
  podeReceberAlerta,
  onSaveAlerta,
  onClose,
  onEdit,
  onSolicitarCarregamento,
  onCancSubstitui,
  onCancelamentoDefinitivo,
  onChanged,
}: PedidoDetailPanelProps) {
  const [audit, setAudit] = useState<PedidoVendaAuditEntry[]>([]);
  const [cancelamentos, setCancelamentos] = useState<CancelamentoPedido[]>([]);
  const [alertaDias, setAlertaDias] = useState(alerta.dias_limite);
  const progress = pedidoProgress(pedido);
  const ativo = pedido.status !== 'cancelado' && pedido.status !== 'concluido';
  const hasSaldoNosItens =
    itens.length === 0 || itens.some((item) => Number(item.saldo_disponivel ?? 0) > 0);
  const dias = diasSemMovimento(pedido);

  useEffect(() => setAlertaDias(alerta.dias_limite), [alerta.dias_limite]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      getPedidoVendaAudit(pedido.id),
      getCancelamentos({ pedidoOrigemId: pedido.id }),
    ]).then(([auditResult, cancelResult]) => {
      if (cancelled) return;
      setAudit(auditResult.status === 'fulfilled' ? auditResult.value : []);
      setCancelamentos(cancelResult.status === 'fulfilled' ? cancelResult.value : []);
    });
    return () => {
      cancelled = true;
    };
  }, [pedido.id, pedido.atualizado_em]);

  const timeline = buildPedidoTimeline(pedido, audit, cancelamentos);
  const address = client?.deliveryAddress || client?.address;

  return (
    <aside
      className="flex h-full flex-col bg-white"
      aria-label={`Detalhe do pedido ${pedidoLabel(pedido)}`}
    >
      <header className="border-b border-stone-200 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-2xl font-black text-stone-900">
                {pedidoLabel(pedido)}
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[pedido.status]}`}
              >
                {STATUS_LABEL[pedido.status]}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[15px] font-semibold text-stone-700">
              {client?.name || pedido.cliente_nome || 'Cliente não informado'}
            </p>
            <p className="text-xs text-stone-500">
              {pedido.regiao_nome ? `Região: ${pedido.regiao_nome} · ` : ''}
              {pedido.vendedor_nome ? `Vendedor: ${pedido.vendedor_nome} · ` : ''}
              Pedido de {formatDate(pedido.data_pedido || pedido.criado_em)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhe"
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ativo && progress.saldo > 0 && (
            <button
              type="button"
              onClick={onSolicitarCarregamento}
              disabled={!hasSaldoNosItens}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              <Truck className="h-4 w-4" /> Solicitar carregamento
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-300 px-3 text-sm font-bold text-stone-700 hover:bg-stone-50"
          >
            <Pencil className="h-4 w-4" /> Editar
          </button>
          {ativo && (
            <>
              <button
                type="button"
                onClick={onCancSubstitui}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-orange-300 px-3 text-sm font-bold text-orange-700 hover:bg-orange-50"
              >
                <GitBranch className="h-4 w-4" /> Canc/Substitui
              </button>
              <button
                type="button"
                onClick={onCancelamentoDefinitivo}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-600 hover:bg-red-50"
              >
                <Ban className="h-4 w-4" /> Cancelar saldo
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* Quantidades */}
        <section className="rounded-xl border border-stone-200 p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs font-semibold text-stone-500">Vendido</p>
              <p className="font-mono text-lg font-black text-stone-900">
                {formatTon(progress.total)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-500">Carregado</p>
              <p className="font-mono text-lg font-black text-stone-900">
                {formatTon(progress.carregado)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-500">Saldo a carregar</p>
              <p className="font-mono text-lg font-black text-emerald-700">
                {formatTon(progress.saldo)}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs font-bold text-stone-500">
            {progress.percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% carregado
          </p>
          {(Number(pedido.quantidade_desmembrada) > 0 ||
            Number(pedido.quantidade_cancelada_definitiva) > 0) && (
            <p className="mt-2 text-xs text-stone-500">
              {Number(pedido.quantidade_desmembrada) > 0 &&
                `Substituído: ${formatTon(pedido.quantidade_desmembrada)}. `}
              {Number(pedido.quantidade_cancelada_definitiva) > 0 &&
                `Cancelado: ${formatTon(pedido.quantidade_cancelada_definitiva)}.`}
            </p>
          )}
        </section>

        {podeReceberAlerta && ativo && progress.saldo > 0 && (
          <section
            className={`rounded-xl border p-4 text-sm ${
              !alerta.desativado && dias >= alerta.dias_limite
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-stone-200 text-stone-600'
            }`}
          >
            <p>
              {!alerta.desativado && dias >= alerta.dias_limite ? (
                <>
                  <strong>Atenção:</strong> saldo de {formatTon(progress.saldo)} sem nova carga há{' '}
                  {dias} dias.
                </>
              ) : (
                <>Alerta de saldo parado {alerta.desativado ? 'desativado' : 'ativo'}.</>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-2">
                Alertar após
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={alertaDias}
                  onChange={(event) => setAlertaDias(Math.max(1, Number(event.target.value) || 1))}
                  onBlur={() => onSaveAlerta({ ...alerta, dias_limite: alertaDias })}
                  className="w-16 rounded border border-stone-300 bg-white px-2 py-1"
                />
                dias
              </label>
              <button
                type="button"
                onClick={() => onSaveAlerta({ ...alerta, desativado: !alerta.desativado })}
                className="font-bold underline"
              >
                {alerta.desativado ? 'Reativar alerta' : 'Desativar neste pedido'}
              </button>
            </div>
          </section>
        )}

        {/* Produtos */}
        {itens.length > 0 && (
          <section className="space-y-2">
            <h3 className={sectionTitle}>Produtos</h3>
            {itens.map((item, index) => {
              const total = Number(item.quantidade_ton || 0);
              const carregado = Math.min(
                total,
                Math.max(0, Number(item.quantidade_carregada ?? 0))
              );
              const percent = total > 0 ? (carregado / total) * 100 : 0;
              return (
                <div key={item.id ?? index} className="rounded-xl border border-stone-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14px] font-bold text-stone-800">
                      {item.produto_nome}
                    </span>
                    <span className="font-mono text-sm font-bold text-stone-700">
                      {formatTon(total)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {item.embalagem ? `${item.embalagem} · ` : ''}
                    {item.preco_unitario ? `${formatMoney(item.preco_unitario)}/t · ` : ''}
                    {formatTon(carregado)} carregadas · saldo{' '}
                    {formatTon(Number(item.saldo_a_carregar ?? total - carregado))}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <EntregaCarregamento
          pedido={pedido}
          filialNome={filialNome}
          podeAlterar={ativo}
          ultimaAlteracao={(() => {
            const entry = audit.find((item) => /^Endereço de entrega alterado/i.test(item.motivo));
            return entry ? { data: entry.criado_em, motivo: entry.motivo } : undefined;
          })()}
          onChanged={onChanged}
        />

        <DadosComerciais pedido={pedido} onSaved={onChanged} />

        {/* Pedido */}
        <section className="space-y-3">
          <h3 className={sectionTitle}>Pedido</h3>
          <div className="grid grid-cols-2 gap-3">
            <Info label="Vencimento" value={formatDate(pedido.data_vencimento)} />
            <Info label="Pagamento" value={pedido.condicao_pagamento} />
            <Info
              label="Frete"
              value={
                pedido.tipo_frete
                  ? `${pedido.tipo_frete}${pedido.valor_frete ? ` · ${formatMoney(pedido.valor_frete)}/t` : ''}`
                  : undefined
              }
            />
            <Info
              label="Preço unitário"
              value={
                pedido.preco_unitario != null
                  ? `${formatMoney(pedido.preco_unitario)}/t`
                  : undefined
              }
            />
            <Info label="Precificação" value={pricingCode} />
            <Info label="Pedido de origem" value={parentLabel} />
          </div>
          {pedido.observacoes && <Info label="Observações" value={pedido.observacoes} />}
        </section>

        {/* Cliente */}
        {client && (
          <section className="space-y-3">
            <h3 className={sectionTitle}>Cliente</h3>
            <div className="grid grid-cols-2 gap-3">
              <Info label="CNPJ / CPF" value={client.document} />
              <Info label="Inscrição estadual" value={client.stateRegistration} />
              <Info label="Fazenda" value={client.fazenda} />
              <Info label="Telefone" value={client.phone} />
            </div>
            {address && (
              <Info
                label="Endereço de entrega"
                value={[
                  [address.street, address.number].filter(Boolean).join(', '),
                  address.neighborhood,
                  [address.city, address.state].filter(Boolean).join('/'),
                  address.cep ? `CEP ${address.cep}` : '',
                ]
                  .filter(Boolean)
                  .join(' - ')}
              />
            )}
          </section>
        )}

        <section className="space-y-2">
          <h3 className={sectionTitle}>Carregamentos</h3>
          <HistoricoCarregamentosPedido pedidoVendaId={pedido.id} />
        </section>

        <section className="space-y-2">
          <h3 className={sectionTitle}>Linha do tempo</h3>
          <ol className="space-y-3 border-l-2 border-stone-200 pl-4">
            {timeline.map((event) => (
              <li key={event.id} className="relative">
                <span
                  className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${
                    event.tone === 'danger'
                      ? 'bg-red-500'
                      : event.tone === 'warning'
                        ? 'bg-orange-400'
                        : event.tone === 'success'
                          ? 'bg-emerald-500'
                          : 'bg-stone-400'
                  }`}
                />
                <p className="text-sm font-bold text-stone-800">{event.title}</p>
                <p className="text-xs text-stone-500">
                  {new Date(event.date).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                  {event.detail ? ` · ${event.detail}` : ''}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </aside>
  );
}
