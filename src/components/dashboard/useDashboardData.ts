import { useCallback, useEffect, useState } from 'react';
import type { Branch, Goal, PricingRecord, User } from '../../types';
import { scopePricingsForUser } from '../../utils/pricingDashboard';

export interface DashboardData {
  pricings: PricingRecord[];
  goals: Goal[];
  branches: Branch[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Carrega precificações, metas e filiais do painel; ignora respostas antigas. */
export function useDashboardData(currentUser: User): DashboardData {
  const [pricings, setPricings] = useState<PricingRecord[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [{ getDashboardPricings }, { getGoals, getBranches }] = await Promise.all([
          import('../../services/dashboardService'),
          import('../../services/db'),
        ]);
        const [records, userGoals, availableBranches] = await Promise.all([
          getDashboardPricings(),
          getGoals(currentUser.id),
          getBranches(),
        ]);
        if (!active) return;
        setPricings(scopePricingsForUser(records, currentUser));
        setGoals(userGoals);
        setBranches(availableBranches);
      } catch {
        if (active)
          setError('Não foi possível carregar o painel. Verifique a conexão e tente de novo.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUser, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { pricings, goals, branches, loading, error, reload };
}
