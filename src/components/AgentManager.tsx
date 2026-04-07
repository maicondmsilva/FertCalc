import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  UserCheck,
  Search,
  Edit2,
  MapPin,
  Phone,
  Mail,
  Eye,
  X,
} from 'lucide-react';
import { Agent, User } from '../types';
import { formatDocument, formatPhone, formatCEP, lookupCEP } from '../utils/formatters';
import { getAgents, createAgent, updateAgent, deleteAgent, getNextAgentCode } from '../services/db';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';

const initialFormData = {
  code: '',
  name: '',
  document: '',
  email: '',
  phone: '',
  ie: '',
  address: { cep: '', street: '', number: '', neighborhood: '', city: '', state: '' },
};

export default function AgentManager({ currentUser }: { currentUser: User }) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const canCreate =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    (currentUser.permissions as any)?.agents_create;
  const canEdit =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    (currentUser.permissions as any)?.agents_edit;
  const canDelete =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    (currentUser.permissions as any)?.agents_delete;
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [viewingAgent, setViewingAgent] = useState<Agent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    const data = await getAgents();
    setAgents(data);
    setLoading(false);
  };

  const handleCEPChange = async (cep: string) => {
    const formattedCEP = formatCEP(cep);
    setFormData((prev) => ({ ...prev, address: { ...prev.address, cep: formattedCEP } }));
    if (formattedCEP.replace(/\D/g, '').length === 8) {
      const addressData = await lookupCEP(formattedCEP);
      if (addressData)
        setFormData((prev) => ({ ...prev, address: { ...prev.address, ...addressData } }));
    }
  };

  const saveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setLoading(true);
    try {
      if (editingAgent) {
        await updateAgent(editingAgent.id, formData as any);
        showSuccess('Agente atualizado com sucesso!');
      } else {
        const nextCode = await getNextAgentCode();
        await createAgent({ ...formData, code: nextCode } as any);
        showSuccess('Agente salvo com sucesso!');
      }
      await loadAgents();
      setFormData(initialFormData);
      setEditingAgent(null);
    } catch {
      showError('Erro ao salvar agente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      code: agent.code || '',
      name: agent.name || '',
      document: agent.document || '',
      email: agent.email || '',
      phone: agent.phone || '',
      ie: agent.ie || '',
      address: agent.address || initialFormData.address,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteAgent = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir agente?',
      message: 'Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await deleteAgent(id);
      showSuccess('Agente excluído com sucesso!');
      await loadAgents();
    } catch {
      showError('Erro ao excluir agente.');
    }
  };

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.document.includes(searchTerm) ||
      (a.code && a.code.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      {(canCreate && !editingAgent) || (canEdit && editingAgent) ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
          <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center">
            <UserCheck className="w-5 h-5 mr-2 text-blue-600" />
            {editingAgent ? 'Editar Agente' : 'Cadastrar Novo Agente'}
          </h2>
          <form onSubmit={saveAgent} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  Nome do Agente
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome completo..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">CPF / CNPJ</label>
                <input
                  type="text"
                  value={formData.document || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, document: formatDocument(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> E-mail
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Telefone / Celular
                </label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="border-t border-stone-100 pt-6">
              <h3 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" /> Endereço
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">CEP</label>
                  <input
                    type="text"
                    value={formData.address.cep || ''}
                    onChange={(e) => handleCEPChange(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="00000-000"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-stone-500 mb-1">
                    Rua / Logradouro
                  </label>
                  <input
                    type="text"
                    value={formData.address.street || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, street: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Nº</label>
                  <input
                    type="text"
                    value={formData.address.number || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, number: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Bairro</label>
                  <input
                    type="text"
                    value={formData.address.neighborhood || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, neighborhood: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-stone-500 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={formData.address.city || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, city: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">
                    Estado (UF)
                  </label>
                  <input
                    type="text"
                    value={formData.address.state || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, state: e.target.value.toUpperCase() },
                      })
                    }
                    maxLength={2}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {editingAgent && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAgent(null);
                    setFormData(initialFormData);
                  }}
                  className="px-6 py-2 border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 py-2 rounded-lg font-bold transition-colors flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Salvando...' : editingAgent ? 'Atualizar Agente' : 'Salvar Agente'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h3 className="text-lg font-bold text-stone-800">
            Agentes Cadastrados ({agents.length})
          </h3>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar agente..."
              value={searchTerm || ''}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3 w-20">Cod.</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-blue-700 font-mono">
                    {agent.code || '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-800">{agent.name}</td>
                  <td className="px-4 py-3 text-stone-600">{agent.document || '---'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => setViewingAgent(agent)}
                      className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                      title="Visualizar"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => startEdit(agent)}
                        className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredAgents.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-stone-400 italic">
                    Nenhum agente encontrado.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-stone-400">
                    Carregando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingAgent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-blue-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Dados do Agente
              </h2>
              <button
                onClick={() => setViewingAgent(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    Código
                  </p>
                  <p className="text-stone-800 font-bold text-lg text-blue-700">
                    Cod. {viewingAgent.code || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    Nome
                  </p>
                  <p className="text-stone-800 font-medium">{viewingAgent.name}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    CPF / CNPJ
                  </p>
                  <p className="text-stone-800 font-medium">{viewingAgent.document}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    E-mail
                  </p>
                  <p className="text-stone-800 font-medium">{viewingAgent.email || '---'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    Telefone
                  </p>
                  <p className="text-stone-800 font-medium">{viewingAgent.phone || '---'}</p>
                </div>
              </div>
              <div className="pt-6 border-t border-stone-100">
                <h3 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" /> Endereço
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-stone-400">CEP</p>
                    <p className="text-stone-800">{viewingAgent.address?.cep || '---'}</p>
                  </div>
                  <div>
                    <p className="text-stone-400">Rua</p>
                    <p className="text-stone-800">
                      {viewingAgent.address?.street || '---'},{' '}
                      {viewingAgent.address?.number || 'S/N'}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-400">Bairro</p>
                    <p className="text-stone-800">{viewingAgent.address?.neighborhood || '---'}</p>
                  </div>
                  <div>
                    <p className="text-stone-400">Cidade/UF</p>
                    <p className="text-stone-800">
                      {viewingAgent.address?.city || '---'} - {viewingAgent.address?.state || '---'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setViewingAgent(null);
                  startEdit(viewingAgent);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={() => setViewingAgent(null)}
                className="px-6 py-2 bg-stone-800 text-white rounded-lg font-bold hover:bg-stone-900 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
