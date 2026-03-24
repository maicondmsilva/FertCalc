import { useState, useCallback } from 'react';

export function useCalculatorSettings() {
  const [settingsStatus, setSettingsStatus] = useState<{isOpen: boolean, formulaId: string | null}>({ isOpen: false, formulaId: null });

  const openSettings = useCallback((formulaId: string) => setSettingsStatus({ isOpen: true, formulaId }), []);
  const closeSettings = useCallback(() => setSettingsStatus({ isOpen: false, formulaId: null }), []);

  return {
    isSettingsOpen: settingsStatus.isOpen,
    activeFormulaId: settingsStatus.formulaId,
    openSettings,
    closeSettings,
  };
}
