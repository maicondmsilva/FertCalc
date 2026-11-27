import React, { useMemo, useState } from 'react';
import Pagination from '../ui/Pagination';
import { User, PedidoVenda, Client } from '../../types';
import {
  Truck,
  Package,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  X,
  Clock,
  MapPin,
  Pencil,
  Trash2,
  History,
  Search,
} from 'lucide-react';
import {
  Carregamento,
  Filial,
  Transportadora,
  KPICarregamento,
  AlertaCarregamento,
  StatusCarregamento,
} from '../../types/carregamento';
import AcompanhamentoOperacional from './AcompanhamentoOperacional';
import RegionFilterSelect, { matchesRegionFilter } from '../regions/RegionFilterSelect';
import { useMyRegions } from '../../hooks/useMyRegions';
import {
  StatusBadge,
  canEditDeleteCarregamento,
  fmtBRL,
  fmtCarregamentoNum,
  fmtDate,
} from './shared';

export interface TabelaCarregamentosProps {
  carregamentos: Carregamento[];
  currentUser?: User;
  onAction?: (c: Carregamento, action: string) => void;
  showActions?: string[];
  onEdit?: (c: Carregamento) => void;
  onDelete?: (c: Carregamento) => void;
  onCancel?: (c: Carregamento) => void;
  onHistory?: (c: Carregamento) => void;
  canLiberar?: boolean;
  canAceitar?: boolean;
  clients?: Client[];
  pedidos?: PedidoVenda[];
}

export function TabelaCarregamentos({
  carregamentos,
  currentUser,
  onAction,
  showActions = [],
  onEdit,
  onDelete,
  onCancel,
  onHistory,
  canLiberar = true,
  canAceitar = true,
  clients = [],
  pedidos = [],
}: TabelaCarregamentosProps) {
  const hasEditDelete = !!(onEdit || onDelete || onCancel || onHistory);
  if (carregamentos.length === 0) {
    return (
      <div className="text-center py-12 text-stone-400">
        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhum carregamento encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
          <tr>
            <th className="px-4 py-3">Número</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Pedido de Venda</th>
            <th className="px-4 py-3">Cliente / Fazenda</th>
            <th className="px-4 py-3">Filial</th>
            <th className="px-4 py-3">Local</th>
            <th className="px-4 py-3">Qtd (ton)</th>
            <th className="px-4 py-3">Dt. Prevista</th>
            <th className="px-4 py-3">Transportadora</th>
            {showActions.length > 0 && <th className="px-4 py-3 text-right">Ações</th>}
            {hasEditDelete && showActions.length === 0 && (
              <th className="px-4 py-3 text-right">Ações</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {carregamentos.map((c) => (
            <tr key={c.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-4 py-3 font-mono font-bold text-stone-700 text-xs">
                {fmtCarregamentoNum(c)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                    c.tipo_frete === 'CIF'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {c.tipo_frete}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-4 py-3">
                {c.pedido_venda_numero ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                    {c.pedido_venda_numero}
                  </span>
                ) : (
                  <span className="text-stone-400 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {(() => {
                  const ped = pedidos.find((p) => p.id === c.pedido_venda_id);
                  const cli = clients.find((cl) => cl.id === ped?.cliente_id);
                  const clientName = cli?.name || c.cliente_nome || ped?.cliente_nome || '—';
                  const farmName = cli?.fazenda || '—';
                  return (
                    <div className="text-xs">
                      <span
                        className="font-semibold text-stone-800 block truncate max-w-[150px]"
                        title={clientName}
                      >
                        {clientName}
                      </span>
                      {farmName !== '—' && (
                        <span
                          className="text-stone-400 text-[10px] block truncate max-w-[150px]"
                          title={farmName}
                        >
                          {farmName}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </td>
              <td className="px-4 py-3 text-stone-600 text-xs">{c.filial?.nome ?? '—'}</td>
              <td className="px-4 py-3 text-stone-600 text-xs">
                {c.local_carregamento ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-stone-400 flex-shrink-0" />
                    {c.local_carregamento.nome}
                    {c.local_carregamento.cidade && (
                      <span className="text-stone-400">— {c.local_carregamento.cidade}</span>
                    )}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3 text-stone-700 font-mono">
                <div className="text-xs">
                  <span className="font-bold">{c.quantidade_total.toFixed(3)}</span>
                  {c.quantidade_liberada > 0 && (
                    <span className="text-emerald-600 ml-1">
                      / {c.quantidade_liberada.toFixed(3)} lib.
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-stone-600 text-xs">
                {fmtDate(c.data_prevista_carregamento)}
              </td>
              <td className="px-4 py-3 text-stone-600 text-xs">{c.transportadora?.nome ?? '—'}</td>
              {(showActions.length > 0 || hasEditDelete) && (
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {showActions.includes('cotacao') &&
                      c.tipo_frete === 'CIF' &&
                      [
                        'aguardando_liberacao',
                        'liberado_total',
                        'liberado_parcial',
                        'cotacao_solicitada',
                        'cotacao_recebida',
                      ].includes(c.status) && (
                        <button
                          onClick={() => onAction?.(c, 'cotacao')}
                          className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          {c.status === 'cotacao_recebida' ||
                          c.status === 'cotacao_solicitada' ||
                          c.transportadora_id
                            ? 'Ver Propostas'
                            : 'Solicitar Cotação'}
                        </button>
                      )}
                    {showActions.includes('liberar') &&
                      canLiberar &&
                      ['aguardando_liberacao', 'liberado_parcial', 'em_carregamento'].includes(
                        c.status
                      ) &&
                      c.quantidade_liberada <
                        c.quantidade_total - (c.quantidade_cancelada || 0) && (
                        <button
                          onClick={() => onAction?.(c, 'liberar')}
                          className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                        >
                          Liberar
                        </button>
                      )}
                    {showActions.includes('transportador') &&
                      c.tipo_frete === 'CIF' &&
                      ['liberado_total', 'liberado_parcial', 'aguardando_liberacao'].includes(
                        c.status
                      ) && (
                        <button
                          onClick={() => onAction?.(c, 'transportador')}
                          className="px-2.5 py-1 text-xs font-bold bg-purple-50 text-purple-700 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors"
                        >
                          Inf. Transportador
                        </button>
                      )}
                    {showActions.includes('execucoes') &&
                      ['liberado_total', 'liberado_parcial', 'em_carregamento'].includes(
                        c.status
                      ) && (
                        <button
                          onClick={() => onAction?.(c, 'execucoes')}
                          className="px-2.5 py-1 text-xs font-bold bg-violet-50 text-violet-700 rounded-lg border border-violet-200 hover:bg-violet-100 transition-colors"
                        >
                          Execuções
                        </button>
                      )}
                    {/* Edit / Delete / History buttons */}
                    {hasEditDelete &&
                      currentUser &&
                      (() => {
                        const perms = canEditDeleteCarregamento(c, currentUser);
                        return (
                          <>
                            {onEdit && (
                              <button
                                onClick={() => (perms.canEdit ? onEdit(c) : undefined)}
                                disabled={!perms.canEdit}
                                title={
                                  perms.canEdit
                                    ? 'Editar carregamento'
                                    : 'Sem permissão para editar esta solicitação'
                                }
                                className={`p-1.5 rounded-lg transition-colors ${
                                  perms.canEdit
                                    ? 'text-stone-400 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-stone-300 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDelete && (
                              <button
                                onClick={() => (perms.canDelete ? onDelete(c) : undefined)}
                                disabled={!perms.canDelete}
                                title={
                                  perms.canDelete
                                    ? 'Excluir carregamento'
                                    : 'Somente a equipe logística pode excluir após aprovação'
                                }
                                className={`p-1.5 rounded-lg transition-colors ${
                                  perms.canDelete
                                    ? 'text-stone-400 hover:text-red-600 hover:bg-red-50'
                                    : 'text-stone-300 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onCancel &&
                              c.status !== 'cancelado' &&
                              c.status !== 'carregado' &&
                              perms.canDelete && (
                                <button
                                  onClick={() => onCancel(c)}
                                  title="Cancelar carregamento"
                                  className="p-1.5 rounded-lg transition-colors text-stone-400 hover:text-orange-600 hover:bg-orange-50"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            {onHistory && (
                              <button
                                onClick={() => onHistory(c)}
                                title="Histórico de modificações"
                                className="p-1.5 rounded-lg transition-colors text-stone-400 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        );
                      })()}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Visão Geral
// ─────────────────────────────────────────────────────────────────────────────
type EtapaCarregamento =
  | 'pendentes'
  | 'liberados'
  | 'em_carregamento'
  | 'carregados'
  | 'cancelados'
  | 'todos';

const ETAPAS: Array<{ id: EtapaCarregamento; label: string; status: StatusCarregamento[] }> = [
  {
    id: 'pendentes',
    label: 'Aguardando',
    status: [
      'aguardando_cotacao',
      'cotacao_solicitada',
      'cotacao_recebida',
      'aguardando_liberacao',
    ],
  },
  { id: 'liberados', label: 'Liberados', status: ['liberado_parcial', 'liberado_total'] },
  { id: 'em_carregamento', label: 'Em carregamento', status: ['em_carregamento'] },
  { id: 'carregados', label: 'Carregados', status: ['carregado'] },
  { id: 'cancelados', label: 'Cancelados', status: ['cancelado'] },
  { id: 'todos', label: 'Todos', status: [] },
];

export function VisaoGeral({
  carregamentos,
  kpi,
  loading,
  onAction,
  currentUser,
  onEdit,
  onDelete,
  onCancel,
  onHistory,
  canLiberar,
  canAceitar,
  clients = [],
  pedidos = [],
  alertas = [],
  onMarcarAlertaLido,
}: {
  carregamentos: Carregamento[];
  kpi: KPICarregamento;
  loading: boolean;
  onAction: (c: Carregamento, action: string) => void;
  currentUser?: User;
  onEdit?: (c: Carregamento) => void;
  onDelete?: (c: Carregamento) => void;
  onCancel?: (c: Carregamento) => void;
  onHistory?: (c: Carregamento) => void;
  canLiberar?: boolean;
  canAceitar?: boolean;
  clients?: Client[];
  pedidos?: PedidoVenda[];
  alertas?: AlertaCarregamento[];
  onMarcarAlertaLido?: (alerta: AlertaCarregamento) => void;
}) {
  // Uma lista só, separada por etapa, com busca e paginação.
  const [etapa, setEtapa] = useState<EtapaCarregamento>('pendentes');
  const [busca, setBusca] = useState('');
  // Região: filtro e nome na busca (o acesso continua por filial).
  const { all: regioes } = useMyRegions(currentUser);
  const [regiao, setRegiao] = useState('');
  const nomeRegiao = (id?: string | null) => regioes.find((r) => r.id === id)?.name;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const porEtapa = useMemo(() => {
    const counts = Object.fromEntries(ETAPAS.map((item) => [item.id, 0])) as Record<
      EtapaCarregamento,
      number
    >;
    carregamentos.forEach((c) => {
      ETAPAS.forEach((item) => {
        if (item.status.length === 0 || item.status.includes(c.status)) counts[item.id] += 1;
      });
    });
    return counts;
  }, [carregamentos]);
  const filtrados = useMemo(() => {
    const atual = ETAPAS.find((item) => item.id === etapa)!;
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return carregamentos.filter((c) => {
      if (atual.status.length > 0 && !atual.status.includes(c.status)) return false;
      if (!matchesRegionFilter(c.region_id, regiao)) return false;
      if (!termo) return true;
      return [
        c.numero_carregamento,
        c.pedido_venda_numero,
        c.pedido_cliente_nome,
        c.cliente_nome,
        c.pedido_produto_nome,
        c.transportadora?.nome,
        c.filial?.nome,
        nomeRegiao(c.region_id),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(termo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregamentos, etapa, busca, regiao, regioes]);
  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const paginaAtual = Math.min(page, totalPages);
  const visiveis = filtrados.slice((paginaAtual - 1) * pageSize, paginaAtual * pageSize);

  return (
    <div className="space-y-6">
      <AcompanhamentoOperacional
        carregamentos={carregamentos}
        alertas={alertas}
        onAbrirExecucoes={(carregamento) => onAction(carregamento, 'execucoes')}
        onMarcarAlertaLido={(alerta) => onMarcarAlertaLido?.(alerta)}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Aguardando Cotação',
            value: kpi.aguardando_cotacao,
            icon: Clock,
            color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            iconColor: 'text-yellow-500',
          },
          {
            label: 'Em Carregamento',
            value: kpi.em_carregamento,
            icon: Truck,
            color: 'bg-purple-50 border-purple-200 text-purple-700',
            iconColor: 'text-purple-500',
          },
          {
            label: 'Carregados Hoje',
            value: kpi.carregados_hoje,
            icon: CheckCircle,
            color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
            iconColor: 'text-emerald-500',
          },
          {
            label: 'Valor Frete (Mês)',
            value: fmtBRL(kpi.valor_frete_mes),
            icon: BarChart3,
            color: 'bg-blue-50 border-blue-200 text-blue-700',
            iconColor: 'text-blue-500',
          },
        ].map((kpiItem) => {
          const Icon = kpiItem.icon;
          return (
            <div
              key={kpiItem.label}
              className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm ${kpiItem.color}`}
            >
              <Icon className={`w-8 h-8 flex-shrink-0 ${kpiItem.iconColor}`} />
              <div>
                <p className="text-2xl font-black">{kpiItem.value}</p>
                <p className="text-xs font-semibold opacity-70 mt-0.5">{kpiItem.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Carregamentos por etapa */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-stone-100 p-4">
          <div className="flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1" role="tablist">
            {ETAPAS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={etapa === item.id}
                onClick={() => {
                  setEtapa(item.id);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold sm:text-sm ${
                  etapa === item.id
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {item.label} <span className="text-stone-400">{porEtapa[item.id]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block flex-1">
              <span className="sr-only">Buscar carregamento</span>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                value={busca}
                onChange={(event) => {
                  setBusca(event.target.value);
                  setPage(1);
                }}
                placeholder="Número, pedido, cliente, produto, transportadora, filial ou região"
                className="h-11 w-full rounded-xl border border-stone-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </label>
            <RegionFilterSelect
              regions={regioes}
              value={regiao}
              onChange={(value) => {
                setRegiao(value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : visiveis.length === 0 ? (
          <p className="py-12 text-center text-sm text-stone-400">
            Nenhum carregamento nesta etapa{busca.trim() ? ' com esta busca' : ''}.
          </p>
        ) : (
          <TabelaCarregamentos
            carregamentos={visiveis}
            currentUser={currentUser}
            onAction={onAction}
            showActions={['cotacao', 'liberar', 'execucoes']}
            onEdit={onEdit}
            onDelete={onDelete}
            onCancel={onCancel}
            onHistory={onHistory}
            canLiberar={canLiberar}
            canAceitar={canAceitar}
            clients={clients}
            pedidos={pedidos}
          />
        )}
        <div className="border-t border-stone-100 p-3">
          <Pagination
            page={paginaAtual}
            totalPages={totalPages}
            totalItems={filtrados.length}
            firstItemNumber={filtrados.length === 0 ? 0 : (paginaAtual - 1) * pageSize + 1}
            lastItemNumber={Math.min(filtrados.length, paginaAtual * pageSize)}
            pageSize={pageSize}
            pageSizeOptions={[12, 25, 50]}
            itemLabel="carregamentos"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Solicitação de Cotação
// ─────────────────────────────────────────────────────────────────────────────
