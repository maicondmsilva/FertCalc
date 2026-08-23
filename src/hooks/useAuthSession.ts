import { useCallback, useEffect, useState } from 'react';
import type { User } from '../types';
import { restoreSession, signOut } from '../services/authService';

export const isSupabaseLogoutEvent = (
  event: Pick<StorageEvent, 'key' | 'newValue'>
): boolean => {
  const isAuthKey =
    event.key?.includes('supabase') ||
    (event.key?.startsWith('sb-') && event.key.endsWith('-auth-token'));
  return Boolean(isAuthKey && !event.newValue);
};

export function useAuthSession(onNavigateHome: () => void) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    restoreSession().then((user) => {
      if (active && user) setCurrentUser(user);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const synchronizeLogout = (event: StorageEvent) => {
      if (isSupabaseLogoutEvent(event)) {
        setCurrentUser(null);
        onNavigateHome();
      }
    };
    window.addEventListener('storage', synchronizeLogout);
    return () => window.removeEventListener('storage', synchronizeLogout);
  }, [currentUser, onNavigateHome]);

  const login = useCallback(
    (user: User) => {
      setCurrentUser(user);
      onNavigateHome();
    },
    [onNavigateHome]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    void signOut();
    onNavigateHome();
  }, [onNavigateHome]);

  return {
    currentUser,
    login,
    logout,
    updateCurrentUser: setCurrentUser,
  };
}
