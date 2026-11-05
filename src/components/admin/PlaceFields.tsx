'use client';
import React, { useMemo, useState } from 'react';
import { Clock, Compass, Globe, Layers, MapPin, Phone, Plus, Search, ShieldCheck, Tag, Trash2 } from 'lucide-react';
import {
  MAP_CATEGORY_REGISTRY,
  MAP_PARENT_CATEGORIES,
  STANDARD_EXTRA_TAGS,
  formatPlaceTaxonomyLine,
  getDefaultSectorTagForSubcategory,
  getSubcategoriesByParent,
  renderRegistryIcon,
  resolvePlaceContentProfile,
  searchSubcategoriesByQuery,
  type CatalogModeType,
  type ContentProfileType,
  type MapParentCategoryId,
  type MapSubcategoryId,
} from '@/lib/map/map-category-registry';
import type { MapCategoryKey } from '@/lib/map/map-types';
import type { CustomMenuEntry } from '@/lib/admin-store';
import { CategoryTaxonomyPicker } from './CategoryPicker';

export interface PlaceFieldsValue {
  name: string;
  parentCategoryId: MapParentCategoryId;
  subcategoryId: MapSubcategoryId;
  mapCategory: Exclude<MapCategoryKey, 'all' | 'game_asset'>;
  sectorTag?: string;
  extraTags?: string[];
  contentProfile?: ContentProfileType;
  catalogMode?: CatalogModeType;
  catalogEnabled?: boolean;
  catalogItems?: CustomMenuEntry[];
  showByDefault: boolean;
  phone: string;
  openHours: string;
  address: string;
  mapsUrl: string;
  lat: string;
  lng: string;
  tagline?: string;
  website?: string;
  educationLevel?: string;
  agencyFunction?: string;
}

export interface PlaceFieldsTheme {
  bgInput: string;
  bgCard: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
}

export interface PlaceFieldsProps {
  mode: 'create' | 'edit';
  value: PlaceFieldsValue;
  onChange: (patch: Partial<PlaceFieldsValue>) => void;
  onResolveCoordinates?: () => void;
  isResolvingCoords?: boolean;
  mapsUrlStatusBadge?: React.ReactNode;
  mapsResolveFeedback?: React.ReactNode;
  showCoordinatesSection?: boolean;
  showTaglineField?: boolean;
  showExtendedContentSection?: boolean;
  theme?: PlaceFieldsTheme;
  idPrefix?: string;
}

const DEFAULT_THEME: PlaceFieldsTheme = {
  bgInput: '#FFFFFF',
  bgCard: '#F8FAFC',
  border: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  accent: '#059669',
};

const QUICK_HOURS_PRESETS = [
  '07:00 - 22:00',
  '06:30 - 22:30',
  '07:30 - 17:30',
  '17:00 - 23:30',
  '24/7',
] as const;

export const PlaceFields: React.FC<PlaceFieldsProps> = ({
  mode,
  value,
  onChange,
  onResolveCoordinates,
  isResolvingCoords = false,
  mapsUrlStatusBadge,
  mapsResolveFeedback,
  showCoordinatesSection = true,
  showTaglineField = true,
  showExtendedContentSection = true,
  theme = DEFAULT_THEME,
  idPrefix = 'place-field',
}) => {
  const [categorySearch, setCategorySearch] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('35');
  const [newItemCat, setNewItemCat] = useState('');

  const subcategoriesForParent = useMemo(
    () => getSubcategoriesByParent(value.parentCategoryId || 'food'),
    [value.parentCategoryId]
  );

  const quickSearchMatches = useMemo(() => {
    const q = categorySearch.trim();
    if (!q) return [];
    return searchSubcategoriesByQuery(q).slice(0, 8);
  }, [categorySearch]);

  const currentSubMeta =
    MAP_CATEGORY_REGISTRY[value.subcategoryId] || MAP_CATEGORY_REGISTRY.local_food;

  const profileMeta = useMemo(
    () =>
      resolvePlaceContentProfile({
        subcategoryId: value.subcategoryId,
        parentCategoryId: value.parentCategoryId,
        contentProfile: value.contentProfile,
        catalogMode: value.catalogMode,
        catalogEnabled: value.catalogEnabled,
      }),
    [
      value.subcategoryId,
      value.parentCategoryId,
      value.contentProfile,
      value.catalogMode,
      value.catalogEnabled,
    ]
  );

  const extraTagsList = useMemo(() => value.extraTags || [], [value.extraTags]);

  const taxonomyPreviewLine = useMemo(
    () => formatPlaceTaxonomyLine(currentSubMeta.label, extraTagsList),
    [currentSubMeta.label, extraTagsList]
  );

  const isCivicPlace =
    profileMeta.contentProfile === 'government' ||
    profileMeta.contentProfile === 'education' ||
    profileMeta.contentProfile === 'landmark' ||
    value.parentCategoryId === 'public' ||
    value.parentCategoryId === 'education' ||
    value.parentCategoryId === 'health';

  const handleSelectParent = (nextParentId: MapParentCategoryId) => {
    const parentMeta = MAP_PARENT_CATEGORIES.find((p) => p.id === nextParentId);
    const nextSubId = parentMeta ? parentMeta.defaultSubcategoryId : 'uncategorized';
    const subMeta = MAP_CATEGORY_REGISTRY[nextSubId] || MAP_CATEGORY_REGISTRY.uncategorized;
    const nextProfile = resolvePlaceContentProfile({
      subcategoryId: subMeta.id,
      parentCategoryId: nextParentId,
    });
    onChange({
      parentCategoryId: nextParentId,
      subcategoryId: subMeta.id,
      mapCategory: subMeta.legacyCategory,
      sectorTag: getDefaultSectorTagForSubcategory(subMeta),
      showByDefault: subMeta.showByDefault,
      contentProfile: nextProfile.contentProfile,
      catalogMode: nextProfile.catalogMode,
      catalogEnabled: nextProfile.catalogEnabled,
    });
  };

  const handleSelectSubcategory = (nextSubId: MapSubcategoryId) => {
    const subMeta = MAP_CATEGORY_REGISTRY[nextSubId];
    if (!subMeta) return;
    const nextProfile = resolvePlaceContentProfile({
      subcategoryId: subMeta.id,
      parentCategoryId: subMeta.parentId,
    });
    onChange({
      parentCategoryId: subMeta.parentId,
      subcategoryId: subMeta.id,
      mapCategory: subMeta.legacyCategory,
      sectorTag: getDefaultSectorTagForSubcategory(subMeta),
      showByDefault: subMeta.showByDefault,
      contentProfile: nextProfile.contentProfile,
      catalogMode: nextProfile.catalogMode,
      catalogEnabled: nextProfile.catalogEnabled,
    });
  };

  const handleToggleExtraTag = (tag: string) => {
    const exists = extraTagsList.some((t) => t.toLowerCase() === tag.toLowerCase());
    const next = exists
      ? extraTagsList.filter((t) => t.toLowerCase() !== tag.toLowerCase())
      : [...extraTagsList, tag];
    onChange({ extraTags: next });
  };

  const handleAddCustomExtraTag = () => {
    const clean = customTagInput.trim();
    if (!clean) return;
    if (!extraTagsList.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      onChange({ extraTags: [...extraTagsList, clean] });
    }
    setCustomTagInput('');
  };

  const handleAddCatalogItem = () => {
    const cleanName = newItemName.trim();
    if (!cleanName) return;
    const defaultCat =
      profileMeta.contentProfile === 'retail'
        ? 'Sản phẩm & Phụ kiện'
        : profileMeta.contentProfile === 'service' || profileMeta.contentProfile === 'entertainment'
        ? 'Dịch vụ & Bảng giá'
        : 'Món chính';
    const nextEntry: CustomMenuEntry = {
      id: `item_${Date.now()}`,
      name: cleanName,
      price: Number(newItemPrice) || 0,
      category: newItemCat.trim() || defaultCat,
      serviceTag: 'both',
      isLocked: false,
    };
    const currentItems = value.catalogItems || [];
    onChange({ catalogItems: [...currentItems, nextEntry] });
    setNewItemName('');
    setNewItemCat('');
  };

  const handleRemoveCatalogItem = (idx: number) => {
    const currentItems = value.catalogItems || [];
    onChange({ catalogItems: currentItems.filter((_, i) => i !== idx) });
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 700,
    color: theme.textSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
    lineHeight: 1.2,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    height: 38,
    padding: '0 10px',
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    background: theme.bgInput,
    color: theme.textPrimary,
    fontSize: 13,
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#047857',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 2,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {/* ================================================================= */}
      {/* A. THÔNG TIN CƠ BẢN (Tên, Nhóm chính, Loại chi tiết, Tag bổ sung) */}
      {/* ================================================================= */}
      <div style={sectionHeaderStyle}>
        <span>A. Thông tin cơ bản & Phân loại 3 cấp</span>
        <span
          data-testid={`${idPrefix}-taxonomy-preview`}
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'none',
            letterSpacing: 0,
            color: '#065F46',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            padding: '2px 8px',
            borderRadius: 999,
          }}
        >
          {taxonomyPreviewLine}
        </span>
      </div>

      {/* 1. Tên địa điểm */}
      <div style={{ minWidth: 0 }}>
        <label htmlFor={`${idPrefix}-name`} style={labelStyle}>
          Tên địa điểm <span style={{ color: '#DC2626' }}>*</span>
        </label>
        <input
          id={`${idPrefix}-name`}
          data-testid={`${idPrefix}-name`}
          type="text"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="VD: Bếp Nhà Cún, Điện Thoại Tuấn Anh, Công an Phường Xuân Hòa..."
          style={{ ...inputStyle, fontWeight: 700 }}
        />
      </div>

      {/* 2. Hệ phân loại thống nhất 3 cấp: Nhóm chính -> Loại chi tiết -> Tag bổ sung */}
      <div
        style={{
          padding: '10px',
          borderRadius: 10,
          background: theme.bgCard,
          border: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              color: theme.textPrimary,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
              }}
            >
              {renderRegistryIcon(currentSubMeta.iconName, { size: 13 })}
            </span>
            Hiển thị chuẩn: <strong style={{ color: '#059669' }}>{taxonomyPreviewLine}</strong>
          </span>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
              color: value.showByDefault ? '#047857' : theme.textMuted,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              data-testid={`${idPrefix}-show-default`}
              checked={Boolean(value.showByDefault)}
              onChange={(e) => onChange({ showByDefault: e.target.checked })}
              style={{ width: 14, height: 14, accentColor: '#059669', cursor: 'pointer' }}
            />
            Hiện mặc định trên bản đồ
          </label>
        </div>

        {/* Ô tìm nhanh loại địa điểm */}
        <div style={{ position: 'relative', minWidth: 0 }}>
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: theme.textMuted,
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            data-testid={`${idPrefix}-category-search`}
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            placeholder="Gõ tìm nhanh loại hình: ăn vặt, điện thoại, bi-a, công an, trường học, vòng tròn..."
            style={{
              ...inputStyle,
              height: 34,
              paddingLeft: 30,
              fontSize: 12,
              fontWeight: 600,
            }}
          />
          {categorySearch && (
            <button
              type="button"
              onClick={() => setCategorySearch('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'transparent',
                color: theme.textMuted,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Xóa
            </button>
          )}
        </div>

        {quickSearchMatches.length > 0 && (
          <div
            data-testid={`${idPrefix}-category-search-results`}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}
          >
            {quickSearchMatches.map((sub) => {
              const active = value.subcategoryId === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  data-testid={`${idPrefix}-quick-sub-${sub.id}`}
                  onClick={() => {
                    handleSelectSubcategory(sub.id);
                    setCategorySearch('');
                  }}
                  style={{
                    padding: '4px 9px',
                    borderRadius: 999,
                    border: active ? '1.5px solid #059669' : `1px solid ${theme.border}`,
                    background: active ? '#ECFDF5' : theme.bgInput,
                    color: active ? '#047857' : theme.textPrimary,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {renderRegistryIcon(sub.iconName, {
                    size: 12,
                  })}
                  {sub.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Category Picker chuyên nghiệp Cấp 1 & Cấp 2: Nhóm chính -> Loại chi tiết */}
        <CategoryTaxonomyPicker
          parentCategoryId={value.parentCategoryId || 'food'}
          subcategoryId={value.subcategoryId || 'local_food'}
          onChange={(_nextParent, nextSub) => {
            handleSelectSubcategory(nextSub);
          }}
          theme={{
            bgCard: theme.bgCard,
            bgInput: theme.bgInput,
            border: theme.border,
            textPrimary: theme.textPrimary,
            textSecondary: theme.textSecondary,
            textMuted: theme.textMuted,
            accent: theme.accent,
            accentSoft: '#ECFDF5',
          }}
          compact
          testIdPrefix={`${idPrefix}-cat-picker`}
          legacyParentSelectTestId={`${idPrefix}-parent-cat`}
          legacySubSelectTestId={`${idPrefix}-sub-cat`}
        />

        {/* Cấp 3 — Tag bổ sung (Extra Tags) */}
        <div style={{ minWidth: 0, paddingTop: 4, borderTop: `1px dashed ${theme.border}` }}>
          <label style={{ ...labelStyle, fontSize: 11 }}>
            <Tag size={11} /> Cấp 3 — Tag bổ sung (Hiển thị kèm loại chi tiết trên Web & Maps)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
            {STANDARD_EXTRA_TAGS.map((tag) => {
              const active = extraTagsList.some((t) => t.toLowerCase() === tag.toLowerCase());
              return (
                <button
                  key={tag}
                  type="button"
                  data-testid={`${idPrefix}-extra-tag-${tag}`}
                  onClick={() => handleToggleExtraTag(tag)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    border: active ? '1.5px solid #059669' : `1px solid ${theme.border}`,
                    background: active ? '#ECFDF5' : theme.bgInput,
                    color: active ? '#047857' : theme.textSecondary,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {active ? `✓ ${tag}` : `+ ${tag}`}
                </button>
              );
            })}
            {extraTagsList
              .filter(
                (t) => !STANDARD_EXTRA_TAGS.some((std) => std.toLowerCase() === t.toLowerCase())
              )
              .map((customTag) => (
                <button
                  key={customTag}
                  type="button"
                  onClick={() => handleToggleExtraTag(customTag)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    border: '1.5px solid #059669',
                    background: '#ECFDF5',
                    color: '#047857',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✓ {customTag} ×
                </button>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              data-testid={`${idPrefix}-custom-tag-input`}
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomExtraTag();
                }
              }}
              placeholder="Thêm tag phụ khác (VD: Ship đêm, Có wifi...)"
              style={{ ...inputStyle, height: 32, fontSize: 11.5, flex: 1 }}
            />
            <button
              type="button"
              onClick={handleAddCustomExtraTag}
              style={{
                height: 32,
                padding: '0 10px',
                borderRadius: 8,
                border: `1px solid ${theme.border}`,
                background: theme.bgInput,
                color: theme.textSecondary,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              + Tag
            </button>
          </div>
        </div>
      </div>

      {showTaglineField && (
        <div style={{ minWidth: 0 }}>
          <label htmlFor={`${idPrefix}-tagline`} style={labelStyle}>
            Mô tả ngắn / Giới thiệu địa điểm
          </label>
          <input
            id={`${idPrefix}-tagline`}
            data-testid={`${idPrefix}-tagline`}
            type="text"
            value={value.tagline || ''}
            onChange={(e) => onChange({ tagline: e.target.value })}
            placeholder={
              profileMeta.contentProfile === 'landmark'
                ? 'VD: Biểu tượng kiến trúc & điểm hẹn trung tâm phường Xuân Hòa'
                : 'VD: Quán ăn vặt đêm • Nhận giao hàng quanh ĐHSP2'
            }
            style={inputStyle}
          />
        </div>
      )}

      {/* ================================================================= */}
      {/* B. THÔNG TIN LIÊN HỆ (Địa chỉ, SĐT, Giờ hoạt động, Website...)     */}
      {/* ================================================================= */}
      <div style={{ ...sectionHeaderStyle, marginTop: 2 }}>
        <span>B. Thông tin liên hệ</span>
      </div>

      {/* Địa chỉ */}
      <div style={{ minWidth: 0 }}>
        <label htmlFor={`${idPrefix}-address`} style={labelStyle}>
          <MapPin size={12} /> Địa chỉ
        </label>
        <input
          id={`${idPrefix}-address`}
          data-testid={`${idPrefix}-address`}
          type="text"
          value={value.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="VD: Đường Nguyễn Văn Linh, Phường Xuân Hòa, Tỉnh Phú Thọ"
          style={inputStyle}
        />
      </div>

      {/* Số điện thoại & Giờ mở cửa */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 8,
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <label htmlFor={`${idPrefix}-phone`} style={labelStyle}>
            <Phone size={12} />{' '}
            {profileMeta.contentProfile === 'government'
              ? 'SĐT trực ban / Hotline (Xác minh)'
              : `Số điện thoại ${isCivicPlace ? '(Tùy chọn)' : ''}`}
          </label>
          <input
            id={`${idPrefix}-phone`}
            data-testid={`${idPrefix}-phone`}
            type="tel"
            value={value.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder={isCivicPlace ? 'Để trống nếu chưa xác thực' : 'VD: 0988 123 456'}
            style={inputStyle}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <label htmlFor={`${idPrefix}-hours`} style={labelStyle}>
            <Clock size={12} />{' '}
            {profileMeta.contentProfile === 'government' ? 'Giờ làm việc' : 'Giờ hoạt động'}
          </label>
          <input
            id={`${idPrefix}-hours`}
            data-testid={`${idPrefix}-hours`}
            type="text"
            value={value.openHours}
            onChange={(e) => onChange({ openHours: e.target.value })}
            placeholder={
              profileMeta.contentProfile === 'landmark'
                ? 'VD: Mở tự do 24/7'
                : 'VD: 07:00 - 22:00'
            }
            style={inputStyle}
          />
        </div>
      </div>

      {/* Quick chips cho giờ mở cửa */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: theme.textMuted }}>Chọn nhanh giờ:</span>
        {QUICK_HOURS_PRESETS.map((preset) => {
          const active = value.openHours.trim() === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange({ openHours: preset })}
              style={{
                padding: '2px 7px',
                borderRadius: 6,
                border: active ? '1px solid #059669' : `1px solid ${theme.border}`,
                background: active ? '#ECFDF5' : theme.bgInput,
                color: active ? '#047857' : theme.textSecondary,
                fontSize: 10.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {preset}
            </button>
          );
        })}
      </div>

      {/* Trường ngữ cảnh cho Giáo dục hoặc Cơ quan hành chính */}
      {profileMeta.contentProfile === 'education' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 8,
            minWidth: 0,
          }}
        >
          <div>
            <label htmlFor={`${idPrefix}-edu-level`} style={labelStyle}>
              Cấp học / Loại hình đào tạo
            </label>
            <input
              id={`${idPrefix}-edu-level`}
              type="text"
              value={value.educationLevel || currentSubMeta.label}
              onChange={(e) => onChange({ educationLevel: e.target.value })}
              placeholder="VD: Tiểu học / THCS / THPT / Đại học"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-website`} style={labelStyle}>
              <Globe size={12} /> Website / Cổng thông tin
            </label>
            <input
              id={`${idPrefix}-website`}
              type="text"
              value={value.website || ''}
              onChange={(e) => onChange({ website: e.target.value })}
              placeholder="VD: https://hpu2.edu.vn"
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {profileMeta.contentProfile === 'government' && (
        <div style={{ minWidth: 0 }}>
          <label htmlFor={`${idPrefix}-agency-fn`} style={labelStyle}>
            <ShieldCheck size={12} /> Chức năng cơ quan / Hướng dẫn liên hệ
          </label>
          <input
            id={`${idPrefix}-agency-fn`}
            type="text"
            value={value.agencyFunction || ''}
            onChange={(e) => onChange({ agencyFunction: e.target.value })}
            placeholder="VD: Tiếp nhận thủ tục hành chính, đảm bảo an ninh trật tự phường Xuân Hòa"
            style={inputStyle}
          />
        </div>
      )}

      {/* ================================================================= */}
      {/* C. ĐỊNH VỊ MAPS (Link Google Maps / Plus Code + Vĩ độ / Kinh độ)   */}
      {/* ================================================================= */}
      {showCoordinatesSection && (
        <>
          <div style={{ ...sectionHeaderStyle, marginTop: 2 }}>
            <span>C. Định vị Maps</span>
          </div>
          <div
            style={{
              padding: '10px',
              borderRadius: 10,
              background: theme.bgCard,
              border: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <label htmlFor={`${idPrefix}-maps-url`} style={{ ...labelStyle, marginBottom: 0 }}>
                <Compass size={12} /> Link Google Maps / Plus Code / Tọa độ (Tùy chọn)
              </label>
              {mapsUrlStatusBadge}
            </div>

            <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
              <input
                id={`${idPrefix}-maps-url`}
                data-testid={`${idPrefix}-maps-url`}
                type="text"
                value={value.mapsUrl}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange({ mapsUrl: raw });
                }}
                placeholder="Dán link Google Maps, Plus Code hoặc 21.2835, 105.7248..."
                style={{ ...inputStyle, flex: 1, height: 36, fontSize: 12 }}
              />
              {onResolveCoordinates && (
                <button
                  type="button"
                  data-testid={`${idPrefix}-resolve-coords-btn`}
                  onClick={onResolveCoordinates}
                  disabled={isResolvingCoords}
                  style={{
                    height: 36,
                    padding: '0 11px',
                    borderRadius: 9,
                    border: '1px solid #0284C7',
                    background: '#EFF6FF',
                    color: '#0369A1',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: isResolvingCoords ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {isResolvingCoords ? 'Đang tìm...' : 'Tìm tọa độ'}
                </button>
              )}
            </div>

            {mapsResolveFeedback}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: 8,
                minWidth: 0,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <label htmlFor={`${idPrefix}-lat`} style={{ ...labelStyle, fontSize: 11 }}>
                  Vĩ độ (Lat)
                </label>
                <input
                  id={`${idPrefix}-lat`}
                  data-testid={`${idPrefix}-lat`}
                  type="text"
                  value={value.lat}
                  onChange={(e) => onChange({ lat: e.target.value })}
                  placeholder="VD: 21.281500"
                  style={{
                    ...inputStyle,
                    height: 36,
                    fontFamily: 'monospace',
                    fontSize: 12.5,
                  }}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <label htmlFor={`${idPrefix}-lng`} style={{ ...labelStyle, fontSize: 11 }}>
                  Kinh độ (Lng)
                </label>
                <input
                  id={`${idPrefix}-lng`}
                  data-testid={`${idPrefix}-lng`}
                  type="text"
                  value={value.lng}
                  onChange={(e) => onChange({ lng: e.target.value })}
                  placeholder="VD: 105.724800"
                  style={{
                    ...inputStyle,
                    height: 36,
                    fontFamily: 'monospace',
                    fontSize: 12.5,
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.35 }}>
              {mode === 'edit'
                ? '💡 Có thể lưu sửa Tên / Loại hình / SĐT / Giờ mở cửa / Địa chỉ ngay cả khi không đổi tọa độ hoặc để trống Link Maps.'
                : '💡 Chấm trực tiếp trên Bản đồ bên phải hoặc dán Link Google Maps để lấy tọa độ, hoặc lưu trước rồi ghim sau.'}
            </div>
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* D. NỘI DUNG MỞ RỘNG (Tự động đổi theo ContentProfile)              */}
      {/* ================================================================= */}
      {showExtendedContentSection && (
        <>
          <div style={{ ...sectionHeaderStyle, marginTop: 2 }}>
            <span>D. Nội dung mở rộng ({profileMeta.sectionTitle})</span>
          </div>
          {profileMeta.forbidsMenuAndOrdering ? (
            <div
              data-testid={`${idPrefix}-civic-no-menu-banner`}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#1E3A8A',
                fontSize: 11.5,
                fontWeight: 600,
                lineHeight: 1.45,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ShieldCheck size={16} style={{ color: '#2563EB', flexShrink: 0 }} />
              <span>
                <strong>
                  {profileMeta.contentProfile === 'government'
                    ? 'Cơ quan hành chính / Công an'
                    : profileMeta.contentProfile === 'education'
                    ? 'Trường học / Cơ sở giáo dục'
                    : 'Địa danh / Công trình công cộng'}
                </strong>
                : Hệ thống tự động tắt thực đơn, bảng giá món ăn và nút đặt mua để đảm bảo hiển thị trang trọng, chuẩn xác.
              </span>
            </div>
          ) : (
            <div
              data-testid={`${idPrefix}-catalog-module`}
              style={{
                padding: '10px',
                borderRadius: 10,
                background: theme.bgCard,
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: theme.textPrimary,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Layers size={14} style={{ color: '#059669' }} />
                  Module: <strong style={{ color: '#059669' }}>{profileMeta.sectionTitle}</strong>
                </span>

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: profileMeta.catalogEnabled ? '#047857' : theme.textMuted,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    data-testid={`${idPrefix}-catalog-enabled-toggle`}
                    checked={profileMeta.catalogEnabled}
                    onChange={(e) => onChange({ catalogEnabled: e.target.checked })}
                    style={{ width: 15, height: 15, accentColor: '#059669', cursor: 'pointer' }}
                  />
                  Bật hiển thị {profileMeta.sectionTitle}
                </label>
              </div>

              <div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.35 }}>
                {profileMeta.catalogEnabled
                  ? `Đang bật hiển thị "${profileMeta.sectionTitle}" trên trang chi tiết và Bản đồ số.`
                  : `Đang tắt hiển thị "${profileMeta.sectionTitle}". Dữ liệu đã nhập vẫn được lưu an toàn trong hệ thống.`}
              </div>

              {profileMeta.catalogEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.5fr) 85px minmax(0, 1fr) auto',
                      gap: 6,
                    }}
                  >
                    <input
                      type="text"
                      data-testid={`${idPrefix}-new-catalog-item-name`}
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder={
                        profileMeta.contentProfile === 'retail'
                          ? 'Tên sản phẩm / phụ kiện...'
                          : profileMeta.contentProfile === 'service' ||
                            profileMeta.contentProfile === 'entertainment'
                          ? 'Tên dịch vụ / giờ chơi...'
                          : 'Tên món ăn / đồ uống...'
                      }
                      style={{ ...inputStyle, height: 34, fontSize: 12 }}
                    />
                    <input
                      type="number"
                      data-testid={`${idPrefix}-new-catalog-item-price`}
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      placeholder="Giá (k)"
                      style={{ ...inputStyle, height: 34, fontSize: 12 }}
                    />
                    <input
                      type="text"
                      data-testid={`${idPrefix}-new-catalog-item-cat`}
                      value={newItemCat}
                      onChange={(e) => setNewItemCat(e.target.value)}
                      placeholder={
                        profileMeta.contentProfile === 'retail'
                          ? 'Danh mục SP'
                          : profileMeta.contentProfile === 'service' ||
                            profileMeta.contentProfile === 'entertainment'
                          ? 'Nhóm DV'
                          : 'Nhóm món'
                      }
                      style={{ ...inputStyle, height: 34, fontSize: 12 }}
                    />
                    <button
                      type="button"
                      data-testid={`${idPrefix}-add-catalog-item-btn`}
                      onClick={handleAddCatalogItem}
                      style={{
                        height: 34,
                        padding: '0 10px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#059669',
                        color: '#FFFFFF',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Plus size={12} /> Thêm
                    </button>
                  </div>

                  {(value.catalogItems || []).length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        maxHeight: 150,
                        overflowY: 'auto',
                        padding: '6px',
                        borderRadius: 8,
                        background: theme.bgInput,
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      {(value.catalogItems || []).map((item, idx) => (
                        <div
                          key={item.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            fontSize: 12,
                            padding: '3px 6px',
                            borderRadius: 6,
                            background: idx % 2 === 0 ? '#F8FAFC' : 'transparent',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1, fontWeight: 600, color: theme.textPrimary }}>
                            #{idx + 1}. {item.name}{' '}
                            {item.category && (
                              <span style={{ fontSize: 10.5, color: theme.textMuted }}>
                                ({item.category})
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <strong style={{ color: '#059669' }}>{item.price}k</strong>
                            <button
                              type="button"
                              onClick={() => handleRemoveCatalogItem(idx)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#DC2626',
                                cursor: 'pointer',
                                padding: 2,
                                display: 'inline-flex',
                              }}
                              title="Xóa mục này"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

