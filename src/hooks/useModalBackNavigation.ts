import { useEffect, useRef } from 'react';

const MODAL_HISTORY_KEY = '__fertcalcModal';

export function useModalBackNavigation(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let closedByNavigation = false;
    window.history.pushState({ ...window.history.state, [MODAL_HISTORY_KEY]: token }, '');

    const handlePopState = (event: Event) => {
      const state = (event as Event & { state?: Record<string, unknown> }).state;
      if (state?.[MODAL_HISTORY_KEY] === token) return;
      closedByNavigation = true;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!closedByNavigation && window.history.state?.[MODAL_HISTORY_KEY] === token) {
        window.history.back();
      }
    };
  }, [isOpen]);
}
