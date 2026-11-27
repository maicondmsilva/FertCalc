import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  FileSpreadsheet,
  FileText,
  Loader2,
  MessageCircle,
  Save,
  Search,
  X,
} from 'lucide-react';
import type {
  AppSettings,
  Client,
  Embalagem,
  PriceList,
  PricingFactors,
  SavedFormula,
  User,
} from '../../types';
import type { LocalCarregamento } from '../../types/carregamento';
import type { NovaProposta, Proposta, PropostaItem } from '../../types/proposta';
import { getClients } from '../../services/db';
import { getEmbalagens } from '../../services/embalagensService';
import {
  criarProposta,
  getProposta,
  linkProposta,
  registrarDocumentoProposta,
  urlPropostaCliente,
} from '../../services/propostaService';
import { getProdutoFormuladoBySavedFormulaId } from '../../services/produtosFormuladosService';
import { addHistoricoPrecos } from '../../services/historicoPrecoService';
import CommercialConditionsForm from '../conditions/CommercialConditionsForm';
import {
  DEFAULT_REPORT_COMMERCIAL_FACTORS,
  calculateReportPrice,
  type ReportCommercialFactors,
} from '../../utils/savedFormulaWorkflow';
import {
  VALIDADE_PADRAO_DIAS,
  diasParaVencer,
  formatDataBr,
  formatNumeroProposta,
  hojeIso,
  somarDias,
} from '../../utils/propostaModel';
import {
  baixarExcelProposta,
  createPropostaPdf,
  moedaProposta,
} from '../../utils/propostaDocumento';
import { formatId } from '../../utils/formatId';
import { saveOrSharePdf } from '../../utils/pdfDelivery';
import { closeModalOnBackdrop } from '../../utils/modalUtils';
import { useMyRegions, defaultRegionId } from '../../hooks/useMyRegions';
import { useToast } from '../Toast';
import { canCreatePropostas } from './propostaPermissions';

interface NovaPropostaModalProps {
  isOpen: boolean;
  formulas: SavedFormula[];
  selectedList?: PriceList;
  selectedLocal?: LocalCarregamento;
  currentUser: User;
  settings: AppSettings;
  getFormulaCost: (
    formula: SavedFormula,
    list: PriceList | undefined
  ) => { total: number; missingItems: string[] };
  onClose: () => void;
  onPropostaCriada?: () => void;
  onVerPropostas?: (propostaId: string) => void;
}

const inputClass =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[15px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-100';

const parseQtd = (raw: string) => Number(raw.replace(',', '.')) || 0;

/** Fator padrão de Configurações, conforme a moeda da lista (igual à calculadora). */
export function fatorPadrao(settings: AppSettings, moeda: 'BRL' | 'USD'): number {
  return moeda === 'USD' ? (settings.defaultFactorUSD ?? 0) : (settings.defaultFactorBRL ?? 0.8);
}

/** Batida como fechou: entra na proposta para a precificação sair igual. */
export function fotografiaDaBatida(formula: SavedFormula): PropostaItem['formula'] {
  return {
    targetFormula: formula.targetFormula,
    category: formula.category,
    targetCa: formula.targetCa,
    targetS: formula.targetS,
    targetMicros: formula.targetMicros,
    macros: formula.macros,
    micros: formula.micros,
  };
}

function Step({
  n,
  title,
  children,
  aside,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-[15px] font-black text-stone-900">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-sm text-white">
            {n}
          </span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Nova proposta de preços (Batidas Salvas): cliente, região e validade;
 * condições comerciais iguais às da calculadora; produtos e quantidades.
 * "Salvar proposta" grava a fotografia; depois PDF, Excel e link ao cliente.
 */
export default function NovaPropostaModal({
  isOpen,
  formulas,
  selectedList,
  selectedLocal,
  currentUser,
  settings,
  getFormulaCost,
  onClose,
  onPropostaCriada,
  onVerPropostas,
}: NovaPropostaModalProps) {
  const { showError, showSuccess } = useToast();
  const moeda: 'BRL' | 'USD' = selectedList?.currency === 'USD' ? 'USD' : 'BRL';
  const regioes = useMyRegions(currentUser);
  const podeCriar = canCreatePropostas(currentUser);

  const [clients, setClients] = useState<Client[]>([]);
  const [embalagens, setEmbalagens] = useState<Embalagem[]>([]);
  const [cliente, setCliente] = useState<Client | null>(null);
  const [busca, setBusca] = useState('');
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [regionId, setRegionId] = useState('');
  const [validaAte, setValidaAte] = useState(() => somarDias(hojeIso(), VALIDADE_PADRAO_DIAS));
  const [observacoes, setObservacoes] = useState('');
  const [modo, setModo] = useState<'todos' | 'produto'>('todos');
  const [produtoAtivo, setProdutoAtivo] = useState('');
  const [fatoresGerais, setFatoresGerais] = useState<ReportCommercialFactors>(
    DEFAULT_REPORT_COMMERCIAL_FACTORS
  );
  const [fatoresPorProduto, setFatoresPorProduto] = useState<
    Record<string, ReportCommercialFactors>
  >({});
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [salva, setSalva] = useState<Proposta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);
  const [gerando, setGerando] = useState<'pdf' | 'excel' | 'link' | null>(null);
  const [comComposicao, setComComposicao] = useState(false);

  // Abre limpo, com o fator padrão de Configurações.
  useEffect(() => {
    if (!isOpen) return;
    const inicial = { ...DEFAULT_REPORT_COMMERCIAL_FACTORS, factor: fatorPadrao(settings, moeda) };
    setFatoresGerais(inicial);
    setFatoresPorProduto(
      Object.fromEntries(formulas.map((formula) => [formula.id, { ...inicial }]))
    );
    setProdutoAtivo(formulas[0]?.id || '');
    setQuantidades({});
    setCliente(null);
    setBusca('');
    setValidaAte(somarDias(hojeIso(), VALIDADE_PADRAO_DIAS));
    setObservacoes('');
    setModo('todos');
    setSalva(null);
    setComComposicao(false);
    void Promise.all([getClients(), getEmbalagens(true)])
      .then(([listaClientes, listaEmbalagens]) => {
        setClients(listaClientes);
        setEmbalagens(listaEmbalagens);
      })
      .catch(() => showError('Não foi possível carregar clientes e embalagens.'));
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || regioes.loading) return;
    setRegionId((atual) =>
      atual && regioes.options.some((region) => region.id === atual)
        ? atual
        : defaultRegionId(regioes.options, regioes.principalId)
    );
  }, [isOpen, regioes]);

  const fatoresDe = (formulaId: string): ReportCommercialFactors =>
    modo === 'todos' ? fatoresGerais : fatoresPorProduto[formulaId] || fatoresGerais;

  const linhas = useMemo(
    () =>
      formulas.map((formula) => {
        const fatores = {
          ...fatoresDe(formula.id),
          totalTons: parseQtd(quantidades[formula.id] || ''),
        };
        const { total } = getFormulaCost(formula, selectedList);
        const preco = calculateReportPrice(total, fatores, new Date(), {
          currency: moeda,
          exchangeRate: selectedList?.exchangeRate,
        });
        return {
          formula,
          fatores,
          preco: Math.round(preco * 100) / 100,
          qtd: fatores.totalTons || 0,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formulas, fatoresGerais, fatoresPorProduto, modo, quantidades, selectedList, moeda]
  );
  const totalToneladas = linhas.reduce((total, linha) => total + linha.qtd, 0);
  const totalValor = linhas.reduce((total, linha) => total + linha.qtd * linha.preco, 0);
  const semPreco = linhas.filter((linha) => !(linha.preco > 0)).map((linha) => linha.formula.name);

  const problema = !podeCriar
    ? 'Seu usuário não tem a permissão “Propostas — criar”.'
    : !cliente
      ? 'Escolha o cliente.'
      : regioes.orgHasRegions && regioes.options.length > 0 && !regionId
        ? 'Escolha a região.'
        : !validaAte || validaAte < hojeIso()
          ? 'A validade não pode ser anterior a hoje.'
          : semPreco.length > 0
            ? `Sem preço na lista: ${semPreco.join(', ')}.`
            : null;

  const fatoresEditando = modo === 'todos' ? fatoresGerais : fatoresPorProduto[produtoAtivo];
  const mudarCondicao = (field: keyof PricingFactors, value: string | number | boolean) => {
    if (modo === 'todos') {
      setFatoresGerais((atual) => ({ ...atual, [field]: value }));
    } else {
      setFatoresPorProduto((atual) => ({
        ...atual,
        [produtoAtivo]: { ...(atual[produtoAtivo] || fatoresGerais), [field]: value },
      }));
    }
  };

  const clientesFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return [];
    const digitos = termo.replace(/\D/g, '');
    return clients
      .filter(
        (item) =>
          item.name.toLowerCase().includes(termo) ||
          (digitos.length >= 3 && (item.document || '').replace(/\D/g, '').includes(digitos))
      )
      .slice(0, 20);
  }, [busca, clients]);

  const registrarHistoricoPrecos = async () => {
    const entradas = (
      await Promise.all(
        linhas.map(async ({ formula, fatores, preco }) => {
          const produto = await getProdutoFormuladoBySavedFormulaId(formula.id);
          if (!produto) return null;
          const { total } = getFormulaCost(formula, selectedList);
          return {
            produto_formulado_id: produto.id,
            saved_formula_id: formula.id,
            organization_id: formula.organizationId || currentUser.organizationId,
            local_carregamento_id: selectedLocal?.id,
            local_carregamento_nome: selectedLocal?.nome,
            price_list_id: selectedList?.id,
            price_list_name: selectedList?.name,
            formula_nome: formula.name,
            preco_base: total,
            preco_final: preco,
            moeda,
            taxa_cambio: moeda === 'USD' ? selectedList?.exchangeRate : undefined,
            preco_final_brl:
              moeda === 'USD' ? preco * Number(selectedList?.exchangeRate || 0) : preco,
            quantidade_tons: fatores.totalTons,
            valor_total: preco * Number(fatores.totalTons || 0),
            fatores_comerciais: { ...fatores, priceListCurrency: moeda },
            origem: 'relatorio_precos' as const,
            registrado_por: currentUser.name,
          };
        })
      )
    ).filter((entrada): entrada is NonNullable<typeof entrada> => entrada !== null);
    await addHistoricoPrecos(entradas);
  };

  const salvar = async () => {
    if (problema) {
      showError(problema);
      return;
    }
    if (salvandoRef.current || salva || !cliente) return; // sem duplicar
    salvandoRef.current = true;
    setSalvando(true);
    try {
      const nova: NovaProposta = {
        clientId: cliente.id,
        clienteNome: cliente.name,
        clienteDocumento: cliente.document || undefined,
        clienteDados: {
          documento: cliente.document,
          inscricaoEstadual: cliente.stateRegistration || undefined,
          fazenda: cliente.fazenda || undefined,
          cidade: cliente.address?.city || undefined,
          estado: cliente.address?.state || undefined,
        },
        regionId: regionId || undefined,
        priceListId: selectedList?.id,
        priceListNome: selectedList?.name,
        localCarregamentoId: selectedLocal?.id,
        localNome: selectedLocal?.nome,
        moeda,
        taxaCambio: moeda === 'USD' ? selectedList?.exchangeRate : undefined,
        validaAte,
        incluirComposicao: false,
        observacoes: observacoes.trim() || undefined,
        itens: linhas.map(({ formula, fatores, preco, qtd }) => ({
          savedFormulaId: formula.id,
          codigo: formatId(formula.id_numeric, 'BAT-'),
          formulaNome: formula.name,
          npk: formula.targetFormula,
          embalagem: fatores.embalagem_nome || undefined,
          precoTonelada: preco,
          quantidadeSugerida: qtd > 0 ? qtd : undefined,
          composicao: [
            ...formula.macros
              .filter((material) => material.quantity > 0)
              .map((material) => ({
                nome: material.name,
                kg: material.quantity,
                tipo: 'Macro' as const,
              })),
            ...formula.micros
              .filter((material) => material.quantity > 0)
              .map((material) => ({
                nome: material.name,
                kg: material.quantity,
                tipo: 'Micro' as const,
              })),
          ],
          fatores: {
            ...fatores,
            priceListCurrency: moeda,
            appliedExchangeRate: moeda === 'USD' ? selectedList?.exchangeRate : undefined,
          },
          formula: fotografiaDaBatida(formula),
        })),
      };
      const id = await criarProposta(nova);
      const proposta = await getProposta(id);
      setSalva(proposta);
      showSuccess(`Proposta ${formatNumeroProposta(proposta.numero)} salva.`);
      onPropostaCriada?.();
      void registrarHistoricoPrecos().catch(() => {});
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível salvar a proposta.');
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  };

  const gerar = async (formato: 'pdf' | 'excel') => {
    if (!salva) return;
    setGerando(formato);
    const comEscolha = { ...salva, incluirComposicao: comComposicao };
    try {
      if (formato === 'pdf') {
        const doc = createPropostaPdf({ proposta: comEscolha, itens: salva.itens || [], settings });
        await saveOrSharePdf(
          doc,
          `${formatNumeroProposta(salva.numero)}.pdf`,
          'Proposta de preços'
        );
      } else {
        await baixarExcelProposta(comEscolha, salva.itens || [], settings);
      }
      void registrarDocumentoProposta(salva.id, formato).catch(() => {});
    } catch {
      showError(
        formato === 'pdf' ? 'Não foi possível gerar o PDF.' : 'Não foi possível gerar o Excel.'
      );
    } finally {
      setGerando(null);
    }
  };

  const enviarLink = async (destino: 'copiar' | 'whatsapp') => {
    if (!salva) return;
    setGerando('link');
    try {
      const url = urlPropostaCliente(await linkProposta(salva.id));
      if (destino === 'copiar') {
        await navigator.clipboard.writeText(url);
        showSuccess('Link copiado. Envie ao cliente.');
      } else {
        const mensagem = `Olá! Segue a proposta de preços ${formatNumeroProposta(salva.numero)}, válida até ${formatDataBr(salva.validaAte)}. Escolha os produtos e as quantidades e confirme por aqui: ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank', 'noopener');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível gerar o link.');
    } finally {
      setGerando(null);
    }
  };

  if (!isOpen) return null;
  const dias = validaAte ? diasParaVencer(validaAte) : 0;
  const bloqueado = Boolean(salva);
  const frete =
    fatoresGerais.tipoFrete === 'FOB'
      ? 'FOB'
      : `CIF · ${moedaProposta(Number(fatoresGerais.freight) || 0, 'BRL')}/t`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, salvando || gerando !== null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nova proposta de preços"
        className="@container flex h-full w-full max-w-7xl flex-col overflow-hidden bg-stone-100 shadow-2xl sm:h-[92vh] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-stone-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-stone-900">
              {salva ? `Proposta ${formatNumeroProposta(salva.numero)}` : 'Nova proposta de preços'}
            </h2>
            <p className="text-sm text-stone-500">
              {formulas.length} batida(s) · {selectedLocal?.nome || 'sem local'} ·{' '}
              {selectedList?.name || 'sem lista'} ({moeda === 'USD' ? 'US$' : 'R$'})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid flex-1 gap-4 overflow-y-auto p-3 sm:p-4 @5xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            <fieldset disabled={bloqueado} className="space-y-4">
              <Step n={1} title="Cliente e validade">
                <div className="grid gap-3 @3xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="relative">
                    <label
                      htmlFor="proposta-cliente"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500"
                    >
                      Cliente{' '}
                      <span className="font-medium normal-case tracking-normal text-stone-400">
                        (obrigatório)
                      </span>
                    </label>
                    {cliente ? (
                      <div className="flex h-11 items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3">
                        <span className="min-w-0 truncate text-sm font-bold text-emerald-900">
                          {cliente.name}
                          <span className="ml-2 font-normal text-emerald-700">
                            {cliente.document}
                            {cliente.address?.city
                              ? ` · ${cliente.address.city}/${cliente.address.state || ''}`
                              : ''}
                          </span>
                        </span>
                        {!bloqueado && (
                          <button
                            type="button"
                            onClick={() => {
                              setCliente(null);
                              setBusca('');
                            }}
                            className="text-xs font-bold text-emerald-700 hover:text-red-600"
                          >
                            Trocar
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <span className="relative block">
                          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400" />
                          <input
                            id="proposta-cliente"
                            type="search"
                            value={busca}
                            onChange={(event) => {
                              setBusca(event.target.value);
                              setMostrarBusca(true);
                            }}
                            onFocus={() => setMostrarBusca(true)}
                            onBlur={() => setTimeout(() => setMostrarBusca(false), 200)}
                            placeholder="Nome ou CPF/CNPJ"
                            className={`${inputClass} pl-9`}
                          />
                        </span>
                        {mostrarBusca && busca.trim() && (
                          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl">
                            {clientesFiltrados.length === 0 ? (
                              <li className="p-3 text-sm text-stone-400">
                                Nenhum cliente encontrado
                              </li>
                            ) : (
                              clientesFiltrados.map((item) => (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                      setCliente(item);
                                      setMostrarBusca(false);
                                    }}
                                    className="w-full border-b border-stone-100 px-3 py-2 text-left last:border-0 hover:bg-stone-50"
                                  >
                                    <span className="block text-sm font-bold text-stone-800">
                                      {item.name}
                                    </span>
                                    <span className="text-xs text-stone-500">
                                      {item.document}
                                      {item.fazenda ? ` · ${item.fazenda}` : ''}
                                      {item.address?.city
                                        ? ` · ${item.address.city}/${item.address.state || ''}`
                                        : ''}
                                    </span>
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
                      Região
                    </span>
                    <select
                      value={regionId}
                      onChange={(event) => setRegionId(event.target.value)}
                      disabled={regioes.options.length <= 1}
                      className={inputClass}
                    >
                      {regioes.options.length === 0 && <option value="">Sem região</option>}
                      {regioes.options.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                          {region.id === regioes.principalId ? ' ★' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
                      Válida até{' '}
                      {validaAte && validaAte >= hojeIso() && (
                        <span className="font-medium normal-case tracking-normal text-stone-400">
                          ({dias === 0 ? 'vence hoje' : `${dias} dia${dias === 1 ? '' : 's'}`})
                        </span>
                      )}
                    </span>
                    <input
                      type="date"
                      min={hojeIso()}
                      value={validaAte}
                      onChange={(event) => setValidaAte(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
                    Observações para o cliente{' '}
                    <span className="font-medium normal-case tracking-normal text-stone-400">
                      (opcional)
                    </span>
                  </span>
                  <textarea
                    value={observacoes}
                    maxLength={800}
                    rows={2}
                    onChange={(event) => setObservacoes(event.target.value)}
                    placeholder="Ex.: preços FOB, condição de pagamento, frete sob consulta…"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-100"
                  />
                </label>
              </Step>

              <Step
                n={2}
                title="Condições comerciais"
                aside={
                  <div
                    role="radiogroup"
                    aria-label="Aplicar condições"
                    className="inline-flex rounded-xl bg-stone-100 p-1"
                  >
                    {(
                      [
                        ['todos', 'Mesmas para todos'],
                        ['produto', 'Por produto'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={modo === value}
                        onClick={() => {
                          if (value === 'produto' && modo === 'todos') {
                            // Parte das condições gerais e deixa ajustar cada produto.
                            setFatoresPorProduto(
                              Object.fromEntries(
                                formulas.map((formula) => [formula.id, { ...fatoresGerais }])
                              )
                            );
                          }
                          setModo(value);
                        }}
                        className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                          modo === value
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                }
              >
                {modo === 'produto' && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {formulas.map((formula) => (
                      <button
                        key={formula.id}
                        type="button"
                        onClick={() => setProdutoAtivo(formula.id)}
                        className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${
                          produtoAtivo === formula.id
                            ? 'bg-emerald-600 text-white ring-emerald-600'
                            : 'bg-white text-stone-600 ring-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {formula.name}
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  {fatoresEditando && (
                    <CommercialConditionsForm
                      key={modo === 'todos' ? 'todos' : produtoAtivo}
                      factors={fatoresEditando}
                      onChange={mudarCondicao}
                      currency={moeda}
                      embalagens={embalagens}
                      clientId={cliente?.id}
                      clientName={cliente?.name}
                      showQuantity={false}
                    />
                  )}
                </div>
              </Step>
            </fieldset>

            <Step n={3} title="Produtos e quantidades">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-stone-500">
                      <th className="px-2 py-2">Produto</th>
                      <th className="px-2 py-2 text-right">Quantidade</th>
                      <th className="px-2 py-2 text-right">Preço/t</th>
                      <th className="px-2 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map(({ formula, preco, qtd }) => (
                      <tr key={formula.id} className="border-t border-stone-100">
                        <td className="px-2 py-2.5">
                          <span className="block font-bold text-stone-900">{formula.name}</span>
                          <span className="font-mono text-xs text-emerald-700">
                            {formatId(formula.id_numeric, 'BAT-')} · {formula.targetFormula}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <span className="relative inline-block">
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={bloqueado}
                              value={quantidades[formula.id] || ''}
                              onChange={(event) => {
                                const raw = event.target.value;
                                if (!/^\d*(?:[.,]\d{0,3})?$/.test(raw)) return;
                                setQuantidades((atual) => ({ ...atual, [formula.id]: raw }));
                              }}
                              placeholder="—"
                              aria-label={`Quantidade em toneladas de ${formula.name}`}
                              className="h-10 w-28 rounded-xl border border-stone-300 pl-3 pr-7 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-100"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-2.5 text-xs font-bold text-stone-400">
                              t
                            </span>
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right font-black tabular-nums text-emerald-700">
                          {preco > 0 ? moedaProposta(preco, moeda) : '—'}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-stone-700">
                          {preco > 0 && qtd > 0 ? (
                            moedaProposta(preco * qtd, moeda)
                          ) : (
                            <span className="text-xs text-stone-400">só preço/t</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                Quantidade opcional: sem ela, a proposta mostra só o preço por tonelada e o cliente
                informa no aceite.
              </p>
            </Step>
          </div>

          {/* Resumo e ações */}
          <aside className="space-y-3 @5xl:sticky @5xl:top-0 @5xl:self-start">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                Resumo da proposta
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums text-stone-900">
                {moedaProposta(totalValor, moeda)}
              </p>
              <p className="text-sm text-stone-500">
                {totalToneladas.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} t em{' '}
                {linhas.filter((linha) => linha.qtd > 0).length} de {linhas.length} produto(s)
                {validaAte ? ` · válida até ${formatDataBr(validaAte)}` : ''}
              </p>
              <dl className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm text-stone-600">
                <div className="flex justify-between gap-2">
                  <dt>Cliente</dt>
                  <dd className="truncate font-semibold text-stone-800">{cliente?.name || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Região</dt>
                  <dd className="font-semibold text-stone-800">
                    {regioes.options.find((region) => region.id === regionId)?.name || '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Frete</dt>
                  <dd className="font-semibold text-stone-800">
                    {modo === 'todos' ? frete : 'por produto'}
                    {modo === 'todos' && fatoresGerais.cotacaoFreteNumero
                      ? ` (${fatoresGerais.cotacaoFreteNumero})`
                      : ''}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Vencimento</dt>
                  <dd className="font-semibold text-stone-800">
                    {modo === 'todos'
                      ? fatoresGerais.dueDate
                        ? formatDataBr(fatoresGerais.dueDate)
                        : '—'
                      : 'por produto'}
                  </dd>
                </div>
              </dl>

              {!salva ? (
                <>
                  <button
                    type="button"
                    onClick={() => void salvar()}
                    disabled={salvando || Boolean(problema)}
                    className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {salvando ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    {salvando ? 'Salvando…' : 'Salvar proposta'}
                  </button>
                  {problema && (
                    <p className="mt-2 text-sm font-semibold text-amber-700">{problema}</p>
                  )}
                  <p className="mt-3 text-xs text-stone-500">
                    Depois de salvar ficam liberados PDF, Excel e o link para o cliente.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> Proposta{' '}
                    {formatNumeroProposta(salva.numero)} salva
                  </p>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold text-stone-700">
                    <input
                      type="checkbox"
                      checked={comComposicao}
                      onChange={(event) => setComComposicao(event.target.checked)}
                      className="h-5 w-5 accent-emerald-600"
                    />
                    Mostrar a batida (composição) no PDF/Excel
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={gerando !== null}
                      onClick={() => void gerar('pdf')}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <FileText className="h-4 w-4" /> PDF
                    </button>
                    <button
                      type="button"
                      disabled={gerando !== null}
                      onClick={() => void gerar('excel')}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-600 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                    >
                      <FileSpreadsheet className="h-4 w-4" /> Excel
                    </button>
                    <button
                      type="button"
                      disabled={gerando !== null}
                      onClick={() => void enviarLink('copiar')}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 text-sm font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                    >
                      <Copy className="h-4 w-4" /> Copiar link
                    </button>
                    <button
                      type="button"
                      disabled={gerando !== null}
                      onClick={() => void enviarLink('whatsapp')}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 text-sm font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </button>
                  </div>
                  {onVerPropostas && (
                    <button
                      type="button"
                      onClick={() => onVerPropostas(salva.id)}
                      className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-100"
                    >
                      <ClipboardList className="h-4 w-4" /> Ver na aba Propostas
                    </button>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
