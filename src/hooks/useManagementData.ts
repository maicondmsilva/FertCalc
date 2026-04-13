import { useState, useEffect } from 'react';
import { useConfirm } from './useConfirm';
import type {
  Unidade,
  Indicador,
  Categoria,
  Lancamento,
  MetaMensal,
  ConfiguracaoIndicador,
  DiasUteisMes,
} from '../types';
import {
  getMgmtUnidades,
  upsertMgmtUnidade,
  deleteMgmtUnidade,
  getMgmtCategorias,
  upsertMgmtCategoria,
  deleteMgmtCategoria,
  getMgmtIndicadores,
  upsertMgmtIndicador,
  deleteMgmtIndicador,
  getMgmtLancamentos,
  upsertMgmtLancamentos,
  getMgmtMetas,
  upsertMgmtMeta,
  deleteMgmtMeta,
  getMgmtConfigs,
  upsertMgmtConfig,
  deleteMgmtConfig,
  getMgmtDiasUteis,
  upsertMgmtDiasUteis,
  deleteMgmtDiasUteis,
} from '../services/db';

export function useManagementData() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [metas, setMetas] = useState<MetaMensal[]>([]);
  const [configs, setConfigs] = useState<ConfiguracaoIndicador[]>([]);
  const [diasUteis, setDiasUteis] = useState<DiasUteisMes[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [u, i, cat, l, m, c, d] = await Promise.all([
        getMgmtUnidades(),
        getMgmtIndicadores(),
        getMgmtCategorias(),
        getMgmtLancamentos(),
        getMgmtMetas(),
        getMgmtConfigs(),
        getMgmtDiasUteis(),
      ]);
      setUnidades(u);
      setIndicadores(i);
      setCategorias(cat);
      setLancamentos(l);
      setMetas(m);
      setConfigs(c);
      setDiasUteis(d);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Save handlers ---

  const handleSaveLancamentos = async (newLancamentos: Partial<Lancamento>[]) => {
    try {
      await upsertMgmtLancamentos(newLancamentos);
      await fetchData();
      showToast('✅ Lançamento registrado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao registrar lançamento:', error);
      showToast('❌ Erro ao registrar lançamento. Tente novamente.', 'error');
    }
  };

  const handleSaveUnidade = async (u: Unidade) => {
    try {
      await upsertMgmtUnidade(u);
      await fetchData();
      showToast('Unidade salva com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao salvar unidade:', error);
      showToast('❌ Erro ao salvar unidade. Tente novamente.', 'error');
    }
  };

  const handleSaveIndicador = async (i: Indicador) => {
    try {
      await upsertMgmtIndicador(i);
      await fetchData();
      showToast('Indicador salvo com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao salvar indicador:', error);
      showToast('❌ Erro ao salvar indicador. Tente novamente.', 'error');
    }
  };

  const handleSaveCategoria = async (c: Categoria) => {
    try {
      await upsertMgmtCategoria(c);
      await fetchData();
      showToast('Categoria salva com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      showToast('❌ Erro ao salvar categoria. Tente novamente.', 'error');
    }
  };

  const handleSaveMeta = async (m: MetaMensal) => {
    try {
      await upsertMgmtMeta(m);
      await fetchData();
      showToast('Meta salva com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      showToast('❌ Erro ao salvar meta. Tente novamente.', 'error');
    }
  };

  const handleSaveConfig = async (c: ConfiguracaoIndicador) => {
    try {
      await upsertMgmtConfig(c);
      await fetchData();
      showToast('Configuração salva com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      showToast('❌ Erro ao salvar configuração. Tente novamente.', 'error');
    }
  };

  const handleSaveDiasUteis = async (d: DiasUteisMes) => {
    try {
      await upsertMgmtDiasUteis(d);
      await fetchData();
      showToast('Dias úteis salvos com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao salvar dias úteis:', error);
      showToast('❌ Erro ao salvar dias úteis. Tente novamente.', 'error');
    }
  };

  // --- Delete handlers ---

  const handleDeleteUnidade = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Unidade',
      message: 'Tem certeza que deseja excluir esta unidade?',
      variant: 'danger',
    });
    if (ok) {
      try {
        await deleteMgmtUnidade(id);
        await fetchData();
        showToast('Unidade excluída com sucesso', 'success');
      } catch (error) {
        console.error('Erro ao excluir unidade:', error);
        showToast('❌ Erro ao excluir unidade. Tente novamente.', 'error');
      }
    }
  };

  const handleDeleteIndicador = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Indicador',
      message: 'Tem certeza que deseja excluir este indicador?',
      variant: 'danger',
    });
    if (ok) {
      try {
        await deleteMgmtIndicador(id);
        await fetchData();
        showToast('Indicador excluído com sucesso', 'success');
      } catch (error) {
        console.error('Erro ao excluir indicador:', error);
        showToast('❌ Erro ao excluir indicador. Tente novamente.', 'error');
      }
    }
  };

  const handleDeleteCategoria = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Categoria',
      message: 'Tem certeza que deseja excluir esta categoria?',
      variant: 'danger',
    });
    if (ok) {
      try {
        await deleteMgmtCategoria(id);
        await fetchData();
        showToast('Categoria excluída com sucesso', 'success');
      } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        showToast('❌ Erro ao excluir categoria. Tente novamente.', 'error');
      }
    }
  };

  const handleDeleteMeta = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Meta',
      message: 'Tem certeza que deseja excluir esta meta?',
      variant: 'danger',
    });
    if (ok) {
      try {
        await deleteMgmtMeta(id);
        await fetchData();
        showToast('Meta excluída com sucesso', 'success');
      } catch (error) {
        console.error('Erro ao excluir meta:', error);
        showToast('❌ Erro ao excluir meta. Tente novamente.', 'error');
      }
    }
  };

  const handleDeleteConfig = async (uId: string, iId: string) => {
    if (!uId) {
      showToast('Selecione uma unidade primeiro', 'error');
      return;
    }
    try {
      await deleteMgmtConfig(uId, iId);
      await fetchData();
      showToast('Personalização excluída com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao excluir personalização:', error);
      showToast('❌ Erro ao excluir personalização. Tente novamente.', 'error');
    }
  };

  const handleDeleteDiasUteis = async (uId: string, ano: number, mes: number) => {
    const ok = await confirm({
      title: 'Excluir Dias Úteis',
      message: 'Tem certeza que deseja excluir este registro de dias úteis?',
      variant: 'danger',
    });
    if (ok) {
      try {
        await deleteMgmtDiasUteis(uId, ano, mes);
        await fetchData();
        showToast('Dias úteis excluídos com sucesso', 'success');
      } catch (error) {
        console.error('Erro ao excluir dias úteis:', error);
        showToast('❌ Erro ao excluir dias úteis. Tente novamente.', 'error');
      }
    }
  };

  return {
    // Data
    unidades,
    indicadores,
    categorias,
    lancamentos,
    metas,
    configs,
    diasUteis,
    loading,
    toast,
    // Save handlers
    handleSaveLancamentos,
    handleSaveUnidade,
    handleSaveIndicador,
    handleSaveCategoria,
    handleSaveMeta,
    handleSaveConfig,
    handleSaveDiasUteis,
    // Delete handlers
    handleDeleteUnidade,
    handleDeleteIndicador,
    handleDeleteCategoria,
    handleDeleteMeta,
    handleDeleteConfig,
    handleDeleteDiasUteis,
    // Toast
    setToast,
    // Confirm dialog
    confirmState,
    handleConfirm,
    handleCancel,
  };
}
