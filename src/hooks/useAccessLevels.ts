import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessLevel } from '../types';
import { getAccessLevels } from '../services/accessLevelService';

export function useAccessLevels() {
  const [levels, setLevels] = useState<AccessLevel[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAccessLevels();
      setLevels(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byCode = useMemo(() => {
    const map = new Map<string, AccessLevel>();
    for (const level of levels) map.set(level.code, level);
    return map;
  }, [levels]);

  return { levels, byCode, loading, reload: load };
}
