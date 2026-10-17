import React, { useState, useMemo, useEffect } from 'react';
import { getAllCatalogFoods, CatalogFoodItem, MainCategoryKey, diversifyFoodList } from '@/lib/xuanhoa-catalog';
import { getAllManagedDishes } from '@/lib/admin-store';
import { FoodImage } from './FoodImage';
import { 
  Search, 
  SlidersHorizontal, 
  ArrowUpDown, 
  RotateCcw, 
  UtensilsCrossed, 
  Dices, 
  Store, 
  ArrowLeft,
  MapPin,
  Sparkles,
  Tag,
  Target,
  Utensils,
  Flame,
  Coffee,
  Star
} from 'lucide-react';
import { getDishRatingSummary } from '@/lib/reviews-storage';
import { formatTypography, getFoodCategoryLabel, cleanDishDisplayTitle } from '@/lib/utils';

interface DishesCatalogViewProps {
  initialCategory?: 'all' | MainCategoryKey;
  onSelectDish: (dish: CatalogFoodItem) => void;
  onSpinWithDish?: (dish: CatalogFoodItem) => void;
  onGoToSpin: () => void;
  onGoToPlaces: () => void;
}

const rarityNames = ['Phổ thông', 'Đặc biệt', 'Quý hiếm', 'Cực hiếm', 'Huyền thoại'];
const rarityColors = ['#10B981', '#F59E0B', '#A855F7', '#F97316', '#EF4444'];
const PAGE_SIZE = 30;

const CATEGORY_LABELS: Record<MainCategoryKey, string> = {
  'an-gi': 'Bữa Chính & Cơm Bún Phở',
  'nhau-gi': 'Món Nhậu & Lẩu Nướng',
  'uong-gi': 'Đồ Uống & Trà Sữa',
};

export function DishesCatalogView({
  initialCategory = 'all',
  onSelectDish,
  onSpinWithDish,
  onGoToSpin,
  onGoToPlaces,
}: DishesCatalogViewProps) {
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    const onSync = () => setSyncTick(t => t + 1);
    window.addEventListener('xuanhoa_admin_sync', onSync);
    return () => window.removeEventListener('xuanhoa_admin_sync', onSync);
  }, []);

  const allDishes = useMemo(() => {
    const managed = getAllManagedDishes().filter(item => item.status === 'active');
    if (managed.length === 0) return getAllCatalogFoods();
    return managed.map(item => ({
      ...item.food,
      categoryKey: item.categoryKey,
      categoryLabel: CATEGORY_LABELS[item.categoryKey] || 'Bữa Chính & Cơm Bún Phở',
    }));
  }, [syncTick]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MainCategoryKey>(initialCategory);
  const [priceFilter, setPriceFilter] = useState<'all' | 'under35' | '35to65' | '65to120' | 'above120'>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | number>('all');
  const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc' | 'name-asc'>('default');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination when filter or search changes
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, categoryFilter, priceFilter, rarityFilter, sortOption]);

  // Sync category filter when initialCategory prop changes
  React.useEffect(() => {
    if (initialCategory) {
      setCategoryFilter(initialCategory);
    }
  }, [initialCategory]);

  const filteredDishes = useMemo(() => {
    const res = allDishes
      .filter((dish) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = dish.name.toLowerCase().includes(q);
          const matchSub = dish.sub ? dish.sub.toLowerCase().includes(q) : false;
          const matchQuip = dish.quip ? dish.quip.toLowerCase().includes(q) : false;
          if (!matchName && !matchSub && !matchQuip) return false;
        }

        // Category filter
        if (categoryFilter !== 'all' && dish.categoryKey !== categoryFilter) {
          return false;
        }

        // Price filter
        if (priceFilter === 'under35' && dish.price >= 35) return false;
        if (priceFilter === '35to65' && (dish.price < 35 || dish.price > 65)) return false;
        if (priceFilter === '65to120' && (dish.price < 65 || dish.price > 120)) return false;
        if (priceFilter === 'above120' && dish.price <= 120) return false;

        // Rarity filter
        if (rarityFilter !== 'all' && (dish.rarity ?? 0) !== rarityFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'price-asc') return a.price - b.price;
        if (sortOption === 'price-desc') return b.price - a.price;
        if (sortOption === 'name-asc') return a.name.localeCompare(b.name, 'vi');
        return 0;
      });

    if (sortOption === 'default' && !searchQuery.trim()) {
      return diversifyFoodList(res);
    }
    return res;
  }, [allDishes, searchQuery, categoryFilter, priceFilter, rarityFilter, sortOption]);

  const displayedDishes = useMemo(() => {
    return filteredDishes.slice(0, visibleCount);
  }, [filteredDishes, visibleCount]);

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setPriceFilter('all');
    setRarityFilter('all');
    setSortOption('default');
  };

  // Counts for pills
  const counts = useMemo(() => {
    return {
      all: allDishes.length,
      anGi: allDishes.filter(d => d.categoryKey === 'an-gi').length,
      nhauGi: allDishes.filter(d => d.categoryKey === 'nhau-gi').length,
      uongGi: allDishes.filter(d => d.categoryKey === 'uong-gi').length,
    };
  }, [allDishes]);

  return (
    <div className="catalog-page-container">
      {/* Sleek, Professional Header Bar (Gọn gàng, xịn xò) */}
      <div className="catalog-header-bar">
        <div className="catalog-header-top-row">
          <button className="catalog-back-pill-btn" onClick={onGoToSpin} title="Quay lại vòng quay">
            <ArrowLeft size={15} />
            <span>Về Vòng Quay</span>
          </button>

          <div className="catalog-header-title-col">
            <h1 className="catalog-title-main">
              KHÁM PHÁ THỰC ĐƠN <span>XUÂN HÒA</span>
            </h1>
            <p className="catalog-title-sub">
              Tổng hợp hơn 300 món ăn chuẩn vị quanh ĐH Sư Phạm Hà Nội 2 &amp; Phường Xuân Hòa
            </p>
            <div className="catalog-header-badges-row">
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400" />
                <span>100% Ảnh Thật</span>
              </span>
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <Tag size={12} className="text-emerald-400" />
                <span>Giá Niêm Yết Rõ Ràng</span>
              </span>
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <Target size={12} className="text-sky-400" />
                <span>Quay Thử Trực Tiếp</span>
              </span>
            </div>
          </div>

          <button className="catalog-header-places-btn" onClick={onGoToPlaces} title="Xem danh bạ quán ăn">
            <Store size={15} className="text-amber-400" />
            <span>Danh Bạ Quán Ăn (50+ quán)</span>
          </button>
        </div>

        {/* Compact, Integrated Search & Filter Controls */}
        <div className="catalog-controls-bar">
          {/* Row 1: Search & Counter Side-by-side (Song song) */}
          <div className="catalog-search-counter-row">
            <div className="catalog-search-box flex-1">
              <Search size={15} className="search-box-icon text-amber-400" />
              <input
                type="search"
                className="search-box-input"
                placeholder="Tìm món ăn, đồ uống, quán..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-box-clear" onClick={() => setSearchQuery('')} title="Xóa tìm kiếm">
                  ×
                </button>
              )}
            </div>

            <div className="catalog-counter-pill shrink-0">
              <span>{Math.min(visibleCount, filteredDishes.length)}/{filteredDishes.length} món</span>
              {(searchQuery || categoryFilter !== 'all' || priceFilter !== 'all' || rarityFilter !== 'all' || sortOption !== 'default') && (
                <button className="catalog-mini-reset-btn" onClick={resetFilters} title="Đặt lại bộ lọc">
                  <RotateCcw size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: 2x2 Grid of 4 Filters (Gọn gàng, cân đối chuẩn 2x2) */}
          <div className="catalog-2x2-filters-grid">
            {/* Filter 1: Danh mục món (Gom Tất cả, Bữa chính... thành 1 ô cuộn) */}
            <div className="control-select-wrap">
              <Utensils size={13} className="text-amber-400 shrink-0" />
              <label htmlFor="catalog-dish-category-select" className="sr-only">Danh mục món</label>
              <select
                id="catalog-dish-category-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
              >
                <option value="all">Tất cả ({counts.all})</option>
                <option value="an-gi">Bữa chính &amp; bún phở ({counts.anGi})</option>
                <option value="nhau-gi">Món nhậu &amp; lẩu nướng ({counts.nhauGi})</option>
                <option value="uong-gi">Đồ uống &amp; trà sữa ({counts.uongGi})</option>
              </select>
            </div>

            {/* Filter 2: Mức giá */}
            <div className="control-select-wrap">
              <SlidersHorizontal size={13} className="text-amber-400 shrink-0" />
              <label htmlFor="catalog-price-select" className="sr-only">Mức giá</label>
              <select
                id="catalog-price-select"
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value as any)}
              >
                <option value="all">Mọi mức giá</option>
                <option value="under35">&lt; 35k (Bình dân)</option>
                <option value="35to65">35k - 65k (No nê)</option>
                <option value="65to120">65k - 120k</option>
                <option value="above120">&gt; 120k (Bàn tiệc)</option>
              </select>
            </div>

            {/* Filter 3: Phẩm cấp hiếm */}
            <div className="control-select-wrap">
              <Sparkles size={13} className="text-amber-400 shrink-0" />
              <label htmlFor="catalog-rarity-select" className="sr-only">Phẩm cấp</label>
              <select
                id="catalog-rarity-select"
                value={rarityFilter}
                onChange={(e) => setRarityFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">Mọi phẩm cấp</option>
                <option value="0">Phổ thông</option>
                <option value="1">Đặc biệt</option>
                <option value="2">Quý hiếm</option>
                <option value="3">Cực hiếm</option>
                <option value="4">Huyền thoại</option>
              </select>
            </div>

            {/* Filter 4: Sắp xếp */}
            <div className="control-select-wrap">
              <ArrowUpDown size={13} className="text-amber-400 shrink-0" />
              <label htmlFor="catalog-sort-select" className="sr-only">Sắp xếp</label>
              <select
                id="catalog-sort-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
              >
                <option value="default">Sắp xếp: Mặc định</option>
                <option value="price-asc">Giá: Thấp → Cao</option>
                <option value="price-desc">Giá: Cao → Thấp</option>
                <option value="name-asc">Tên món: A → Z</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Dishes (Cân đối, chuẩn đẹp, đĩa thức ăn ở tâm, không bị trống) */}
      {filteredDishes.length > 0 ? (
        <>
          <div className="dish-catalog-grid">
            {displayedDishes.map((dish) => {
              const rarity = dish.rarity ?? 0;
              const rarityColor = rarityColors[rarity] || '#3B82F6';
              const rarityName = rarityNames[rarity] || 'Phổ thông';
              const categoryLabel = getFoodCategoryLabel(dish);
              const displayTitle = cleanDishDisplayTitle(dish.name);

              return (
                <div
                  key={dish.customId || `${dish.name}-${dish.price}`}
                  className="dish-clean-card"
                  style={{ '--dish-rarity': rarityColor } as React.CSSProperties}
                  onClick={() => onSelectDish(dish)}
                >
                  {/* Visual Art Box - Plate Centered */}
                  <div className="dish-clean-art">
                    <div className="catalog-card-star-badge" title="Đánh giá chất lượng món">
                      <Star size={10} className="inline mr-1 text-amber-400 fill-amber-400" />
                      <span>{getDishRatingSummary(dish.customId || dish.name).displayRating}</span>
                    </div>
                    <div className="dish-plate-wrapper">
                      <div className="food-plate-halo">
                        <FoodImage food={dish} size="md" />
                      </div>
                    </div>
                  </div>

                  {/* Content Box - Clean, lightweight */}
                  <div className="dish-clean-body">
                    <span className="dish-clean-category" title={categoryLabel}>
                      {categoryLabel}
                    </span>

                    <strong className="dish-clean-name" title={displayTitle}>
                      {formatTypography(displayTitle)}
                    </strong>

                    <div className="dish-clean-footer">
                      <div className="dish-clean-price">
                        {dish.price}.000đ
                      </div>

                      <span className="dish-clean-rarity" style={{ color: rarityColor }}>
                        {rarityName.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Button & Progress */}
          {visibleCount < filteredDishes.length && (
            <div className="catalog-load-more-wrap">
              <div className="catalog-load-more-info">
                <span>Đang xem <strong>{Math.min(visibleCount, filteredDishes.length)}</strong> / <strong>{filteredDishes.length}</strong> món ăn</span>
                <div className="catalog-progress-track">
                  <div 
                    className="catalog-progress-bar" 
                    style={{ width: `${Math.min(100, Math.round((visibleCount / filteredDishes.length) * 100))}%` }} 
                  />
                </div>
              </div>
              <div className="catalog-load-more-actions">
                <button 
                  className="catalog-load-more-btn"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                >
                  <span>Xem Thêm {Math.min(PAGE_SIZE, filteredDishes.length - visibleCount)} Món Tiếp Theo</span>
                  <span className="load-more-counter">(Còn {filteredDishes.length - visibleCount} món)</span>
                </button>
                <button 
                  className="catalog-load-all-btn"
                  onClick={() => setVisibleCount(filteredDishes.length)}
                >
                  Xem Tất Cả ({filteredDishes.length})
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="catalog-empty-box">
          <UtensilsCrossed size={44} className="text-amber-400" />
          <h3>Không tìm thấy món ăn phù hợp</h3>
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
