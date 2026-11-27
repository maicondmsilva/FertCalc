import React from 'react';
import { X } from 'lucide-react';
import type { Embalagem, PricingFactors, TargetFormula } from '../../types';
import { formatMoney } from './betaCalculatorModel';
import type { BetaCalculator } from './SimplifiedCalculatorBeta';
import CommercialConditionsForm from '../conditions/CommercialConditionsForm';

interface BetaConditionsPanelProps {
  calculation: TargetFormula;
  calculator: BetaCalculator;
  embalagens: Embalagem[];
  canSimulateReduction: boolean;
  onSimulateReduction: () => void;
  onClose: () => void;
}

export default function BetaConditionsPanel({
  calculation,
  calculator,
  embalagens,
  canSimulateReduction,
  onSimulateReduction,
  onClose,
}: BetaConditionsPanelProps) {
  const { factors: globalFactors, updateCalculationFactors } = calculator;
  const isUsd = globalFactors.priceListCurrency === 'USD';
  const set = (field: keyof PricingFactors, value: string | number | boolean) =>
    updateCalculationFactors(calculation.id, field, value);

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-stone-900">Condições comerciais</h3>
          <p className="text-sm text-stone-600">O preço é atualizado a cada alteração.</p>
        </div>
        <div className="flex items-center gap-2">
          {canSimulateReduction && (
            <button
              type="button"
              onClick={onSimulateReduction}
              className="rounded-lg px-3 py-1.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
            >
              Simular redução →
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-white"
            aria-label="Fechar condições"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <CommercialConditionsForm
        factors={calculation.factors}
        onChange={set}
        currency={isUsd ? 'USD' : 'BRL'}
        embalagens={embalagens}
        clientId={globalFactors.client?.id || undefined}
        clientName={globalFactors.client?.name}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-indigo-100 pt-3">
        <span className="text-sm text-stone-600">
          {calculation.summary ? (
            <>
              Preço com estas condições:{' '}
              <strong className="text-lg text-emerald-800">
                {formatMoney(calculation.summary.finalPrice, isUsd ? 'USD' : 'BRL')}/t
              </strong>
            </>
          ) : (
            'Calcule a fórmula para ver o preço.'
          )}
        </span>
      </div>
    </section>
  );
}
