import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Building,
  Database,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Save,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { AppSettings } from '../types';
import {
  createAgentsBulk,
  createClientsBulk,
  getAgents,
  getAppSettings,
  getClients,
  saveAppSettings,
} from '../services/db';
import { useToast } from './Toast';
import CompatibilityCategoryManager from './CompatibilityCategoryManager';
import SystemHealthPanel from './SystemHealthPanel';
import { describeSkipped, parseAgentRows, parseClientRows } from './settings/importRows';
import { prepareLogo, validateLogoFile } from './settings/logoUpload';

type SectionId = 'empresa' | 'precificacao' | 'categorias' | 'importacao' | 'sistema';

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'empresa', label: 'Empresa', icon: Building },
  { id: 'precificacao', label: 'Precificação', icon: FileText },
  { id: 'categorias', label: 'Categorias', icon: Layers },
  { id: 'importacao', label: 'Importação', icon: Upload },
  { id: 'sistema', label: 'Sistema', icon: Activity },
];

const DEFAULT_SETTINGS: AppSettings = {
  companyName: 'FertCalc Pro',
  companyLogo: '',
  defaultFactorBRL: 0.8,
  defaultFactorUSD: 0,
};

const CLIENT_TEMPLATE = {
  'Razão Social / Nome*': '',
  'CNPJ / CPF*': '',
  Código: '',
  'E-mail': '',
  Telefone: '',
  'Inscrição Estadual': '',
  Fazenda: '',
  CEP: '',
  Rua: '',
  Número: '',
  Bairro: '',
  Cidade: '',
  'Estado (UF)': '',
};

const AGENT_TEMPLATE = {
  'Nome*': '',
  'Documento*': '',
  Código: '',
  'E-mail': '',
  Telefone: '',
  'Inscrição Estadual': '',
  CEP: '',
  Rua: '',
  Número: '',
  Bairro: '',
  Cidade: '',
  'Estado (UF)': '',
};

const SUPABASE_PROJECT_URL = 'https://supabase.com/dashboard/project/vadbhbyfnkrqvboiiakw';

const inputClass =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 sm:p-6">
      <h2 className="text-base font-bold text-stone-800">{title}</h2>
      {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-700 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

export default function SettingsManager({
  canEditCompany = true,
}: {
  /** O banco só deixa administradores gravarem a personalização. */
  canEditCompany?: boolean;
} = {}) {
  const { showSuccess, showError, showInfo } = useToast();
  const [section, setSection] = useState<SectionId>('empresa');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingLogo, setIsPreparingLogo] = useState(false);
  const [importing, setImporting] = useState<'clients' | 'agents' | null>(null);
  const [preparingTemplate, setPreparingTemplate] = useState<'clients' | 'agents' | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const agentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAppSettings().then((current) => {
      if (current) {
        setSettings(current);
        setSaved(current);
      }
    });
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(saved),
    [settings, saved]
  );
  const update = (patch: Partial<AppSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = validateLogoFile(file);
    if (problem) {
      showError(problem);
      return;
    }
    setIsPreparingLogo(true);
    try {
      update({ companyLogo: await prepareLogo(file) });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível usar esta imagem.');
    } finally {
      setIsPreparingLogo(false);
    }
  };

  const saveSettings = async () => {
    if ((settings.defaultFactorBRL ?? 0) < 0 || (settings.defaultFactorUSD ?? 0) < 0) {
      showError('Os fatores padrão não podem ser negativos.');
      return;
    }
    setIsSaving(true);
    try {
      await saveAppSettings(settings);
      setSaved(settings);
      showSuccess('Configurações salvas.');
    } catch (error) {
      showError(
        `Erro ao salvar configurações: ${error instanceof Error ? error.message : 'Tente novamente.'}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const downloadTemplate = async (kind: 'clients' | 'agents') => {
    setPreparingTemplate(kind);
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet([
        kind === 'clients' ? CLIENT_TEMPLATE : AGENT_TEMPLATE,
      ]);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, kind === 'clients' ? 'Clientes' : 'Agentes');
      XLSX.writeFile(
        book,
        kind === 'clients' ? 'modelo_importacao_clientes.xlsx' : 'modelo_importacao_agentes.xlsx'
      );
    } catch {
      showError('Não foi possível gerar o modelo.');
    } finally {
      setPreparingTemplate(null);
    }
  };

  const handleImport = async (
    kind: 'clients' | 'agents',
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(kind);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[workbook.SheetNames[0]]
      );
      const label = kind === 'clients' ? 'clientes' : 'agentes';
      const existing = (kind === 'clients' ? await getClients() : await getAgents()).map(
        (item) => item.document
      );
      const result =
        kind === 'clients' ? parseClientRows(rows, existing) : parseAgentRows(rows, existing);
      const skipped = describeSkipped(result);

      if (result.items.length === 0) {
        showError(
          `Nenhum ${label.slice(0, -1)} novo para importar.${skipped ? ` Ignorados: ${skipped}.` : ''}`
        );
        return;
      }
      if (kind === 'clients') await createClientsBulk(result.items as never);
      else await createAgentsBulk(result.items as never);
      showSuccess(`${result.items.length} ${label} importados.`);
      if (skipped) showInfo(`Ignorados: ${skipped}.`, 'Algumas linhas ficaram de fora');
    } catch (error) {
      console.error(error);
      showError(
        `Erro ao importar. ${error instanceof Error ? error.message : 'Verifique o formato do arquivo.'}`
      );
    } finally {
      setImporting(null);
    }
  };

  const saveBar = (section === 'empresa' || section === 'precificacao') && (
    <div className="sticky bottom-0 mt-4 flex flex-col gap-2 rounded-xl border border-stone-200 bg-white/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <p
        className={`text-sm ${!canEditCompany ? 'text-red-700' : isDirty ? 'text-amber-700' : 'text-stone-400'}`}
      >
        {!canEditCompany
          ? 'Somente administradores podem salvar estas configurações.'
          : isDirty
            ? 'Há alterações não salvas.'
            : 'Tudo salvo.'}
      </p>
      <div className="flex gap-2">
        {isDirty && (
          <button
            type="button"
            onClick={() => setSettings(saved)}
            className="px-4 py-2 rounded-lg border border-stone-300 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Descartar
          </button>
        )}
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={!canEditCompany || !isDirty || isSaving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );

  const importCard = (kind: 'clients' | 'agents') => {
    const isClients = kind === 'clients';
    const Icon = isClients ? Users : UserCheck;
    const inputRef = isClients ? clientInputRef : agentInputRef;
    return (
      <div className="flex flex-col justify-between rounded-xl border border-stone-200 p-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-stone-800">
            <Icon className="w-4 h-4 text-emerald-600" />
            {isClients ? 'Clientes' : 'Agentes'}
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Campos com * são obrigatórios. Documentos já cadastrados ou repetidos na planilha são
            ignorados, e o sistema informa as linhas.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void downloadTemplate(kind)}
            disabled={preparingTemplate !== null}
            className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {preparingTemplate === kind ? 'Preparando...' : 'Baixar modelo'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            aria-label={`Planilha de ${isClients ? 'clientes' : 'agentes'}`}
            onChange={(event) => void handleImport(kind, event)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={importing !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {importing === kind ? 'Importando...' : 'Importar planilha'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-stone-800">Configurações</h1>
        <p className="text-sm text-stone-500">Dados da empresa, padrões, cadastros e sistema.</p>
      </header>

      <div className="flex flex-col gap-5 md:flex-row">
        <nav
          aria-label="Seções de configurações"
          className="flex gap-1 overflow-x-auto md:w-52 md:flex-shrink-0 md:flex-col"
        >
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                section === id
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-5">
          {section === 'empresa' && (
            <Card
              title="Empresa"
              description="Aparece no topo das páginas e nos relatórios em PDF."
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <Field label="Nome da empresa (opcional)" htmlFor="settings-company-name">
                    <input
                      id="settings-company-name"
                      type="text"
                      value={settings.companyName || ''}
                      onChange={(event) => update({ companyName: event.target.value })}
                      className={inputClass}
                      placeholder="Ex: AgroFertil S.A."
                    />
                  </Field>
                  <label className="flex items-start gap-2 text-sm text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showCompanyName !== false}
                      onChange={(event) => update({ showCompanyName: event.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      Mostrar o nome ao lado da logo
                      <span className="block text-xs text-stone-400">
                        Desmarque se a logo já tem o nome. Sem logo, o nome sempre aparece.
                      </span>
                    </span>
                  </label>
                  <Field label="CNPJ" htmlFor="settings-company-cnpj">
                    <input
                      id="settings-company-cnpj"
                      type="text"
                      value={settings.companyCnpj || ''}
                      onChange={(event) => update({ companyCnpj: event.target.value })}
                      className={inputClass}
                      placeholder="00.000.000/0001-00"
                    />
                  </Field>
                </div>

                <div>
                  <p className="text-sm font-medium text-stone-700 mb-1">Logo</p>
                  <div className="flex h-36 items-center justify-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-3">
                    {settings.companyLogo ? (
                      <img
                        src={settings.companyLogo}
                        alt="Logo da empresa"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-stone-300" />
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    aria-label="Arquivo da logo"
                    onChange={(event) => void handleLogoChange(event)}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isPreparingLogo}
                      className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {isPreparingLogo
                        ? 'Preparando...'
                        : settings.companyLogo
                          ? 'Trocar logo'
                          : 'Enviar logo'}
                    </button>
                    {settings.companyLogo && (
                      <button
                        type="button"
                        onClick={() => update({ companyLogo: '' })}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-stone-400">
                    PNG, JPG ou WEBP até 2 MB. Prefira fundo transparente. A imagem é reduzida para
                    no máximo 600 px.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {section === 'precificacao' && (
            <Card
              title="Padrões da precificação"
              description="Valores usados ao iniciar uma nova precificação nas calculadoras."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Fator padrão — Real" htmlFor="settings-factor-brl">
                  <input
                    id="settings-factor-brl"
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.defaultFactorBRL ?? 0.8}
                    onChange={(event) =>
                      update({ defaultFactorBRL: Math.max(0, Number(event.target.value)) })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Fator padrão — Dólar"
                  htmlFor="settings-factor-usd"
                  hint="Zero não altera o custo da lista em dólar."
                >
                  <input
                    id="settings-factor-usd"
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.defaultFactorUSD ?? 0}
                    onChange={(event) =>
                      update({ defaultFactorUSD: Math.max(0, Number(event.target.value)) })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Termos comerciais padrão" htmlFor="settings-pricing-terms">
                  <textarea
                    id="settings-pricing-terms"
                    value={settings.pricingTerms || ''}
                    onChange={(event) => update({ pricingTerms: event.target.value })}
                    className={`${inputClass} h-28`}
                    placeholder="Condições de pagamento, entrega, etc."
                  />
                </Field>
              </div>
            </Card>
          )}

          {section === 'categorias' && (
            <Card
              title="Categorias de produtos"
              description="Organizam as matérias-primas e agilizam a escolha na calculadora. Somente gerente ou acima altera."
            >
              <CompatibilityCategoryManager />
            </Card>
          )}

          {section === 'importacao' && (
            <Card
              title="Importação em lote"
              description="Baixe o modelo, preencha e importe a planilha."
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {importCard('clients')}
                {importCard('agents')}
              </div>
            </Card>
          )}

          {section === 'sistema' && (
            <>
              <SystemHealthPanel />
              <Card
                title="Backup dos dados"
                description="Os dados ficam no Supabase, que faz cópias de segurança automáticas do banco."
              >
                <a
                  href={SUPABASE_PROJECT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  <Database className="w-4 h-4" />
                  Abrir painel do Supabase
                </a>
                <p className="mt-2 text-xs text-stone-400">
                  As cópias e a restauração ficam em Database → Backups, no painel.
                </p>
              </Card>
            </>
          )}

          {saveBar}
        </div>
      </div>
    </div>
  );
}
