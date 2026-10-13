'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface GlobalSpinCounterProps {
  count: number;
  isSpinning?: boolean;
  compact?: boolean;
  variant?: 'header' | 'banner' | 'compact';
}

export const GlobalSpinCounter: React.FC<GlobalSpinCounterProps> = ({ 
  count, 
  isSpinning, 
  compact = false,
  variant = 'banner'
}) => {
  const [displayCount, setDisplayCount] = useState(count);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (count !== displayCount) {
      setHighlight(true);
      const timer = setTimeout(() => {
        setDisplayCount(count);
        setHighlight(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [count, displayCount]);

  // Format count into standard thousand-separated string (e.g. 4.230)
  const formattedCount = displayCount.toLocaleString('vi-VN');

  // 1. Dạng Header trên thanh trên cùng (Gọn nhất, sang trọng, số chuẩn 100%, không tốn diện tích)
  if (variant === 'header') {
    return (
      <div 
        className={`header-spin-counter inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full 
          bg-slate-900/90 backdrop-blur-md border border-amber-500/35 shadow-md shadow-black/40
          transition-all duration-300 select-none ${highlight ? 'border-amber-400 scale-[1.04] shadow-amber-500/25 ring-1 ring-amber-400/30' : 'hover:border-amber-400/60'}`}
        title="Tổng số lượt quay toàn hệ thống (Realtime Firebase)"
      >
        <span className="text-[10.5px] sm:text-[11.5px] font-bold uppercase tracking-wider text-amber-200/90">
          Tổng lượt quay:
        </span>

        {/* Ô số kỹ thuật số sắc nét, rõ ràng 100% */}
        <div className="flex items-center gap-[2px] font-mono">
          {formattedCount.split('').map((char, idx) => (
            char === '.' || char === ',' ? (
              <span key={idx} className="text-amber-400 font-bold px-0.5 text-xs">
                {char}
              </span>
            ) : (
              <span
                key={idx}
                className="inline-flex items-center justify-center min-w-[17px] sm:min-w-[18px] h-5 sm:h-5.5 px-0.5
                  rounded bg-amber-400/15 border border-amber-500/40 text-amber-300 font-extrabold text-xs
                  shadow-inner transition-transform"
              >
                {char}
              </span>
            )
          ))}
        </div>
      </div>
    );
  }

  // 2. Dạng Compact (cho mobile deck)
  if (compact || variant === 'compact') {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full 
          bg-slate-900/90 backdrop-blur-md border border-amber-500/30 shadow-md shadow-black/40
          transition-all duration-300 ${highlight ? 'border-amber-400 scale-[1.03] shadow-amber-500/20' : ''}`}
        title="Tổng lượt mở hòm đã thực hiện"
      >
        <Sparkles size={11} className={isSpinning ? 'animate-spin text-amber-300' : 'animate-pulse text-amber-400'} />
        <span className="text-[10px] font-bold uppercase text-amber-200/80">Mở hòm:</span>
        <span className="font-mono text-xs font-bold text-amber-300 tracking-tight">{formattedCount}</span>
        <span className="text-[9.5px] font-semibold text-slate-400 uppercase">lượt</span>
      </div>
    );
  }

  // 3. Dạng Banner (nếu dùng độc lập)
  return (
    <div className="global-counter-banner flex items-center justify-center my-2 sm:my-3 px-2">
      <div 
        className={`inline-flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full 
          bg-slate-900/90 backdrop-blur-md border border-amber-500/30 shadow-lg shadow-black/50
          transition-all duration-300 ${highlight ? 'border-amber-400 scale-[1.03] shadow-amber-500/20' : 'hover:border-amber-500/50'}`}
        title="Tổng số lượt mở hòm chọn món đã thực hiện kể từ thời điểm khai mở"
      >
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 shrink-0">
          <Sparkles size={12} className={isSpinning ? 'animate-spin text-amber-300' : 'animate-pulse text-amber-400'} />
        </div>

        <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-200/85 select-none">
          Mở Hòm:
        </span>

        <div className="flex items-center gap-0.5 font-mono">
          {formattedCount.split('').map((char, idx) => (
            char === '.' || char === ',' ? (
              <span key={idx} className="text-amber-400/60 font-bold px-0.5 text-xs sm:text-sm">
                {char}
              </span>
            ) : (
              <span
                key={idx}
                className="inline-flex items-center justify-center min-w-[18px] sm:min-w-[21px] h-6 sm:h-6.5 px-1 
                  rounded bg-amber-400/10 border border-amber-500/35 text-amber-300 font-extrabold text-xs sm:text-sm
                  shadow-inner select-none transition-transform"
              >
                {char}
              </span>
            )
          ))}
        </div>

        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-tight select-none">
          Lượt
        </span>
      </div>
    </div>
  );
};
