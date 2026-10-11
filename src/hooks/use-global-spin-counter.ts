import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'xuanhoa_global_spins';
export const BASE_SPIN_COUNT = 688;

function getStoredCount(): number {
  if (typeof window === 'undefined') return BASE_SPIN_COUNT;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, BASE_SPIN_COUNT.toString());
      return BASE_SPIN_COUNT;
    }
    const parsed = parseInt(stored, 10);
    if (isNaN(parsed) || parsed < BASE_SPIN_COUNT) {
      localStorage.setItem(STORAGE_KEY, BASE_SPIN_COUNT.toString());
      return BASE_SPIN_COUNT;
    }
    return parsed;
  } catch {
    return BASE_SPIN_COUNT;
  }
}

export function useGlobalSpinCounter() {
  const [count, setCount] = useState<number>(BASE_SPIN_COUNT);

  useEffect(() => {
    setCount(getStoredCount());

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const val = parseInt(e.newValue, 10);
        if (!isNaN(val)) setCount(val);
      }
    };

    const handleCustomIncrement = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (customEvent.detail) {
        setCount(customEvent.detail);
      } else {
        setCount(getStoredCount());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('xuanhoa_spin_increment', handleCustomIncrement);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('xuanhoa_spin_increment', handleCustomIncrement);
    };
  }, []);

  const increment = useCallback(() => {
    const current = getStoredCount();
    const next = current + 1;
    try {
      localStorage.setItem(STORAGE_KEY, next.toString());
    } catch {
      // Fallback
    }
    setCount(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('xuanhoa_spin_increment', { detail: next }));
    }
    return next;
  }, []);

  return { count, increment };
}
