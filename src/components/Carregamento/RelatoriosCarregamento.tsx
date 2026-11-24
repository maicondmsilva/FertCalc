import React, { useMemo, useState } from 'react';
import { BarChart3, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import {
  Carregamento,
  Filial,
  Transportadora,
  StatusCarregamento,
  FiltrosRelatorioCarregamento,
} from '../../types/carregamento';
import { getCarregamentosRelatorio } from '../../services/carregamentoService';
import { TabelaCarregamentos } from './VisaoGeral';
import { STATUS_LABEL, fmtBRL } from './shared';
import { getAppSettings } from '../../services/db';
import { useToast } from '../Toast';
import {
  CARREGAMENTO_GROUP_LABEL,
  buildCarregamentoSheetRows,
  createCarregamentoPdf,
  groupCarregamentos,
  summarizeCarregamentos,
  type CarregamentoGroupBy,
} from '../../utils/carregamentoReport';

export function RelatoriosCarregamento({
  filiais,
  transportadoras,
}: {
  filiais: Filial[];
  transportadoras: Transportadora[];
}) {
  const [filtros, setFiltros] = useState<FiltrosRelatorioCarregamento>({});
  const [dados, setDados] = useState<Carregamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const { showError, showSuccess } = useToast();
  const [groupBy, setGroupBy] = useState<CarregamentoGroupBy>('transportadora');
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const buscar = async () => {
    setLoading(true);
    try {
      const result = await getCarregamentosRelatorio(filtros);
      setDados(result);
      setSearched(true);
    } catch {
      showError('Não foi possível carregar o relatório de carregamentos.');
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => summarizeCarregamentos(dados), [dados]);
  const groups = useMemo(() => groupCarregamentos(dados, groupBy), [dados, groupBy]);

  const filtersText = () => {
    const parts = [
      filtros.filial_id
        ? `Filial: ${filiais.find((f) => f.id === filtros.filial_id)?.nome ?? ''}`
        : '',
      filtros.transportadora_id
        ? `Transportadora: ${transportadoras.find((t) => t.id === filtros.transportadora_id)?.nome ?? ''}`
        : '',
      filtros.status ? `Status: ${STATUS_LABEL[filtros.status as StatusCarregamento]}` : '',
      filtros.tipo_frete ? `Frete: ${filtros.tipo_frete}` : '',
      filtros.data_inicio ? `De ${filtros.data_inicio.split('-').reverse().join('/')}` : '',
      filtros.data_fim ? `Até ${filtros.data_fim.split('-').reverse().join('/')}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Nenhum filtro aplicado';
  };

  const exportPdf = async () => {
    setExporting('pdf');
    try {
      const settings = await getAppSettings().catch(() => null);
      createCarregamentoPdf({ groupBy, groups, filtersText: filtersText(), settings }).save(
        'relatorio-carregamentos.pdf'
      );
      showSuccess('PDF gerado.');
    } catch {
      showError('Não foi possível gerar o PDF.');
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    setExporting('excel');
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet(buildCarregamentoSheetRows(groups, groupBy));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Carregamentos');
      XLSX.writeFile(book, 'relatorio-carregamentos.xlsx');
    } catch {
      showError('Não foi possível gerar a planilha.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
        <h3 className="font-bold text-stone-800 text-sm mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-stone-400" />
          Filtros
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Filial</label>
            <select
              value={filtros.filial_id ?? ''}
              onChange={(e) => setFiltros({ ...filtros, filial_id: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">Todas</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Tipo de Frete
            </label>
            <select
              value={filtros.tipo_frete ?? ''}
              onChange={(e) => setFiltros({ ...filtros, tipo_frete: e.target.value as any })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">Todos</option>
              <option value="CIF">CIF</option>
              <option value="FOB">FOB</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Status</label>
            <select
              value={filtros.status ?? ''}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">Todos</option>
              {(Object.keys(STATUS_LABEL) as StatusCarregamento[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Transportadora
            </label>
            <select
              value={filtros.transportadora_id ?? ''}
              onChange={(e) =>
                setFiltros({ ...filtros, transportadora_id: e.target.value || undefined })
              }
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">Todas</option>
              {transportadoras.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={filtros.data_inicio ?? ''}
              onChange={(e) => setFiltros({ ...filtros, data_inicio: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Data Fim
            </label>
            <input
              type="date"
              value={filtros.data_fim ?? ''}
              onChange={(e) => setFiltros({ ...filtros, data_fim: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={buscar}
            disabled={loading}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4" />
            )}
            Buscar
          </button>
        </div>
      </div>

      {searched && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
                Agrupar
              </span>
              <div
                className="inline-flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1"
                role="radiogroup"
                aria-label="Agrupar relatório"
              >
                {(Object.keys(CARREGAMENTO_GROUP_LABEL) as CarregamentoGroupBy[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={groupBy === option}
                    onClick={() => setGroupBy(option)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                      groupBy === option
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {CARREGAMENTO_GROUP_LABEL[option]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void exportExcel()}
                disabled={dados.length === 0 || exporting !== null}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {exporting === 'excel' ? 'Gerando…' : 'Excel'}
              </button>
              <button
                type="button"
                onClick={() => void exportPdf()}
                disabled={dados.length === 0 || exporting !== null}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white hover:bg-stone-800 disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                {exporting === 'pdf' ? 'Gerando…' : 'PDF'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: 'Carregamentos', value: String(summary.registros) },
              {
                label: 'Solicitado',
                value: `${summary.solicitado.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} t`,
              },
              {
                label: 'Carregado',
                value: `${summary.carregado.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} t`,
                accent: true,
              },
              { label: 'Frete total', value: fmtBRL(summary.frete) },
              { label: 'Frete médio', value: `${fmtBRL(summary.fretePorTonelada)}/t` },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
                  {card.label}
                </p>
                <p
                  className={`mt-1 text-2xl font-black ${card.accent ? 'text-amber-700' : 'text-stone-900'}`}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {groups.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white py-12 text-center text-sm text-stone-400">
              Nenhum carregamento encontrado com estes filtros.
            </div>
          ) : (
            groups.map((group) => (
              <section
                key={group.key}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
              >
                {groupBy !== 'nenhum' && (
                  <header className="flex flex-wrap items-center justify-between gap-2 bg-stone-900 px-4 py-2.5 text-white">
                    <p className="text-sm font-black">{group.label}</p>
                    <p className="text-sm font-bold">
                      {group.summary.registros} carregamento(s) ·{' '}
                      {group.summary.carregado.toLocaleString('pt-BR', {
                        maximumFractionDigits: 3,
                      })}{' '}
                      t carregadas · frete {fmtBRL(group.summary.frete)}
                    </p>
                  </header>
                )}
                <TabelaCarregamentos carregamentos={group.items} />
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL: Informar Transportador (Logística)
// ─────────────────────────────────────────────────────────────────────────────
