import { useState, useEffect, useCallback } from 'react';
import { getRealtimeDb, ref, onValue, runTransaction, BASE_SPIN_COUNT } from '@/lib/firebase';

const STORAGE_KEY = 'xuanhoa_global_spins_v2';
export { BASE_SPIN_COUNT };

function getStoredCount(): number {
  if (typeof window === 'undefined') return BASE_SPIN_COUNT;
  try {
    const storedStr = localStorage.getItem(STORAGE_KEY);
    const stored = storedStr ? parseInt(storedStr, 10) : 0;
    return Math.max(isNaN(stored) ? 0 : stored, BASE_SPIN_COUNT);
  } catch {
    return BASE_SPIN_COUNT;
  }
}

export function useGlobalSpinCounter() {
  const [count, setCount] = useState<number>(() => getStoredCount());

  useEffect(() => {
    const db = getRealtimeDb();

    // 1. Nếu đã kết nối Firebase Realtime Database: Lắng nghe số thật 100%
    if (db) {
      const counterRef = ref(db, 'globalSpinCount');
      const unsubscribe = onValue(counterRef, (snapshot) => {
        const val = snapshot.val();
        if (typeof val === 'number' && val >= BASE_SPIN_COUNT) {
          setCount(val);
          try {
            localStorage.setItem(STORAGE_KEY, val.toString());
          } catch {}
        } else if (val === null || val < BASE_SPIN_COUNT) {
          // Khởi tạo giá trị ban đầu nếu trên Firebase chưa có
          runTransaction(counterRef, (current) => {
            if (current === null || current < BASE_SPIN_COUNT) {
              return BASE_SPIN_COUNT;
            }
            return current;
          });
        }
      }, (error) => {
        console.warn('Lỗi đọc Firebase Realtime Database:', error);
      });

      return () => {
        unsubscribe();
      };
    }

    // 2. Chế độ đồng bộ giữa các Tab trên cùng máy khi chưa có Firebase DB
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const val = parseInt(e.newValue, 10);
        if (!isNaN(val)) setCount(prev => Math.max(prev, val));
      }
    };

    const handleCustomIncrement = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (customEvent.detail) {
        setCount(prev => Math.max(prev, customEvent.detail));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('xuanhoa_spin_increment', handleCustomIncrement);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('xuanhoa_spin_increment', handleCustomIncrement);
    };
  }, []);

  // 3. Hàm bấm quay -> Tăng +1 LƯỢT THẬT (Atomic trên Firebase hoặc Local)
  const increment = useCallback(() => {
    const db = getRealtimeDb();

    if (db) {
      // Cập nhật phản hồi nhanh ngay lập tức trên UI (Optimistic update)
      setCount(prev => Math.max(prev, BASE_SPIN_COUNT) + 1);

      // Ghi nhận trực tiếp lên Firebase Realtime Database (Atomic Transaction)
      const counterRef = ref(db, 'globalSpinCount');
      runTransaction(counterRef, (current) => {
        const next = (typeof current === 'number' && current >= BASE_SPIN_COUNT) ? current + 1 : BASE_SPIN_COUNT + 1;
        return next;
      }).then((result) => {
        if (result.committed) {
          const snapshotVal = result.snapshot.val();
          if (typeof snapshotVal === 'number') {
            setCount(snapshotVal);
            try {
              localStorage.setItem(STORAGE_KEY, snapshotVal.toString());
            } catch {}
          }
        }
      }).catch((err) => {
        console.warn('Lỗi ghi lượt quay lên Firebase:', err);
      });
    } else {
      // Tăng lượt thật cục bộ
      setCount(prev => {
        const next = Math.max(prev, BASE_SPIN_COUNT) + 1;
        try {
          localStorage.setItem(STORAGE_KEY, next.toString());
        } catch {}
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('xuanhoa_spin_increment', { detail: next }));
        }
        return next;
      });
    }
  }, []);

  return { count, increment };
}
