import React, { useState, useMemo, useEffect } from 'react';
import { xuanHoaPlaces, Place, getPlaceStyleGroup } from '@/lib/places-xuanhoa';
import { PlaceCard } from './PlaceCard';
import { 
  Search, 
  SlidersHorizontal, 
  ArrowUpDown, 
  RotateCcw, 
  Store, 
  UtensilsCrossed, 
  ArrowLeft, 
  MapPin,
  Bike,
  Star,
  Utensils,
  Flame,
  Coffee,
  Sparkles
} from 'lucide-react';

interface PlacesCatalogViewProps {
  onSelectPlace: (place: Place) => void;
  onGoToSpin: () => void;
  onGoToDishes: () => void;
}

const PAGE_SIZE = 16;

export function PlacesCatalogView({
  onSelectPlace,
  onGoToSpin,
  onGoToDishes,
}: PlacesCatalogViewProps) {
  const allPlaces = useMemo(() => xuanHoaPlaces, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [styleFilter, setStyleFilter] = useState<'all' | 'an-chinh' | 'nhau-lau' | 'uong' | 'an-vat'>('all');
  const [zoneFilter, setZoneFilter] = useState<'all' | 'dhsp2' | 'center' | 'expanded'>('all');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'ship' | 'dine_in'>('all');
  const [sortOption, setSortOption] = useState<'rating' | 'reviews' | 'name'>('rating');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, styleFilter, zoneFilter, serviceFilter, sortOption]);

  const filteredPlaces = useMemo(() => {
    return allPlaces
      .filter((place) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = place.name.toLowerCase().includes(q);
          const matchAddress = place.address ? place.address.toLowerCase().includes(q) : false;
          const matchTagline = place.tagline ? place.tagline.toLowerCase().includes(q) : false;
          const matchMenu = place.menu?.some(m => m.name.toLowerCase().includes(q)) ?? false;
          if (!matchName && !matchAddress && !matchTagline && !matchMenu) return false;
        }

        // Style group
        if (styleFilter !== 'all') {
          const group = getPlaceStyleGroup(place);
          if (group !== styleFilter) return false;
        }

        // Zone
        if (zoneFilter !== 'all' && place.zone !== zoneFilter) {
          return false;
        }

        // Service
        if (serviceFilter === 'ship' && place.serviceMode === 'dine_in_only') return false;
        if (serviceFilter === 'dine_in' && place.serviceMode === 'delivery_only') return false;

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'rating') return b.rating - a.rating;
        if (sortOption === 'reviews') return b.reviewCount - a.reviewCount;
        if (sortOption === 'name') return a.name.localeCompare(b.name, 'vi');
        return 0;
      });
  }, [allPlaces, searchQuery, styleFilter, zoneFilter, serviceFilter, sortOption]);

  const displayedPlaces = useMemo(() => {
    return filteredPlaces.slice(0, visibleCount);
  }, [filteredPlaces, visibleCount]);

  const resetFilters = () => {
    setSearchQuery('');
    setStyleFilter('all');
    setZoneFilter('all');
    setServiceFilter('all');
    setSortOption('rating');
  };

  // Counts for pills
  const counts = useMemo(() => {
    return {
      all: allPlaces.length,
      anChinh: allPlaces.filter(p => getPlaceStyleGroup(p) === 'an-chinh').length,
      nhauLau: allPlaces.filter(p => getPlaceStyleGroup(p) === 'nhau-lau').length,
      uong: allPlaces.filter(p => getPlaceStyleGroup(p) === 'uong').length,
      anVat: allPlaces.filter(p => getPlaceStyleGroup(p) === 'an-vat').length,
    };
  }, [allPlaces]);

  return (
    <div className="catalog-page-container">
      {/* Sleek, Professional Header Bar - Synchronized with DishesCatalogView */}
      <div className="catalog-header-bar">
        <div className="catalog-header-top-row">
          <button className="catalog-back-pill-btn" onClick={onGoToSpin} title="Quay lại vòng quay">
            <ArrowLeft size={15} />
            <span>Về Vòng Quay</span>
          </button>

          <div className="catalog-header-title-col">
            <h1 className="catalog-title-main">
              DANH BẠ QUÁN ĂN <span>XUÂN HÒA</span>
            </h1>
            <p className="catalog-title-sub">
              Tổng hợp 50+ địa điểm ẩm thực, nhà hàng, quán ốc, cafe &amp; lẩu nướng quanh ĐH Sư Phạm Hà Nội 2
            </p>
            <div className="catalog-header-badges-row">
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <MapPin size={12} className="text-amber-400" />
                <span>100% Địa Chỉ Thật</span>
              </span>
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <Bike size={12} className="text-sky-400" />
                <span>Phục Vụ Tại Quán &amp; Ship</span>
              </span>
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <Star size={12} className="text-amber-400" />
                <span>Đầy Đủ Tọa Độ &amp; Hotline</span>
              </span>
            </div>
          </div>

          <button className="catalog-header-places-btn" onClick={onGoToDishes} title="Khám phá thực đơn món ăn">
            <UtensilsCrossed size={15} className="text-amber-400" />
            <span>Khám Phá Món Ăn (300+ món)</span>
          </button>
        </div>

        {/* Compact, Integrated Search & Filter Controls */}
        <div className="catalog-controls-bar">
          {/* Search Input */}
          <div className="catalog-search-box">
            <Search size={16} className="search-box-icon text-amber-400" />
            <input
              type="search"
              className="search-box-input"
              placeholder="Tìm quán, tên đường hoặc món tủ... (VD: Cuốn Mộc, Ốc 2000, Ruby, Mẹ Tít, Nguyễn Văn Linh...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-box-clear" onClick={() => setSearchQuery('')} title="Xóa tìm kiếm">
                ×
              </button>
            )}
          </div>

          {/* Filter Pills & Selects */}
          <div className="catalog-controls-row">
            {/* Style Pills */}
            <div className="category-pill-group">
              <button
                className={`cat-pill ${styleFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStyleFilter('all')}
              >
                Tất Cả ({counts.all})
              </button>
              <button
                className={`cat-pill ${styleFilter === 'an-chinh' ? 'active' : ''}`}
                onClick={() => setStyleFilter('an-chinh')}
              >
                <Utensils size={13} className="inline mr-1 text-amber-400" />
                Cơm, Bún &amp; Phở ({counts.anChinh})
              </button>
              <button
                className={`cat-pill ${styleFilter === 'nhau-lau' ? 'active' : ''}`}
                onClick={() => setStyleFilter('nhau-lau')}
              >
                <Flame size={13} className="inline mr-1 text-orange-400" />
                Lẩu Nướng &amp; Nhậu ({counts.nhauLau})
              </button>
              <button
                className={`cat-pill ${styleFilter === 'uong' ? 'active' : ''}`}
                onClick={() => setStyleFilter('uong')}
              >
                <Coffee size={13} className="inline mr-1 text-sky-400" />
                Cafe &amp; Đồ Uống ({counts.uong})
              </button>
              <button
                className={`cat-pill ${styleFilter === 'an-vat' ? 'active' : ''}`}
                onClick={() => setStyleFilter('an-vat')}
              >
                <Sparkles size={13} className="inline mr-1 text-emerald-400" />
                Quán Ăn Vặt ({counts.anVat})
              </button>
            </div>

            {/* Price & Sort Selects */}
            <div className="select-pill-group">
              <div className="control-select-wrap">
                <MapPin size={13} className="text-amber-400" />
                <label htmlFor="catalog-places-zone-select" className="sr-only">Khu vực</label>
                <select
                  id="catalog-places-zone-select"
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value as any)}
                >
                  <option value="all">Mọi khu vực</option>
                  <option value="dhsp2">Gần ĐH Sư Phạm 2 (&lt; 500m)</option>
                  <option value="center">Trung tâm Phường Xuân Hòa</option>
                  <option value="expanded">Mở rộng (Phúc Yên lân cận)</option>
                </select>
              </div>

              <div className="control-select-wrap">
                <SlidersHorizontal size={13} className="text-amber-400" />
                <label htmlFor="catalog-places-service-select" className="sr-only">Hình thức</label>
                <select
                  id="catalog-places-service-select"
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value as any)}
                >
                  <option value="all">Mọi hình thức</option>
                  <option value="ship">Có nhận Ship tận nơi</option>
                  <option value="dine_in">Phục vụ tại quán</option>
                </select>
              </div>

              <div className="control-select-wrap">
                <ArrowUpDown size={13} className="text-amber-400" />
                <label htmlFor="catalog-places-sort-select" className="sr-only">Sắp xếp</label>
                <select
                  id="catalog-places-sort-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as any)}
                >
                  <option value="rating">Đánh giá sao cao nhất</option>
                  <option value="reviews">Lượt đánh giá nhiều nhất</option>
                  <option value="name">Tên quán: A đến Z</option>
                </select>
              </div>

              {(searchQuery || styleFilter !== 'all' || zoneFilter !== 'all' || serviceFilter !== 'all' || sortOption !== 'rating') && (
                <button className="control-reset-btn" onClick={resetFilters} title="Đặt lại bộ lọc">
                  <RotateCcw size={13} />
                  <span>Đặt lại</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Counter */}
        <div className="catalog-status-bar">
          <span className="catalog-count-text">
            Đang hiển thị <strong>{Math.min(visibleCount, filteredPlaces.length)}</strong> / {filteredPlaces.length} quán ăn xác thực (Tổng danh bạ {allPlaces.length} quán)
          </span>
        </div>
      </div>

      {/* Grid of Places */}
      {filteredPlaces.length > 0 ? (
        <>
          <div className="catalog-places-grid">
            {displayedPlaces.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                onClick={() => onSelectPlace(place)}
              />
            ))}
          </div>

          {/* Load More Button & Progress */}
          {visibleCount < filteredPlaces.length && (
            <div className="catalog-load-more-wrap">
              <div className="catalog-load-more-info">
                <span>Đang xem <strong>{Math.min(visibleCount, filteredPlaces.length)}</strong> / <strong>{filteredPlaces.length}</strong> quán ăn</span>
                <div className="catalog-progress-track">
                  <div 
                    className="catalog-progress-bar" 
                    style={{ width: `${Math.min(100, Math.round((visibleCount / filteredPlaces.length) * 100))}%` }} 
                  />
                </div>
              </div>
              <div className="catalog-load-more-actions">
                <button 
                  className="catalog-load-more-btn"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                >
                  <span>Xem Thêm 16 Quán Tiếp Theo (4x4)</span>
                  <span className="load-more-counter">(Còn {filteredPlaces.length - visibleCount} quán)</span>
                </button>
                <button 
                  className="catalog-load-all-btn"
                  onClick={() => setVisibleCount(filteredPlaces.length)}
                >
                  Xem Tất Cả ({filteredPlaces.length})
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="catalog-empty-box">
          <Store size={44} className="text-amber-400" />
          <h3>Không tìm thấy quán ăn phù hợp</h3>
          <p>Hãy thử tìm kiếm bằng từ khóa khác hoặc bấm nút đặt lại toàn bộ bộ lọc.</p>
          <button className="control-reset-btn" onClick={resetFilters}>
            <RotateCcw size={15} />
            <span>Đặt lại tất cả bộ lọc</span>
          </button>
        </div>
      )}
    </div>
  );
}
