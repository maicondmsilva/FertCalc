import { useEffect, useState } from 'react';
import type { ActiveModule } from '../navigation/appNavigation';
import type { AppSettings } from '../types';
import { getAppSettings } from '../services/db';
import { APP_SETTINGS_UPDATED_EVENT } from '../utils/appSettingsEvents';
import { getCheckedCount, getPendingCount } from '../services/expenseService';

const DEFAULT_APP_SETTINGS: AppSettings = {
  companyName: 'FertCalc Pro',
  companyLogo: '',
};

export function useAppData(activeModule: ActiveModule, currentUserId?: string) {
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [pendingExpenseCount, setPendingExpenseCount] = useState(0);
  const [checkedExpenseCount, setCheckedExpenseCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      getAppSettings()
        .then((savedSettings) => {
          if (active && savedSettings) setAppSettings(savedSettings);
        })
        .catch(() => {
          // Mantém a identidade padrão quando a configuração remota não está disponível.
        });
    void load();
    // Depois de salvar a Personalização, logo e nome mudam sem recarregar a página.
    window.addEventListener(APP_SETTINGS_UPDATED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(APP_SETTINGS_UPDATED_EVENT, load);
    };
  }, []);

  useEffect(() => {
    if (activeModule !== 'expenses' || !currentUserId) return;
    let active = true;
    Promise.all([getPendingCount(), getCheckedCount()])
      .then(([pending, checked]) => {
        if (!active) return;
        setPendingExpenseCount(pending);
        setCheckedExpenseCount(checked);
      })
      .catch(() => {
        // Preserva as últimas contagens conhecidas se a consulta falhar.
      });
    return () => {
      active = false;
    };
  }, [activeModule, currentUserId]);

  return {
    appSettings,
    pendingExpenseCount,
    checkedExpenseCount,
  };
}
