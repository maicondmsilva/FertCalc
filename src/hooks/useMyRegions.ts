import { useEffect, useState } from 'react';
import type { Region, User } from '../types';
import { listRegions, listUserRegions } from '../services/regionService';

export interface MyRegions {
  /** Regiões que o usuário pode escolher ao salvar (admin/master: todas as ativas). */
  options: Region[];
  /** Todas as regiões da empresa (para mostrar nomes). */
  all: Region[];
  principalId: string;
  /** A empresa já cadastrou regiões: a região passa a ser obrigatória. */
  orgHasRegions: boolean;
  loading: boolean;
}

/** Região padrão: a principal; com uma opção só, ela. */
export function defaultRegionId(options: Region[], principalId: string): string {
  if (principalId && options.some((region) => region.id === principalId)) return principalId;
  return options.length === 1 ? options[0].id : '';
}

/** Regiões do usuário logado, para a calculadora e as precificações. */
export function useMyRegions(user: { id: string; role?: User['role'] | string }): MyRegions {
  const [state, setState] = useState<MyRegions>({
    options: [],
    all: [],
    principalId: '',
    orgHasRegions: false,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    Promise.all([listRegions(), listUserRegions()])
      .then(([regions, links]) => {
        if (!active) return;
        const activeRegions = regions.filter((region) => region.ativo);
        const own = links.filter((link) => link.userId === user.id);
        const isAdmin = user.role === 'master' || user.role === 'admin';
        const options = isAdmin
          ? activeRegions
          : activeRegions.filter((region) => own.some((link) => link.regionId === region.id));
        setState({
          options,
          all: regions,
          principalId: own.find((link) => link.principal)?.regionId || '',
          orgHasRegions: activeRegions.length > 0,
          loading: false,
        });
      })
      .catch(() => {
        if (active) setState((current) => ({ ...current, loading: false }));
      });
    return () => {
      active = false;
    };
  }, [user.id, user.role]);

  return state;
}
