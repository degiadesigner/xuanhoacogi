import React, { useState, useMemo } from 'react';
import { getAllCatalogFoods, CatalogFoodItem, MainCategoryKey, diversifyFoodList } from '@/lib/xuanhoa-catalog';
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
  Coffee
} from 'lucide-react';
import { formatTypography, getFoodCategoryLabel, cleanDishDisplayTitle } from '@/lib/utils';

interface DishesCatalogViewProps {
  onSelectDish: (dish: CatalogFoodItem) => void;
  onSpinWithDish?: (dish: CatalogFoodItem) => void;
  onGoToSpin: () => void;
  onGoToPlaces: () => void;
}

const rarityNames = ['Phổ thông', 'Đặc biệt', 'Quý hiếm', 'Cực hiếm', 'Huyền thoại'];
const rarityColors = ['#10B981', '#F59E0B', '#A855F7', '#F97316', '#EF4444'];
const PAGE_SIZE = 24;

export function DishesCatalogView({
  onSelectDish,
  onSpinWithDish,
  onGoToSpin,
  onGoToPlaces,
}: DishesCatalogViewProps) {
  const allDishes = useMemo(() => getAllCatalogFoods(), []);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MainCategoryKey>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'under35' | '35to65' | '65to120' | 'above120'>('all');
  const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc' | 'name-asc'>('default');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination when filter or search changes
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, categoryFilter, priceFilter, sortOption]);

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
  }, [allDishes, searchQuery, categoryFilter, priceFilter, sortOption]);

  const displayedDishes = useMemo(() => {
    return filteredDishes.slice(0, visibleCount);
  }, [filteredDishes, visibleCount]);

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setPriceFilter('all');
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
          {/* Search Input */}
          <div className="catalog-search-box">
            <Search size={16} className="search-box-icon text-amber-400" />
            <input
              type="search"
              className="search-box-input"
              placeholder="Tìm món, quán hoặc vị... (VD: bánh xèo, bún đậu, mì cay, lẩu, trà sữa, ốc...)"
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
            {/* Category Pills */}
            <div className="category-pill-group">
              <button
                className={`cat-pill ${categoryFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('all')}
              >
                Tất Cả ({counts.all})
              </button>
              <button
                className={`cat-pill ${categoryFilter === 'an-gi' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('an-gi')}
              >
                <Utensils size={13} className="inline mr-1 text-amber-400" />
                Bữa Chính &amp; Bún Phở ({counts.anGi})
              </button>
              <button
                className={`cat-pill ${categoryFilter === 'nhau-gi' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('nhau-gi')}
              >
                <Flame size={13} className="inline mr-1 text-orange-400" />
                Món Nhậu &amp; Lẩu Nướng ({counts.nhauGi})
              </button>
              <button
                className={`cat-pill ${categoryFilter === 'uong-gi' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('uong-gi')}
              >
                <Coffee size={13} className="inline mr-1 text-sky-400" />
                Đồ Uống &amp; Trà Sữa ({counts.uongGi})
              </button>
            </div>

            {/* Price & Sort Selects */}
            <div className="select-pill-group">
              <div className="control-select-wrap">
                <SlidersHorizontal size={13} className="text-amber-400" />
                <label htmlFor="catalog-price-select" className="sr-only">Mức giá</label>
                <select
                  id="catalog-price-select"
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(e.target.value as any)}
                >
                  <option value="all">Tất cả mức giá</option>
                  <option value="under35">&lt; 35.000đ (Bình dân)</option>
                  <option value="35to65">35k - 65k (No nê)</option>
                  <option value="65to120">65k - 120k (Ăn ngon)</option>
                  <option value="above120">&gt; 120k (Bàn tiệc)</option>
                </select>
              </div>

              <div className="control-select-wrap">
                <ArrowUpDown size={13} className="text-amber-400" />
                <label htmlFor="catalog-sort-select" className="sr-only">Sắp xếp</label>
                <select
                  id="catalog-sort-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as any)}
                >
                  <option value="default">Sắp xếp: Mặc định</option>
                  <option value="price-asc">Giá: Thấp đến Cao</option>
                  <option value="price-desc">Giá: Cao đến Thấp</option>
                  <option value="name-asc">Tên món: A đến Z</option>
                </select>
              </div>

              {(searchQuery || categoryFilter !== 'all' || priceFilter !== 'all' || sortOption !== 'default') && (
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
            Đang hiển thị <strong>{Math.min(visibleCount, filteredDishes.length)}</strong> / {filteredDishes.length} món ngon xác thực (Tổng kho {allDishes.length} món)
          </span>
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
                  <span>Xem Thêm 24 Món Tiếp Theo</span>
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
