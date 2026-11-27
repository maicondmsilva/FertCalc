import React, { useEffect, useState } from 'react';
import { Loader2, MapPin, Pencil, Truck, X } from 'lucide-react';
import type { PedidoVenda } from '../../types';
import type { CotacaoSolicitada, LocalCarregamento } from '../../types/carregamento';
import { getLocaisAtivos } from '../../services/locaisCarregamentoService';
import { getCotacaoById } from '../../services/cotacaoSolicitadaService';
import { alterarEnderecoEntrega } from '../../services/pedidosVendaService';
import { closeModalOnBackdrop } from '../../utils/modalUtils';
import { quoteValidity } from '../../utils/quoteValidity';
import { sanitizeUrl } from '../../utils/sanitizeUrl';
import { useToast } from '../Toast';
import { formatDate, formatMoney } from './pedidosVendaModel';

export interface UltimaAlteracaoEndereco {
  data: string;
  motivo: string;
}

/** Endereço em uma linha: "Rua X, 12 · Cidade/UF". */
export function enderecoCompleto(
  pedido: Pick<PedidoVenda, 'endereco_entrega' | 'cidade_entrega' | 'estado_entrega'>
): string {
  const cidade = [pedido.cidade_entrega, pedido.estado_entrega].filter(Boolean).join('/');
  return [pedido.endereco_entrega, cidade].filter(Boolean).join(' · ');
}

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs font-semibold text-stone-500">{label}</span>
      <span className="text-right text-[14px] font-medium text-stone-800">{children || '—'}</span>
    </div>
  );
}

function AlterarEnderecoModal({
  pedido,
  onClose,
  onSaved,
}: {
  pedido: PedidoVenda;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showSuccess, showError } = useToast();
  const [form, setForm] = useState({
    endereco: pedido.endereco_entrega || '',
    cidade: pedido.cidade_entrega || '',
    estado: pedido.estado_entrega || '',
    maps_url: pedido.maps_url || '',
    motivo: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const input =
    'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.endereco.trim()) return showError('Informe o endereço de entrega.');
    if (form.motivo.trim().length < 5) return showError('Informe o motivo da alteração.');
    setSaving(true);
    try {
      await alterarEnderecoEntrega(pedido.id, form);
      showSuccess('Endereço de entrega alterado. A mudança ficou no histórico do pedido.');
      onSaved();
      onClose();
    } catch (error) {
      showError((error as { message?: string })?.message || 'Não foi possível alterar o endereço.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, saving)}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="Alterar endereço de entrega"
        className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <p className="font-black text-stone-900">Alterar endereço de entrega</p>
            <p className="text-xs text-stone-500">
              Atual: {enderecoCompleto(pedido) || 'não informado'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-3 p-5">
          <label className="block text-xs font-bold uppercase tracking-wide text-stone-500">
            Endereço (fazenda, rodovia, km…)
            <input
              value={form.endereco}
              onChange={(event) => set('endereco', event.target.value)}
              className={`${input} mt-1.5 normal-case`}
            />
          </label>
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <label className="block text-xs font-bold uppercase tracking-wide text-stone-500">
              Cidade
              <input
                value={form.cidade}
                onChange={(event) => set('cidade', event.target.value)}
                className={`${input} mt-1.5 normal-case`}
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wide text-stone-500">
              UF
              <input
                value={form.estado}
                maxLength={2}
                onChange={(event) => set('estado', event.target.value.toUpperCase())}
                className={`${input} mt-1.5`}
              />
            </label>
          </div>
          <label className="block text-xs font-bold uppercase tracking-wide text-stone-500">
            Link do mapa (opcional)
            <input
              value={form.maps_url}
              onChange={(event) => set('maps_url', event.target.value)}
              placeholder="https://maps.google.com/…"
              className={`${input} mt-1.5 normal-case`}
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-stone-500">
            Motivo da alteração <span className="text-red-500">*</span>
            <textarea
              rows={2}
              value={form.motivo}
              onChange={(event) => set('motivo', event.target.value)}
              placeholder="Ex.: cliente pediu entrega em outra fazenda."
              className="mt-1.5 w-full resize-none rounded-xl border border-stone-300 p-3 text-sm normal-case outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            A alteração fica no histórico do pedido: quem mudou, quando, o endereço anterior e o
            motivo.
          </p>
        </div>
        <footer className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl px-4 text-sm font-bold text-stone-600 hover:bg-stone-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 disabled:bg-stone-300"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar endereço
          </button>
        </footer>
      </form>
    </div>
  );
}

/** Entrega e carregamento do pedido + frete da cotação vinculada. */
export default function EntregaCarregamento({
  pedido,
  filialNome,
  podeAlterar,
  ultimaAlteracao,
  onChanged,
}: {
  pedido: PedidoVenda;
  filialNome?: string;
  podeAlterar: boolean;
  ultimaAlteracao?: UltimaAlteracaoEndereco;
  onChanged: () => void;
}) {
  const [locais, setLocais] = useState<LocalCarregamento[]>([]);
  const [cotacao, setCotacao] = useState<CotacaoSolicitada | null>(null);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    getLocaisAtivos()
      .then(setLocais)
      .catch(() => setLocais([]));
  }, []);

  useEffect(() => {
    let active = true;
    if (!pedido.cotacao_frete_id) {
      setCotacao(null);
      return;
    }
    getCotacaoById(pedido.cotacao_frete_id).then((result) => {
      if (active) setCotacao(result);
    });
    return () => {
      active = false;
    };
  }, [pedido.cotacao_frete_id]);

  const local = locais.find((item) => item.id === pedido.local_carregamento_id);
  const mapa = pedido.maps_url ? sanitizeUrl(pedido.maps_url) : '';
  const cidade = [pedido.cidade_entrega, pedido.estado_entrega].filter(Boolean).join(' / ');
  const total =
    cotacao?.valor_frete_unitario && pedido.quantidade_real
      ? cotacao.valor_frete_unitario * Number(pedido.quantidade_real)
      : undefined;

  return (
    <>
      <section className="rounded-xl border border-stone-200 p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-black text-stone-900">
            <MapPin className="h-4 w-4 text-emerald-600" /> Entrega e carregamento
          </h3>
          {podeAlterar && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Alterar endereço
            </button>
          )}
        </div>
        <Linha label="Filial">{filialNome}</Linha>
        <Linha label="Local de carregamento">{local?.nome}</Linha>
        <Linha label="Previsão de carregamento">
          {pedido.previsao_entrega ? formatDate(pedido.previsao_entrega) : ''}
        </Linha>
        <Linha label="Endereço de entrega">
          {pedido.endereco_entrega ? (
            <>
              {pedido.endereco_entrega}
              {(cidade || mapa) && (
                <span className="block text-xs font-medium text-stone-500">
                  {cidade}
                  {mapa && (
                    <>
                      {cidade ? ' · ' : ''}
                      <a
                        href={mapa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        ver no mapa
                      </a>
                    </>
                  )}
                </span>
              )}
            </>
          ) : (
            ''
          )}
        </Linha>
        {ultimaAlteracao && (
          <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
            Endereço alterado em {formatDate(ultimaAlteracao.data)}:{' '}
            {ultimaAlteracao.motivo.replace(/^Endereço de entrega alterado:\s*/i, '')}. Veja a linha
            do tempo.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-black text-stone-900">
          <Truck className="h-4 w-4 text-blue-700" /> Frete
        </h3>
        <Linha label="Tipo">{pedido.tipo_frete}</Linha>
        {cotacao ? (
          <>
            <Linha label="Cotação">
              {cotacao.numero_cotacao}
              <span className="block text-xs font-medium text-stone-500">
                {quoteValidity(cotacao.validade_ate).label}
              </span>
            </Linha>
            <Linha label="Transportadora">
              {cotacao.transportadora?.nome || cotacao.transportadora_nome}
            </Linha>
            <Linha label="Frete">
              {cotacao.valor_frete_unitario != null
                ? `${formatMoney(cotacao.valor_frete_unitario)}/t${total ? ` · ${formatMoney(total)}` : ''}`
                : ''}
            </Linha>
          </>
        ) : (
          <>
            <Linha label="Frete">
              {pedido.valor_frete ? `${formatMoney(pedido.valor_frete)}/t` : ''}
            </Linha>
            <p className="text-xs text-stone-500">
              Sem cotação vinculada na precificação: a transportadora é definida no Carregamento.
            </p>
          </>
        )}
      </section>

      {editando && (
        <AlterarEnderecoModal
          pedido={pedido}
          onClose={() => setEditando(false)}
          onSaved={onChanged}
        />
      )}
    </>
  );
}
