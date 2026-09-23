import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { APP_VARIANT, isPricingApp, type AppVariant } from '../config/appVariant';
import { getActiveModule } from '../navigation/appNavigation';

export function getAppRoute(pathname: string, search: string, variant: AppVariant = APP_VARIANT) {
  const requestedTab = pathname.split('/').filter(Boolean)[0] ?? '';
  const searchParams = new URLSearchParams(search);
  const isPasswordReset = pathname === '/reset-password';
  const requestedModule = getActiveModule(requestedTab);
  const restrictToPricing = isPricingApp(variant) && !isPasswordReset;
  const activeTab =
    restrictToPricing && requestedModule !== 'pricing' ? 'calculator' : requestedTab;

  return {
    activeTab,
    activeModule: getActiveModule(activeTab),
    isPasswordReset,
    isStandalone: searchParams.get('standalone') === 'true',
  };
}

export function useAppRoute() {
  const { pathname, search } = useLocation();

  return useMemo(() => getAppRoute(pathname, search), [pathname, search]);
}
