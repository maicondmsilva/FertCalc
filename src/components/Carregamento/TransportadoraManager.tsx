import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import { Truck, RefreshCw, Plus, X } from 'lucide-react';
import { Transportadora } from '../../types/carregamento';
import {
  getAllTransportadoras,
  createTransportadora,
  updateTransportadora,
} from '../../services/carregamentoService';
import { useToast } from '../Toast';
import { closeModalOnBackdrop } from '../../utils/modalUtils';
import TransportadoraAccessManager from './TransportadoraAccessManager';

export function TransportadoraManager({ currentUser }: { currentUser: User }) {
  const { showSuccess, showError } = useToast();
  const [lista, setLista] = useState<Transportadora[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<Transportadora | null>(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<Omit<Transportadora, 'id' | 'criado_em'>>({
    nome: '',
    cnpj: '',
    contato: '',
    telefone: '',
    email: '',
    ativo: true,
  });

  const carregarTodas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllTransportadoras();
      setLista(data);
    } catch (err) {
      console.error(err);
      showError('Erro ao carregar transportadoras.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    carregarTodas();
  }, [carregarTodas]);

  const abrirCriacao = () => {
    setForm({ nome: '', cnpj: '', contato: '', telefone: '', email: '', ativo: true });
    setEditando(null);
    setCriando(true);
  };

  const abrirEdicao = (t: Transportadora) => {
    setForm({
      nome: t.nome,
      cnpj: t.cnpj ?? '',
      contato: t.contato ?? '',
      telefone: t.telefone ?? '',
      email: t.email ?? '',
      ativo: t.ativo,
    });
    setEditando(t);
    setCriando(true);
  };

  const fechar = () => {
    setCriando(false);
    setEditando(null);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editando) {
        await updateTransportadora(editando.id, form);
        showSuccess('Transportadora atualizada com sucesso!');
      } else {
        await createTransportadora(form);
        showSuccess('Transportadora cadastrada com sucesso!');
      }
      fechar();
      await carregarTodas();
    } catch (err) {
      console.error(err);
      showError('Erro ao salvar transportadora.');
    }
  };

  const alternarAtivo = async (t: Transportadora) => {
    try {
      await updateTransportadora(t.id, { ativo: !t.ativo });
      showSuccess(t.ativo ? 'Transportadora desativada.' : 'Transportadora ativada.');
      await carregarTodas();
    } catch (err) {
      console.error(err);
      showError('Erro ao alterar status da transportadora.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-stone-400" />
            Transportadoras
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Gerencie as transportadoras disponíveis para cotação de frete
          </p>
        </div>
        <button
          onClick={abrirCriacao}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Transportadora
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin text-stone-300" />
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-8 text-stone-400 text-sm">
          Nenhuma transportadora cadastrada
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {lista.map((t) => (
                <tr
                  key={t.id}
                  className={`hover:bg-stone-50 transition-colors ${!t.ativo ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3 font-bold text-stone-800">{t.nome}</td>
                  <td className="px-4 py-3 text-stone-600 font-mono text-xs">{t.cnpj || '—'}</td>
                  <td className="px-4 py-3 text-stone-600 text-xs">{t.contato || '—'}</td>
                  <td className="px-4 py-3 text-stone-600 text-xs">{t.telefone || '—'}</td>
                  <td className="px-4 py-3 text-stone-600 text-xs">{t.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        t.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {t.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => abrirEdicao(t)}
                        className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => alternarAtivo(t)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors ${
                          t.ativo
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {t.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {['master', 'admin'].includes(currentUser.role) && (
        <TransportadoraAccessManager currentUser={currentUser} transportadoras={lista} />
      )}

      {/* Formulário de criação/edição */}
      {criando && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onMouseDown={(event) => closeModalOnBackdrop(event, () => setCriando(false))}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-stone-100">
              <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600" />
                {editando ? 'Editar Transportadora' : 'Nova Transportadora'}
              </h3>
              <button
                onClick={fechar}
                className="p-1 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>
            <form onSubmit={salvar} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    value={form.cnpj ?? ''}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Contato
                  </label>
                  <input
                    type="text"
                    value={form.contato ?? ''}
                    onChange={(e) => setForm({ ...form, contato: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={form.telefone ?? ''}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
              </div>
              {editando && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <span className="text-sm text-stone-700">Ativo</span>
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={fechar}
                  className="px-5 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold transition-colors"
                >
                  {editando ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN MODULE
// ─────────────────────────────────────────────────────────────────────────────
