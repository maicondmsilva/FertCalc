import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Save, User as UserIcon, Edit2, X } from 'lucide-react';
import { User } from '../types';
import { getUsers, createUser, updateUser, deleteUser } from '../services/db';
import { useToast } from './Toast';

export default function UserManager() {
  const { showSuccess, showError } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    customCode: '',
    password: '',
    role: 'user' as 'master' | 'user' | 'manager' | 'admin',
    managedUserIds: [] as string[],
    permissions: {
      dashboard: true,
      calculator: true,
      history: true,
      clients: true,
      agents: true,
      goals: false,
      priceLists: true,
      branches: false,
      users: false,
      settings: false,
      approvals: false,
      reports: true,
      pricingReport: true,
      commissionReport: true,
      prd: true,
      managementReports: true
    }
  });

  const modules = [
    { id: 'dashboard', name: 'Dashboard' },
    { id: 'calculator', name: 'Calculadora' },
    { id: 'history', name: 'Situação' },
    { id: 'approvals', name: 'Aprovações' },
    { id: 'goals', name: 'Metas' },
    { id: 'reports', name: 'Relatórios' },
    { id: 'pricingReport', name: 'Relatório de Precificação' },
    { id: 'commissionReport', name: 'Relatório de Comissão' },
    { id: 'priceLists', name: 'Lista de Preço' },
    { id: 'clients', name: 'Clientes' },
    { id: 'agents', name: 'Agentes' },
    { id: 'branches', name: 'Filiais' },
    { id: 'users', name: 'Usuários' },
    { id: 'settings', name: 'Personalização' },
    { id: 'prd', name: 'Documentação PRD' },
    { id: 'managementReports', name: 'Relatórios Gerenciais' }
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const data = await getUsers();
    setUsers(data);
    setLoading(false);
  };

  const getDefaultPermissions = (role: string) => {
    const base = {
      dashboard: true,
      calculator: true,
      history: true,
      clients: true,
      agents: true,
      goals: false,
      priceLists: true,
      branches: false,
      users: false,
      settings: false,
      approvals: false,
      reports: true,
      pricingReport: true,
      commissionReport: true,
      prd: false,
      managementReports: false
    };

    if (role === 'master' || role === 'admin') {
      return Object.keys(base).reduce((acc, key) => ({ ...acc, [key]: true }), {});
    }
    if (role === 'manager') {
      return { ...base, approvals: true, reports: true, pricingReport: true, commissionReport: true, goals: true, priceLists: true, branches: true };
    }
    return base;
  };

  const handleRoleChange = (role: 'master' | 'user' | 'manager' | 'admin') => {
    setFormData({
      ...formData,
      role,
      permissions: getDefaultPermissions(role) as any
    });
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.role) {
      showError('Nome, e-mail e nível de acesso são obrigatórios.');
      return;
    }
    if (!editingId && !formData.password) {
      showError('A senha é obrigatória para um novo usuário.');
      return;
    }

    setLoading(true);

    try {
      if (editingId) {
        const payload: any = {
          name: formData.name,
          email: formData.email,
          customCode: formData.customCode,
          role: formData.role,
          managedUserIds: formData.role === 'manager' ? formData.managedUserIds : [],
          permissions: formData.permissions,
        };
        if (formData.password) payload.password = formData.password;
        await updateUser(editingId, payload);
        setEditingId(null);
      } else {
        await createUser({
          name: formData.name,
          email: formData.email,
          customCode: formData.customCode,
          password: formData.password,
          role: formData.role,
          managedUserIds: formData.role === 'manager' ? formData.managedUserIds : [],
          permissions: formData.permissions as any,
        });
      }

      await loadUsers();
      showSuccess(editingId ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
      setFormData({
        name: '',
        email: '',
        customCode: '',
        password: '',
        role: 'user',
        managedUserIds: [],
        permissions: getDefaultPermissions('user') as any
      });
    } catch (err) {
      showError('Erro ao salvar usuário. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({
      name: user.name,
      email: user.email,
      customCode: user.customCode,
      password: '',
      role: user.role as any,
      managedUserIds: user.managedUserIds || [],
      permissions: (user.permissions || getDefaultPermissions(user.role)) as any
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      customCode: '',
      password: '',
      role: 'user',
      managedUserIds: [],
      permissions: getDefaultPermissions('user') as any
    });
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
      try {
        await deleteUser(id);
        showSuccess('Usuário excluído com sucesso!');
        await loadUsers();
      } catch {
        showError('Erro ao excluir usuário.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-stone-800 flex items-center">
            <UserIcon className="w-5 h-5 mr-2 text-emerald-600" />
            {editingId ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          {editingId && (
            <button
              onClick={cancelEdit}
              className="text-stone-400 hover:text-stone-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={saveUser} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Nome</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">E-mail</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Código</label>
              <input
                type="text"
                value={formData.customCode}
                onChange={(e) => setFormData({ ...formData, customCode: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Ex: VEND-001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Senha</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                required={!editingId}
                placeholder={editingId ? 'Deixe em branco para manter' : ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Nível de Acesso</label>
              <select
                value={formData.role}
                onChange={(e) => handleRoleChange(e.target.value as any)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="user">Vendedor</option>
                <option value="manager">Gerente</option>
                <option value="admin">Administrador</option>
                <option value="master">Master</option>
              </select>
            </div>
          </div>

          {formData.role === 'manager' && (
            <div className="space-y-4 pt-4 border-t border-stone-200">
              <label className="block text-sm font-bold text-stone-600">Vendedores Gerenciados</label>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {users.filter(u => u.role === 'user' && u.id !== editingId).map(u => (
                  <label key={u.id} className="flex items-center space-x-2 p-2 rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors bg-white">
                    <input
                      type="checkbox"
                      checked={formData.managedUserIds.includes(u.id)}
                      onChange={(e) => {
                        const newSelection = e.target.checked
                          ? [...formData.managedUserIds, u.id]
                          : formData.managedUserIds.filter(id => id !== u.id);
                        setFormData({ ...formData, managedUserIds: newSelection });
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-stone-700 truncate" title={u.name}>{u.name}</span>
                  </label>
                ))}
                {users.filter(u => u.role === 'user' && u.id !== editingId).length === 0 && (
                  <span className="text-sm text-stone-500 italic col-span-full">Nenhum vendedor disponível</span>
                )}
              </div>
            </div>
          )}

          {/* PERMISSÕES AGRUPADAS */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-stone-400 uppercase tracking-wider">Permissões de Acesso</label>

            {/* Módulos principais */}
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <div className="bg-stone-800 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">📋 Módulos — Acesso às Páginas</div>
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {[
                  { id: 'dashboard', name: 'Dashboard' },
                  { id: 'calculator', name: 'Calculadora' },
                  { id: 'history', name: 'Situação' },
                  { id: 'approvals', name: 'Aprovações' },
                  { id: 'goals', name: 'Metas' },
                  { id: 'savedFormulas', name: 'Fórmulas Salvas' },
                  { id: 'reports', name: 'Relatórios' },
                  { id: 'pricingReport', name: 'Rel. Precificação' },
                  { id: 'commissionReport', name: 'Rel. Comissão' },
                  { id: 'priceLists', name: 'Lista de Preços' },
                  { id: 'clients', name: 'Clientes' },
                  { id: 'agents', name: 'Agentes' },
                  { id: 'branches', name: 'Filiais' },
                  { id: 'users', name: 'Usuários' },
                  { id: 'settings', name: 'Personalização' },
                  { id: 'managementReports', name: 'Rel. Gerenciais' },
                ].map(m => (
                  <button key={m.id} type="button"
                    onClick={() => setFormData({ ...formData, permissions: { ...formData.permissions, [m.id]: !(formData.permissions as any)[m.id] } })}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg border transition-all text-xs font-bold ${(formData.permissions as any)[m.id] ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-400'}`}>
                    {m.name}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ml-1 ${(formData.permissions as any)[m.id] ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-permissões Calculadora */}
            <div className="border border-blue-200 rounded-xl overflow-hidden">
              <div className="bg-blue-700 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">🧮 Calculadora — Ações Permitidas</div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'calculator_savePricing', name: 'Salvar Precificação' },
                  { id: 'calculator_generatePDF', name: 'Gerar PDF' },
                  { id: 'calculator_saveFormula', name: 'Salvar Batida/Fórmula' },
                ].map(m => (
                  <button key={m.id} type="button"
                    onClick={() => setFormData({ ...formData, permissions: { ...formData.permissions, [m.id]: !(formData.permissions as any)[m.id] } })}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-xs font-bold ${(formData.permissions as any)[m.id] ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-stone-50 border-stone-200 text-stone-400'}`}>
                    {m.name}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ml-1 ${(formData.permissions as any)[m.id] ? 'bg-blue-500' : 'bg-stone-300'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-permissões Histórico */}
            <div className="border border-orange-200 rounded-xl overflow-hidden">
              <div className="bg-orange-600 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">📂 Histórico — Ações Permitidas</div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'history_changeStatus', name: 'Alterar Status (Fechar/Perder)' },
                  { id: 'history_editPricing', name: 'Editar Precificação Existente' },
                ].map(m => (
                  <button key={m.id} type="button"
                    onClick={() => setFormData({ ...formData, permissions: { ...formData.permissions, [m.id]: !(formData.permissions as any)[m.id] } })}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-xs font-bold ${(formData.permissions as any)[m.id] ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-stone-50 border-stone-200 text-stone-400'}`}>
                    {m.name}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ml-1 ${(formData.permissions as any)[m.id] ? 'bg-orange-500' : 'bg-stone-300'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-permissões Cadastros */}
            <div className="border border-purple-200 rounded-xl overflow-hidden">
              <div className="bg-purple-700 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">🗄️ Cadastros — Macros e Micros</div>
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'macro_create', name: 'Criar Macro' },
                  { id: 'macro_edit', name: 'Editar Macro' },
                  { id: 'macro_delete', name: 'Excluir Macro' },
                  { id: 'micro_create', name: 'Criar Micro' },
                  { id: 'micro_edit', name: 'Editar Micro' },
                  { id: 'micro_delete', name: 'Excluir Micro' },
                ].map(m => (
                  <button key={m.id} type="button"
                    onClick={() => setFormData({ ...formData, permissions: { ...formData.permissions, [m.id]: !(formData.permissions as any)[m.id] } })}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-xs font-bold ${(formData.permissions as any)[m.id] ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-stone-50 border-stone-200 text-stone-400'}`}>
                    {m.name}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ml-1 ${(formData.permissions as any)[m.id] ? 'bg-purple-500' : 'bg-stone-300'}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-6 py-2 border border-stone-300 rounded-lg font-bold text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-8 py-2 rounded-lg font-bold transition-all shadow-md flex items-center"
            >
              {editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {loading ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 border-b border-stone-100 bg-stone-50/50">
          <h3 className="font-bold text-stone-800 text-sm">Usuários Cadastrados</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-6 py-4">Nome / E-mail</th>
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Nível</th>
                <th className="px-6 py-4">Acesso aos Módulos</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-stone-800">{user.name}</p>
                    <p className="text-xs text-stone-500">{user.email}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-stone-500">{user.customCode}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${user.role === 'master' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'admin' ? 'bg-red-100 text-red-700' :
                        user.role === 'manager' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                      }`}>
                      {user.role === 'user' ? 'vendedor' :
                        user.role === 'manager' ? 'gerente' :
                          user.role === 'admin' ? 'administrador' :
                            user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {modules.filter(m => (user.permissions as any)?.[m.id]).map(m => (
                        <span key={m.id} className="px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded text-[9px] font-medium border border-stone-200">
                          {m.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(user)}
                        className="text-stone-400 hover:text-emerald-600 p-1 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-stone-400 hover:text-red-500 p-1 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-400 italic">Nenhum usuário cadastrado</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-400">Carregando...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
