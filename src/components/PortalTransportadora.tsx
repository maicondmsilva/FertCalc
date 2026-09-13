import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogOut,
  MapPin,
  RefreshCw,
  Truck,
  XCircle,
} from 'lucide-react';
import type { User } from '../types';
import {
  listarCotacoesPortal,
  responderCotacaoPortal,
  type CotacaoPortalTransportadora,
} from '../services/portalTransportadoraService';
import { useToast } from './Toast';

export default function PortalTransportadora({
  currentUser,
  onLogout,
}: {
  currentUser: User;
  onLogout: () => void;
}) {
  const [cotacoes, setCotacoes] = useState<CotacaoPortalTransportadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CotacaoPortalTransportadora | null>(null);
  const [valor, setValor] = useState('');
  const [prazo, setPrazo] = useState('');
  const [validade, setValidade] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const { showError, showSuccess } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCotacoes(await listarCotacoesPortal());
    } catch {
      showError('Não foi possível carregar as cotações da transportadora.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void load();
  }, [load]);
  const abertas = useMemo(() => cotacoes.filter((c) => c.status === 'pendente'), [cotacoes]);

  const responder = async (aceitar: boolean) => {
    if (!selected || saving) return;
    const valorNumerico = Number(valor.replace(',', '.'));
    if (aceitar && (!Number.isFinite(valorNumerico) || valorNumerico <= 0)) {
      showError('Informe um valor de frete maior que zero.');
      return;
    }
    setSaving(true);
    try {
      await responderCotacaoPortal(selected.id, {
        aceitar,
        valorCotado: aceitar ? valorNumerico : undefined,
        prazoDias: prazo ? Number(prazo) : undefined,
        validadeCotacao: validade || undefined,
        observacoes,
      });
      showSuccess(aceitar ? 'Proposta enviada com sucesso.' : 'Cotação recusada.');
      setSelected(null);
      setValor('');
      setPrazo('');
      setValidade('');
      setObservacoes('');
      await load();
    } catch {
      showError('Não foi possível registrar a resposta. A cotação pode não estar mais disponível.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b border-stone-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-600 p-2.5 text-white">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Portal da transportadora
              </p>
              <h1 className="font-black">Olá, {currentUser.name}</h1>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-bold hover:bg-stone-50"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-8">
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-emerald-600 p-5 text-white shadow-sm">
            <p className="text-sm opacity-80">Aguardando resposta</p>
            <p className="mt-2 text-3xl font-black">{abertas.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Respondidas</p>
            <p className="mt-2 text-3xl font-black">
              {cotacoes.filter((c) => c.status === 'respondida').length}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Total disponível</p>
            <p className="mt-2 text-3xl font-black">{cotacoes.length}</p>
          </div>
        </section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Cotações de frete</h2>
            <p className="text-sm text-stone-500">
              Veja e responda somente as solicitações destinadas à sua empresa.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            aria-label="Atualizar cotações"
            className="rounded-lg border border-stone-200 bg-white p-2.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {loading ? (
          <div role="status" className="rounded-2xl bg-white p-10 text-center text-stone-500">
            Carregando cotações...
          </div>
        ) : cotacoes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
            <p className="font-bold">Nenhuma cotação disponível</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {cotacoes.map((c) => (
              <article
                key={c.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row">
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold">
                        Carga {c.numero_carregamento}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${c.status === 'pendente' ? 'bg-amber-100 text-amber-800' : c.status === 'respondida' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-stone-400" />
                        {c.quantidade_total.toLocaleString('pt-BR')} ton · {c.tipo_frete}
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-stone-400" />
                        {[c.local_carregamento, c.cidade_origem, c.estado_origem]
                          .filter(Boolean)
                          .join(' — ') || 'Origem não informada'}
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-stone-400" />
                        Previsto:{' '}
                        {c.data_prevista_carregamento
                          ? new Date(`${c.data_prevista_carregamento}T12:00:00`).toLocaleDateString(
                              'pt-BR'
                            )
                          : 'a definir'}
                      </span>
                      <span className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-stone-400" />
                        Solicitada em {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {c.valor_cotado != null && (
                      <p className="mt-3 font-bold text-emerald-700">
                        Proposta:{' '}
                        {c.valor_cotado.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </p>
                    )}
                  </div>
                  {c.status === 'pendente' && (
                    <button
                      onClick={() => setSelected(c)}
                      className="self-start rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      Responder cotação
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setSelected(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resposta-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="resposta-title" className="text-xl font-black">
              Responder carga {selected.numero_carregamento}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Valor do frete (R$)
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"
                  placeholder="0,00"
                />
              </label>
              <label className="text-sm font-bold">
                Prazo (dias)
                <input
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"
                />
              </label>
              <label className="text-sm font-bold sm:col-span-2">
                Validade da proposta
                <input
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                  type="date"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"
                />
              </label>
              <label className="text-sm font-bold sm:col-span-2">
                Observações
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                disabled={saving}
                onClick={() => void responder(false)}
                className="flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 font-bold text-red-700"
              >
                <XCircle className="h-4 w-4" /> Recusar
              </button>
              <button
                disabled={saving}
                onClick={() => void responder(true)}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-bold text-white"
              >
                <CheckCircle2 className="h-4 w-4" /> {saving ? 'Enviando...' : 'Enviar proposta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
