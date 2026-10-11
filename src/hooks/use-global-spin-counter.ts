import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'xuanhoa_global_spins_v1';
export const BASE_SPIN_COUNT = 688;

// Mốc thời gian khai mở chính thức: 09:09:09 Chủ Nhật 11.10.2026
const LAUNCH_TIMESTAMP = new Date('2026-10-11T09:09:09+07:00').getTime();

/**
 * Thuật toán tính toán lượt mở hòm tự nhiên theo thời gian thực (Deterministic Organic Growth)
 * Đảm bảo mọi thiết bị truy cập cùng thời điểm đều thấy con số đồng nhất và logic.
 */
function calculateDeterministicSpins(now: number): number {
  if (now < LAUNCH_TIMESTAMP) return BASE_SPIN_COUNT;

  const elapsedSeconds = Math.max(0, Math.floor((now - LAUNCH_TIMESTAMP) / 1000));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  let accumulated = 0;
  const totalHours = elapsedSeconds / 3600;
  
  if (totalHours < 24) {
    const d = new Date(now);
    const h = d.getHours();
    
    // Tốc độ bình quân ~ 0.9 lượt / phút trong ngày đầu
    accumulated = Math.floor(elapsedMinutes * 0.9);
    
    // Khung giờ cao điểm sinh viên đi ăn (11h-13h trưa & 18h-20h tối) cộng dồn thêm nhịp sôi động
    if (h >= 11 && h <= 13) {
      accumulated += Math.floor((h - 11) * 30 + d.getMinutes() * 0.7);
    } else if (h >= 18 && h <= 20) {
      accumulated += Math.floor((h - 18) * 35 + d.getMinutes() * 0.8);
    }
  } else {
    // Các ngày tiếp theo: tích lũy tự nhiên đều đặn
    const days = Math.floor(totalHours / 24);
    const remHours = totalHours % 24;
    accumulated = days * 650 + Math.floor(remHours * 28);
  }

  return BASE_SPIN_COUNT + Math.max(0, accumulated);
}

function getStoredOrCalculatedCount(): number {
  if (typeof window === 'undefined') return BASE_SPIN_COUNT;
  const now = Date.now();
  const calculated = calculateDeterministicSpins(now);

  try {
    const storedStr = localStorage.getItem(STORAGE_KEY);
    const stored = storedStr ? parseInt(storedStr, 10) : 0;
    const finalCount = Math.max(calculated, isNaN(stored) ? 0 : stored, BASE_SPIN_COUNT);
    localStorage.setItem(STORAGE_KEY, finalCount.toString());
    return finalCount;
  } catch {
    return Math.max(calculated, BASE_SPIN_COUNT);
  }
}

export function useGlobalSpinCounter() {
  const [count, setCount] = useState<number>(() => getStoredOrCalculatedCount());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Khởi tạo con số ban đầu
    setCount(getStoredOrCalculatedCount());

    // 2. Lắng nghe đồng bộ giữa các Tab trên cùng trình duyệt
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

    // 3. THUẬT TOÁN NHỊP SỐNG XUÂN HÒA (Ambient Organic Pulse)
    // Khi đang xem web, cứ mỗi 30s - 65s tự động có thêm người mở hòm quanh khu vực
    const scheduleNextOrganicPulse = () => {
      const now = new Date();
      const hour = now.getHours();
      const isPeakHours = (hour >= 11 && hour <= 13) || (hour >= 18 && hour <= 20);

      const delay = isPeakHours
        ? Math.floor(Math.random() * 20000) + 25000 
        : Math.floor(Math.random() * 35000) + 38000;

      timerRef.current = setTimeout(() => {
        setCount(prev => {
          const next = prev + 1;
          try {
            localStorage.setItem(STORAGE_KEY, next.toString());
          } catch {}
          return next;
        });
        scheduleNextOrganicPulse();
      }, delay);
    };

    scheduleNextOrganicPulse();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('xuanhoa_spin_increment', handleCustomIncrement);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 4. Khi người dùng tự bấm mở hòm -> Tăng +1 ngay lập tức
  const increment = useCallback(() => {
    setCount(prev => {
      const next = prev + 1;
      try {
        localStorage.setItem(STORAGE_KEY, next.toString());
      } catch {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('xuanhoa_spin_increment', { detail: next }));
      }
      return next;
    });
  }, []);

  return { count, increment };
}
