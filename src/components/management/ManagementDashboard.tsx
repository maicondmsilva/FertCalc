import React, { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { format, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import type {
  Unidade,
  Indicador,
  Lancamento,
  MetaMensal,
  ConfiguracaoIndicador,
  DiasUteisMes,
  Categoria,
} from '../../types';
import { cn, gerarIdsVisuais } from '../../utils/managementUtils';
import { Card, Button, Input } from './ManagementUI';

interface ManagementDashboardProps {
  unidades: Unidade[];
  indicadores: Indicador[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
  metas: MetaMensal[];
  configs: ConfiguracaoIndicador[];
  diasUteis: DiasUteisMes[];
}

export default function ManagementDashboard({
  unidades,
  indicadores,
  categorias,
  lancamentos,
  metas,
  configs,
  diasUteis,
}: ManagementDashboardProps) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { reverseVisualIdMap } = useMemo(
    () => gerarIdsVisuais(indicadores, categorias),
    [indicadores, categorias]
  );

  const activeUnidades = unidades
    .filter((u) => u.ativo)
    .sort((a, b) => a.ordem_exibicao - b.ordem_exibicao);

  const getValor = (unidadeId: string, indicadorId: string, date: string = selectedDate) => {
    return (
      lancamentos.find(
        (l) => l.unidade_id === unidadeId && l.indicador_id === indicadorId && l.data === date
      )?.valor || 0
    );
  };

  const getSomaPeriodo = (unidadeId: string, indicadorId: string, start: Date, end: Date) => {
    return lancamentos
      .filter(
        (l) =>
          l.unidade_id === unidadeId &&
          l.indicador_id === indicadorId &&
          parseISO(l.data) >= start &&
          parseISO(l.data) <= end
      )
      .reduce((acc, curr) => acc + curr.valor, 0);
  };

  const getMediaPonderada = (
    unidadeId: string,
    rentId: string,
    volumeId: string,
    start: Date,
    end: Date
  ) => {
    const periodLancamentos = lancamentos.filter(
      (l) => l.unidade_id === unidadeId && parseISO(l.data) >= start && parseISO(l.data) <= end
    );
    let totalVolume = 0;
    let weightedSum = 0;

    const dates = [...new Set(periodLancamentos.map((l) => l.data))];
    dates.forEach((d) => {
      const rent =
        periodLancamentos.find((l) => l.data === d && l.indicador_id === rentId)?.valor || 0;
      const vol =
        periodLancamentos.find((l) => l.data === d && l.indicador_id === volumeId)?.valor || 0;
      weightedSum += rent * vol;
      totalVolume += vol;
    });

    return totalVolume > 0 ? weightedSum / totalVolume : 0;
  };

  const currentMonthStart = startOfMonth(parseISO(selectedDate));
  const currentYearStart = new Date(parseISO(selectedDate).getFullYear(), 0, 1);

  // Weekly range (Mon to Sun)
  const d = parseISO(selectedDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const avaliarFormula = (
    formula: string,
    valores: Record<string, number>,
    valoresMes: Record<string, number> = {},
    valoresAno: Record<string, number> = {},
    valoresMesAnt: Record<string, number> = {},
    valoresAnoAnt: Record<string, number> = {},
    valoresSem: Record<string, number> = {},
    valoresSemAnt: Record<string, number> = {},
    diasComLancMes = 1,
    diasComLancAno = 1,
    diasComLancSem = 1
  ): number => {
    try {
      let expressao = formula;

      // 1. Specific accumulation tags FIRST (longer prefixes before shorter ones to avoid partial matches)
      expressao = expressao.replace(/ACUM_MES_ANT\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresMesAnt[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      expressao = expressao.replace(/ACUM_ANO_ANT\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresAnoAnt[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      // Previous-week accumulation tag
      expressao = expressao.replace(/ACUM_SEM_ANT\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresSemAnt[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      // Average tags: ACUM / number-of-days-with-data
      expressao = expressao.replace(/MEDIA_MES\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresMes[idInterno] ?? 0;
        return String(diasComLancMes > 0 ? val / diasComLancMes : 0);
      });

      expressao = expressao.replace(/MEDIA_ANO\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresAno[idInterno] ?? 0;
        return String(diasComLancAno > 0 ? val / diasComLancAno : 0);
      });

      expressao = expressao.replace(/MEDIA_SEM\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresSem[idInterno] ?? 0;
        return String(diasComLancSem > 0 ? val / diasComLancSem : 0);
      });

      // Weekly accumulation tag
      expressao = expressao.replace(/ACUM_SEM\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresSem[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      // 2. Standard accumulation tags
      expressao = expressao.replace(/ACUM_MES\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresMes[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      expressao = expressao.replace(/ACUM_ANO\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresAno[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      // 3. Simple [visualId] references LAST
      expressao = expressao.replace(/\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valores[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      // 4. Pre-process math functions into Math.* equivalents
      // IF(cond, vTrue, vFalse) → (cond ? vTrue : vFalse)
      expressao = expressao.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, (_, cond, vTrue, vFalse) => {
        return `(${cond.trim()}?${vTrue.trim()}:${vFalse.trim()})`;
      });
      // MIN(a, b)
      expressao = expressao.replace(/MIN\(([^,]+),([^)]+)\)/gi, (_, a, b) => {
        return `Math.min(${a.trim()},${b.trim()})`;
      });
      // MAX(a, b)
      expressao = expressao.replace(/MAX\(([^,]+),([^)]+)\)/gi, (_, a, b) => {
        return `Math.max(${a.trim()},${b.trim()})`;
      });
      // ABS(a)
      expressao = expressao.replace(/ABS\(([^)]+)\)/gi, (_, a) => {
        return `Math.abs(${a.trim()})`;
      });
      // ROUND(a, casas)
      expressao = expressao.replace(/ROUND\(([^,]+),([^)]+)\)/gi, (_, a, casas) => {
        return `Math.round(${a.trim()}*Math.pow(10,${casas.trim()}))/Math.pow(10,${casas.trim()})`;
      });

      // Remove whitespace
      expressao = expressao.replace(/\s/g, '');

      // Validate: allow digits, operators, parentheses, decimal point, comparison operators, and Math.* calls
      if (
        !/^[\d+\-*/().,><=!?:]+$/.test(expressao.replace(/\bMath\.(min|max|abs|round|pow)\b/g, '0'))
      ) {
        return 0;
      }

      // Blocklist: reject any dangerous identifiers after transformations
      const blocklist = [
        'eval',
        'fetch',
        'window',
        'document',
        'process',
        'require',
        'import',
        'export',
        'function',
        'return',
        'var',
        'let',
        'const',
        'new',
        'this',
        'prototype',
        '__proto__',
        'constructor',
        'globalThis',
      ];
      if (blocklist.some((word) => new RegExp(`\\b${word}\\b`).test(expressao))) {
        return 0;
      }

      // Evaluate using Function with Math in scope
      // eslint-disable-next-line no-new-func
      const resultado = new Function('Math', `return (${expressao})`)(Math);

      if (typeof resultado !== 'number' || !isFinite(resultado)) {
        return 0;
      }

      return resultado;
    } catch {
      return 0;
    }
  };

  const getCalculatedData = (u: Unidade) => {
    const year = parseISO(selectedDate).getFullYear();
    const month = parseISO(selectedDate).getMonth() + 1;
    const selectedDateObj = parseISO(selectedDate);

    // Vendas
    const tonsDia = getValor(u.id, 'v1');
    const rentDia = getValor(u.id, 'v2');
    const entradaGeral = getValor(u.id, 'v3');
    const cancelamentoBruto = getValor(u.id, 'v4');
    const carteiraAno = getValor(u.id, 'v5');

    // Weekly accumulation up to selected date
    const tonsSemana = getSomaPeriodo(u.id, 'v1', weekStart, selectedDateObj);
    const tonsMes = getSomaPeriodo(u.id, 'v1', currentMonthStart, selectedDateObj);
    const entradaMes = getSomaPeriodo(u.id, 'v3', currentMonthStart, selectedDateObj);
    const cancelamentoSemana = getSomaPeriodo(u.id, 'v4', weekStart, selectedDateObj);
    const mediaRentMes = getMediaPonderada(u.id, 'v2', 'v1', currentMonthStart, selectedDateObj);

    // Carregamento
    const prodDia = getValor(u.id, 'c1');
    const prodMes = getSomaPeriodo(u.id, 'c1', currentMonthStart, selectedDateObj);
    const prodAno = getSomaPeriodo(u.id, 'c1', currentYearStart, selectedDateObj);

    // Faturamento
    const fatVenda = getValor(u.id, 'f1');
    const fatConsig = getValor(u.id, 'f2');
    const fatRemessa = getValor(u.id, 'f3');
    const fatTotalDia = fatVenda + fatConsig + fatRemessa;
    const fatAcumuladoMes = lancamentos
      .filter(
        (l) =>
          l.unidade_id === u.id &&
          ['f1', 'f2', 'f3'].includes(l.indicador_id) &&
          parseISO(l.data) >= currentMonthStart &&
          parseISO(l.data) <= selectedDateObj
      )
      .reduce((acc, curr) => acc + curr.valor, 0);
    const fatAcumuladoAno = lancamentos
      .filter(
        (l) =>
          l.unidade_id === u.id &&
          ['f1', 'f2', 'f3'].includes(l.indicador_id) &&
          parseISO(l.data) >= currentYearStart &&
          parseISO(l.data) <= selectedDateObj
      )
      .reduce((acc, curr) => acc + curr.valor, 0);

    const metaMes =
      metas.find(
        (m) => m.unidade_id === u.id && m.ano === year && m.mes === month && m.indicador_id === 'f1'
      )?.valor_meta || 0;
    const saldoDeficit = metaMes - fatAcumuladoMes;

    const totalDiasUteis =
      diasUteis.find((d) => d.unidade_id === u.id && d.ano === year && d.mes === month)
        ?.total_dias_uteis || 22;
    // Count days with invoicing
    const daysWithInvoicing = new Set(
      lancamentos
        .filter(
          (l) =>
            l.unidade_id === u.id &&
            ['f1', 'f2', 'f3'].includes(l.indicador_id) &&
            parseISO(l.data) >= currentMonthStart &&
            parseISO(l.data) <= selectedDateObj &&
            l.valor > 0
        )
        .map((l) => l.data)
    ).size;

    const diasRestantes = Math.max(0, totalDiasUteis - daysWithInvoicing);
    const mediaAFaturar = diasRestantes > 0 ? saldoDeficit / diasRestantes : 0;

    const genericData = Object.fromEntries(indicadores.map((i) => [i.id, getValor(u.id, i.id)]));
    const genericDataMes = Object.fromEntries(
      indicadores.map((i) => [i.id, getSomaPeriodo(u.id, i.id, currentMonthStart, selectedDateObj)])
    );
    const genericDataAno = Object.fromEntries(
      indicadores.map((i) => [i.id, getSomaPeriodo(u.id, i.id, currentYearStart, selectedDateObj)])
    );
    const genericDataSem = Object.fromEntries(
      indicadores.map((i) => [i.id, getSomaPeriodo(u.id, i.id, weekStart, selectedDateObj)])
    );

    // Previous day accumulation (selectedDate - 1)
    const yesterday = new Date(selectedDateObj);
    yesterday.setDate(yesterday.getDate() - 1);

    const genericDataMesAnt = Object.fromEntries(
      indicadores.map((i) => [i.id, getSomaPeriodo(u.id, i.id, currentMonthStart, yesterday)])
    );
    const genericDataAnoAnt = Object.fromEntries(
      indicadores.map((i) => [i.id, getSomaPeriodo(u.id, i.id, currentYearStart, yesterday)])
    );

    // Previous-week accumulation (Mon–Sun of the week before the current one).
    // Initialized here so it is available as a closure inside makeEvaluator.
    const prevWeekStartInit = new Date(weekStart);
    prevWeekStartInit.setDate(prevWeekStartInit.getDate() - 7);
    const prevWeekEndInit = new Date(weekEnd);
    prevWeekEndInit.setDate(prevWeekEndInit.getDate() - 7);
    const genericDataSemAnt = Object.fromEntries(
      indicadores.map((i) => [i.id, getSomaPeriodo(u.id, i.id, prevWeekStartInit, prevWeekEndInit)])
    );

    // These day-count variables are used by MEDIA_* tags inside makeEvaluator (closure access).
    // They are assigned their real values after daysInMonth/Year/Week are computed below.
    let diasComLancMes = 1;
    let diasComLancAno = 1;
    let diasComLancSem = 1;

    // Process calculated indicators with formulas in dependency order (topological sort)
    const formulaIndicadores = indicadores.filter((ind) => !ind.digitavel && ind.formula);
    const formulaIndMap = new Map(formulaIndicadores.map((i) => [i.id, i]));
    const getDeps = (formula: string): string[] => {
      const deps: string[] = [];
      // Longer prefixes listed before shorter ones to avoid partial matches.
      // The prefix is optional so plain [id] references are also captured.
      const regex =
        /(?:ACUM_MES_ANT|ACUM_ANO_ANT|ACUM_SEM_ANT|ACUM_MES|ACUM_ANO|ACUM_SEM|MEDIA_MES|MEDIA_ANO|MEDIA_SEM)?\[([^\]\s]+)\]/g;
      let match;
      while ((match = regex.exec(formula)) !== null) {
        const rawId = match[1].trim();
        const idInterno = reverseVisualIdMap[rawId] || rawId;
        deps.push(idInterno);
      }
      return deps;
    };

    // Reusable topological evaluator: resolves each indicator's formula into the given target context.
    // When onlyAccum is true, indicators without ACUM_* tags are skipped (their values were already
    // correctly set by recalcularSomasPeriodo and must not be overwritten).
    const makeEvaluator = (
      target: Record<string, number>,
      valores: Record<string, number>,
      valoresMes: Record<string, number>,
      valoresAno: Record<string, number>,
      valoresSem: Record<string, number> = {},
      onlyAccum = false,
      valoresSemAnt: Record<string, number> = {}
    ) => {
      const visited = new Set<string>();
      const evaluate = (
        ind: (typeof formulaIndicadores)[number],
        stack: Set<string> = new Set()
      ): void => {
        if (visited.has(ind.id)) return;
        if (stack.has(ind.id)) return; // circular reference guard
        const usesAccum = /ACUM_MES|ACUM_ANO|ACUM_SEM|MEDIA_MES|MEDIA_ANO|MEDIA_SEM/.test(
          ind.formula!
        );
        if (onlyAccum && !usesAccum) {
          // Already correctly set by recalcularSomasPeriodo; mark visited and keep the value.
          visited.add(ind.id);
          return;
        }
        stack.add(ind.id);
        const deps = getDeps(ind.formula!);
        for (const depId of deps) {
          const depInd = formulaIndMap.get(depId);
          if (depInd) evaluate(depInd, stack);
        }
        target[ind.id] = avaliarFormula(
          ind.formula!,
          valores,
          valoresMes,
          valoresAno,
          genericDataMesAnt,
          genericDataAnoAnt,
          valoresSem,
          valoresSemAnt,
          diasComLancMes,
          diasComLancAno,
          diasComLancSem
        );
        visited.add(ind.id);
        stack.delete(ind.id);
      };
      return evaluate;
    };

    // Evaluates a single calculated indicator for one specific day, resolving its formula
    // dependencies recursively (topological order) before evaluating. Raw (digitavel) values
    // for the day should already be present in valoresDia before calling this.
    const avaliarIndicadorDia = (
      ind: (typeof formulaIndicadores)[number],
      valoresDia: Record<string, number>,
      visitedDay: Set<string>
    ): number => {
      if (visitedDay.has(ind.id)) return valoresDia[ind.id] ?? 0;
      visitedDay.add(ind.id);
      const deps = getDeps(ind.formula!);
      for (const depId of deps) {
        const depInd = formulaIndMap.get(depId);
        if (depInd) avaliarIndicadorDia(depInd, valoresDia, visitedDay);
      }
      valoresDia[ind.id] = avaliarFormula(ind.formula!, valoresDia, {}, {}, {}, {}, {});
      return valoresDia[ind.id];
    };

    // Computes the correct accumulated value for a calculated indicator by summing its formula
    // result day-by-day over the given period. This ensures that ACUM_MES[r7] where r7=[r5]*[r6]
    // stores Σ(r5_day * r6_day) in the accumulation context instead of sum_r5 * sum_r6.
    const calcularSomaDiaria = (
      ind: (typeof formulaIndicadores)[number],
      days: string[],
      visitedCalc: Set<string>,
      target: Record<string, number>
    ): void => {
      if (visitedCalc.has(ind.id)) return;
      // Resolve period-sum dependencies first (topological order)
      const deps = getDeps(ind.formula!);
      for (const depId of deps) {
        const depInd = formulaIndMap.get(depId);
        if (depInd && !visitedCalc.has(depInd.id)) {
          calcularSomaDiaria(depInd, days, visitedCalc, target);
        }
      }
      visitedCalc.add(ind.id);
      // Sum the formula result for each day in the period
      target[ind.id] = days.reduce((acc, d) => {
        const valoresDia: Record<string, number> = {};
        indicadores.forEach((i) => {
          valoresDia[i.id] = getValor(u.id, i.id, d);
        });
        // Recursively resolve any calculated dependencies for this specific day
        const visitedDay = new Set<string>();
        for (const depId of deps) {
          const depInd = formulaIndMap.get(depId);
          if (depInd) avaliarIndicadorDia(depInd, valoresDia, visitedDay);
        }
        return acc + avaliarFormula(ind.formula!, valoresDia, {}, {}, {}, {}, {});
      }, 0);
    };

    // For each accumulation context, replace the initial getSomaPeriodo value (which is 0 for
    // calculated indicators) with the correct per-day sum for indicators whose formulas do not
    // themselves contain ACUM_* or MEDIA_* tags. Indicators with those tags are handled separately by
    // makeEvaluator (onlyAccum=true) so they can read the corrected values from valoresMes/valoresAno.
    const recalcularSomasPeriodo = (target: Record<string, number>, days: string[]): void => {
      const visitedCalc = new Set<string>();
      for (const ind of formulaIndicadores) {
        const usesAccum = /ACUM_MES|ACUM_ANO|ACUM_SEM|MEDIA_MES|MEDIA_ANO|MEDIA_SEM/.test(
          ind.formula!
        );
        if (!usesAccum) {
          calcularSomaDiaria(ind, days, visitedCalc, target);
        }
      }
    };

    // Collect unique days with lancamentos for each accumulation period
    const daysInMonth = [
      ...new Set(
        lancamentos
          .filter(
            (l) =>
              l.unidade_id === u.id &&
              parseISO(l.data) >= currentMonthStart &&
              parseISO(l.data) <= selectedDateObj
          )
          .map((l) => l.data)
      ),
    ];
    const daysInYear = [
      ...new Set(
        lancamentos
          .filter(
            (l) =>
              l.unidade_id === u.id &&
              parseISO(l.data) >= currentYearStart &&
              parseISO(l.data) <= selectedDateObj
          )
          .map((l) => l.data)
      ),
    ];
    const daysInWeek = [
      ...new Set(
        lancamentos
          .filter(
            (l) =>
              l.unidade_id === u.id &&
              parseISO(l.data) >= weekStart &&
              parseISO(l.data) <= selectedDateObj
          )
          .map((l) => l.data)
      ),
    ];
    const daysInMonthAnt = [
      ...new Set(
        lancamentos
          .filter(
            (l) =>
              l.unidade_id === u.id &&
              parseISO(l.data) >= currentMonthStart &&
              parseISO(l.data) <= yesterday
          )
          .map((l) => l.data)
      ),
    ];
    const daysInYearAnt = [
      ...new Set(
        lancamentos
          .filter(
            (l) =>
              l.unidade_id === u.id &&
              parseISO(l.data) >= currentYearStart &&
              parseISO(l.data) <= yesterday
          )
          .map((l) => l.data)
      ),
    ];

    // Previous week range (same start/end used for genericDataSemAnt above)
    const daysInWeekAnt = [
      ...new Set(
        lancamentos
          .filter(
            (l) =>
              l.unidade_id === u.id &&
              parseISO(l.data) >= prevWeekStartInit &&
              parseISO(l.data) <= prevWeekEndInit
          )
          .map((l) => l.data)
      ),
    ];

    // Number of distinct days with data for each period; assigned to the let variables declared
    // earlier so makeEvaluator closures pick up the real values before the evaluators run.
    // Using || 1 is safe because ACUM_MES/ANO/SEM for an indicator also equals 0 when there
    // are no days with data, so MEDIA_* would correctly return 0/1 = 0 in that case.
    diasComLancMes = daysInMonth.length || 1;
    diasComLancAno = daysInYear.length || 1;
    diasComLancSem = daysInWeek.length || 1;

    // Pre-compute per-day sums for all accumulation contexts BEFORE evaluating the day context.
    // This ensures that when the day evaluator processes an indicator like ACUM_MES[r7]
    // (where r7 is itself a calculated indicator), it can read the correct monthly sum
    // for r7 from genericDataMes rather than the initial getSomaPeriodo value of 0.
    recalcularSomasPeriodo(genericDataMes, daysInMonth);
    recalcularSomasPeriodo(genericDataAno, daysInYear);
    recalcularSomasPeriodo(genericDataSem, daysInWeek);
    recalcularSomasPeriodo(genericDataMesAnt, daysInMonthAnt);
    recalcularSomasPeriodo(genericDataAnoAnt, daysInYearAnt);
    recalcularSomasPeriodo(genericDataSemAnt, daysInWeekAnt);

    // Resolve formulas for the current day context.
    // genericDataMes/Ano/Sem are already populated with correct per-day sums above,
    // so ACUM_* references in day-context formulas resolve to the right values.
    const evaluate = makeEvaluator(
      genericData,
      genericData,
      genericDataMes,
      genericDataAno,
      genericDataSem,
      false,
      genericDataSemAnt
    );
    for (const ind of formulaIndicadores) evaluate(ind);

    // For each accumulation context, evaluate indicators that use ACUM_* or MEDIA_* tags.
    // recalcularSomasPeriodo already set correct values for non-ACUM indicators;
    // makeEvaluator(onlyAccum=true) skips those and only evaluates ACUM_*/MEDIA_* indicators.
    const evaluateMes = makeEvaluator(
      genericDataMes,
      genericDataMes,
      genericDataMes,
      genericDataAno,
      genericDataSem,
      true,
      genericDataSemAnt
    );
    for (const ind of formulaIndicadores) evaluateMes(ind);

    const evaluateAno = makeEvaluator(
      genericDataAno,
      genericDataAno,
      genericDataMes,
      genericDataAno,
      genericDataSem,
      true,
      genericDataSemAnt
    );
    for (const ind of formulaIndicadores) evaluateAno(ind);

    const evaluateSem = makeEvaluator(
      genericDataSem,
      genericDataSem,
      genericDataMes,
      genericDataAno,
      genericDataSem,
      true,
      genericDataSemAnt
    );
    for (const ind of formulaIndicadores) evaluateSem(ind);

    return {
      ...genericData,
      tonsDia,
      rentDia,
      entradaGeral,
      cancelamentoBruto,
      carteiraAno,
      tonsSemana,
      tonsMes,
      entradaMes,
      cancelamentoSemana,
      mediaRentMes,
      prodDia,
      prodMes,
      prodAno,
      fatVenda,
      fatConsig,
      fatRemessa,
      fatTotalDia,
      fatAcumuladoMes,
      fatAcumuladoAno,
      metaMes,
      saldoDeficit,
      diasRestantes,
      mediaAFaturar,
    };
  };

  const unitData = activeUnidades.map((u) => ({
    unidade: u,
    data: getCalculatedData(u),
  }));

  const formatValue = (val: number, indicadorId?: string) => {
    const ind = indicadores.find((i) => i.id === indicadorId);
    const unit = ind?.unidade_medida || '';

    if (unit === 'R$' || unit === 'currency') {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (unit === '%' || unit === 'percent') {
      return val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '%';
    }
    return val.toLocaleString('pt-BR');
  };

  const renderRow = (label: string, field: string, indicadorId?: string, isTotal = false) => (
    <tr
      className={cn('hover:bg-slate-50 transition-colors', isTotal && 'bg-indigo-50/30 font-bold')}
    >
      <td className="px-4 py-2 font-medium text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-100">
        {label}
      </td>
      {unitData.map(({ data, unidade }) => {
        const val = (data as any)[field] || 0;
        return (
          <td
            key={unidade.id}
            className="px-4 py-2 text-right font-mono text-slate-600 border-r border-slate-100"
          >
            {formatValue(val, indicadorId)}
          </td>
        );
      })}
      <td className="px-4 py-2 text-right font-bold text-indigo-700 bg-indigo-50/50">
        {(() => {
          let val = 0;
          if (field === 'rentDia') {
            // Weighted average for daily rentability
            const totalTons = unitData.reduce((acc, curr) => acc + curr.data.tonsDia, 0);
            const weightedSum = unitData.reduce(
              (acc, curr) => acc + curr.data.rentDia * curr.data.tonsDia,
              0
            );
            val = totalTons > 0 ? weightedSum / totalTons : 0;
          } else if (field === 'mediaRentMes') {
            // Weighted average for monthly rentability
            const totalTons = unitData.reduce((acc, curr) => acc + curr.data.tonsMes, 0);
            const weightedSum = unitData.reduce(
              (acc, curr) => acc + curr.data.mediaRentMes * curr.data.tonsMes,
              0
            );
            val = totalTons > 0 ? weightedSum / totalTons : 0;
          } else if (field === 'diasRestantes') {
            val =
              unitData.length > 0
                ? unitData.reduce((acc, curr) => acc + curr.data.diasRestantes, 0) / unitData.length
                : 0;
          } else {
            val = unitData.reduce((acc, curr) => acc + ((curr.data as any)[field] || 0), 0);
          }
          return formatValue(val, indicadorId);
        })()}
      </td>
    </tr>
  );

  const generatePDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('RELATÓRIO DIÁRIO', 14, 15);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(
      `Data: ${format(parseISO(selectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
      14,
      22
    );
    doc.text('Gestão de unidades', 14, 27);

    const tableData: (string | number | Record<string, unknown>)[][] = [];
    const tableHeaders = ['Indicador', ...activeUnidades.map((u) => u.nome), 'Total'];

    const categoriasVisiveis = [...categorias]
      .filter((cat) => cat.visivel_capa !== false)
      .sort((a, b) => a.ordem - b.ordem);

    categoriasVisiveis.forEach((cat) => {
      const catIndicadores = indicadores
        .filter((i) => i.categoria === cat.nome)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

      // Category row
      tableData.push([
        {
          content: cat.nome.toUpperCase(),
          colSpan: tableHeaders.length,
          styles: {
            fillColor: [79, 70, 229],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
          },
        },
      ]);

      catIndicadores.forEach((ind) => {
        const isVisibleGlobal = (uId: string) => {
          const cfg = configs.find((c) => c.unidade_id === uId && c.indicador_id === ind.id);
          return cfg ? cfg.visivel : true;
        };
        const isVisibleAny = activeUnidades.some((u) => isVisibleGlobal(u.id));
        if (!isVisibleAny) return;

        const row: (string | number | Record<string, unknown>)[] = [ind.nome];

        activeUnidades.forEach((u) => {
          const uDat = unitData.find((ud) => ud.unidade.id === u.id);
          const val = (uDat?.data as any)?.[ind.id] || 0;
          const cfg = configs.find((c) => c.unidade_id === u.id && c.indicador_id === ind.id);
          const isVis = cfg ? cfg.visivel : true;
          const bgColorHex = cfg?.cor_fundo || '';

          let fill: [number, number, number] | undefined = undefined;
          if (isVis && bgColorHex && bgColorHex.startsWith('#')) {
            const r = parseInt(bgColorHex.slice(1, 3), 16);
            const g = parseInt(bgColorHex.slice(3, 5), 16);
            const b = parseInt(bgColorHex.slice(5, 7), 16);
            fill = [r, g, b];
          }

          row.push({
            content: isVis ? formatValue(val, ind.id) : '-',
            styles: { fillColor: fill, halign: 'right' },
          });
        });

        const total = unitData.reduce((acc, curr) => {
          const cfg = configs.find(
            (c) => c.unidade_id === curr.unidade.id && c.indicador_id === ind.id
          );
          if (cfg && !cfg.visivel) return acc;
          return acc + ((curr.data as any)[ind.id] || 0);
        }, 0);
        row.push({
          content: formatValue(total, ind.id),
          styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 249, 255] },
        });

        tableData.push(row);
      });
    });

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
      headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 35 },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Página ${data.pageNumber}`,
          pageWidth - 20,
          doc.internal.pageSize.getHeight() - 10
        );
      },
    });

    doc.save(`relatorio-diario-${format(parseISO(selectedDate), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">RELATÓRIO DIÁRIO</h1>
          <p className="text-slate-500 font-medium">Gestão de unidades</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="icon" onClick={generatePDF} title="Gerar PDF">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-[11px] text-left border-collapse">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-bold text-slate-700 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 w-48">
                INDICADORES
              </th>
              {activeUnidades.map((u) => (
                <th
                  key={u.id}
                  className="px-4 py-3 font-bold text-slate-700 text-center border-r border-slate-200 min-w-[120px]"
                >
                  {u.nome}
                </th>
              ))}
              <th className="px-4 py-3 font-bold text-indigo-700 text-center bg-indigo-100 min-w-[120px]">
                TOTAL GERAL
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {[...categorias]
              .filter((cat) => cat.visivel_capa !== false)
              .sort((a, b) => a.ordem - b.ordem)
              .map((cat) => {
                const catIndicadores = indicadores
                  .filter((i) => i.categoria === cat.nome)
                  .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

                return (
                  <React.Fragment key={cat.id}>
                    <tr className="bg-slate-50">
                      <td
                        colSpan={activeUnidades.map((u) => u.id).length + 2}
                        className="px-4 py-1 font-black text-indigo-600 text-[10px] uppercase"
                      >
                        {cat.nome}
                      </td>
                    </tr>
                    {catIndicadores.map((ind) => {
                      const isVisibleGlobal = (uId: string) => {
                        const cfg = configs.find(
                          (c) => c.unidade_id === uId && c.indicador_id === ind.id
                        );
                        return cfg ? cfg.visivel : true;
                      };

                      // Check if indicator is visible in at least one unit
                      const isVisibleAny = activeUnidades.some((u) => isVisibleGlobal(u.id));
                      if (!isVisibleAny) return null;

                      return (
                        <React.Fragment key={ind.id}>
                          <tr className={cn('hover:bg-slate-50 transition-colors')}>
                            <td className="px-4 py-2 font-medium text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-100">
                              {ind.nome}
                            </td>
                            {unitData.map(({ data, unidade }) => {
                              const val = (data as any)[ind.id] || 0;
                              const cfg = configs.find(
                                (c) => c.unidade_id === unidade.id && c.indicador_id === ind.id
                              );
                              const isVis = cfg ? cfg.visivel : true;
                              const bgColor = cfg?.cor_fundo || '';

                              return (
                                <td
                                  key={unidade.id}
                                  className="px-4 py-2 text-right font-mono text-slate-600 border-r border-slate-100"
                                  style={{
                                    backgroundColor: isVis ? bgColor : '#f8fafc',
                                    opacity: isVis ? 1 : 0.3,
                                  }}
                                >
                                  {isVis ? formatValue(val, ind.id) : '-'}
                                </td>
                              );
                            })}
                            <td className="px-4 py-2 text-right font-bold text-indigo-700 bg-indigo-50/50">
                              {formatValue(
                                unitData.reduce((acc, curr) => {
                                  const cfg = configs.find(
                                    (c) =>
                                      c.unidade_id === curr.unidade.id && c.indicador_id === ind.id
                                  );
                                  if (cfg && !cfg.visivel) return acc;
                                  return acc + ((curr.data as any)[ind.id] || 0);
                                }, 0),
                                ind.id
                              )}
                            </td>
                          </tr>

                          {/* Special Variations */}
                          {ind.id === 'v1' && (
                            <>
                              {renderRow('Acumulado Tons Semana', 'tonsSemana', 'v1')}
                              {renderRow('Acumulado Tons Mês', 'tonsMes', 'v1')}
                            </>
                          )}
                          {ind.id === 'v2' &&
                            renderRow('Média Rentabilidade Mês', 'mediaRentMes', 'v2')}
                          {ind.id === 'v4' &&
                            renderRow('Cancelamento Semana', 'cancelamentoSemana', 'v4')}
                          {ind.id === 'c1' && (
                            <>
                              {renderRow('Acumulado Produção Mês', 'prodMes', 'c1')}
                              {renderRow('Acumulado Produção Ano', 'prodAno', 'c1')}
                            </>
                          )}
                          {ind.id === 'f3' && (
                            <>
                              {renderRow('Total Faturado Dia', 'fatTotalDia', 'f1', true)}
                              {renderRow('Total Acumulado Mês', 'fatAcumuladoMes', 'f1')}
                              {renderRow('Meta do Mês', 'metaMes', 'f1')}
                              {renderRow('Saldo / Déficit', 'saldoDeficit', 'f1')}
                              {renderRow('Dias Restantes', 'diasRestantes')}
                              {renderRow('Média a Faturar / Dia', 'mediaAFaturar', 'f1')}
                              {renderRow('Faturamento Acumulado Ano', 'fatAcumuladoAno', 'f1')}
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
