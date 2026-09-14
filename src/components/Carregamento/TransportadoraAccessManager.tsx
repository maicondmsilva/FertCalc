import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, RefreshCw, UserRound, X } from 'lucide-react';
import type { User } from '../../types';
import type { Transportadora } from '../../types/carregamento';
import {
  desativarVinculoTransportadora,
  listarUsuariosPortalTransportadora,
  listarVinculosTransportadora,
  vincularUsuarioTransportadora,
  type UsuarioPortalTransportadora,
  type VinculoTransportadoraUsuario,
} from '../../services/transportadoraAccessService';
import { useToast } from '../Toast';

interface Props {
  currentUser: User;
  transportadoras: Transportadora[];
}

export default function TransportadoraAccessManager({ currentUser, transportadoras }: Props) {
  const { showSuccess, showError } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioPortalTransportadora[]>([]);
  const [vinculos, setVinculos] = useState<VinculoTransportadoraUsuario[]>([]);
  const [usuarioId, setUsuarioId] = useState('');
  const [transportadoraId, setTransportadoraId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [novosUsuarios, novosVinculos] = await Promise.all([
        listarUsuariosPortalTransportadora(),
        listarVinculosTransportadora(),
      ]);
      setUsuarios(novosUsuarios);
      setVinculos(novosVinculos);
    } catch (error) {
      console.error(error);
      showError('Não foi possível carregar os acessos das transportadoras.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const vinculosAtivos = useMemo(() => vinculos.filter((vinculo) => vinculo.ativo), [vinculos]);
  const usuariosDisponiveis = useMemo(
    () =>
      usuarios.filter(
        (usuario) => usuario.ativo && !vinculosAtivos.some((v) => v.userId === usuario.id)
      ),
    [usuarios, vinculosAtivos]
  );

  const vincular = async () => {
    if (!currentUser.organizationId || !usuarioId || !transportadoraId) return;
    setSaving(true);
    try {
      await vincularUsuarioTransportadora({
        organizationId: currentUser.organizationId,
        transportadoraId,
        userId: usuarioId,
        criadoPor: currentUser.id,
      });
      setUsuarioId('');
      setTransportadoraId('');
      await carregar();
      showSuccess('Acesso vinculado à transportadora.');
    } catch (error) {
      console.error(error);
      showError('Não foi possível vincular o acesso. Verifique o usuário e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const desativar = async (vinculo: VinculoTransportadoraUsuario) => {
    setSaving(true);
    try {
      await desativarVinculoTransportadora(vinculo.id);
      await carregar();
      showSuccess('Acesso da transportadora removido.');
    } catch (error) {
      console.error(error);
      showError('Não foi possível remover o acesso.');
    } finally {
      setSaving(false);
    }
  };

  const usuarioPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
  const transportadoraPorId = new Map(transportadoras.map((item) => [item.id, item]));

  return (
    <section className="mt-6 border-t border-stone-200 pt-5 space-y-4">
      <div>
        <h4 className="font-bold text-stone-800 text-sm flex items-center gap-2">
          <UserRound className="w-4 h-4 text-amber-600" /> Acessos do portal
        </h4>
        <p className="text-xs text-stone-500 mt-1">
          Relacione cada usuário do tipo Transportadora à empresa que ele representa.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end bg-stone-50 border border-stone-200 rounded-xl p-4">
        <label className="text-xs font-bold text-stone-600">
          Usuário
          <select
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal"
          >
            <option value="">Selecione...</option>
            {usuariosDisponiveis.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.nome} — {usuario.email}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-stone-600">
          Transportadora
          <select
            value={transportadoraId}
            onChange={(e) => setTransportadoraId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal"
          >
            <option value="">Selecione...</option>
            {transportadoras
              .filter((item) => item.ativo)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          onClick={vincular}
          disabled={saving || !usuarioId || !transportadoraId || !currentUser.organizationId}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          <Link2 className="w-4 h-4" /> Vincular
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-5">
          <RefreshCw className="w-5 h-5 animate-spin text-stone-300" />
        </div>
      ) : vinculosAtivos.length === 0 ? (
        <p className="text-sm text-stone-400 py-3">Nenhum acesso vinculado.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {vinculosAtivos.map((vinculo) => {
            const usuario = usuarioPorId.get(vinculo.userId);
            const transportadora = transportadoraPorId.get(vinculo.transportadoraId);
            return (
              <div
                key={vinculo.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-800 truncate">
                    {usuario?.nome ?? 'Usuário indisponível'}
                  </p>
                  <p className="text-xs text-stone-500 truncate">
                    {transportadora?.nome ?? 'Transportadora indisponível'} ·{' '}
                    {usuario?.email ?? '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void desativar(vinculo)}
                  disabled={saving}
                  title="Remover vínculo"
                  className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

