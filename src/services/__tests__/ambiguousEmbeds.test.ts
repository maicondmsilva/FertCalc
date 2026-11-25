import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * No banco há dois vínculos entre estas tabelas (o original e o
 * "*_same_organization_fk" do isolamento por empresa). Sem dizer qual usar, o
 * Supabase recusa a consulta (HTTP 300) e a tela não carrega. Toda junção
 * dessas tabelas precisa indicar o vínculo: tabela!nome_do_vinculo(...).
 */
const AMBIGUOUS: { from: string; embed: string }[] = [
  { from: 'carregamentos', embed: 'transportadoras' },
  { from: 'carregamentos', embed: 'pedidos_venda' },
  { from: 'carregamentos', embed: 'cotacoes_solicitadas' },
  { from: 'cotacoes_frete', embed: 'transportadoras' },
  { from: 'cotacoes_frete', embed: 'carregamentos' },
  { from: 'credit_card_expenses', embed: 'expense_categories' },
  { from: 'price_lists', embed: 'branches' },
  { from: 'price_lists', embed: 'locais_carregamento' },
  { from: 'locais_carregamento', embed: 'branches' },
  { from: 'macro_materials', embed: 'brands' },
  { from: 'pedidos_venda', embed: 'clients' },
  { from: 'pedidos_venda_itens', embed: 'pedidos_venda' },
  { from: 'carregamento_itens', embed: 'carregamentos' },
  { from: 'carregamento_execucoes', embed: 'carregamentos' },
  { from: 'alertas_carregamento', embed: 'carregamentos' },
  { from: 'historico_carregamento', embed: 'carregamentos' },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

/** Pares (tabela da consulta, texto do select) encontrados no código. */
function selectsByTable() {
  const found: { file: string; table: string; select: string }[] = [];
  for (const file of sourceFiles(join(__dirname, '..', '..'))) {
    const text = readFileSync(file, 'utf8');
    const pattern = /\.from\(\s*'([a-z_]+)'\s*\)\s*\.select\(\s*([`'])([\s\S]*?)\2/g;
    for (const match of text.matchAll(pattern)) {
      found.push({ file, table: match[1], select: match[3] });
    }
  }
  return found;
}

describe('junções entre tabelas com dois vínculos', () => {
  it('sempre indicam qual vínculo usar', () => {
    const problems = selectsByTable().flatMap(({ file, table, select }) =>
      AMBIGUOUS.filter(
        (pair) => pair.from === table && new RegExp(`(^|[\\s,])${pair.embed}\\s*\\(`).test(select)
      ).map((pair) => `${file}: ${table} -> ${pair.embed} sem !vinculo`)
    );
    expect(problems).toEqual([]);
  });
});
