'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, Check, Dices, ShieldCheck, Swords, Sparkles, 
  Flame, Crown, Wallet, Target, Users, Zap, Bike, Clock 
} from 'lucide-react';
import { MEAL_SESSIONS, MealSession } from '@/lib/time-mechanics';
import { PLACE_KEO_LIST, PlaceKeoType } from '@/lib/places-xuanhoa';

export function renderCaseTierIcon(tier: 'all' | number, size = 15) {
  switch (tier) {
    case 'all': return <Dices size={size} />;
    case 0: return <ShieldCheck size={size} />;
    case 1: return <Swords size={size} />;
    case 2: return <Sparkles size={size} />;
    case 3: return <Flame size={size} />;
    case 4: return <Crown size={size} />;
    default: return <Dices size={size} />;
  }
}

export function renderPlaceKeoIcon(id: PlaceKeoType, size = 15) {
  switch (id) {
    case 'all': return <Target size={size} className="text-amber-400 shrink-0" />;
    case 'hen-ho': return <Users size={size} className="text-pink-400 shrink-0" />;
    case 'an-nhanh': return <Zap size={size} className="text-amber-400 shrink-0" />;
    case 'nhom-dong': return <Flame size={size} className="text-orange-400 shrink-0" />;
    case 'ship': return <Bike size={size} className="text-sky-400 shrink-0" />;
    default: return <Target size={size} className="text-amber-400 shrink-0" />;
  }
}

export const CASE_TIER_CONFIG = [
  {
    tier: 'all' as const,
    name: 'Hòm Tự Do',
    range: 'Tất cả món',
    color: '#D4AF37',
    gemColor: '#F5C542',
    icon: 'all',
  },
  {
    tier: 0,
    name: 'Hòm Phổ Thông',
    range: '≤25k',
    color: '#10B981',
    gemColor: '#34D399',
    icon: 0,
  },
  {
    tier: 1,
    name: 'Hòm Đặc Biệt',
    range: '26k - 45k',
    color: '#F59E0B',
    gemColor: '#FBBF24',
    icon: 1,
  },
  {
    tier: 2,
    name: 'Hòm Quý Hiếm',
    range: '46k - 70k',
    color: '#A855F7',
    gemColor: '#C084FC',
    icon: 2,
  },
  {
    tier: 3,
    name: 'Hòm Cực Hiếm',
    range: '71k - 100k',
    color: '#F97316',
    gemColor: '#FB923C',
    icon: 3,
  },
  {
    tier: 4,
    name: 'Hòm Huyền Thoại',
    range: '>100k',
    color: '#EF4444',
    gemColor: '#F87171',
    icon: 4,
  },
];

interface CaseTierDropdownProps {
  value: 'all' | number;
  onChange: (value: 'all' | number) => void;
  totalCount: number;
  tierCounts?: Record<number, number>;
  disabled?: boolean;
}

export function CaseTierDropdown({
  value,
  onChange,
  totalCount,
  tierCounts = {},
  disabled = false,
}: CaseTierDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = CASE_TIER_CONFIG.find(c => c.tier === value) || CASE_TIER_CONFIG[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        className="luxury-tier-trigger"
        style={{
          ['--tier-active-color' as any]: currentOption.color,
        }}
      >
        <span
          className="luxury-gem-dot"
          style={{
            backgroundColor: currentOption.gemColor,
            boxShadow: `0 0 10px ${currentOption.gemColor}`,
          }}
        />
        <span className="luxury-trigger-label">
          {currentOption.tier === 'all'
            ? `Hòm Tự Do (${totalCount} món)`
            : `${currentOption.name} (${currentOption.range})`}
        </span>
        <ChevronDown
          size={14}
          className={`luxury-chevron transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-400' : 'text-slate-400'}`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div className="luxury-tier-menu">
          <div className="luxury-tier-menu-header">
            <span>CHỌN CẤP ĐỘ HÒM THƯỞNG</span>
          </div>

          <div className="luxury-tier-menu-list">
            {CASE_TIER_CONFIG.map(option => {
              const isSelected = option.tier === value;
              const count = option.tier === 'all' ? totalCount : (tierCounts[option.tier] ?? 0);

              return (
                <button
                  key={String(option.tier)}
                  type="button"
                  onClick={() => {
                    onChange(option.tier);
                    setIsOpen(false);
                  }}
                  className={`luxury-tier-item ${isSelected ? 'selected' : ''}`}
                  style={{
                    ['--opt-color' as any]: option.color,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="luxury-menu-gem"
                      style={{
                        backgroundColor: option.gemColor,
                        boxShadow: `0 0 8px ${option.gemColor}`,
                      }}
                    />
                    <div className="flex flex-col text-left">
                      <span className="luxury-opt-name" style={{ color: isSelected ? '#FFE699' : '#F1F5F9' }}>
                        {option.name}
                      </span>
                      <span className="luxury-opt-range">
                        {option.range}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="luxury-opt-count">
                      {count} món
                    </span>
                    {isSelected && (
                      <Check size={14} className="text-amber-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const BUDGET_CONFIG = [
  { value: 'all', label: 'Tất cả mức giá' },
  { value: '35', label: '≤ 35.000đ (Bình dân)' },
  { value: '50', label: '≤ 50.000đ (Tiêu chuẩn)' },
  { value: '75', label: '≤ 75.000đ (Khá)' },
  { value: '100', label: '≤ 100.000đ (Lẩu/Nhậu)' },
  { value: '150', label: '≥ 150.000đ (Đặc sản)' },
  { value: 'custom', label: 'Tự nhập giá...' },
];

interface BudgetDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function BudgetDropdown({
  value,
  onChange,
  disabled = false,
}: BudgetDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = BUDGET_CONFIG.find(b => b.value === value) || BUDGET_CONFIG[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        className="luxury-budget-trigger"
        title="Lọc theo mức chi tiêu dự kiến"
      >
        <Wallet size={14} className="text-amber-400 shrink-0" />
        <span>{value === 'all' ? 'Mức giá: Tất cả' : currentOption.label}</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-400' : 'text-slate-400'}`}
        />
      </button>

      {isOpen && (
        <div className="luxury-budget-menu">
          <div className="luxury-filter-menu-header">
            <span>CHỌN MỨC NGÂN SÁCH</span>
          </div>
          <div className="luxury-budget-menu-list">
            {BUDGET_CONFIG.map(option => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`luxury-budget-item ${isSelected ? 'selected' : ''}`}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check size={14} className="text-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface SessionDropdownProps {
  value: MealSession | 'all';
  onChange: (value: MealSession | 'all') => void;
  liveSession?: MealSession;
  disabled?: boolean;
}

export function SessionDropdown({
  value,
  onChange,
  liveSession,
  disabled = false,
}: SessionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentSession = MEAL_SESSIONS.find(s => s.id === value);
  const isCurrentLive = currentSession && currentSession.id === liveSession;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        className="luxury-filter-trigger"
        title="Chọn khung giờ phục vụ"
      >
        <Clock size={14} className="text-amber-400 shrink-0" />
        {isCurrentLive && <span className="live-gem-indicator" />}
        <span className="luxury-trigger-label">
          {value === 'all'
            ? 'Khung giờ: Cả ngày'
            : `Khung giờ: ${currentSession ? currentSession.label.replace('Buổi ', '') : 'Tự động'}`}
        </span>
        <ChevronDown
          size={14}
          className={`luxury-chevron transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-400' : 'text-slate-400'}`}
        />
      </button>

      {isOpen && (
        <div className="luxury-filter-menu luxury-session-menu">
          <div className="luxury-filter-menu-header">
            <span>KHUNG GIỜ PHỤC VỤ</span>
          </div>

          <div className="luxury-filter-menu-list">
            {MEAL_SESSIONS.map(s => {
              const isSelected = s.id === value;
              const isLive = s.id === liveSession;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onChange(s.id);
                    setIsOpen(false);
                  }}
                  className={`luxury-filter-item ${isSelected ? 'selected' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    {isLive && <span className="live-gem-indicator" />}
                    <span className="font-semibold text-slate-200">{s.label}</span>
                    {isLive && (
                      <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40">
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">{s.timeRange}</span>
                    {isSelected && <Check size={14} className="text-amber-400" />}
                  </div>
                </button>
              );
            })}

            <div className="luxury-menu-divider" />

            <button
              type="button"
              onClick={() => {
                onChange('all');
                setIsOpen(false);
              }}
              className={`luxury-filter-item ${value === 'all' ? 'selected' : ''}`}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400 shrink-0" />
                <span className="font-semibold text-slate-200">Cả ngày</span>
                <span className="text-[11px] text-slate-400">(Tất cả quán/món)</span>
              </div>
              {value === 'all' && <Check size={14} className="text-amber-400" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PlaceKeoDropdownProps {
  value: PlaceKeoType;
  onChange: (value: PlaceKeoType) => void;
  disabled?: boolean;
}

export function PlaceKeoDropdown({
  value,
  onChange,
  disabled = false,
}: PlaceKeoDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentKeo = PLACE_KEO_LIST.find(k => k.id === value) || PLACE_KEO_LIST[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        className="luxury-filter-trigger"
        title="Chọn kèo đi ăn tại Xuân Hòa"
      >
        {renderPlaceKeoIcon(currentKeo.id, 14)}
        <span className="luxury-trigger-label">
          Kèo: {currentKeo.label}
        </span>
        <ChevronDown
          size={14}
          className={`luxury-chevron transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-400' : 'text-slate-400'}`}
        />
      </button>

      {isOpen && (
        <div className="luxury-filter-menu luxury-keo-menu">
          <div className="luxury-filter-menu-header">
            <span>KÈO ĐI ĂN TẠI XUÂN HÒA</span>
          </div>

          <div className="luxury-filter-menu-list">
            {PLACE_KEO_LIST.map(k => {
              const isSelected = k.id === value;

              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    onChange(k.id);
                    setIsOpen(false);
                  }}
                  className={`luxury-filter-item ${isSelected ? 'selected' : ''}`}
                >
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-2">
                      {renderPlaceKeoIcon(k.id, 14)}
                      <span className="font-semibold text-slate-200">{k.label}</span>
                    </div>
                    {k.desc && (
                      <span className="text-[10.5px] text-slate-400 mt-0.5 ml-5">{k.desc}</span>
                    )}
                  </div>
                  {isSelected && <Check size={14} className="text-amber-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
