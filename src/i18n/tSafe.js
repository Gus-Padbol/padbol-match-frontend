import { useCallback } from 'react';

export function useSafeTranslation() {
  const t = useCallback((key, fallback = '') => {
    if (typeof fallback === 'string' && fallback.length > 0) return fallback;
    return String(key);
  }, []);

  return { t };
}
