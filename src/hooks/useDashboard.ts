import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { StatusCarregamento } from '../types/carregamento';

// ─────────────────────────────────────────────────────────────
//  Tipos
// ─────────────────────────────────────────────────────────────

export interface DashboardKPIs {
  carregamentosMes: number;
  pedidosVendaMes: number;
  pendentesAprovacao: number;
  tonelagemTransito: number;
  freteMedia: number;
  cotacoesAguardando: number;
  usuariosAtivos?: number;
  gastosCartaoMes?: number;
}

export interface GraficoMes {
  mes: string;
  total: number;
  entregues: number;
}

export interface GraficoStatus {
  status: string;
  count: number;
  color: string;
}

export interface GraficoTransportadora {
  nome: string;
  valor: number;
}

export interface GraficoFilial {
  filial: string;
  tonelagem: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  graficos: {
    carregamentosPorMes: GraficoMes[];
    statusCarregamentos: GraficoStatus[];
    freteTransportadora: GraficoTransportadora[];
    tonelagemFilial: GraficoFilial[];
  };
  auditRecente: {
    id: string;
    criado_em: string;
    usuario_nome: string;
    acao: string;
    tabela: string;
    dados_novos?: Record<string, unknown> | null;
  }[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────
//  Labels
// ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<StatusCarregamento, string> = {
  aguardando_cotacao: 'Aguardando Cotação',
  cotacao_solicitada: 'Cotação Solicitada',
  cotacao_recebida: 'Cotação Recebida',
  aguardando_liberacao: 'Aguardando Liberação',
  liberado_parcial: 'Liberado Parcial',
  liberado_total: 'Liberado Total',
  em_carregamento: 'Em Carregamento',
  carregado: 'Carregado',
  cancelado: 'Cancelado',
};

const STATUS_COLORS: Record<StatusCarregamento, string> = {
  aguardando_cotacao: '#94a3b8',
  cotacao_solicitada: '#60a5fa',
  cotacao_recebida: '#34d399',
  aguardando_liberacao: '#fbbf24',
  liberado_parcial: '#a78bfa',
  liberado_total: '#10b981',
  em_carregamento: '#f97316',
  carregado: '#22c55e',
  cancelado: '#ef4444',
};

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─────────────────────────────────────────────────────────────
//  Hook principal
// ─────────────────────────────────────────────────────────────

const EMPTY_KPIS: DashboardKPIs = {
  carregamentosMes: 0,
  pedidosVendaMes: 0,
  pendentesAprovacao: 0,
  tonelagemTransito: 0,
  freteMedia: 0,
  cotacoesAguardando: 0,
};

const EMPTY_DATA: Omit<DashboardData, 'loading' | 'error' | 'refetch'> = {
  kpis: EMPTY_KPIS,
  graficos: {
    carregamentosPorMes: [],
    statusCarregamentos: [],
    freteTransportadora: [],
    tonelagemFilial: [],
  },
  auditRecente: [],
};

export function useDashboard(currentUser: User): DashboardData {
  const [data, setData] = useState<Omit<DashboardData, 'loading' | 'error' | 'refetch'>>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdminOrMaster = currentUser.role === 'admin' || currentUser.role === 'master';
  const isLogistica =
    isAdminOrMaster || !!(currentUser.permissions as Record<string, unknown>)?.carregamento_liberar;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

      // ── Queries paralelas ────────────────────────────────────
      const [
        carregamentosRes,
        pedidosRes,
        cotacoesRes,
        carregamentosMesRes,
        usuariosRes,
        gastosRes,
        auditRes,
      ] = await Promise.allSettled([
        // Todos os carregamentos (para KPIs e gráficos)
        supabase
          .from('carregamentos')
          .select('id, status, quantidade_total, criado_por, criado_em, valor_frete, transportadora_id, filial_id, transportadoras(nome), branches(name)')
          .gte('criado_em', sixMonthsAgo),

        // Pedidos de venda do mês
        supabase
          .from('pedidos_venda')
          .select('id, criado_por, criado_em')
          .gte('criado_em', firstDayOfMonth),

        // Cotações aguardando (status pendente)
        supabase
          .from('cotacoes_frete')
          .select('id, status')
          .eq('status', 'pendente'),

        // Carregamentos por mês (últimos 6 meses) — contagem
        supabase
          .from('carregamentos')
          .select('criado_em, status')
          .gte('criado_em', sixMonthsAgo),

        // Usuários ativos (admin/master only)
        isAdminOrMaster
          ? supabase.from('app_users').select('id').eq('ativo', true)
          : Promise.resolve({ data: null, error: null }),

        // Gastos de cartão do mês (admin/master only)
        isAdminOrMaster
          ? supabase
              .from('credit_card_expenses')
              .select('amount, status')
              .gte('created_at', firstDayOfMonth)
          : Promise.resolve({ data: null, error: null }),

        // Audit log recente (admin/master only)
        isAdminOrMaster
          ? supabase
              .from('audit_log')
              .select('id, criado_em, usuario_nome, acao, tabela, dados_novos')
              .order('criado_em', { ascending: false })
              .limit(10)
          : Promise.resolve({ data: null, error: null }),
      ]);

      // ── Processar carregamentos ──────────────────────────────
      const carregamentos =
        carregamentosRes.status === 'fulfilled' ? (carregamentosRes.value.data ?? []) : [];

      // Filtrar por usuário se não for logística
      const myCarregamentos = isLogistica
        ? carregamentos
        : carregamentos.filter((c) => c.criado_por === currentUser.id);

      // KPIs do mês atual
      const carregamentosMesAtual = myCarregamentos.filter(
        (c) => c.criado_em >= firstDayOfMonth
      );

      const pendentesAprovacao = myCarregamentos.filter(
        (c) => c.status === 'aguardando_liberacao'
      ).length;

      const tonelagemTransito = myCarregamentos
        .filter((c) => c.status === 'em_carregamento')
        .reduce((sum: number, c) => sum + Number(c.quantidade_total ?? 0), 0);

      const freteValues = myCarregamentos
        .filter((c) => c.valor_frete != null)
        .map((c) => Number(c.valor_frete));
      const freteMedia = freteValues.length > 0
        ? freteValues.reduce((a, b) => a + b, 0) / freteValues.length
        : 0;

      // KPI pedidos de venda
      const pedidos = pedidosRes.status === 'fulfilled' ? (pedidosRes.value.data ?? []) : [];
      const myPedidos = isLogistica
        ? pedidos
        : pedidos.filter((p) => p.criado_por === currentUser.id);

      // Cotações aguardando
      const cotacoes = cotacoesRes.status === 'fulfilled' ? (cotacoesRes.value.data ?? []) : [];

      // Usuários ativos
      const usuariosData =
        usuariosRes.status === 'fulfilled' ? (usuariosRes.value as { data: unknown[] | null }).data : null;
      const usuariosAtivos = usuariosData ? usuariosData.length : undefined;

      // Gastos cartão
      const gastosData =
        gastosRes.status === 'fulfilled'
          ? ((gastosRes.value as { data: { amount: number }[] | null }).data ?? [])
          : [];
      const gastosCartaoMes = isAdminOrMaster
        ? gastosData.reduce((sum, g) => sum + Number(g.amount ?? 0), 0)
        : undefined;

      // ── Gráfico: carregamentos por mês ─────────────────────
      const mesCarregamentos =
        carregamentosMesRes.status === 'fulfilled'
          ? (carregamentosMesRes.value.data ?? [])
          : [];

      const graficoMes: GraficoMes[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;

        const mesData = mesCarregamentos.filter(
          (c) => c.criado_em && c.criado_em.slice(0, 7) === mesStr
        );
        graficoMes.push({
          mes: label,
          total: mesData.length,
          entregues: mesData.filter((c) => c.status === 'carregado').length,
        });
      }

      // ── Gráfico: status dos carregamentos (mês atual) ──────
      const mesAtualStr = firstDayOfMonth.slice(0, 7);
      const carregamentosMesGrafico = myCarregamentos.filter(
        (c) => c.criado_em && c.criado_em.slice(0, 7) === mesAtualStr
      );

      const allStatuses: StatusCarregamento[] = [
        'aguardando_cotacao',
        'cotacao_solicitada',
        'cotacao_recebida',
        'aguardando_liberacao',
        'liberado_parcial',
        'liberado_total',
        'em_carregamento',
        'carregado',
        'cancelado',
      ];
      const graficoStatus: GraficoStatus[] = allStatuses.map((s) => ({
        status: STATUS_LABELS[s],
        count: carregamentosMesGrafico.filter((c) => c.status === s).length,
        color: STATUS_COLORS[s],
      }));

      // ── Gráfico: frete por transportadora (Top 5) ─────────
      const transMap: Record<string, { nome: string; valor: number }> = {};
      for (const c of myCarregamentos.filter(
        (c) => c.criado_em >= firstDayOfMonth && c.valor_frete != null
      )) {
        const tId = c.transportadora_id ?? 'desconhecida';
        const tNome =
          (c.transportadoras as { nome?: string } | null)?.nome ??
          tId.slice(0, 8);
        if (!transMap[tId]) transMap[tId] = { nome: tNome, valor: 0 };
        transMap[tId].valor += Number(c.valor_frete);
      }
      const graficoTransportadora: GraficoTransportadora[] = Object.values(transMap)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);

      // ── Gráfico: tonelagem por filial (admin/master) ───────
      const graficoFilial: GraficoFilial[] = [];
      if (isAdminOrMaster) {
        const filialMap: Record<string, { nome: string; ton: number }> = {};
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
        for (const c of carregamentos.filter((c) => c.criado_em >= threeMonthsAgo)) {
          const fId = c.filial_id ?? 'desconhecida';
          const fNome = (c.branches as { name?: string } | null)?.name ?? fId.slice(0, 8);
          if (!filialMap[fId]) filialMap[fId] = { nome: fNome, ton: 0 };
          filialMap[fId].ton += Number(c.quantidade_total ?? 0);
        }
        for (const [, v] of Object.entries(filialMap)) {
          graficoFilial.push({ filial: v.nome, tonelagem: v.ton });
        }
        graficoFilial.sort((a, b) => b.tonelagem - a.tonelagem);
      }

      // ── Audit log recente ───────────────────────────────────
      const auditData =
        auditRes.status === 'fulfilled'
          ? ((auditRes.value as { data: DashboardData['auditRecente'] | null }).data ?? [])
          : [];

      setData({
        kpis: {
          carregamentosMes: carregamentosMesAtual.length,
          pedidosVendaMes: myPedidos.length,
          pendentesAprovacao,
          tonelagemTransito,
          freteMedia,
          cotacoesAguardando: cotacoes.length,
          usuariosAtivos,
          gastosCartaoMes,
        },
        graficos: {
          carregamentosPorMes: graficoMes,
          statusCarregamentos: graficoStatus,
          freteTransportadora: graficoTransportadora,
          tonelagemFilial: graficoFilial,
        },
        auditRecente: auditData,
      });
    } catch (err) {
      console.error('[useDashboard] Erro:', err);
      setError('Erro ao carregar dados do dashboard.');
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, isAdminOrMaster, isLogistica]);

  useEffect(() => {
    fetchData();
    // Auto-refresh a cada 5 minutos
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { ...data, loading, error, refetch: fetchData };
}
