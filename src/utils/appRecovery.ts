const RECOVERY_ATTEMPT_KEY = 'fertcalc:version-recovery-attempted';

export async function recoverLatestApplicationVersion(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.update()));
  }

  if ('caches' in window) {
    const names = await window.caches.keys();
    await Promise.all(
      names.filter((name) => name.startsWith('fertcalc-')).map((name) => window.caches.delete(name))
    );
  }

  window.location.reload();
}

export function recoverOnceFromStaleDeployment(): void {
  if (window.sessionStorage.getItem(RECOVERY_ATTEMPT_KEY) === 'true') return;
  window.sessionStorage.setItem(RECOVERY_ATTEMPT_KEY, 'true');
  void recoverLatestApplicationVersion();
}

export function clearVersionRecoveryMarker(): void {
  window.sessionStorage.removeItem(RECOVERY_ATTEMPT_KEY);
}
