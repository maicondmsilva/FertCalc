import React, { useState, useEffect } from 'react';
import { Truck, Calendar, CheckCircle, RefreshCw, X, Clock, MapPin, FileText } from 'lucide-react';
import {
  Carregamento,
  Transportadora,
  CotacaoFrete,
  HistoricoCarregamento,
} from '../../types/carregamento';
import {
  getCotacoesCarregamento,
  getHistoricoCarregamento,
} from '../../services/carregamentoService';
import { useToast } from '../Toast';
import { closeModalOnBackdrop } from '../../utils/modalUtils';
import { CotacaoFormData, fmtBRL, fmtCarregamentoNum, fmtDate } from './shared';

export interface ModalCotacaoProps {
  carregamento: Carregamento;
  transportadoras: Transportadora[];
  onSave: (carregamentoId: string, data: CotacaoFormData) => Promise<void>;
  onClose: () => void;
  canAprovar?: boolean;
  onAprovar: (cotacaoId: string) => Promise<void>;
}

export function ModalCotacao({
  carregamento,
  transportadoras,
  onSave,
  onClose,
  canAprovar,
  onAprovar,
}: ModalCotacaoProps) {
  const [form, setForm] = useState({
    transportadora_id: '',
    valor_cotado: '',
    prazo_dias: '',
    validade_cotacao: '',
    observacoes: '',
  });
  const [saving, setSaving] = useState(false);
  const [cotacoesExistentes, setCotacoesExistentes] = useState<CotacaoFrete[]>([]);
  const [loadingCotacoes, setLoadingCotacoes] = useState(true);
  const [aprovandoId, setAprovandoId] = useState<string | null>(null);
  const possuiPropostaAprovada = cotacoesExistentes.some(
    (cotacao) => cotacao.status === 'aprovada'
  );

  useEffect(() => {
    let ativo = true;
    setLoadingCotacoes(true);
    getCotacoesCarregamento(carregamento.id)
      .then((cotacoes) => {
        if (ativo) setCotacoesExistentes(cotacoes);
      })
      .catch((error) => console.error('Erro ao carregar propostas de frete:', error))
      .finally(() => {
        if (ativo) setLoadingCotacoes(false);
      });
    return () => {
      ativo = false;
    };
  }, [carregamento.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(carregamento.id, form);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, saving || aprovandoId !== null)}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Solicitar Cotação de Frete
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-100 text-sm text-stone-600">
          <span className="font-mono font-bold text-emerald-600">
            {fmtCarregamentoNum(carregamento)}
          </span>{' '}
          &mdash; {carregamento.tipo_frete} &mdash; {carregamento.quantidade_total} ton
        </div>
        <div className="px-6 pt-5">
          <p className="text-xs font-bold uppercase text-stone-500 mb-2">Propostas enviadas</p>
          {loadingCotacoes ? (
            <RefreshCw className="w-4 h-4 animate-spin text-stone-300" />
          ) : cotacoesExistentes.length === 0 ? (
            <p className="text-xs text-stone-400">Ainda não há transportadoras consultadas.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {cotacoesExistentes.map((cotacao) => (
                <div
                  key={cotacao.id}
                  className={`rounded-lg border p-3 text-xs ${
                    cotacao.status === 'respondida'
                      ? 'border-indigo-300 bg-indigo-50'
                      : cotacao.status === 'aprovada'
                        ? 'border-emerald-300 bg-emerald-50'
                        : cotacao.status === 'recusada'
                          ? 'border-red-200 bg-red-50'
                          : 'border-stone-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-stone-800">
                      {cotacao.transportadora?.nome ?? 'Transportadora'}
                    </span>
                    <span className="font-bold uppercase text-[10px] text-stone-600">
                      {cotacao.status === 'respondida'
                        ? 'Proposta recebida'
                        : cotacao.status === 'recusada'
                          ? 'Recusada'
                          : cotacao.status}
                    </span>
                  </div>
                  {cotacao.valor_cotado != null && (
                    <p className="mt-1 text-base font-black text-indigo-700">
                      {fmtBRL(cotacao.valor_cotado)}
                    </p>
                  )}
                  <div className="mt-1 flex gap-3 text-stone-500">
                    {cotacao.prazo_dias != null && <span>Prazo: {cotacao.prazo_dias} dia(s)</span>}
                    {cotacao.validade_cotacao && (
                      <span>Validade: {fmtDate(cotacao.validade_cotacao)}</span>
                    )}
                  </div>
                  {cotacao.observacoes && (
                    <p className="mt-1 text-stone-600">{cotacao.observacoes}</p>
                  )}
                  {canAprovar && cotacao.status === 'respondida' && (
                    <button
                      type="button"
                      disabled={aprovandoId !== null}
                      onClick={async () => {
                        setAprovandoId(cotacao.id);
                        try {
                          await onAprovar(cotacao.id);
                        } finally {
                          setAprovandoId(null);
                        }
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      {aprovandoId === cotacao.id ? 'Aprovando...' : 'Aprovar proposta'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {!possuiPropostaAprovada && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Transportadora *
              </label>
              <select
                value={form.transportadora_id}
                onChange={(e) => setForm({ ...form, transportadora_id: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                required
              >
                <option value="">— Selecione —</option>
                {transportadoras.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  Valor Cotado (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valor_cotado}
                  onChange={(e) => setForm({ ...form, valor_cotado: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  Prazo (dias)
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.prazo_dias}
                  onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Validade da Cotação
              </label>
              <input
                type="date"
                value={form.validade_cotacao}
                onChange={(e) => setForm({ ...form, validade_cotacao: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Observações
              </label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-bold transition-colors"
              >
                {saving ? 'Salvando...' : 'Solicitar Cotação'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL: Solicitar Cotação (multi-transportadora)
// ─────────────────────────────────────────────────────────────────────────────
export interface ModalSolicitarCotacaoProps {
  carregamento: Carregamento;
  transportadoras: Transportadora[];
  onSave: (
    carregamentoId: string,
    transportadoraIds: string[],
    prazo_dias?: number,
    observacoes?: string
  ) => Promise<void>;
  onClose: () => void;
}

export function ModalSolicitarCotacao({
  carregamento,
  transportadoras,
  onSave,
  onClose,
}: ModalSolicitarCotacaoProps) {
  const { showError } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prazo, setPrazo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const [historico, setHistorico] = useState<HistoricoCarregamento[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  useEffect(() => {
    setLoadingHistorico(true);
    getHistoricoCarregamento(carregamento.id)
      .then(setHistorico)
      .catch((err) => {
        console.error('[ModalSolicitarCotacao] failed to load historico:', err);
      })
      .finally(() => setLoadingHistorico(false));
  }, [carregamento.id]);

  const toggleTransportadora = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      showError('Selecione ao menos uma transportadora.');
      return;
    }
    setSaving(true);
    await onSave(
      carregamento.id,
      selectedIds,
      prazo ? parseInt(prazo) : undefined,
      observacoes || undefined
    );
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, saving)}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-stone-100 flex-shrink-0">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" /> Solicitar Cotação de Frete
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        {/* Carregamento details */}
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <p className="font-mono font-bold text-emerald-600 text-sm">
            {fmtCarregamentoNum(carregamento)}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                carregamento.tipo_frete === 'CIF'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {carregamento.tipo_frete}
            </span>
            <span className="text-xs text-stone-600">
              {carregamento.quantidade_total.toFixed(3)} ton
            </span>
            {carregamento.filial && (
              <span className="text-xs text-stone-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {carregamento.filial.nome}
              </span>
            )}
            {carregamento.data_prevista_carregamento && (
              <span className="text-xs text-stone-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {fmtDate(carregamento.data_prevista_carregamento)}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Transportadoras checkboxes */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-2">
              Selecionar Transportadoras *
            </label>
            {transportadoras.length === 0 ? (
              <p className="text-sm text-stone-400">Nenhuma transportadora cadastrada.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {transportadoras.map((t) => (
                  <label
                    key={t.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedIds.includes(t.id)
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(t.id)}
                      onChange={() => toggleTransportadora(t.id)}
                      className="w-4 h-4 text-blue-600 rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-800">{t.nome}</p>
                      {t.email && <p className="text-xs text-stone-500">{t.email}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
            {selectedIds.length > 0 && (
              <p className="text-xs text-blue-600 mt-2 font-medium">
                {selectedIds.length} transportadora
                {selectedIds.length > 1 ? 's' : ''} selecionada
                {selectedIds.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Prazo Desejado (dias) — opcional
            </label>
            <input
              type="number"
              min="1"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              placeholder="Ex: 7"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Observações — opcional
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Instruções especiais, restrições, etc."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || selectedIds.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-bold transition-colors"
            >
              {saving
                ? 'Solicitando...'
                : `Solicitar${selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}`}
            </button>
          </div>
        </form>

        {/* Histórico do Carregamento */}
        <div className="px-6 pb-6 border-t border-stone-100">
          <div className="flex items-center gap-2 mt-4 mb-3">
            <Clock className="w-4 h-4 text-stone-400" />
            <h4 className="text-xs font-bold text-stone-500 uppercase">Histórico</h4>
          </div>
          {loadingHistorico ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-4 h-4 animate-spin text-stone-300" />
            </div>
          ) : historico.length === 0 ? (
            <p className="text-xs text-stone-400">Nenhum histórico disponível.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {historico.map((h) => (
                <div key={h.id} className="flex gap-3 text-xs">
                  <span className="text-stone-400 flex-shrink-0 font-mono">
                    {new Date(h.criado_em).toLocaleString('pt-BR')}
                  </span>
                  <div className="flex-1">
                    <span className="text-stone-600">{h.descricao}</span>
                    {h.status_anterior && h.status_novo && (
                      <span className="ml-1 text-stone-400">
                        ({h.status_anterior} → {h.status_novo})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL: Liberação Parcial
// ─────────────────────────────────────────────────────────────────────────────
export interface ModalLiberacaoProps {
  carregamento: Carregamento;
  onSave: (carregamentoId: string, tipo: 'total' | 'parcial', quantidade?: number) => Promise<void>;
  onClose: () => void;
}

export function ModalLiberacao({ carregamento, onSave, onClose }: ModalLiberacaoProps) {
  const [tipo, setTipo] = useState<'total' | 'parcial'>('total');
  const [quantidade, setQuantidade] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSave(carregamento.id, tipo, tipo === 'parcial' ? parseFloat(quantidade) : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, saving)}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" /> Liberar Carregamento
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 hover:bg-stone-100 disabled:opacity-50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-100">
          <p className="text-sm font-mono font-bold text-emerald-600">
            {fmtCarregamentoNum(carregamento)}
          </p>
          <p className="text-xs text-stone-500">
            Total: {carregamento.quantidade_total} ton | Liberado:{' '}
            {carregamento.quantidade_liberada} ton
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-500 uppercase mb-2">
              Tipo de Liberação
            </label>
            <label className="flex items-center gap-3 p-3 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50">
              <input
                type="radio"
                value="total"
                checked={tipo === 'total'}
                onChange={() => setTipo('total')}
                className="text-emerald-600"
              />
              <div>
                <p className="text-sm font-bold text-stone-800">Liberação Total</p>
                <p className="text-xs text-stone-500">
                  Libera o restante:{' '}
                  {(
                    carregamento.quantidade_total -
                    (carregamento.quantidade_cancelada || 0) -
                    carregamento.quantidade_liberada
                  ).toFixed(3)}{' '}
                  ton
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50">
              <input
                type="radio"
                value="parcial"
                checked={tipo === 'parcial'}
                onChange={() => setTipo('parcial')}
                className="text-emerald-600"
              />
              <div>
                <p className="text-sm font-bold text-stone-800">Liberação Parcial</p>
                <p className="text-xs text-stone-500">Informe a quantidade a liberar</p>
              </div>
            </label>
          </div>

          {tipo === 'parcial' && (
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Quantidade a Liberar (ton) *
              </label>
              <input
                type="number"
                min="0.001"
                max={
                  carregamento.quantidade_total -
                  (carregamento.quantidade_cancelada || 0) -
                  carregamento.quantidade_liberada
                }
                step="0.001"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                required={tipo === 'parcial'}
              />
              <p className="text-xs text-stone-400 mt-1">
                Máximo disponível:{' '}
                {(
                  carregamento.quantidade_total -
                  (carregamento.quantidade_cancelada || 0) -
                  carregamento.quantidade_liberada
                ).toFixed(3)}{' '}
                ton
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors"
            >
              {saving ? 'Liberando...' : 'Confirmar Liberação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TABLE: Carregamentos
// ─────────────────────────────────────────────────────────────────────────────
