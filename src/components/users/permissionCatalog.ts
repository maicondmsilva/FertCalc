/**
 * Catálogo único de permissões — usado pela ficha do usuário e pelos perfis de
 * acesso. Antes cada tela tinha a sua cópia da lista e elas já divergiam.
 */

export interface PermissionItem {
  id: string;
  label: string;
}

export interface PermissionGroup {
  id: string;
  title: string;
  items: PermissionItem[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'painel',
    title: 'Painel',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'goals', label: 'Metas' },
      { id: 'managementReports', label: 'Relatórios gerenciais' },
    ],
  },
  {
    id: 'comunicacao',
    title: 'Comunicação',
    items: [{ id: 'chat_access', label: 'Chat interno' }],
  },
  {
    id: 'precificacao',
    title: 'Calculadora e precificação',
    items: [
      { id: 'calculator', label: 'Calculadora' },
      { id: 'simplified_calculator', label: 'Calculadora simplificada' },
      { id: 'simplified_calculator_beta', label: 'Calculadora teste' },
      { id: 'history', label: 'Precificações' },
      { id: 'pricingBySeller', label: 'Precificação por vendedor' },
      { id: 'calculator_savePricing', label: 'Salvar precificação' },
      { id: 'calculator_generatePDF', label: 'Gerar PDF' },
      { id: 'calculator_fertigranP', label: 'Comparador de fórmulas' },
      { id: 'calculator_profitabilityCheck', label: 'Análise de rentabilidade' },
      { id: 'calculator_extraProducts', label: 'Ver produtos fora da lista de preço' },
      { id: 'calculator_overrideGuaranteeDivergence', label: 'Autorizar garantia divergente' },
      { id: 'history_changeStatus', label: 'Alterar status' },
      { id: 'history_editPricing', label: 'Editar precificação existente' },
      { id: 'pricing_viewAllRegions', label: 'Ver precificações de todas as regiões' },
    ],
  },
  {
    id: 'batidas',
    title: 'Batidas e produtos formulados',
    items: [
      { id: 'savedFormulas', label: 'Batidas salvas' },
      { id: 'calculator_saveFormula', label: 'Salvar batida' },
      { id: 'savedFormulas_delete', label: 'Excluir batidas salvas' },
      { id: 'savedFormulas_report', label: 'Relatório de preços das batidas' },
      { id: 'produtosFormulados', label: 'Produtos formulados' },
      { id: 'produtosFormulados_edit', label: 'Produtos formulados — editar' },
    ],
  },
  {
    id: 'aprovacoes',
    title: 'Aprovações',
    items: [
      { id: 'approvals', label: 'Aprovações' },
      { id: 'approvals_canApprove', label: 'Aprovar / reprovar' },
    ],
  },
  {
    id: 'financeiro',
    title: 'Gastos com cartão',
    items: [{ id: 'expenses', label: 'Gastos com cartão' }],
  },
  {
    id: 'logistica',
    title: 'Carregamento e cotações',
    items: [
      { id: 'carregamento', label: 'Carregamento (visualizar)' },
      { id: 'carregamento_solicitar_cotacao', label: 'Solicitar cotação de frete' },
      { id: 'carregamento_tratar_cotacao', label: 'Tratar / responder cotações' },
      { id: 'carregamento_aprovar_cotacao', label: 'Aprovar cotações de frete' },
      { id: 'carregamento_liberar', label: 'Liberar carregamento' },
      { id: 'carregamento_logistica', label: 'Painel de logística' },
      { id: 'carregamento_informar_transportador', label: 'Informar transportador (CIF)' },
      { id: 'carregamento_relatorios', label: 'Relatórios do carregamento' },
      { id: 'carregamento_cancelar', label: 'Cancelar carregamentos' },
      { id: 'carregamento_all_filiais', label: 'Ver todas as filiais' },
      { id: 'carregamento_configurar_filiais', label: 'Configurar filiais do carregamento' },
      { id: 'carregamento_admin', label: 'Administrar o módulo' },
      { id: 'carregamento_ver_arquivadas', label: 'Ver cotações arquivadas' },
    ],
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    items: [
      { id: 'relatorios', label: 'Central de relatórios' },
      { id: 'reports', label: 'Relatórios da precificação' },
      { id: 'pricingReport', label: 'Relatório de precificação' },
      { id: 'commissionReport', label: 'Relatório de comissão' },
    ],
  },
  {
    id: 'cadastros',
    title: 'Cadastros',
    items: [
      { id: 'clients', label: 'Clientes' },
      { id: 'clients_create', label: 'Clientes — criar' },
      { id: 'clients_edit', label: 'Clientes — editar' },
      { id: 'clients_delete', label: 'Clientes — excluir' },
      { id: 'agents', label: 'Agentes' },
      { id: 'agents_create', label: 'Agentes — criar' },
      { id: 'agents_edit', label: 'Agentes — editar' },
      { id: 'agents_delete', label: 'Agentes — excluir' },
      { id: 'priceLists', label: 'Listas de preço' },
      { id: 'priceLists_create', label: 'Listas de preço — criar' },
      { id: 'priceLists_edit', label: 'Listas de preço — editar' },
      { id: 'priceLists_delete', label: 'Listas de preço — excluir' },
      { id: 'macro', label: 'Matérias-primas macro' },
      { id: 'macro_create', label: 'Macro — criar' },
      { id: 'macro_edit', label: 'Macro — editar' },
      { id: 'macro_delete', label: 'Macro — excluir' },
      { id: 'micro', label: 'Matérias-primas micro' },
      { id: 'micro_create', label: 'Micro — criar' },
      { id: 'micro_edit', label: 'Micro — editar' },
      { id: 'micro_delete', label: 'Micro — excluir' },
    ],
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    items: [
      { id: 'branches', label: 'Filiais e locais' },
      { id: 'branches_create', label: 'Filiais — criar' },
      { id: 'branches_edit', label: 'Filiais — editar' },
      { id: 'branches_delete', label: 'Filiais — excluir' },
      { id: 'regions_manage', label: 'Regiões — gerenciar' },
      { id: 'users', label: 'Usuários' },
      { id: 'accessProfiles', label: 'Perfis de acesso' },
      { id: 'settings', label: 'Personalização' },
      { id: 'alertas', label: 'Central de alertas' },
    ],
  },
];

export const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap((group) =>
  group.items.map((item) => item.id)
);

export type PermissionMap = Record<string, unknown>;

export const isEnabled = (permissions: PermissionMap | undefined, id: string) =>
  Boolean(permissions?.[id]);

/** Quantas permissões do catálogo estão ligadas. */
export function countEnabled(permissions: PermissionMap | undefined): number {
  return ALL_PERMISSION_IDS.filter((id) => isEnabled(permissions, id)).length;
}

/** Permissões em que o usuário difere do perfil (só as do catálogo). */
export function differencesFromProfile(
  permissions: PermissionMap | undefined,
  profile: PermissionMap | undefined
): string[] {
  if (!profile) return [];
  return ALL_PERMISSION_IDS.filter((id) => isEnabled(permissions, id) !== isEnabled(profile, id));
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Grupos filtrados pela busca (no nome da permissão ou do grupo). */
export function filterPermissionGroups(query: string): PermissionGroup[] {
  const term = normalize(query);
  if (!term) return PERMISSION_GROUPS;
  return PERMISSION_GROUPS.map((group) =>
    normalize(group.title).includes(term)
      ? group
      : { ...group, items: group.items.filter((item) => normalize(item.label).includes(term)) }
  ).filter((group) => group.items.length > 0);
}

/** Liga ou desliga todas as permissões de um grupo. */
export function setGroup(
  permissions: PermissionMap,
  group: PermissionGroup,
  value: boolean
): PermissionMap {
  const next = { ...permissions };
  group.items.forEach((item) => {
    next[item.id] = value;
  });
  return next;
}
