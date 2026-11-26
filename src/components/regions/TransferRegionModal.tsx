import React, { useState } from 'react';
import { ArrowLeftRight, Loader2, X } from 'lucide-react';
import type { PricingRecord, Region } from '../../types';
import { closeModalOnBackdrop } from '../../utils/modalUtils';

/** Transferir a precificação para outra região, com motivo (vai para o histórico). */
export default function TransferRegionModal({
  pricing,
  regions,
  saving,
  onConfirm,
  onClose,
}: {
  pricing: PricingRecord;
  regions: Region[];
  saving: boolean;
  onConfirm: (regionId: string, reason: string) => void;
  onClose: () => void;
}) {
  const current = regions.find((region) => region.id === pricing.regionId);
  const options = regions.filter((region) => region.ativo && region.id !== pricing.regionId);
  const [regionId, setRegionId] = useState(options[0]?.id || '');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!regionId) return setProblem('Escolha a nova região.');
    if (reason.trim().length < 5) return setProblem('Informe o motivo da transferência.');
    setProblem(null);
    onConfirm(regionId, reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, saving)}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="Transferir região"
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 font-black text-stone-900">
              <ArrowLeftRight className="h-4 w-4" /> Transferir região
            </p>
            <p className="text-xs text-stone-500">
              {pricing.formattedCod ? `Precificação ${pricing.formattedCod} · ` : ''}
              {pricing.factors?.client?.name || 'Cliente'} · hoje em{' '}
              <strong>{current?.name || 'sem região'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          {problem && (
            <p role="alert" className="text-sm font-semibold text-red-600">
              {problem}
            </p>
          )}
          {options.length === 0 ? (
            <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
              Não há outra região ativa para transferir.
            </p>
          ) : (
            <div>
              <label
                htmlFor="transfer-region"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500"
              >
                Nova região
              </label>
              <select
                id="transfer-region"
                value={regionId}
                onChange={(event) => setRegionId(event.target.value)}
                className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {options.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label
              htmlFor="transfer-reason"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500"
            >
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              id="transfer-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: cliente passou a ser atendido pela equipe de outra região."
              className="w-full resize-none rounded-xl border border-stone-300 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Fica registrado no histórico da precificação: quem transferiu, de onde, para onde e o
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
            disabled={saving || options.length === 0}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 disabled:bg-stone-300"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Transferir
          </button>
        </footer>
      </form>
    </div>
  );
}
