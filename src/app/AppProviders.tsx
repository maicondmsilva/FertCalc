import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';

interface AppProvidersProps {
  children: ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <ToastProvider>
      <BrowserRouter>{children}</BrowserRouter>
    </ToastProvider>
  );
}
