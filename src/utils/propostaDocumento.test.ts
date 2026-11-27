import { describe, expect, it } from 'vitest';
import type { Proposta, PropostaItem } from '../types/proposta';
import {
  MARCA_DAGUA_VENCIDA,
  createPropostaPdf,
  gerarExcelProposta,
  planilhaProposta,
  tamanhoLogoExcel,
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
