import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Calculator,
  Copy,
  Download,
  MessageCircle,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type { AppSettings, User } from '../../types';
import type { Proposta, PropostaItem } from '../../types/proposta';
import {
  alterarValidadeProposta,
  cancelarProposta,
  getProposta,
  linkProposta,
  listPropostas,
  registrarDocumentoProposta,
  urlPropostaCliente,
} from '../../services/propostaService';
import {
  SITUACAO_PROPOSTA,
  diasParaVencer,
  estatisticasPropostas,
  filtrarPropostas,
  formatDataBr,
  formatNumeroProposta,
  hojeIso,
  situacaoProposta,
  totaisExibidos,
  type PropostaFiltros,
} from '../../utils/propostaModel';
import {
  baixarExcelProposta,
  createComprovantePdf,
  createPropostaPdf,
  moedaProposta,
  totaisProposta,
  vencimentoItem,
} from '../../utils/propostaDocumento';
import { saveOrSharePdf } from '../../utils/pdfDelivery';
import { useToast } from '../Toast';
import { useMyRegions } from '../../hooks/useMyRegions';
import RegionFilterSelect from '../regions/RegionFilterSelect';
import { permissoesProposta } from './propostaPermissions';
import { qrDaVerificacao, qrDoAceite } from './propostaQr';

interface PropostasPanelProps {
  currentUser: User;
  settings: AppSettings;
  /** Muda quando uma proposta nova é criada, para recarregar a lista. */
  reloadKey?: number;
  /** Abre a calculadora preenchida com o que o cliente aceitou. */
  onGerarPrecificacao?: (proposta: Proposta) => void;
  /** Proposta a abrir assim que a aba carrega (aviso clicado). */
  abrirPropostaId?: string | null;
}

const inputClass =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[15px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500';

function SituacaoBadge({ proposta }: { proposta: Pick<Proposta, 'status' | 'validaAte'> }) {
  const situacao = situacaoProposta(proposta);
  const style = SITUACAO_PROPOSTA[situacao];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${style.className}`}
    >
      {style.label}
    </span>
  );
}

function ValidadeTexto({ proposta }: { proposta: Proposta }) {
  const situacao = situacaoProposta(proposta);
  const dias = diasParaVencer(proposta.validaAte);
  return (
    <span className="tabular-nums">
      {formatDataBr(proposta.validaAte)}
      {situacao === 'vigente' && (
        <span
          className={`ml-1 text-xs font-bold ${dias <= 3 ? 'text-amber-700' : 'text-stone-400'}`}
        >
          {dias === 0 ? '· vence hoje' : `· ${dias} dia${dias === 1 ? '' : 's'}`}
        </span>
      )}
    </span>
  );
}

/** Batida como fechou na proposta e as condições do produto. */
function ItemDetalhe({ item, moeda }: { item: PropostaItem; moeda: 'BRL' | 'USD' }) {
  const fatores = (item.fatores || {}) as Record<string, unknown>;
  const num = (key: string) => Number(fatores[key]) || 0;
  const linhas: Array<[string, string]> = [
    ['Fator', num('factor') ? `${num('factor').toLocaleString('pt-BR')} ×` : '—'],
    ['Desconto', num('discount') ? `${moedaProposta(num('discount'), moeda)}/t` : '—'],
    ['Comissão', num('commission') ? `${num('commission').toLocaleString('pt-BR')}%` : '—'],
    ['Alíquota', num('taxRate') ? `${num('taxRate').toLocaleString('pt-BR')}%` : '—'],
    [
      'Frete',
      fatores.tipoFrete === 'FOB'
        ? 'FOB'
        : `CIF · ${moedaProposta(num('freight'), 'BRL')}/t${fatores.cotacaoFreteNumero ? ` (${String(fatores.cotacaoFreteNumero)})` : ''}`,
    ],
    ['Vencimento', vencimentoItem(item)],
    [
      'Juros',
      num('monthlyInterestRate')
        ? `${num('monthlyInterestRate').toLocaleString('pt-BR')}% a.m.${fatores.exemptCurrentMonth ? ' · mês atual isento' : ''}`
        : '—',
    ],
    ['Embalagem', item.embalagem || '—'],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-500">
          Batida {item.formula?.targetFormula ? `· alvo ${item.formula.targetFormula}` : ''}
        </p>
        {item.composicao.length === 0 ? (
          <p className="text-sm text-stone-500">Sem composição registrada.</p>
        ) : (
          <ul className="space-y-0.5 text-sm">
            {item.composicao.map((material) => (
              <li key={`${material.nome}-${material.tipo}`} className="flex justify-between gap-2">
                <span>
                  {material.nome}
                  {material.tipo ? (
                    <span className="text-xs text-stone-400"> · {material.tipo}</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-stone-700">
                  {Math.round(material.kg).toLocaleString('pt-BR')} kg
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-500">Condições</p>
        <dl className="space-y-0.5 text-sm">
          {linhas.map(([label, valor]) => (
            <div key={label} className="flex justify-between gap-2">
              <dt className="text-stone-500">{label}</dt>
              <dd className="text-right text-stone-800">{valor}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Aba Propostas de Batidas Salvas: histórico, PDF/Excel, validade e cancelamento. */
export default function PropostasPanel({
  currentUser,
  settings,
  reloadKey,
  onGerarPrecificacao,
  abrirPropostaId,
}: PropostasPanelProps) {
  const { showError, showSuccess } = useToast();
  const permissoes = permissoesProposta(currentUser);
  const { all: regioes } = useMyRegions(currentUser);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<PropostaFiltros>({ busca: '', situacao: '', regiao: '' });
  const [aberta, setAberta] = useState<Proposta | null>(null);
  const [abrindoId, setAbrindoId] = useState<string | null>(null);
  const [gerando, setGerando] = useState<'pdf' | 'excel' | null>(null);
  const [acao, setAcao] = useState<'validade' | 'cancelar' | null>(null);
  const [novaValidade, setNovaValidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [comComposicao, setComComposicao] = useState(false);
  const [itemAberto, setItemAberto] = useState<string | null>(null);

  /** Copia o link do cliente ou abre o WhatsApp com a mensagem pronta. */
  const enviarLink = async (destino: 'copiar' | 'whatsapp') => {
    if (!aberta) return;
    setGerandoLink(true);
    try {
      const url = urlPropostaCliente(await linkProposta(aberta.id));
      const mensagem = `Olá! Segue a proposta de preços ${formatNumeroProposta(aberta.numero)}, válida até ${formatDataBr(aberta.validaAte)}. Escolha os produtos e as quantidades e confirme por aqui: ${url}`;
      if (destino === 'copiar') {
        await navigator.clipboard.writeText(url);
        showSuccess('Link copiado. Envie ao cliente.');
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank', 'noopener');
      }
      setAberta(await getProposta(aberta.id).catch(() => aberta));
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível gerar o link.');
    } finally {
      setGerandoLink(false);
    }
  };

  const baixarComprovante = async () => {
    if (!aberta?.resposta) return;
    const doc = createComprovantePdf({
      numero: aberta.numero,
      clienteNome: aberta.clienteNome,
      vendedor: aberta.criadoPorNome,
      moeda: aberta.moeda,
      resposta: aberta.resposta,
      settings,
      ...(await qrDaVerificacao(aberta.resposta)),
    });
    await saveOrSharePdf(
      doc,
      `comprovante-${formatNumeroProposta(aberta.numero)}.pdf`,
      'Comprovante da proposta'
    );
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setPropostas(await listPropostas());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar, reloadKey]);

  const visiveis = useMemo(() => filtrarPropostas(propostas, filtros), [propostas, filtros]);
  const stats = useMemo(() => estatisticasPropostas(propostas), [propostas]);

  const abrir = async (id: string) => {
    setAbrindoId(id);
    try {
      setAberta(await getProposta(id));
      setAcao(null);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível abrir a proposta.');
    } finally {
      setAbrindoId(null);
    }
  };
  // Aviso clicado: abre a proposta indicada no endereço (uma vez).
  const abertaDoLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!abrirPropostaId || abertaDoLinkRef.current === abrirPropostaId) return;
    abertaDoLinkRef.current = abrirPropostaId;
    void abrir(abrirPropostaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirPropostaId]);

  const recarregarAberta = async (id: string) => {
    await carregar();
    setAberta(await getProposta(id));
  };

  const gerar = async (formato: 'pdf' | 'excel') => {
    if (!aberta) return;
    setGerando(formato);
    try {
      if (formato === 'pdf') {
        const doc = createPropostaPdf({
          proposta: { ...aberta, incluirComposicao: comComposicao },
          itens: aberta.itens || [],
          settings,
          qrAceite: permissoes.criar ? await qrDoAceite(aberta) : undefined,
        });
        await saveOrSharePdf(
          doc,
          `${formatNumeroProposta(aberta.numero)}.pdf`,
          'Proposta de preços'
        );
      } else {
        await baixarExcelProposta(
          { ...aberta, incluirComposicao: comComposicao },
          aberta.itens || [],
          settings
        );
      }
      await registrarDocumentoProposta(aberta.id, formato).catch(() => {});
      setAberta(await getProposta(aberta.id).catch(() => aberta));
    } catch {
      showError(
        formato === 'pdf' ? 'Não foi possível gerar o PDF.' : 'Não foi possível gerar o Excel.'
      );
    } finally {
      setGerando(null);
    }
  };

  const confirmarAcao = async () => {
    if (!aberta || !acao) return;
    if (!motivo.trim()) {
      showError('Informe o motivo.');
      return;
    }
    setSalvando(true);
    try {
      if (acao === 'validade') {
        await alterarValidadeProposta(aberta.id, novaValidade, motivo.trim());
        showSuccess('Validade alterada.');
      } else {
        await cancelarProposta(aberta.id, motivo.trim());
        showSuccess('Proposta cancelada.');
      }
      setAcao(null);
      setMotivo('');
      await recarregarAberta(aberta.id);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const situacaoAberta = aberta ? situacaoProposta(aberta) : null;
  const totaisAberta = aberta ? totaisProposta(aberta.itens || []) : null;
  const nomeRegiao = (id?: string) =>
    id ? regioes.find((region) => region.id === id)?.name || 'Região removida' : 'Sem região';
  const aceitoPorItem = new Map(
    (aberta?.resposta?.tipo === 'aceite' ? aberta.resposta.itens : []).map((item) => [
      item.id,
      item.quantidade,
    ])
  );
  const exibidosAberta = aberta ? totaisExibidos(aberta) : null;

  return (
    <div className="space-y-5">
      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Vigentes', value: stats.vigentes, tone: 'text-emerald-700' },
          { label: 'Vencem em até 3 dias', value: stats.vencendo, tone: 'text-amber-700' },
          { label: 'Aceitas', value: stats.aceitas, tone: 'text-blue-700' },
          {
            label: 'Conversão',
            value:
              stats.conversao === null
                ? '—'
                : `${stats.conversao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
            tone: 'text-violet-700',
          },
          {
            label: 'Valor aceito',
            value: stats.valorAceito > 0 ? moedaProposta(stats.valorAceito, 'BRL') : '—',
            detail:
              stats.toneladasAceitas > 0
                ? `${stats.toneladasAceitas.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} t aceitas`
                : undefined,
            tone: 'text-blue-700',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-black tabular-nums ${card.tone}`}>{card.value}</p>
            {'detail' in card && card.detail && (
              <p className="text-xs text-stone-500">{card.detail}</p>
            )}
          </div>
        ))}
      </div>

      {/* Filtros */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]">
          <label className="relative block">
            <span className="sr-only">Buscar proposta</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400" />
            <input
              type="search"
              value={filtros.busca}
              onChange={(event) => setFiltros({ ...filtros, busca: event.target.value })}
              placeholder="Número, cliente, CPF/CNPJ ou vendedor…"
              className={`${inputClass} pl-9`}
            />
          </label>
          <select
            aria-label="Situação"
            value={filtros.situacao}
            onChange={(event) =>
              setFiltros({
                ...filtros,
                situacao: event.target.value as PropostaFiltros['situacao'],
              })
            }
            className={inputClass}
          >
            <option value="">Todas as situações</option>
            {Object.entries(SITUACAO_PROPOSTA).map(([value, style]) => (
              <option key={value} value={value}>
                {style.label}
              </option>
            ))}
          </select>
          {regioes.length > 0 ? (
            <RegionFilterSelect
              regions={regioes}
              value={filtros.regiao}
              onChange={(regiao) => setFiltros({ ...filtros, regiao })}
              className={inputClass}
            />
          ) : (
            <span className="hidden md:block" />
          )}
          <button
            type="button"
            onClick={() => void carregar()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 px-4 text-sm font-bold text-stone-700 hover:bg-stone-50"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
      </section>

      {loadError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" /> {loadError}
        </div>
      )}

      {/* Lista */}
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando propostas…
          </div>
        ) : visiveis.length === 0 ? (
          <div className="p-10 text-center text-sm text-stone-500">
            {propostas.length === 0
              ? 'Nenhuma proposta ainda. Selecione batidas e use “Gerar proposta” para criar a primeira.'
              : 'Nenhuma proposta com esses filtros.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-bold uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3">Proposta</th>
                  <th className="px-4 py-3">Cliente</th>
                  {regioes.length > 0 && <th className="px-4 py-3">Região</th>}
                  <th className="px-4 py-3">Válida até</th>
                  <th className="px-4 py-3 text-right">Volume</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((proposta) => (
                  <tr
                    key={proposta.id}
                    className="cursor-pointer border-b border-stone-100 last:border-0 hover:bg-emerald-50/40"
                    onClick={() => void abrir(proposta.id)}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void abrir(proposta.id);
                        }}
                        className="font-mono font-bold text-emerald-700 hover:underline"
                      >
                        {formatNumeroProposta(proposta.numero)}
                      </button>
                      <span className="block text-xs text-stone-400">
                        {formatDataBr(proposta.createdAt)} · {proposta.criadoPorNome || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-stone-800">
                        {proposta.clienteNome}
                      </span>
                      {proposta.clienteDocumento && (
                        <span className="text-xs text-stone-400">{proposta.clienteDocumento}</span>
                      )}
                    </td>
                    {regioes.length > 0 && (
                      <td className="px-4 py-3 text-stone-700">{nomeRegiao(proposta.regionId)}</td>
                    )}
                    <td className="px-4 py-3 text-stone-700">
                      <ValidadeTexto proposta={proposta} />
                    </td>
                    {(() => {
                      const totais = totaisExibidos(proposta);
                      return (
                        <>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {totais.toneladas > 0
                              ? `${totais.toneladas.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} t`
                              : '—'}
                            <span className="block text-xs text-stone-400">
                              {proposta.quantidadeItens} produto(s)
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-stone-800">
                            {totais.valor > 0 ? (
                              moedaProposta(totais.valor, proposta.moeda)
                            ) : (
                              <span className="text-xs font-normal text-stone-400">só preço/t</span>
                            )}
                            {totais.origem === 'aceite' && (
                              <span className="block text-xs font-bold text-blue-700">aceito</span>
                            )}
                          </td>
                        </>
                      );
                    })()}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <SituacaoBadge proposta={proposta} />
                        {abrindoId === proposta.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detalhe */}
      {aberta && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !salvando) setAberta(null);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Proposta ${formatNumeroProposta(aberta.numero)}`}
            className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-stone-50 shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-stone-200 bg-white p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-mono text-xl font-black text-stone-900">
                    {formatNumeroProposta(aberta.numero)}
                  </h3>
                  <SituacaoBadge proposta={aberta} />
                </div>
                <p className="mt-1 text-sm text-stone-500">
                  {aberta.clienteNome} · criada em {formatDataBr(aberta.createdAt)} por{' '}
                  {aberta.criadoPorNome || '—'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setAberta(null)}
                className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {situacaoAberta === 'vencida' && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <p className="font-bold">Proposta fora da validade</p>
                  <p>Fica só para consulta. O PDF sai com a marca “PREÇOS FORA DA VALIDADE”.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Válida até', <ValidadeTexto key="v" proposta={aberta} />],
                  ['Região', nomeRegiao(aberta.regionId)],
                  [
                    'Local · Lista',
                    [aberta.localNome, aberta.priceListNome].filter(Boolean).join(' · ') || '—',
                  ],
                  [
                    exibidosAberta?.origem === 'aceite' ? 'Total aceito' : 'Total proposto',
                    <span key="t">
                      {exibidosAberta && exibidosAberta.valor > 0
                        ? moedaProposta(exibidosAberta.valor, aberta.moeda)
                        : 'só preço/t'}
                      {exibidosAberta && exibidosAberta.toneladas > 0 && (
                        <span className="block text-xs font-semibold text-stone-500">
                          {exibidosAberta.toneladas.toLocaleString('pt-BR', {
                            maximumFractionDigits: 3,
                          })}{' '}
                          t
                        </span>
                      )}
                      {exibidosAberta?.origem === 'aceite' &&
                        totaisAberta &&
                        totaisAberta.valor > 0 && (
                          <span className="block text-xs font-normal text-stone-400">
                            proposto {moedaProposta(totaisAberta.valor, aberta.moeda)}
                          </span>
                        )}
                    </span>,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-stone-200 bg-white p-3"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">
                      {label}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-stone-800">{value}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-bold uppercase tracking-wide text-stone-500">
                      <th className="px-3 py-2">Produto</th>
                      <th className="px-3 py-2 text-right">Proposta</th>
                      {aceitoPorItem.size > 0 && <th className="px-3 py-2 text-right">Aceito</th>}
                      <th className="px-3 py-2 text-right">Preço/t</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(aberta.itens || []).map((item) => (
                      <React.Fragment key={item.id}>
                        <tr
                          className="cursor-pointer border-b border-stone-100 last:border-0 hover:bg-stone-50"
                          onClick={() =>
                            setItemAberto((atual) => (atual === item.id ? null : item.id || null))
                          }
                        >
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-1 font-semibold text-stone-800">
                              <span className="text-stone-400">
                                {itemAberto === item.id ? '▾' : '▸'}
                              </span>
                              {item.formulaNome}
                            </span>
                            <span className="font-mono text-xs text-emerald-700">
                              {[item.codigo, item.npk, item.embalagem].filter(Boolean).join(' · ')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {item.quantidadeSugerida
                              ? `${item.quantidadeSugerida.toLocaleString('pt-BR')} t`
                              : '—'}
                          </td>
                          {aceitoPorItem.size > 0 && (
                            <td className="px-3 py-2 text-right font-bold tabular-nums text-blue-700">
                              {aceitoPorItem.get(item.id || '')
                                ? `${aceitoPorItem.get(item.id || '')!.toLocaleString('pt-BR')} t`
                                : 'não aceito'}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-700">
                            {moedaProposta(item.precoTonelada, aberta.moeda)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                            {(() => {
                              const qtd =
                                aceitoPorItem.size > 0
                                  ? aceitoPorItem.get(item.id || '') || 0
                                  : item.quantidadeSugerida || 0;
                              return qtd > 0
                                ? moedaProposta(qtd * item.precoTonelada, aberta.moeda)
                                : '—';
                            })()}
                          </td>
                        </tr>
                        {itemAberto === item.id && (
                          <tr className="bg-stone-50">
                            <td colSpan={aceitoPorItem.size > 0 ? 5 : 4} className="px-3 py-3">
                              <ItemDetalhe item={item} moeda={aberta.moeda} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-stone-500">
                Clique num produto para ver a batida e as condições.
                {aberta.observacoes ? ` · Observações: ${aberta.observacoes}` : ''}
              </p>

              {/* Resposta do cliente pelo link */}
              {aberta.resposta ? (
                <div
                  className={`rounded-xl border p-4 text-sm ${
                    aberta.resposta.tipo === 'aceite'
                      ? 'border-blue-200 bg-blue-50 text-blue-900'
                      : 'border-red-200 bg-red-50 text-red-900'
                  }`}
                >
                  <p className="font-bold">
                    {aberta.resposta.tipo === 'aceite'
                      ? 'Aceita pelo cliente'
                      : 'Recusada pelo cliente'}{' '}
                    em {new Date(aberta.resposta.respondidoEm).toLocaleString('pt-BR')}
                  </p>
                  {aberta.resposta.codigoVerificacao && (
                    <p className="mt-0.5 text-xs">
                      Assinado eletronicamente · código{' '}
                      <span className="font-mono font-bold">
                        {aberta.resposta.codigoVerificacao}
                      </span>
                    </p>
                  )}
                  {aberta.resposta.tipo === 'aceite' ? (
                    <ul className="mt-2 space-y-1">
                      {aberta.resposta.itens.map((item) => (
                        <li key={item.id} className="flex justify-between gap-3">
                          <span>{item.nome}</span>
                          <b className="tabular-nums">
                            {item.quantidade.toLocaleString('pt-BR')} t ·{' '}
                            {moedaProposta(item.quantidade * item.precoTonelada, aberta.moeda)}
                          </b>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    aberta.resposta.motivo && (
                      <p className="mt-1">Motivo: {aberta.resposta.motivo}</p>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => void baixarComprovante()}
                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                  >
                    <Download className="h-4 w-4" /> Comprovante (PDF)
                  </button>
                </div>
              ) : (
                situacaoAberta === 'vigente' &&
                permissoes.criar && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-bold text-emerald-900">Enviar para o cliente</p>
                    <p className="text-xs text-emerald-800">
                      O cliente abre o link, escolhe produtos e quantidades e aceita ou recusa com o
                      CPF/CNPJ.
                      {aberta.linkAbertoEm
                        ? ` Aberto pelo cliente em ${new Date(aberta.linkAbertoEm).toLocaleString('pt-BR')}.`
                        : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={gerandoLink}
                        onClick={() => void enviarLink('copiar')}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        <Copy className="h-4 w-4" /> Copiar link
                      </button>
                      <button
                        type="button"
                        disabled={gerandoLink}
                        onClick={() => void enviarLink('whatsapp')}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <MessageCircle className="h-4 w-4" /> Enviar no WhatsApp
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* Alterar validade / cancelar */}
              {acao && (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-900">
                    {acao === 'validade' ? 'Alterar validade' : 'Cancelar proposta'}
                  </p>
                  {acao === 'validade' && (
                    <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
                      Nova validade
                      <input
                        type="date"
                        min={hojeIso()}
                        value={novaValidade}
                        onChange={(event) => setNovaValidade(event.target.value)}
                        className={`${inputClass} mt-1`}
                      />
                    </label>
                  )}
                  <label className="block text-xs font-bold uppercase tracking-wide text-stone-600">
                    Motivo
                    <input
                      type="text"
                      value={motivo}
                      maxLength={300}
                      onChange={(event) => setMotivo(event.target.value)}
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAcao(null)}
                      className="h-10 rounded-xl px-4 text-sm font-bold text-stone-600 hover:bg-white"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => void confirmarAcao()}
                      className={`h-10 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-60 ${
                        acao === 'cancelar'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {salvando
                        ? 'Salvando…'
                        : acao === 'cancelar'
                          ? 'Cancelar proposta'
                          : 'Salvar validade'}
                    </button>
                  </div>
                </div>
              )}

              {/* Histórico */}
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
                  Histórico
                </h4>
                <ol className="space-y-2">
                  {(aberta.eventos || []).map((evento) => (
                    <li
                      key={evento.id}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                    >
                      <p className="text-stone-800">{evento.descricao}</p>
                      <p className="text-xs text-stone-400">
                        {new Date(evento.createdAt).toLocaleString('pt-BR')}
                        {evento.criadoPorNome ? ` · ${evento.criadoPorNome}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 bg-white p-4">
              {aberta.status === 'aceita' && onGerarPrecificacao && (
                <button
                  type="button"
                  onClick={() => {
                    onGerarPrecificacao(aberta);
                    setAberta(null);
                  }}
                  className="mr-auto inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
                >
                  <Calculator className="h-4 w-4" /> Gerar precificação
                </button>
              )}
              {situacaoAberta === 'vigente' && permissoes.editar && (
                <button
                  type="button"
                  onClick={() => {
                    setAcao('validade');
                    setNovaValidade(aberta.validaAte);
                    setMotivo('');
                  }}
                  className="mr-auto inline-flex h-11 items-center gap-2 rounded-xl border border-stone-300 px-4 text-sm font-bold text-stone-700 hover:bg-stone-50"
                >
                  <CalendarClock className="h-4 w-4" /> Alterar validade
                </button>
              )}
              {aberta.status !== 'cancelada' &&
                aberta.status !== 'convertida' &&
                permissoes.cancelar && (
                  <button
                    type="button"
                    onClick={() => {
                      setAcao('cancelar');
                      setMotivo('');
                    }}
                    className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-red-600 hover:bg-red-50"
                  >
                    Cancelar
                  </button>
                )}
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-stone-700">
                <input
                  type="checkbox"
                  checked={comComposicao}
                  onChange={(event) => setComComposicao(event.target.checked)}
                  className="h-5 w-5 accent-emerald-600"
                />
                Mostrar a batida
              </label>
              <button
                type="button"
                disabled={gerando !== null}
                onClick={() => void gerar('excel')}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-600 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {gerando === 'excel' ? 'Preparando…' : 'Excel'}
              </button>
              <button
                type="button"
                disabled={gerando !== null}
                onClick={() => void gerar('pdf')}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <FileText className="h-4 w-4" />
                {gerando === 'pdf' ? 'Preparando…' : 'PDF'}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
