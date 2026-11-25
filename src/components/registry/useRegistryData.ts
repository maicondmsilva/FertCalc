import { useCallback, useEffect, useState } from 'react';

/** Carrega a lista do cadastro com estado de carga e erro; ignora respostas antigas. */
export function useRegistryData<T>(load: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    load()
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar a lista. Verifique a conexão.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { items, loading, error, reload };
}

/** Mensagem do banco em linguagem do usuário. */
export function registrySaveError(error: unknown, kind: string): string {
  const raw = String((error as { message?: string; code?: string })?.message || '');
  const code = (error as { code?: string })?.code;
  if (code === '42501' || /row-level security|permission/i.test(raw))
    return `Seu usuário não tem permissão para alterar ${kind}.`;
  if (code === '23505') return 'Já existe um cadastro com esse código. Tente de novo.';
  return `Não foi possível salvar o ${kind}. Tente novamente.`;
}
