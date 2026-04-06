import React, { useState } from 'react';
import { CreditCardExpense, ExpenseCategory, ExpensePeriod } from '../../types/expense.types';
import { User } from '../../types';
import { Save, X } from 'lucide-react';

interface NewExpenseFormProps {
  currentUser: User;
  categories: ExpenseCategory[];
  period: ExpensePeriod;
  initialData?: CreditCardExpense | null;
  onSave: (data: Partial<CreditCardExpense>) => Promise<void>;
  onCancel: () => void;
}

export default function NewExpenseForm({ currentUser, categories, period, initialData, onSave, onCancel }: NewExpenseFormProps) {
  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(initialData ? String(initialData.amount) : '');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '');
  const [cardName, setCardName] = useState(initialData?.cardName || '');
  const [installments, setInstallments] = useState(initialData?.installments || 1);
  const [currentInstallment, setCurrentInstallment] = useState(initialData?.currentInstallment || 1);
  const [observation, setObservation] = useState(initialData?.observation || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || !categoryId) return;

    setSaving(true);
    try {
      await onSave({
        description: description.trim(),
        amount: parseFloat(amount),
        date,
        categoryId,
        cardName: cardName.trim() || undefined,
        installments,
        currentInstallment: installments > 1 ? currentInstallment : undefined,
        observation: observation.trim() || undefined,
        userId: currentUser.id,
        userName: currentUser.name,
        periodMonth: period.month,
        periodYear: period.year,
        status: 'pendente',
      });
    } catch {
      // Error handled by hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
      <h2 className="text-lg font-bold text-stone-800 mb-6">
        {initialData ? 'Editar Gasto' : 'Novo Gasto'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Description */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              Descrição *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o gasto..."
              required
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              Valor (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              Data *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              Categoria *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            >
              <option value="">Selecione...</option>
              {categories.filter(c => c.active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Card Name */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              Cartão
            </label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Ex: Visa Final 1234"
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>

          {/* Installments */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              Parcelas
            </label>
            <input
              type="number"
              min="1"
              max="48"
              value={installments}
              onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>

          {/* Current Installment */}
          {installments > 1 && (
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                Parcela Atual
              </label>
              <input
                type="number"
                min="1"
                max={installments}
                value={currentInstallment}
                onChange={(e) => setCurrentInstallment(parseInt(e.target.value) || 1)}
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
          )}

          {/* Observation */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              Observação
            </label>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={3}
              placeholder="Observações adicionais..."
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !description.trim() || !amount || !categoryId}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : (initialData ? 'Atualizar' : 'Salvar')}
          </button>
        </div>
      </form>
    </div>
  );
}
