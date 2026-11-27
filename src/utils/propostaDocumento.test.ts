import { describe, expect, it } from 'vitest';
import type { Proposta, PropostaItem } from '../types/proposta';
import {
  MARCA_DAGUA_VENCIDA,
  createComprovantePdf,
  createPropostaPdf,
  gerarExcelProposta,
  planilhaProposta,
  tamanhoLogoExcel,
  vencimentoComum,
  vencimentoItem,
  totaisProposta,
} from './propostaDocumento';

const proposta = {
  id: 'p',
  numero: 7,
  criadoPor: 'u',
  criadoPorNome: 'Maria',
  clienteNome: 'Cliente A',
  clienteDocumento: '123',
  clienteDados: { cidade: 'Uruaçu', estado: 'GO' },
  moeda: 'BRL',
  validaAte: '2026-12-01',
  incluirComposicao: true,
  status: 'vigente',
  valorTotal: 0,
  toneladasTotal: 0,
  quantidadeItens: 2,
  createdAt: '2026-11-27',
} as Proposta;

const itens: PropostaItem[] = [
  {
    formulaNome: 'A',
    npk: '04-14-08',
    precoTonelada: 1000,
    quantidadeSugerida: 10,
    composicao: [{ nome: 'MAP', kg: 300, tipo: 'Macro' }],
  },
  { formulaNome: 'B', precoTonelada: 2000, composicao: [] },
];

describe('propostaDocumento', () => {
  it('totais só contam o que tem quantidade', () => {
    expect(totaisProposta(itens)).toEqual({ toneladas: 10, valor: 10000 });
  });

  it('planilha: aviso de vencida e aba de composição quando escolhida', () => {
    const vigente = planilhaProposta(proposta, itens, '2026-11-27');
    expect(vigente.proposta.flat()).not.toContain(MARCA_DAGUA_VENCIDA);
    expect(vigente.composicao?.[1]).toEqual(['A', '04-14-08', 'MAP', 'Macro', 300]);
    const vencida = planilhaProposta(proposta, itens, '2026-12-02');
    expect(vencida.proposta.flat()).toContain(MARCA_DAGUA_VENCIDA);
    expect(
      planilhaProposta({ ...proposta, incluirComposicao: false }, itens).composicao
    ).toBeNull();
  });

  it('PDF tem a marca d’água só quando vencida', () => {
    const texto = (hoje: string) =>
      createPropostaPdf({
        proposta,
        itens,
        settings: { companyName: 'X', companyLogo: '' },
        hoje,
      }).output();
    expect(texto('2026-11-27')).not.toContain('FORA DA VALIDADE');
    expect(texto('2026-12-02')).toContain('FORA DA VALIDADE');
  });

  it('Excel é gerado com as abas', async () => {
    const buffer = await gerarExcelProposta(proposta, itens, null, '2026-11-27');
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer);
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(['Proposta', 'Composição']);
  });
});

describe('logo e nome da empresa', () => {
  it('nome some do PDF quando a Personalização manda mostrar só a logo', () => {
    // PNG 1x1 transparente.
    const logo =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const pdf = (show: boolean) =>
      createPropostaPdf({
        proposta,
        itens,
        settings: { companyName: 'EMPRESA XYZ', companyLogo: logo, showCompanyName: show },
        hoje: '2026-11-27',
      }).output();
    expect(pdf(true)).toContain('EMPRESA XYZ');
    expect(pdf(false)).not.toContain('EMPRESA XYZ');
  });

  it('tamanho da logo no Excel mantém a proporção do PNG', () => {
    // Cabeçalho PNG de 300x100.
    const header = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 1, 44, 0, 0, 0, 100, 8, 6,
      0, 0, 0,
    ]);
    const base64 = globalThis.btoa(String.fromCharCode(...header));
    expect(tamanhoLogoExcel(base64)).toEqual({ width: 150, height: 50 });
  });
});

describe('comprovante', () => {
  it('traz o CPF formatado, os produtos aceitos e o total', () => {
    const texto = createComprovantePdf({
      numero: 5,
      clienteNome: 'Cliente A',
      vendedor: 'Maria',
      moeda: 'BRL',
      resposta: {
        tipo: 'aceite',
        documento: '12345678909',
        itens: [{ id: 'i', nome: 'SOJA 04-14-08', precoTonelada: 1000, quantidade: 12.5 }],
        valorTotal: 12500,
        toneladasTotal: 12.5,
        ip: '200.1.2.3',
        respondidoEm: '2026-11-27T14:32:00Z',
      },
      settings: null,
    }).output();
    expect(texto).toContain('Comprovante de aceite');
    expect(texto).toContain('123.456.789-09');
    expect(texto).toContain('SOJA 04-14-08');
    expect(texto).toContain('200.1.2.3');
  });
});

describe('vencimento', () => {
  it('data, DDF e comum a todos', () => {
    const venc = {
      formulaNome: 'A',
      precoTonelada: 1,
      composicao: [],
      fatores: { dueDate: '2027-04-30' },
    };
    const ddf = {
      formulaNome: 'B',
      precoTonelada: 1,
      composicao: [],
      fatores: { paymentCondition: 'ddf', ddfDias: 30, dueDate: '2026-12-27' },
    };
    expect(vencimentoItem(venc)).toBe('30/04/2027');
    expect(vencimentoItem(ddf)).toBe('30 dias após carreg. (27/12/2026)');
    expect(vencimentoComum([venc, venc])).toBe('30/04/2027');
    expect(vencimentoComum([venc, ddf])).toBeNull();
  });
});

describe('assinatura eletrônica no comprovante', () => {
  it('traz o código de verificação, o resumo e o endereço de conferência', () => {
    const texto = createComprovantePdf({
      numero: 5,
      clienteNome: 'Cliente A',
      vendedor: 'Maria',
      moeda: 'BRL',
      resposta: {
        tipo: 'aceite',
        documento: '12345678909',
        itens: [],
        valorTotal: 0,
        toneladasTotal: 0,
        respondidoEm: '2026-11-27T14:32:00Z',
        codigoVerificacao: '7694-CBC6-B7F7',
        hashAssinatura: 'abc123',
      },
      urlVerificacao: 'https://app/verificar/7694-CBC6-B7F7',
    }).output();
    expect(texto).toContain('ASSINADO ELETRONICAMENTE');
    expect(texto).toContain('7694-CBC6-B7F7');
    expect(texto).toContain('abc123');
    expect(texto).toContain('https://app/verificar/7694-CBC6-B7F7');
  });
});
