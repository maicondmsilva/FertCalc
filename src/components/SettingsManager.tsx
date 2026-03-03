import React, { useState, useEffect } from 'react';
import { Settings, Save, Image as ImageIcon, Building, Download, Upload, Database, FileText } from 'lucide-react';
import { AppSettings } from '../types';
import { getAppSettings, saveAppSettings } from '../services/db';
import { useToast } from './Toast';

export default function SettingsManager() {
  const { showSuccess } = useToast();
  const [settings, setSettings] = useState<AppSettings>({
    companyName: 'FertCalc Pro',
    companyLogo: ''
  });

  useEffect(() => {
    getAppSettings().then(saved => {
      if (saved) setSettings(saved);
    });
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, companyLogo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveSettings = async () => {
    await saveAppSettings(settings);
    showSuccess('Configurações salvas com sucesso!');
  };

  const handleBackup = () => {
    const data = {
      info: 'Dados agora armazenados no Supabase. Use o painel Supabase para backups completos.',
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fertcalc_info_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Exportação concluída. Acesse o painel Supabase para dados completos.');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-stone-600" />
          Personalização do Sistema
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-2">Informações Gerais</h3>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1 flex items-center">
                <Building className="w-4 h-4 mr-1" /> Nome da Empresa
              </label>
              <input
                type="text"
                value={settings.companyName || ''}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-500"
                placeholder="Ex: AgroFertil S.A."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1 flex items-center">
                <ImageIcon className="w-4 h-4 mr-1" /> Logo da Empresa
              </label>
              <div className="mt-2 flex items-center gap-4">
                {settings.companyLogo ? (
                  <div className="w-24 h-24 border border-stone-200 rounded-lg overflow-hidden bg-stone-50 flex items-center justify-center">
                    <img src={settings.companyLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-24 h-24 border-2 border-dashed border-stone-200 rounded-lg flex items-center justify-center text-stone-400">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200 cursor-pointer"
                  />
                  <p className="mt-1 text-xs text-stone-400">Recomendado: PNG ou JPG, fundo transparente.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1 flex items-center">
                <Building className="w-4 h-4 mr-1" /> CNPJ da Empresa
              </label>
              <input
                type="text"
                value={settings.companyCnpj || ''}
                onChange={(e) => setSettings({ ...settings, companyCnpj: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-500"
                placeholder="Ex: 00.000.000/0001-00"
              />
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-2">Parâmetros por Módulo</h3>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-2" /> Módulo Precificação
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1">Termos Comerciais Padrão</label>
                  <textarea
                    value={settings.pricingTerms || ''}
                    onChange={(e) => setSettings({ ...settings, pricingTerms: e.target.value })}
                    className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 h-24 text-sm"
                    placeholder="Digite as condições de pagamento, entrega, etc."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="auto_approve" className="rounded text-emerald-600" />
                  <label htmlFor="auto_approve" className="text-xs text-emerald-700">Habilitar auto-aprovação para margens acima de 15%</label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 opacity-60">
              <h4 className="text-sm font-bold text-stone-800 mb-2 flex items-center">
                <Settings className="w-4 h-4 mr-2" /> Módulo Configuração
              </h4>
              <p className="text-[10px] text-stone-500 italic">Configurações avançadas de sistema em breve.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-stone-100 flex justify-end">
          <button
            onClick={saveSettings}
            className="bg-stone-800 hover:bg-stone-900 text-white px-8 py-2 rounded-lg font-bold transition-colors flex items-center shadow-lg active:scale-95"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Personalização
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center">
          <Database className="w-5 h-5 mr-2 text-stone-600" />
          Backup e Restauração
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
            <h3 className="font-bold text-stone-700 mb-2 flex items-center">
              <Download className="w-4 h-4 mr-2" /> Exportar Dados
            </h3>
            <p className="text-sm text-stone-500 mb-4">
              Baixe uma cópia completa de todos os dados do sistema (clientes, histórico, configurações, etc).
            </p>
            <button
              onClick={handleBackup}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Backup
            </button>
          </div>

          <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
            <h3 className="font-bold text-stone-700 mb-2 flex items-center">
              <Upload className="w-4 h-4 mr-2" /> Dados na Nuvem
            </h3>
            <p className="text-sm text-stone-500 mb-2">
              Os dados agora são armazenados de forma segura no <strong>Supabase</strong>.
            </p>
            <a
              href="https://supabase.com/dashboard/project/joogfmtpecnaghbpexqy"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              <Database className="w-4 h-4 mr-2" />
              Abrir Painel Supabase
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
