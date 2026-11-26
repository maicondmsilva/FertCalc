import { describe, expect, it } from 'vitest';
import { describeAuditEntry, formatAuditValue } from '../auditHistory';

const TRANSPORTADORA = 'bdbb3a00-0817-41eb-820d-8e13f6b9a6a6';

describe('histórico em mensagens', () => {
  it('cotação informada mostra transportadora, frete e total em reais', () => {
    const description = describeAuditEntry(
      {
        tabela: 'cotacoes_solicitadas',
        acao: 'UPDATE',
        dados_anteriores: { status: 'aguardando' },
        dados_novos: {
          status: 'cotado',
          transportadora_id: TRANSPORTADORA,
          valor_frete: 4800,
          valor_frete_unitario: 100,
          cotado_em: '2026-11-26T17:28:23.892Z',
        },
        campos_alterados: ['status', 'transportadora_id', 'valor_frete_unitario', 'valor_frete'],
        motivo: 'Cotação informada por Maicon',
      },
      { [TRANSPORTADORA]: 'Translog' }
    );
    expect(description.title).toBe('Cotação informada pela logística');
    expect(description.details.join(' | ')).toContain('Transportadora: Translog');
    expect(description.details.join(' | ')).toMatch(/Frete: R\$\s?100,00\/t/);
    expect(description.details.join(' | ')).toMatch(/Total: R\$\s?4\.800,00/);
    // Sem ids, nomes de coluna ou o motivo repetido.
    expect(JSON.stringify(description)).not.toContain(TRANSPORTADORA);
    expect(JSON.stringify(description)).not.toContain('valor_frete');
    expect(description.note).toBeUndefined();
  });

  it('aprovação mostra até quando fica disponível', () => {
    const description = describeAuditEntry({
      tabela: 'cotacoes_solicitadas',
      acao: 'UPDATE',
      dados_anteriores: { status: 'cotado' },
      dados_novos: {
        status: 'aprovado',
        aprovado_em: '2026-11-26T17:29:08Z',
        validade_ate: '2026-12-10',
      },
    });
    expect(description.title).toBe('Cotação aprovada');
    expect(description.tone).toBe('approved');
    expect(description.details[0]).toContain('10/12/2026');
  });

  it('devolução mostra o motivo', () => {
    const description = describeAuditEntry({
      tabela: 'cotacoes_solicitadas',
      acao: 'UPDATE',
      dados_anteriores: { status: 'cotado' },
      dados_novos: { status: 'em_analise', motivo_recusa: 'Prazo incompatível' },
    });
    expect(description.title).toBe('Devolvida para revisão');
    expect(description.details).toContain('Motivo: Prazo incompatível');
  });

  it('edição lista antes → depois com nomes de campo legíveis', () => {
    const description = describeAuditEntry({
      tabela: 'cotacoes_solicitadas',
      acao: 'UPDATE',
      dados_anteriores: { quantidade_ton: 40, produto: null, id: 'x', organization_id: 'y' },
      dados_novos: { quantidade_ton: 48, produto: '08-20-18', id: 'x', organization_id: 'y' },
      campos_alterados: ['quantidade_ton', 'produto', 'atualizado_em'],
    });
    expect(description.title).toBe('Dados alterados');
    expect(description.changes).toEqual([
      { field: 'quantidade_ton', label: 'Quantidade', before: '40 t', after: '48 t' },
      { field: 'produto', label: 'Produto', before: '—', after: '08-20-18' },
    ]);
  });

  it('criação resume cliente e quantidade', () => {
    const description = describeAuditEntry({
      tabela: 'cotacoes_solicitadas',
      acao: 'INSERT',
      dados_novos: { cliente_nome: 'Fazenda Boa Vista', quantidade_ton: 48, status: 'aguardando' },
    });
    expect(description.title).toBe('Cotação solicitada');
    expect(description.details).toEqual(['Cliente: Fazenda Boa Vista', 'Quantidade: 48 t']);
  });

  it('formata situação, datas e ids desconhecidos', () => {
    expect(formatAuditValue('status', 'liberado_parcial', 'carregamentos')).toBe(
      'Liberado parcial'
    );
    expect(formatAuditValue('validade_ate', '2026-12-10')).toBe('10/12/2026');
    expect(formatAuditValue('filial_id', TRANSPORTADORA)).toBe('outro cadastro');
  });
});
