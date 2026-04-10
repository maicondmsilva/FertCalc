import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useManagementData } from '../hooks/useManagementData';
import ManagementDashboard from './management/ManagementDashboard';
import ManagementLancamentos from './management/ManagementLancamentos';
import ManagementCadastros from './management/ManagementCadastros';
import { Toast } from './management/ManagementUI';
import { ConfirmDialog } from './ui/ConfirmDialog';
import type { User } from '../types';

interface ManagementReportsModuleProps {
  currentUser: User;
  activeTab: 'dashboard' | 'lancamentos' | 'cadastros';
}

const MotionDiv = motion.div as any;
const AnimatePresenceComponent = AnimatePresence as any;

export default function ManagementReportsModule({
  currentUser,
  activeTab,
}: ManagementReportsModuleProps) {
  const {
    unidades,
    indicadores,
    categorias,
    lancamentos,
    metas,
    configs,
    diasUteis,
    loading,
    toast,
    setToast,
    handleSaveLancamentos,
    handleSaveUnidade,
    handleSaveIndicador,
    handleSaveCategoria,
    handleSaveMeta,
    handleSaveConfig,
    handleSaveDiasUteis,
    handleDeleteUnidade,
    handleDeleteIndicador,
    handleDeleteCategoria,
    handleDeleteMeta,
    handleDeleteConfig,
    handleDeleteDiasUteis,
    confirmState,
    handleConfirm,
    handleCancel,
  } = useManagementData();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-medium">Carregando RELATÓRIO DIÁRIO...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 overflow-y-auto p-8">
      <MotionDiv
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'dashboard' && (
          <ManagementDashboard
            unidades={unidades}
            indicadores={indicadores}
            categorias={categorias}
            lancamentos={lancamentos}
            metas={metas}
            configs={configs}
            diasUteis={diasUteis}
          />
        )}
        {activeTab === 'lancamentos' && (
          <ManagementLancamentos
            unidades={unidades}
            indicadores={indicadores}
            categorias={categorias}
            configs={configs}
            currentUser={currentUser}
            onSave={handleSaveLancamentos}
          />
        )}
        {activeTab === 'cadastros' && (
          <ManagementCadastros
            unidades={unidades}
            indicadores={indicadores}
            categorias={categorias}
            metas={metas}
            configs={configs}
            diasUteis={diasUteis}
            onSaveUnidade={handleSaveUnidade}
            onSaveIndicador={handleSaveIndicador}
            onSaveCategoria={handleSaveCategoria}
            onSaveMeta={handleSaveMeta}
            onSaveConfig={handleSaveConfig}
            onSaveDiasUteis={handleSaveDiasUteis}
            onDeleteUnidade={handleDeleteUnidade}
            onDeleteIndicador={handleDeleteIndicador}
            onDeleteCategoria={handleDeleteCategoria}
            onDeleteMeta={handleDeleteMeta}
            onDeleteConfig={handleDeleteConfig}
            onDeleteDiasUteis={handleDeleteDiasUteis}
          />
        )}
      </MotionDiv>

      <AnimatePresenceComponent>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </AnimatePresenceComponent>

      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
