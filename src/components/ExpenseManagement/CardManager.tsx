import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CreditCard } from '../../types/expense.types';
import { User } from '../../types';
import { getCards, createCard, updateCard, toggleCardActive } from '../../services/cardService';
import { getUsers } from '../../services/db';
import { Plus, Edit3, Save, X, CreditCard as CreditCardIcon } from 'lucide-react';

interface CardManagerProps {
  currentUser: User;
}

interface CardForm {
  name: string;
  lastFour: string;
  userId: string;
  userName: string;
  active: boolean;
}

const DROPDOWN_BLUR_DELAY = 150; // ms — allows click events on dropdown items to fire before the dropdown closes

const emptyForm: CardForm = {
  name: '',
  lastFour: '',
  userId: '',
  userName: '',
  active: true,
};

export default function CardManager({ currentUser }: CardManagerProps) {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CardForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<User[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const isAdmin = currentUser.role === 'master' || currentUser.role === 'admin';

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const [cardsData, usersData] = await Promise.all([getCards(), getUsers()]);
      setCards(cardsData);
      setUsers(usersData);
    } catch (err) {
      console.error('Erro ao carregar cartões:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.name);
    return map;
  }, [users]);

  const getUserName = (userId: string) => {
    return userMap.get(userId) ?? (userId ? userId.substring(0, 8) + '...' : '—');
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError(null);
    setUserSearch('');
    setUserResults([]);
    setShowUserDropdown(false);
  };

  const startEdit = (card: CreditCard) => {
    setEditingId(card.id);
    const foundUser = users.find((u) => u.id === card.userId);
    setForm({
      name: card.name,
      lastFour: card.lastFour || '',
      userId: card.userId,
      userName: foundUser?.name || '',
      active: card.active,
    });
    setUserSearch(foundUser?.name || card.userId || '');
    setShowForm(true);
    setError(null);
  };

  const handleUserSearchChange = (value: string) => {
    setUserSearch(value);
    // Only clear the selected user if the new value differs from the currently selected user's name
    setForm((f) => (f.userName && value === f.userName ? f : { ...f, userId: '', userName: '' }));
    if (value.trim().length < 2) {
      setUserResults([]);
      setShowUserDropdown(false);
      return;
    }
    const q = value.toLowerCase();
    const filtered = users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.nickname?.toLowerCase().includes(q)
    );
    setUserResults(filtered.slice(0, 8));
    setShowUserDropdown(true);
  };

  const handleSelectUser = (user: User) => {
    setForm((f) => ({ ...f, userId: user.id, userName: user.name }));
    setUserSearch(user.name);
    setShowUserDropdown(false);
    setUserResults([]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('O nome do cartão é obrigatório.');
      return;
    }
    if (form.lastFour && !/^\d{4}$/.test(form.lastFour)) {
      setError('Os 4 últimos dígitos devem conter exatamente 4 números.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateCard(editingId, {
          name: form.name.trim(),
          lastFour: form.lastFour || undefined,
          userId: form.userId,
          active: form.active,
        });
      } else {
        await createCard({
          name: form.name.trim(),
          lastFour: form.lastFour || undefined,
          userId: form.userId || currentUser.id,
          churchId: '',
          active: form.active,
        });
      }
      await loadCards();
      resetForm();
    } catch (err: unknown) {
      console.error('Erro ao salvar cartão:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar cartão.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (card: CreditCard) => {
    try {
      await toggleCardActive(card.id, !card.active);
      await loadCards();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-16 text-stone-400">
        <CreditCardIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-bold">Acesso restrito</p>
        <p className="text-sm mt-1">Apenas administradores podem gerenciar cartões.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-800 flex items-center gap-2">
            <CreditCardIcon className="w-7 h-7 text-purple-600" />
            Cartões
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Gerenciamento de cartões de crédito corporativos
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Cartão
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h4 className="text-sm font-bold text-stone-700 mb-4">
            {editingId ? 'Editar Cartão' : 'Novo Cartão'}
          </h4>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                Nome do Cartão *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Cartão Diretoria"
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                4 Últimos Dígitos
              </label>
              <input
                type="text"
                maxLength={4}
                value={form.lastFour}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastFour: e.target.value.replace(/\D/g, '') }))
                }
                placeholder="1234"
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
            <div className="relative">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                Usuário Responsável
              </label>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => handleUserSearchChange(e.target.value)}
                onFocus={() => {
                  if (userResults.length > 0) setShowUserDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowUserDropdown(false), DROPDOWN_BLUR_DELAY)}
                placeholder="Digite o nome do usuário..."
                autoComplete="off"
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
              {form.userId && (
                <p className="text-xs text-emerald-600 mt-1 font-medium">✓ {form.userName}</p>
              )}
              {showUserDropdown && userResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={() => handleSelectUser(u)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 flex items-center gap-3 border-b border-stone-100 last:border-0"
                    >
                      <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-stone-800">{u.name}</p>
                        {u.nickname && <p className="text-xs text-stone-400">@{u.nickname}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {userSearch.length >= 2 && userResults.length === 0 && !form.userId && (
                <p className="text-xs text-stone-400 mt-1">Nenhum usuário encontrado.</p>
              )}
              <p className="text-xs text-stone-400 mt-1">
                Deixe em branco para associar ao seu usuário.
              </p>
            </div>
            {editingId && (
              <div className="flex items-center gap-3">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Ativo
                </label>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-stone-500 rounded-lg hover:bg-stone-100"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Cards List */}
      {cards.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <CreditCardIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-bold">Nenhum cartão cadastrado</p>
          <p className="text-sm mt-1">Crie o primeiro cartão para começar.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">
                  Nome
                </th>
                <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">
                  Dígitos
                </th>
                <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">
                  Usuário
                </th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">
                  Status
                </th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {cards.map((card) => (
                <tr key={card.id} className="hover:bg-stone-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-stone-800">{card.name}</td>
                  <td className="py-3 px-4 text-stone-600">
                    {card.lastFour ? `**** ${card.lastFour}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-stone-600">{getUserName(card.userId)}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${card.active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}
                    >
                      {card.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => startEdit(card)}
                        className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(card)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${card.active ? 'text-stone-500 hover:bg-amber-50 hover:text-amber-700' : 'text-stone-500 hover:bg-emerald-50 hover:text-emerald-700'}`}
                        title={card.active ? 'Desativar' : 'Ativar'}
                      >
                        {card.active ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
