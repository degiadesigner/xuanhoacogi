'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Layers, Search, Tag, X } from 'lucide-react';
import {
  MAP_CATEGORY_REGISTRY,
  MAP_PARENT_CATEGORIES,
  getSubcategoriesByParent,
  renderRegistryIcon,
  searchSubcategoriesByQuery,
  type MapParentCategoryId,
  type MapSubcategoryId,
  type MapSubcategoryMeta,
} from '@/lib/map/map-category-registry';

export interface CategoryPickerTheme {
  bgCard: string;
  bgElevated?: string;
  bgInput: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentBorder?: string;
}

const DEFAULT_THEME: CategoryPickerTheme = {
  bgCard: '#FFFFFF',
  bgElevated: '#F8FAFC',
  bgInput: '#FFFFFF',
  border: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  accent: '#059669',
  accentSoft: '#ECFDF5',
  accentBorder: '#A7F3D0',
};

export interface CategoryTaxonomyPickerProps {
  parentCategoryId: MapParentCategoryId;
  subcategoryId: MapSubcategoryId;
  onChange: (nextParent: MapParentCategoryId, nextSub: MapSubcategoryId) => void;
  theme?: Partial<CategoryPickerTheme>;
  compact?: boolean;
  testIdPrefix?: string;
  legacyParentSelectTestId?: string;
  legacySubSelectTestId?: string;
}

export const CategoryTaxonomyPicker: React.FC<CategoryTaxonomyPickerProps> = ({
  parentCategoryId,
  subcategoryId,
  onChange,
  theme: rawTheme,
  compact = false,
  testIdPrefix = 'category-picker',
  legacyParentSelectTestId,
  legacySubSelectTestId,
}) => {
  const theme: CategoryPickerTheme = { ...DEFAULT_THEME, ...(rawTheme || {}) };
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'parent' | 'sub'>('sub');
  const [browseParentId, setBrowseParentId] = useState<MapParentCategoryId>(parentCategoryId);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number; width: number; openUpward: boolean }>({
    top: 120,
    left: 120,
    width: 620,
    openUpward: false,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setBrowseParentId(parentCategoryId);
  }, [parentCategoryId]);

  const currentParentMeta = useMemo(
    () => MAP_PARENT_CATEGORIES.find(p => p.id === parentCategoryId) || MAP_PARENT_CATEGORIES[0],
    [parentCategoryId]
  );

  const currentSubMeta = useMemo(
    () =>
      MAP_CATEGORY_REGISTRY[subcategoryId] ||
      getSubcategoriesByParent(parentCategoryId)[0] ||
      Object.values(MAP_CATEGORY_REGISTRY)[0],
    [subcategoryId, parentCategoryId]
  );

  const visibleSubcategories: MapSubcategoryMeta[] = useMemo(() => {
    const q = searchQuery.trim();
    if (q) {
      return searchSubcategoriesByQuery(q);
    }
    return getSubcategoriesByParent(browseParentId);
  }, [searchQuery, browseParentId]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [searchQuery, browseParentId]);

  const updatePosition = () => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = vw < 768;
    setIsMobileViewport(mobile);
    if (mobile || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const desiredWidth = Math.min(640, Math.max(460, vw - 32));
    let left = rect.left;
    if (left + desiredWidth > vw - 16) {
      left = Math.max(16, vw - desiredWidth - 16);
    }
    const estimatedHeight = Math.min(410, vh - 28);
    const spaceBelow = vh - rect.bottom;
    const openUpward = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    const rawTop = openUpward ? rect.top - estimatedHeight - 6 : rect.bottom + 6;
    const top = Math.max(12, Math.min(vh - estimatedHeight - 12, rawTop));

    setPopoverRect({
      top,
      left,
      width: desiredWidth,
      openUpward,
    });
  };

  const handleOpenPicker = (focusTarget: 'parent' | 'sub') => {
    setActiveTab(focusTarget);
    setBrowseParentId(parentCategoryId);
    setSearchQuery('');
    updatePosition();
    setIsOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 30);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleResizeOrScroll = () => updatePosition();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      } else if (e.key === 'ArrowDown') {
        if (visibleSubcategories.length > 0) {
          e.preventDefault();
          setFocusedIndex(prev => (prev + 1) % visibleSubcategories.length);
        }
      } else if (e.key === 'ArrowUp') {
        if (visibleSubcategories.length > 0) {
          e.preventDefault();
          setFocusedIndex(prev => (prev - 1 + visibleSubcategories.length) % visibleSubcategories.length);
        }
      } else if (e.key === 'Enter' && document.activeElement === searchInputRef.current) {
        const picked = visibleSubcategories[focusedIndex];
        if (picked) {
          e.preventDefault();
          onChange(picked.parentId, picked.id);
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, visibleSubcategories, focusedIndex, onChange]);

  const handleSelectParent = (nextParentId: MapParentCategoryId) => {
    setBrowseParentId(nextParentId);
    setSearchQuery('');
    const subs = getSubcategoriesByParent(nextParentId);
    if (subs[0]) {
      onChange(nextParentId, subs[0].id);
    }
  };

  const handleSelectSubcategory = (sub: MapSubcategoryMeta) => {
    onChange(sub.parentId, sub.id);
    setIsOpen(false);
  };

  const triggerHeight = compact ? '35px' : '38px';
  const labelFontSize = compact ? '10.5px' : '11.5px';

  return (
    <div
      ref={containerRef}
      data-testid={`${testIdPrefix}-root`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
        gap: compact ? '6px' : '8px',
        width: '100%',
      }}
    >
      {/* Nút chọn Cấp 1 — Nhóm danh mục (Parent) */}
      <div style={{ minWidth: 0 }}>
        <label
          style={{
            display: 'block',
            fontSize: labelFontSize,
            fontWeight: 700,
            color: theme.textSecondary,
            marginBottom: '4px',
          }}
        >
          Nhóm danh mục (Parent)
        </label>
        <button
          type="button"
          data-testid={`${testIdPrefix}-parent-trigger`}
          aria-haspopup="dialog"
          aria-expanded={isOpen && activeTab === 'parent'}
          onClick={() => handleOpenPicker('parent')}
          style={{
            width: '100%',
            height: triggerHeight,
            padding: '0 10px',
            borderRadius: '8px',
            border: isOpen ? `1.5px solid ${theme.accent}` : `1px solid ${theme.border}`,
            background: theme.bgInput,
            color: theme.textPrimary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            cursor: 'pointer',
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
              fontSize: compact ? '12px' : '12.5px',
              fontWeight: 700,
            }}
          >
            <span style={{ color: theme.accent, display: 'inline-flex', flexShrink: 0 }}>
              {renderRegistryIcon(currentParentMeta.iconName, 14)}
            </span>
            <span
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentParentMeta.label}
            </span>
          </span>
          <ChevronDown size={14} style={{ color: theme.textMuted, flexShrink: 0 }} />
        </button>

        {/* Đồng bộ <select> ẩn hỗ trợ accessibility & kịch bản tự động */}
        <select
          aria-label="Nhóm danh mục (Parent)"
          data-testid={legacyParentSelectTestId || `${testIdPrefix}-parent-select`}
          value={parentCategoryId}
          onChange={e => {
            const nextParent = e.target.value as MapParentCategoryId;
            const subs = getSubcategoriesByParent(nextParent);
            if (subs[0]) {
              onChange(nextParent, subs[0].id);
            }
          }}
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
          tabIndex={-1}
        >
          {MAP_PARENT_CATEGORIES.map(p => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Nút chọn Cấp 2 — Loại chi tiết (Subcategory) */}
      <div style={{ minWidth: 0 }}>
        <label
          style={{
            display: 'block',
            fontSize: labelFontSize,
            fontWeight: 700,
            color: theme.textSecondary,
            marginBottom: '4px',
          }}
        >
          Loại chi tiết (Subcategory)
        </label>
        <button
          type="button"
          data-testid={`${testIdPrefix}-subcategory-trigger`}
          aria-haspopup="dialog"
          aria-expanded={isOpen && activeTab === 'sub'}
          onClick={() => handleOpenPicker('sub')}
          style={{
            width: '100%',
            height: triggerHeight,
            padding: '0 10px',
            borderRadius: '8px',
            border: isOpen ? `1.5px solid ${theme.accent}` : `1px solid ${theme.border}`,
            background: theme.bgInput,
            color: theme.textPrimary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            cursor: 'pointer',
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
              fontSize: compact ? '12px' : '12.5px',
              fontWeight: 700,
            }}
          >
            <span style={{ color: theme.accent, display: 'inline-flex', flexShrink: 0 }}>
              {renderRegistryIcon(currentSubMeta?.iconName || 'compass', 14)}
            </span>
            <span
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentSubMeta?.label || subcategoryId}
            </span>
          </span>
          <ChevronDown size={14} style={{ color: theme.textMuted, flexShrink: 0 }} />
        </button>

        {/* Đồng bộ <select> ẩn hỗ trợ accessibility & kịch bản tự động */}
        <select
          aria-label="Loại chi tiết (Subcategory)"
          data-testid={legacySubSelectTestId || `${testIdPrefix}-subcategory-select`}
          value={subcategoryId}
          onChange={e => {
            const nextSub = e.target.value as MapSubcategoryId;
            const meta = MAP_CATEGORY_REGISTRY[nextSub];
            if (meta) {
              onChange(meta.parentId, meta.id);
            }
          }}
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
          tabIndex={-1}
        >
          {getSubcategoriesByParent(parentCategoryId).map(sub => (
            <option key={sub.id} value={sub.id}>
              {sub.label}
            </option>
          ))}
        </select>
      </div>

      {/* PORTAL POPOVER (DESKTOP) HOẶC BOTTOM SHEET (MOBILE) */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid={`${testIdPrefix}-overlay`}
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99990,
              background: isMobileViewport ? 'rgba(15, 23, 42, 0.5)' : 'transparent',
              display: isMobileViewport ? 'flex' : 'block',
              alignItems: isMobileViewport ? 'flex-end' : undefined,
              justifyContent: isMobileViewport ? 'center' : undefined,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Chọn danh mục địa điểm"
              data-testid={isMobileViewport ? `${testIdPrefix}-bottom-sheet` : `${testIdPrefix}-popover`}
              onClick={e => e.stopPropagation()}
              style={
                isMobileViewport
                  ? {
                      width: '100%',
                      maxWidth: '540px',
                      maxHeight: '84dvh',
                      background: theme.bgCard,
                      borderRadius: '18px 18px 0 0',
                      borderTop: `1.5px solid ${theme.border}`,
                      boxShadow: '0 -12px 36px rgba(15, 23, 42, 0.24)',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }
                  : {
                      position: 'fixed',
                      top: `${popoverRect.top}px`,
                      left: `${popoverRect.left}px`,
                      width: `${popoverRect.width}px`,
                      maxHeight: 'min(410px, calc(100vh - 24px))',
                      background: theme.bgCard,
                      borderRadius: '14px',
                      border: `1.5px solid ${theme.border}`,
                      boxShadow: '0 18px 42px rgba(15, 23, 42, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }
              }
            >
              {/* HEADER: TIÊU ĐỀ + Ô TÌM NHANH + NÚT ĐÓNG */}
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: `1px solid ${theme.border}`,
                  background: theme.bgElevated || '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <Layers size={15} style={{ color: theme.accent, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: theme.textPrimary }}>
                      Chọn Danh mục (Nhóm chính → Loại chi tiết)
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-close-btn`}
                    onClick={() => setIsOpen(false)}
                    aria-label="Đóng bảng chọn danh mục"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '7px',
                      border: `1px solid ${theme.border}`,
                      background: theme.bgCard,
                      color: theme.textSecondary,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Ô tìm kiếm nhanh danh mục */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      color: theme.textMuted,
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    data-testid={`${testIdPrefix}-search-input`}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm nhanh loại hình (VD: phở, cafe, bi-a, trường học, chùa, UBND)..."
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 30px 0 32px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.border}`,
                      background: theme.bgInput,
                      color: theme.textPrimary,
                      fontSize: '12.5px',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        border: 'none',
                        background: 'transparent',
                        color: theme.textMuted,
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* BODY: DESKTOP 2 CỘT / MOBILE TABS + GRID */}
              {isMobileViewport ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                  }}
                >
                  {/* Thanh cuộn ngang Nhóm chính trên Mobile */}
                  {!searchQuery.trim() && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        overflowX: 'auto',
                        padding: '8px 12px',
                        borderBottom: `1px solid ${theme.border}`,
                        background: theme.bgCard,
                        flexShrink: 0,
                      }}
                    >
                      {MAP_PARENT_CATEGORIES.map(parent => {
                        const isSelectedParent = browseParentId === parent.id;
                        return (
                          <button
                            key={parent.id}
                            type="button"
                            data-testid={`${testIdPrefix}-parent-item-${parent.id}`}
                            onClick={() => handleSelectParent(parent.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              height: '34px',
                              padding: '0 11px',
                              borderRadius: '999px',
                              border: isSelectedParent ? `1.5px solid ${theme.accent}` : `1px solid ${theme.border}`,
                              background: isSelectedParent ? theme.accentSoft : theme.bgElevated || '#F8FAFC',
                              color: isSelectedParent ? theme.accent : theme.textSecondary,
                              fontSize: '12px',
                              fontWeight: isSelectedParent ? 800 : 600,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              cursor: 'pointer',
                            }}
                          >
                            {renderRegistryIcon(parent.iconName, 13)}
                            <span>{parent.shortLabel || parent.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Danh sách Loại chi tiết trên Mobile */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '10px 12px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                      gap: '8px',
                      alignContent: 'start',
                    }}
                  >
                    {visibleSubcategories.map((sub, idx) => {
                      const isSelected = sub.id === subcategoryId;
                      const parentObj = MAP_PARENT_CATEGORIES.find(p => p.id === sub.parentId);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          data-testid={`${testIdPrefix}-sub-item-${sub.id}`}
                          onClick={() => handleSelectSubcategory(sub)}
                          style={{
                            minHeight: '44px',
                            padding: '8px 10px',
                            borderRadius: '10px',
                            border: isSelected
                              ? `2px solid ${theme.accent}`
                              : idx === focusedIndex && searchQuery
                              ? `1.5px solid ${theme.accent}`
                              : `1px solid ${theme.border}`,
                            background: isSelected ? theme.accentSoft : theme.bgCard,
                            color: isSelected ? '#065F46' : theme.textPrimary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                            <span style={{ color: theme.accent, display: 'inline-flex', flexShrink: 0 }}>
                              {renderRegistryIcon(sub.iconName, 15)}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12.5px', fontWeight: isSelected ? 800 : 700, lineHeight: 1.25 }}>
                                {sub.label}
                              </div>
                              {searchQuery.trim() && parentObj && (
                                <div style={{ fontSize: '10.5px', color: theme.textMuted }}>{parentObj.label}</div>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check size={15} style={{ color: theme.accent, flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Sticky Footer trên Mobile — không bao giờ che nút xác nhận */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderTop: `1px solid ${theme.border}`,
                      background: theme.bgElevated || '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: '11.5px', color: theme.textSecondary, minWidth: 0 }}>
                      Đang chọn: <b style={{ color: theme.accent }}>{currentParentMeta.shortLabel}</b> →{' '}
                      <b style={{ color: theme.textPrimary }}>{currentSubMeta?.label}</b>
                    </div>
                    <button
                      type="button"
                      data-testid={`${testIdPrefix}-mobile-confirm-btn`}
                      onClick={() => setIsOpen(false)}
                      style={{
                        height: '34px',
                        padding: '0 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: theme.accent,
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Xong
                    </button>
                  </div>
                </div>
              ) : (
                /* DESKTOP 2-COLUMN POPOVER */
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: searchQuery.trim() ? '1fr' : '215px 1fr',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                  }}
                >
                  {/* Cột trái: Danh sách Nhóm chính (Parent) */}
                  {!searchQuery.trim() && (
                    <div
                      style={{
                        borderRight: `1px solid ${theme.border}`,
                        overflowY: 'auto',
                        padding: '8px',
                        background: theme.bgElevated || '#F8FAFC',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: theme.textMuted,
                          textTransform: 'uppercase',
                          padding: '2px 8px 4px',
                          letterSpacing: '0.04em',
                        }}
                      >
                        1. Nhóm chính ({MAP_PARENT_CATEGORIES.length})
                      </div>
                      {MAP_PARENT_CATEGORIES.map(parent => {
                        const active = browseParentId === parent.id;
                        const count = getSubcategoriesByParent(parent.id).length;
                        return (
                          <button
                            key={parent.id}
                            type="button"
                            data-testid={`${testIdPrefix}-parent-item-${parent.id}`}
                            onClick={() => handleSelectParent(parent.id)}
                            style={{
                              padding: '7px 9px',
                              borderRadius: '8px',
                              border: active ? `1.5px solid ${theme.accent}` : '1px solid transparent',
                              background: active ? theme.accentSoft : 'transparent',
                              color: active ? '#065F46' : theme.textPrimary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                              fontSize: '12px',
                              fontWeight: active ? 800 : 600,
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                              <span style={{ color: theme.accent, display: 'inline-flex', flexShrink: 0 }}>
                                {renderRegistryIcon(parent.iconName, 14)}
                              </span>
                              <span style={{ lineHeight: 1.25 }}>{parent.label}</span>
                            </span>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '999px',
                                background: active ? theme.accent : theme.border,
                                color: active ? '#FFFFFF' : theme.textSecondary,
                                flexShrink: 0,
                              }}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Cột phải: Lưới đa cột Loại chi tiết (Subcategories) */}
                  <div
                    style={{
                      overflowY: 'auto',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: theme.textMuted,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {searchQuery.trim()
                          ? `Kết quả tìm kiếm (${visibleSubcategories.length} loại chi tiết)`
                          : `2. Loại chi tiết thuộc "${
                              MAP_PARENT_CATEGORIES.find(p => p.id === browseParentId)?.label || ''
                            }" (${visibleSubcategories.length})`}
                      </span>
                      <span style={{ fontSize: '10.5px', color: theme.textMuted }}>
                        Phím ↑↓ để di chuyển • Enter để chọn • Esc để đóng
                      </span>
                    </div>

                    {visibleSubcategories.length === 0 ? (
                      <div
                        style={{
                          padding: '28px 12px',
                          textAlign: 'center',
                          fontSize: '12.5px',
                          color: theme.textMuted,
                        }}
                      >
                        Không tìm thấy loại danh mục phù hợp với từ khóa "{searchQuery}".
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                          gap: '7px',
                        }}
                      >
                        {visibleSubcategories.map((sub, idx) => {
                          const isSelected = sub.id === subcategoryId;
                          const isKeyboardFocused = idx === focusedIndex && Boolean(searchQuery.trim());
                          const parentObj = MAP_PARENT_CATEGORIES.find(p => p.id === sub.parentId);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              data-testid={`${testIdPrefix}-sub-item-${sub.id}`}
                              onClick={() => handleSelectSubcategory(sub)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '9px',
                                border: isSelected
                                  ? `2px solid ${theme.accent}`
                                  : isKeyboardFocused
                                  ? `1.5px solid ${theme.accent}`
                                  : `1px solid ${theme.border}`,
                                background: isSelected ? theme.accentSoft : theme.bgCard,
                                color: isSelected ? '#065F46' : theme.textPrimary,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                                textAlign: 'left',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                <span style={{ color: theme.accent, display: 'inline-flex', flexShrink: 0 }}>
                                  {renderRegistryIcon(sub.iconName, 15)}
                                </span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '12px', fontWeight: isSelected ? 800 : 700, lineHeight: 1.3 }}>
                                    {sub.label}
                                  </div>
                                  {searchQuery.trim() && parentObj && (
                                    <div style={{ fontSize: '10px', color: theme.textMuted }}>
                                      Nhóm: {parentObj.shortLabel}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {isSelected && <Check size={14} style={{ color: theme.accent, flexShrink: 0 }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export interface CategoryFilterOption {
  value: string;
  label: string;
  groupLabel?: string;
}

export interface CategoryFilterPickerProps {
  value: string;
  options: CategoryFilterOption[];
  onChange: (nextValue: string) => void;
  theme?: Partial<CategoryPickerTheme>;
  testId?: string;
  placeholder?: string;
  compact?: boolean;
}

export const CategoryFilterPicker: React.FC<CategoryFilterPickerProps> = ({
  value,
  options,
  onChange,
  theme: rawTheme,
  testId = 'category-filter-picker',
  placeholder = 'Lọc danh mục',
  compact = false,
}) => {
  const theme: CategoryPickerTheme = { ...DEFAULT_THEME, ...(rawTheme || {}) };
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [rectState, setRectState] = useState<{ top: number; left: number; width: number }>({
    top: 100,
    left: 100,
    width: 360,
  });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = useMemo(
    () => options.find(o => o.value === value) || options[0],
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      o => o.label.toLowerCase().includes(q) || (o.groupLabel && o.groupLabel.toLowerCase().includes(q))
    );
  }, [options, search]);

  const computePos = () => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const mobile = vw < 768;
    setIsMobile(mobile);
    if (mobile || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const w = Math.min(440, Math.max(300, vw - 24));
    const left = Math.min(Math.max(12, r.left), vw - w - 12);
    setRectState({
      top: Math.min(window.innerHeight - 100, r.bottom + 5),
      left,
      width: w,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', computePos);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', computePos);
    };
  }, [isOpen]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', minWidth: compact ? '135px' : '155px' }}>
      <button
        type="button"
        data-testid={`${testId}-trigger`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => {
          setSearch('');
          computePos();
          setIsOpen(prev => !prev);
          setTimeout(() => inputRef.current?.focus(), 25);
        }}
        style={{
          width: '100%',
          height: compact ? '34px' : '38px',
          padding: '0 10px',
          borderRadius: '8px',
          border: isOpen ? `1.5px solid ${theme.accent}` : `1px solid ${theme.border}`,
          background: theme.bgInput,
          color: theme.textPrimary,
          fontSize: compact ? '12px' : '12.5px',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
          <Tag size={13} style={{ color: theme.accent, flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedOption?.label || placeholder}
          </span>
        </span>
        <ChevronDown size={13} style={{ color: theme.textMuted, flexShrink: 0 }} />
      </button>

      <select
        aria-label={placeholder}
        data-testid={testId}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
        tabIndex={-1}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99990,
              background: isMobile ? 'rgba(15, 23, 42, 0.45)' : 'transparent',
              display: isMobile ? 'flex' : 'block',
              alignItems: isMobile ? 'flex-end' : undefined,
              justifyContent: isMobile ? 'center' : undefined,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              data-testid={`${testId}-popover`}
              onClick={e => e.stopPropagation()}
              style={
                isMobile
                  ? {
                      width: '100%',
                      maxWidth: '500px',
                      maxHeight: '78dvh',
                      background: theme.bgCard,
                      borderRadius: '16px 16px 0 0',
                      borderTop: `1.5px solid ${theme.border}`,
                      boxShadow: '0 -10px 30px rgba(15,23,42,0.22)',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }
                  : {
                      position: 'fixed',
                      top: `${rectState.top}px`,
                      left: `${rectState.left}px`,
                      width: `${rectState.width}px`,
                      maxHeight: '360px',
                      background: theme.bgCard,
                      borderRadius: '12px',
                      border: `1.5px solid ${theme.border}`,
                      boxShadow: '0 14px 36px rgba(15,23,42,0.18)',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }
              }
            >
              <div
                style={{
                  padding: '8px 10px',
                  borderBottom: `1px solid ${theme.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme.bgElevated || '#F8FAFC',
                }}
              >
                <Search size={13} style={{ color: theme.textMuted, flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  type="text"
                  data-testid={`${testId}-search`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm nhanh danh mục lọc..."
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: theme.textPrimary,
                    fontSize: '12px',
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: theme.textMuted,
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              <div
                style={{
                  padding: '8px',
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '6px',
                }}
              >
                {filteredOptions.map(opt => {
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`${testId}-opt-${opt.value}`}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      style={{
                        padding: '7px 9px',
                        borderRadius: '8px',
                        border: active ? `1.5px solid ${theme.accent}` : `1px solid ${theme.border}`,
                        background: active ? theme.accentSoft : theme.bgCard,
                        color: active ? '#065F46' : theme.textPrimary,
                        fontSize: '12px',
                        fontWeight: active ? 800 : 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ lineHeight: 1.25 }}>{opt.label}</span>
                      {active && <Check size={13} style={{ color: theme.accent, flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
