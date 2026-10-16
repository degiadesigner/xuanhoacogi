'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Radio } from 'lucide-react';

interface GlobalSpinCounterProps {
  count: number;
  isSpinning?: boolean;
  compact?: boolean;
  variant?: 'sub-mode' | 'header' | 'banner' | 'compact';
}

export const GlobalSpinCounter: React.FC<GlobalSpinCounterProps> = ({ 
  count, 
  isSpinning, 
  compact = false,
  variant = 'sub-mode'
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

  // Format count into standard thousand-separated string (e.g. 4.969)
  const formattedCount = displayCount.toLocaleString('vi-VN');

  // 1. Dạng Ticker Tinh Tế Đẳng Cấp Đặt Dưới Hàng Chọn Món & Quán (Đã đơn giản hóa, cực kỳ sang trọng & không chướng mắt)
  if (variant === 'sub-mode' || variant === 'header') {
    return (
      <div className="sub-mode-counter-wrapper">
        <div 
          className={`sub-mode-counter-pill ${highlight ? 'highlight' : ''}`}
          title="Dữ liệu số lượt quay mở hòm thời gian thực được đồng bộ qua Firebase Realtime Database"
        >
          <div className="counter-pulse-wrapper" aria-hidden="true">
            <span className="counter-pulse-dot" />
            <span className="counter-pulse-ring" />
          </div>
          <span className="counter-label">Đã mở:</span>
          <strong className="counter-number-val">{formattedCount}</strong>
          <span className="counter-unit-text">lượt quay</span>
        </div>
      </div>
    );
  }

  // 2. Dạng Compact
  if (compact || variant === 'compact') {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full 
          bg-slate-900/90 backdrop-blur-md border border-amber-500/30 shadow-md shadow-black/40
          transition-all duration-300 ${highlight ? 'border-amber-400 scale-[1.03] shadow-amber-500/20' : ''}`}
        title="Tổng lượt mở hòm đã thực hiện"
      >
        <Sparkles size={11} className={isSpinning ? 'animate-spin text-amber-300' : 'animate-pulse text-amber-400'} />
        <span className="text-[10px] font-bold uppercase text-amber-200/80">Đã mở:</span>
        <span className="font-mono text-xs font-bold text-amber-300 tracking-tight">{formattedCount}</span>
        <span className="text-[9.5px] font-semibold text-slate-400 uppercase">lượt</span>
      </div>
    );
  }

  // 3. Dạng Banner (Fallback)
  return (
    <div className="global-counter-banner flex items-center justify-center my-2 sm:my-3 px-2">
      <div 
        className={`inline-flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full 
          bg-slate-900/90 backdrop-blur-md border border-amber-500/30 shadow-lg shadow-black/50
          transition-all duration-300 ${highlight ? 'border-amber-400 scale-[1.03] shadow-amber-500/20' : 'hover:border-amber-500/50'}`}
        title="Tổng số lượt quay mở hòm toàn hệ thống"
      >
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 shrink-0">
          <Sparkles size={12} className={isSpinning ? 'animate-spin text-amber-300' : 'animate-pulse text-amber-400'} />
        </div>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold">
          <span className="text-slate-300">Đã mở:</span>
          <span className="font-mono font-bold text-amber-400 text-sm sm:text-base tracking-wider">{formattedCount}</span>
          <span className="text-slate-400 text-xs">lượt quay</span>
        </div>
      </div>
    </div>
  );
};
