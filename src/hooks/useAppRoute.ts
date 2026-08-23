import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getActiveModule } from '../navigation/appNavigation';

export function getAppRoute(pathname: string, search: string) {
  const activeTab = pathname.split('/').filter(Boolean)[0] ?? '';
  const searchParams = new URLSearchParams(search);

  return {
    activeTab,
    activeModule: getActiveModule(activeTab),
    isPasswordReset: pathname === '/reset-password',
    isStandalone: searchParams.get('standalone') === 'true',
  };
}

export function useAppRoute() {
  const { pathname, search } = useLocation();

  return useMemo(() => getAppRoute(pathname, search), [pathname, search]);
}
