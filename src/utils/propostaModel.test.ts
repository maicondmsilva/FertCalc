import { describe, expect, it } from 'vitest';
import type { Proposta } from '../types/proposta';
import {
  diasParaVencer,
  estatisticasPropostas,
  filtrarPropostas,
  formatNumeroProposta,
  problemaNovaProposta,
  situacaoProposta,
  somarDias,
  totaisExibidos,
} from './propostaModel';

const base = (over: Partial<Proposta>): Proposta =>
  ({
    id: 'p',
    numero: 1,
    criadoPor: 'u',
    criadoPorNome: 'Maria',
    clienteNome: 'Cliente A',
    clienteDados: {},
    moeda: 'BRL',
    validaAte: '2026-12-01',
    incluirComposicao: false,
    status: 'vigente',
    valorTotal: 0,
    toneladasTotal: 0,
    quantidadeItens: 1,
    createdAt: '2026-11-27',
    ...over,
  }) as Proposta;

describe('propostaModel', () => {
  it('número formatado', () => {
    expect(formatNumeroProposta(123)).toBe('PROP-000123');
  });

  it('vigente vira vencida depois da validade, mas não no próprio dia', () => {
    expect(situacaoProposta(base({ validaAte: '2026-11-27' }), '2026-11-27')).toBe('vigente');
    expect(situacaoProposta(base({ validaAte: '2026-11-26' }), '2026-11-27')).toBe('vencida');
    expect(
      situacaoProposta(base({ status: 'aceita', validaAte: '2026-01-01' }), '2026-11-27')
    ).toBe('aceita');
  });

  it('dias para vencer e soma de dias', () => {
    expect(diasParaVencer('2026-12-04', '2026-11-27')).toBe(7);
    expect(somarDias('2026-11-27', 7)).toBe('2026-12-04');
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('filtra por situação, região e busca (nome, número, documento)', () => {
    const lista = [
      base({
        id: '1',
        numero: 10,
        clienteNome: 'João Silva',
        regionId: 'r1',
        clienteDocumento: '123.456.789-00',
      }),
      base({ id: '2', numero: 11, clienteNome: 'Ana Souza', validaAte: '2026-11-01' }),
    ];
    const hoje = '2026-11-27';
    const f = { busca: '', situacao: '' as const, regiao: '' };
    expect(filtrarPropostas(lista, { ...f, situacao: 'vencida' }, hoje).map((p) => p.id)).toEqual([
      '2',
    ]);
    expect(filtrarPropostas(lista, { ...f, regiao: 'none' }, hoje).map((p) => p.id)).toEqual(['2']);
    expect(filtrarPropostas(lista, { ...f, busca: 'joao' }, hoje).map((p) => p.id)).toEqual(['1']);
    expect(filtrarPropostas(lista, { ...f, busca: 'PROP-000011' }, hoje).map((p) => p.id)).toEqual([
      '2',
    ]);
    expect(filtrarPropostas(lista, { ...f, busca: '456789' }, hoje).map((p) => p.id)).toEqual([
      '1',
    ]);
  });

  it('estatísticas', () => {
    const hoje = '2026-11-27';
    const stats = estatisticasPropostas(
      [
        base({ validaAte: '2026-11-29' }),
        base({ validaAte: '2026-12-20' }),
        base({ status: 'aceita' }),
        base({ status: 'recusada' }),
      ],
      hoje
    );
    expect(stats).toEqual({
      vigentes: 2,
      vencendo: 1,
      aceitas: 1,
      conversao: 50,
      valorAceito: 0,
      toneladasAceitas: 0,
    });
  });

  it('problemas ao criar', () => {
    const ok = {
      validaAte: '2026-12-01',
      quantidadeItens: 1,
      itensSemPreco: [],
      hoje: '2026-11-27',
    };
    expect(problemaNovaProposta(ok)).toBeNull();
    expect(problemaNovaProposta({ ...ok, validaAte: '2026-11-26' })).toMatch(/anterior a hoje/);
    expect(problemaNovaProposta({ ...ok, quantidadeItens: 0 })).toMatch(/ao menos uma/);
    expect(problemaNovaProposta({ ...ok, itensSemPreco: ['X'] })).toMatch(/Sem preço/);
  });
});

describe('totaisExibidos', () => {
  it('depois do aceite mostra o que o cliente aceitou', () => {
    const proposta = {
      valorTotal: 0,
      toneladasTotal: 0,
      aceite: { valor: 12500, toneladas: 12.5 },
    };
    expect(totaisExibidos(proposta)).toEqual({ valor: 12500, toneladas: 12.5, origem: 'aceite' });
    expect(totaisExibidos({ valorTotal: 900, toneladasTotal: 1, aceite: null })).toEqual({
      valor: 900,
      toneladas: 1,
      origem: 'proposta',
    });
  });
});
