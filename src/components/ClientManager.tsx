import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  User as UserIcon,
  Search,
  Edit2,
  MapPin,
  Phone,
  Mail,
  Hash,
  Eye,
  X,
} from 'lucide-react';
import { Client, User } from '../types';
import { formatDocument, formatPhone, formatCEP, lookupCEP } from '../utils/formatters';
import {
  getClients,
  createClient,
  updateClient,
  deleteClient,
  getNextClientCode,
} from '../services/db';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { useFormValidation, validationRules, ValidationSchema } from '../hooks/useFormValidation';
import { ValidatedInput } from './ui/ValidatedInput';
import { BRAZILIAN_STATES } from '../constants/appConstants';

const emptyAddress = { cep: '', street: '', number: '', neighborhood: '', city: '', state: '' };

const initialFormData = {
  code: '',
  name: '',
  document: '',
  email: '',
  phone: '',
  stateRegistration: '',
  fazenda: '',
  address: { ...emptyAddress },
  deliveryAddress: { ...emptyAddress },
  sameAsCorrespondence: false,
};

const clientValidationSchema: ValidationSchema = {
  name: {
    required: true,
    rules: [validationRules.minLength(3)],
  },
  document: {
    required: true,
    rules: [
      {
        validate: (v: string) => {
          const clean = v.replace(/\D/g, '');
          return clean.length === 11 || clean.length === 14;
        },
        message: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos',
      },
    ],
  },
  stateRegistration: {
    required: true,
    rules: [validationRules.minLength(1)],
  },
  email: {
    required: false,
    rules: [
      {
        validate: (v: string) => !v || validationRules.email().validate(v),
        message: 'Email inválido',
      },
    ],
  },
  phone: {
    required: false,
    rules: [
      {
        validate: (v: string) => !v || v.replace(/\D/g, '').length >= 10,
        message: 'Telefone deve ter pelo menos 10 dígitos',
      },
    ],
  },
};

export default function ClientManager({ currentUser }: { currentUser: User }) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const { errors, touched, hasError, validateAll, handleBlur, handleChange, clearAllErrors } =
    useFormValidation(clientValidationSchema);

  const canCreate =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    (currentUser.permissions as any)?.clients_create;
  const canEdit =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    (currentUser.permissions as any)?.clients_edit;
  const canDelete =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    (currentUser.permissions as any)?.clients_delete;
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const data = await getClients();
    setClients(data);
    setLoading(false);
  };

  const handleCEPChange = async (cep: string, field: 'address' | 'deliveryAddress' = 'address') => {
    const formattedCEP = formatCEP(cep);
    setFormData((prev) => ({ ...prev, [field]: { ...prev[field], cep: formattedCEP } }));
    if (formattedCEP.replace(/\D/g, '').length === 8) {
      const addressData = await lookupCEP(formattedCEP);
      if (addressData) {
        setFormData((prev) => ({ ...prev, [field]: { ...prev[field], ...addressData } }));
      }
    }
  };

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const isValid = validateAll(formData);
    if (!isValid) {
      showError('Por favor, corrija os erros no formulário.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        deliveryAddress: formData.sameAsCorrespondence
          ? formData.address
          : formData.deliveryAddress,
      };
      // Remove UI-only field
      const { sameAsCorrespondence: _sac, ...clientPayload } = payload;

      if (editingClient) {
        await updateClient(editingClient.id, clientPayload as any);
        showSuccess('Cliente atualizado com sucesso!');
      } else {
        const nextCode = await getNextClientCode();
        await createClient({ ...clientPayload, code: nextCode } as any);
        showSuccess('Cliente salvo com sucesso!');
      }
      await loadClients();
      setFormData(initialFormData);
      setEditingClient(null);
      clearAllErrors();
    } catch {
      showError('Erro ao salvar cliente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (client: Client) => {
    setEditingClient(client);
    const sameAddr =
      !!client.deliveryAddress &&
      !!client.address &&
      JSON.stringify(client.address) === JSON.stringify(client.deliveryAddress);
    setFormData({
      code: client.code || '',
      name: client.name || '',
      document: client.document || '',
      email: client.email || '',
      phone: client.phone || '',
      stateRegistration: client.stateRegistration || '',
      fazenda: client.fazenda || '',
      address: client.address || { ...emptyAddress },
      deliveryAddress: client.deliveryAddress || { ...emptyAddress },
      sameAsCorrespondence: sameAddr,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClient = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir cliente?',
      message: 'Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await deleteClient(id);
      showSuccess('Cliente excluído com sucesso!');
      await loadClients();
    } catch {
      showError('Erro ao excluir cliente.');
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.document.includes(searchTerm) ||
      (c.code && c.code.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      {(canCreate && !editingClient) || (canEdit && editingClient) ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
          <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center">
            <UserIcon className="w-5 h-5 mr-2 text-emerald-600" />
            {editingClient ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
          </h2>

          <form onSubmit={saveClient} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <ValidatedInput
                  label="Nome / Razão Social"
                  type="text"
                  value={formData.name || ''}
                  error={errors.name}
                  touched={touched.name}
                  onChange={(value) => {
                    setFormData({ ...formData, name: value });
                    handleChange('name', value);
                  }}
                  onBlur={() => handleBlur('name', formData.name)}
                  placeholder="Nome completo do cliente..."
                  required
                />
              </div>
              <div>
                <ValidatedInput
                  label="CPF / CNPJ"
                  type="text"
                  value={formData.document || ''}
                  error={errors.document}
                  touched={touched.document}
                  onChange={(value) => {
                    const formatted = formatDocument(value);
                    setFormData({ ...formData, document: formatted });
                    handleChange('document', formatted);
                  }}
                  onBlur={() => handleBlur('document', formData.document)}
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div>
                <ValidatedInput
                  label={
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Inscrição Estadual (IE)
                    </span>
                  }
                  type="text"
                  value={formData.stateRegistration || ''}
                  error={errors.stateRegistration}
                  touched={touched.stateRegistration}
                  onChange={(value) => {
                    setFormData({ ...formData, stateRegistration: value });
                    handleChange('stateRegistration', value);
                  }}
                  onBlur={() => handleBlur('stateRegistration', formData.stateRegistration)}
                  placeholder="IE do cliente..."
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-stone-600 mb-1">Fazenda</label>
                <input
                  type="text"
                  value={formData.fazenda || ''}
                  onChange={(e) => setFormData({ ...formData, fazenda: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nome da fazenda..."
                />
              </div>
              <div>
                <ValidatedInput
                  label={
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> E-mail
                    </span>
                  }
                  type="email"
                  value={formData.email || ''}
                  error={errors.email}
                  touched={touched.email}
                  onChange={(value) => {
                    setFormData({ ...formData, email: value });
                    handleChange('email', value);
                  }}
                  onBlur={() => handleBlur('email', formData.email)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <ValidatedInput
                  label={
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Telefone / Celular
                    </span>
                  }
                  type="text"
                  value={formData.phone || ''}
                  error={errors.phone}
                  touched={touched.phone}
                  onChange={(value) => {
                    const formatted = formatPhone(value);
                    setFormData({ ...formData, phone: formatted });
                    handleChange('phone', formatted);
                  }}
                  onBlur={() => handleBlur('phone', formData.phone)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="border-t border-stone-100 pt-6">
              <h3 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" /> Endereço de Correspondência
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">CEP</label>
                  <input
                    type="text"
                    value={formData.address.cep || ''}
                    onChange={(e) => handleCEPChange(e.target.value, 'address')}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">
                    Estado (UF)
                  </label>
                  <select
                    value={formData.address.state || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, state: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">—</option>
                    {BRAZILIAN_STATES.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-6">
              <h3 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" /> Endereço de Entrega
                <label className="ml-4 flex items-center gap-2 text-xs font-normal text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.sameAsCorrespondence}
                    onChange={(e) =>
                      setFormData({ ...formData, sameAsCorrespondence: e.target.checked })
                    }
                    className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Mesmo endereço de correspondência
                </label>
              </h3>
              {!formData.sameAsCorrespondence && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">CEP</label>
                    <input
                      type="text"
                      value={formData.deliveryAddress.cep || ''}
                      onChange={(e) => handleCEPChange(e.target.value, 'deliveryAddress')}
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
                      value={formData.deliveryAddress.street || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          deliveryAddress: { ...formData.deliveryAddress, street: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Nº</label>
                    <input
                      type="text"
                      value={formData.deliveryAddress.number || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          deliveryAddress: { ...formData.deliveryAddress, number: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={formData.deliveryAddress.neighborhood || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          deliveryAddress: {
                            ...formData.deliveryAddress,
                            neighborhood: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-stone-500 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={formData.deliveryAddress.city || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          deliveryAddress: { ...formData.deliveryAddress, city: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">
                      Estado (UF)
                    </label>
                    <select
                      value={formData.deliveryAddress.state || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          deliveryAddress: { ...formData.deliveryAddress, state: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">—</option>
                      {BRAZILIAN_STATES.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              {editingClient && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingClient(null);
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
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-8 py-2 rounded-lg font-bold transition-colors flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Salvando...' : editingClient ? 'Atualizar Cliente' : 'Salvar Cliente'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h3 className="text-lg font-bold text-stone-800">
            Clientes Cadastrados ({clients.length})
          </h3>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm || ''}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3 w-20">Cod.</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">IE</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-emerald-700 font-mono">
                    {client.code || '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-800">{client.name}</td>
                  <td className="px-4 py-3 text-stone-600">{client.stateRegistration || '---'}</td>
                  <td className="px-4 py-3 text-stone-600">{client.document || '---'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => setViewingClient(client)}
                      className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-colors"
                      title="Visualizar"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => startEdit(client)}
                        className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteClient(client.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-stone-400 italic">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                    Carregando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {viewingClient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-emerald-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UserIcon className="w-5 h-5" />
                Dados do Cliente
              </h2>
              <button
                onClick={() => setViewingClient(null)}
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
                  <p className="text-stone-800 font-bold text-lg text-emerald-700">
                    Cod. {viewingClient.code || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    Nome / Razão Social
                  </p>
                  <p className="text-stone-800 font-medium">{viewingClient.name}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    CPF / CNPJ
                  </p>
                  <p className="text-stone-800 font-medium">{viewingClient.document}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    Inscrição Estadual (IE)
                  </p>
                  <p className="text-stone-800 font-medium">
                    {viewingClient.stateRegistration || '---'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    Fazenda
                  </p>
                  <p className="text-stone-800 font-medium">{viewingClient.fazenda || '---'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    E-mail
                  </p>
                  <p className="text-stone-800 font-medium">{viewingClient.email || '---'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    Telefone
                  </p>
                  <p className="text-stone-800 font-medium">{viewingClient.phone || '---'}</p>
                </div>
              </div>
              <div className="pt-6 border-t border-stone-100">
                <h3 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" /> Endereço
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-stone-400">CEP</p>
                    <p className="text-stone-800">{viewingClient.address?.cep || '---'}</p>
                  </div>
                  <div>
                    <p className="text-stone-400">Rua</p>
                    <p className="text-stone-800">
                      {viewingClient.address?.street || '---'},{' '}
                      {viewingClient.address?.number || 'S/N'}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-400">Bairro</p>
                    <p className="text-stone-800">{viewingClient.address?.neighborhood || '---'}</p>
                  </div>
                  <div>
                    <p className="text-stone-400">Cidade/UF</p>
                    <p className="text-stone-800">
                      {viewingClient.address?.city || '---'} -{' '}
                      {viewingClient.address?.state || '---'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setViewingClient(null);
                  startEdit(viewingClient);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={() => setViewingClient(null)}
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
