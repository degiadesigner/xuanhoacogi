'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface GlobalSpinCounterProps {
  count: number;
  isSpinning?: boolean;
}

export const GlobalSpinCounter: React.FC<GlobalSpinCounterProps> = ({ count, isSpinning }) => {
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

  // Format count into standard thousand-separated string (e.g. 688, 1.250)
  const formattedCount = displayCount.toLocaleString('vi-VN');

  return (
    <div className="global-counter-banner flex items-center justify-center my-2 sm:my-3 px-2">
      <div 
        className={`inline-flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full 
          bg-slate-900/90 backdrop-blur-md border border-amber-500/30 shadow-lg shadow-black/50
          transition-all duration-300 ${highlight ? 'border-amber-400 scale-[1.03] shadow-amber-500/20' : 'hover:border-amber-500/50'}`}
        title="Tổng số lượt mở hòm chọn món đã thực hiện kể từ thời điểm khai mở"
      >
        {/* Subtle glowing sparkles */}
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 shrink-0">
          <Sparkles size={12} className={isSpinning ? 'animate-spin text-amber-300' : 'animate-pulse text-amber-400'} />
        </div>

        {/* Title */}
        <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-200/85 select-none">
          Tổng Lượt Mở Hòm:
        </span>

        {/* Crisp, professional digit cells */}
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
