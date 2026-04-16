import React from 'react';
import {
  Truck,
  ClipboardList,
  DollarSign,
  AlertTriangle,
  Package,
  Users,
  CreditCard,
  RefreshCw,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { User } from '../types';
import { useDashboard } from '../hooks/useDashboard';
import KPICard from './Dashboard/KPICard';
import GraficoCarregamentosMes from './Dashboard/GraficoCarregamentosMes';
import GraficoStatusCarregamentos from './Dashboard/GraficoStatusCarregamentos';
import GraficoFreteTransportadora from './Dashboard/GraficoFreteTransportadora';

interface HomeProps {
  currentUser: User;
  onSelectModule: (
    moduleId: 'pricing' | 'config' | 'prd' | 'managementReports' | 'expenses' | 'carregamento' | 'relatorios'
  ) => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function acaoLabel(acao: string): string {
  if (acao === 'INSERT') return 'criou';
  if (acao === 'UPDATE') return 'editou';
  if (acao === 'DELETE') return 'excluiu';
  return acao;
}

export default function Home({ currentUser, onSelectModule }: HomeProps) {
  const isAdminOrMaster = currentUser.role === 'admin' || currentUser.role === 'master';
  const isLogistica =
    isAdminOrMaster ||
    !!(currentUser.permissions as Record<string, unknown>)?.carregamento_liberar;
  const hasCarregamento =
    isAdminOrMaster ||
    isLogistica ||
    !!(currentUser.permissions as Record<string, unknown>)?.carregamento;
  const hasReportAccess =
    isAdminOrMaster ||
    currentUser.role === 'manager' ||
    !!(currentUser.permissions as Record<string, unknown>)?.relatorios;

  const { kpis, graficos, auditRecente, loading, error, refetch } = useDashboard(currentUser);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-800">
            {getGreeting()}, {currentUser.name.split(' ')[0]}! 👋
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">FertCalc Pro · Dashboard Executivo</p>
        </div>
        <div className="flex items-center gap-3">
          {hasReportAccess && (
            <button
              onClick={() => onSelectModule('relatorios')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-600 transition-colors"
            >
              📊 Relatórios
            </button>
          )}
          <button
            onClick={refetch}
            className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Banner de erro ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Banner: pendentes de aprovação ── */}
      {!loading && kpis.pendentesAprovacao > 0 && isLogistica && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <span className="text-sm text-yellow-800 font-medium">
            Há <strong>{kpis.pendentesAprovacao}</strong> carregamento
            {kpis.pendentesAprovacao !== 1 ? 's' : ''} aguardando sua aprovação.
          </span>
          {hasCarregamento && (
            <button
              onClick={() => onSelectModule('carregamento')}
              className="ml-auto flex items-center gap-1 text-sm font-bold text-yellow-700 hover:text-yellow-900 transition-colors"
            >
              Ver agora <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          title={isLogistica ? 'Carregamentos (mês)' : 'Meus Carregamentos'}
          value={loading ? '—' : kpis.carregamentosMes}
          icon={<Truck className="w-5 h-5" />}
          color="blue"
          loading={loading}
          onClick={hasCarregamento ? () => onSelectModule('carregamento') : undefined}
        />
        <KPICard
          title="Pedidos de Venda"
          value={loading ? '—' : kpis.pedidosVendaMes}
          icon={<ClipboardList className="w-5 h-5" />}
          color="green"
          loading={loading}
          onClick={hasCarregamento ? () => onSelectModule('carregamento') : undefined}
        />
        <KPICard
          title="Frete Médio"
          value={loading ? '—' : kpis.freteMedia > 0 ? formatCurrency(kpis.freteMedia) : '—'}
          subtitle="dos carregamentos"
          icon={<DollarSign className="w-5 h-5" />}
          color="yellow"
          loading={loading}
        />
        <KPICard
          title="Pend. Aprovação"
          value={loading ? '—' : kpis.pendentesAprovacao}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          loading={loading}
          onClick={isLogistica && hasCarregamento ? () => onSelectModule('carregamento') : undefined}
        />
        <KPICard
          title="Em Carregamento"
          value={loading ? '—' : `${kpis.tonelagemTransito.toLocaleString('pt-BR')} ton`}
          subtitle="tonelagem em trânsito"
          icon={<Package className="w-5 h-5" />}
          color="purple"
          loading={loading}
        />
      </div>

      {/* ── KPIs extras (admin/master) ── */}
      {isAdminOrMaster && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <KPICard
            title="Usuários Ativos"
            value={loading ? '—' : (kpis.usuariosAtivos ?? '—')}
            icon={<Users className="w-5 h-5" />}
            color="blue"
            loading={loading}
            onClick={() => onSelectModule('config')}
          />
          <KPICard
            title="Cotações Aguardando"
            value={loading ? '—' : kpis.cotacoesAguardando}
            icon={<ClipboardList className="w-5 h-5" />}
            color="orange"
            loading={loading}
            onClick={hasCarregamento ? () => onSelectModule('carregamento') : undefined}
          />
          <KPICard
            title="Gastos Cartão (mês)"
            value={
              loading
                ? '—'
                : kpis.gastosCartaoMes != null
                  ? formatCurrency(kpis.gastosCartaoMes)
                  : '—'
            }
            icon={<CreditCard className="w-5 h-5" />}
            color="purple"
            loading={loading}
            onClick={() => onSelectModule('expenses')}
          />
        </div>
      )}

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GraficoCarregamentosMes data={graficos.carregamentosPorMes} loading={loading} />
        <GraficoStatusCarregamentos data={graficos.statusCarregamentos} loading={loading} />
        <GraficoFreteTransportadora data={graficos.freteTransportadora} loading={loading} />

        {/* Tonelagem por filial — apenas admin/master */}
        {isAdminOrMaster && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest mb-4">
              Tonelagem por Filial (últimos 3 meses)
            </h3>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-stone-100 rounded" />
                ))}
              </div>
            ) : graficos.tonelagemFilial.length === 0 ? (
              <p className="text-center text-stone-400 py-16 text-sm">Sem dados disponíveis</p>
            ) : (
              <div className="space-y-3">
                {graficos.tonelagemFilial.map((f) => {
                  const max = Math.max(...graficos.tonelagemFilial.map((x) => x.tonelagem), 1);
                  const pct = (f.tonelagem / max) * 100;
                  return (
                    <div key={f.filial}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-stone-700">{f.filial}</span>
                        <span className="text-stone-500">
                          {f.tonelagem.toLocaleString('pt-BR')} ton
                        </span>
                      </div>
                      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Atividade Recente (admin/master) ── */}
      {isAdminOrMaster && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-stone-400" />
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest">
              Atividade Recente
            </h3>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-5 bg-stone-100 rounded w-3/4" />
              ))}
            </div>
          ) : auditRecente.length === 0 ? (
            <p className="text-sm text-stone-400">Nenhuma atividade recente.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {auditRecente.map((entry) => (
                <li key={entry.id} className="py-2 flex items-start gap-3 text-sm">
                  <span className="text-stone-400 whitespace-nowrap min-w-[100px]">
                    {formatDate(entry.criado_em)}
                  </span>
                  <span className="text-stone-700">
                    <span className="font-medium">{entry.usuario_nome}</span>{' '}
                    {acaoLabel(entry.acao)}{' '}
                    <span className="text-stone-500">{entry.tabela}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
