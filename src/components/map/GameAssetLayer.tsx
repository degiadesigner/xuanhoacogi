import React from 'react';
import {
  Castle,
  X,
  Sparkles,
  ShieldAlert,
  Coins,
  UserCheck,
  History,
  Link2,
} from 'lucide-react';
import type { GameAsset } from '@/lib/map/map-types';

interface GameAssetLayerProps {
  isEnabled: boolean;
  assets: GameAsset[];
  selectedAsset: GameAsset | null;
  onSelectAsset: (asset: GameAsset | null) => void;
  onToggleEnable: () => void;
}

export const GameAssetLayer: React.FC<GameAssetLayerProps> = ({
  isEnabled,
  assets,
  selectedAsset,
  onSelectAsset,
  onToggleEnable,
}) => {
  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Huy hiệu thông báo rõ ràng khi lớp Game đang bật (Phần 9 & Phần 12) */}
      <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#403064]/95 text-white border-2 border-[#39B980] shadow-md text-[11px]">
        <Castle size={14} className="text-[#39B980] shrink-0" />
        <span>
          <strong>Lớp Tài sản Game (DEMO):</strong> {assets.length} lô mô phỏng · Không phải giao dịch hay quyền sở hữu pháp lý thực tế
        </span>
        <button
          type="button"
          onClick={onToggleEnable}
          className="ml-1 px-2 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-bold cursor-pointer"
        >
          Tắt
        </button>
      </div>

      {/* Nếu không có tài sản game nào */}
      {assets.length === 0 && (
        <div className="pointer-events-auto mt-2 p-3 rounded-2xl bg-[#FFFDF9] border-2 border-[#403064] text-xs text-[#2D2246] max-w-sm">
          Hiện chưa có tài sản game nào trong khu vực này.
        </div>
      )}

      {/* Popup chi tiết Tài sản Game khi người dùng bấm chọn */}
      {selectedAsset && (
        <div
          role="dialog"
          aria-label={`Tài sản game demo ${selectedAsset.name}`}
          className="pointer-events-auto w-full max-w-md rounded-3xl bg-[#FFFDF9] border-2 border-[#403064] shadow-[0_14px_38px_rgba(64,48,100,0.24)] p-4 text-[#2D2246] animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#403064] text-white text-[11px] font-extrabold">
                <Castle size={12} className="text-[#39B980]" />
                <span>TÀI SẢN ẢO · DEMO</span>
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-[#EDE9FE] text-[#403064] text-[10px] font-bold">
                {selectedAsset.ownershipStatus === 'available'
                  ? 'Đang mở mô phỏng'
                  : selectedAsset.ownershipStatus === 'for_rent'
                  ? 'Cho thuê ảo'
                  : 'Công trình Hệ thống'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSelectAsset(null)}
              aria-label="Đóng thông tin tài sản game"
              className="p-1.5 rounded-xl bg-[#F1ECE1] text-[#403064] hover:bg-[#E5DEC9] cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="mt-2.5">
            <h3 className="text-[15px] font-extrabold text-[#403064]">
              {selectedAsset.name}
            </h3>
            <p className="text-xs text-[#65587F] mt-0.5">
              {selectedAsset.districtLabel}
            </p>
            <p className="text-xs text-[#2D2246] mt-1.5 leading-relaxed">
              {selectedAsset.description}
            </p>
          </div>

          {/* Thông số kinh tế ảo */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9]">
              <div className="text-[10px] font-bold text-[#65587F] flex items-center gap-1">
                <Coins size={11} className="text-[#39B980]" />
                <span>Giá mua định danh (Ảo)</span>
              </div>
              <div className="text-xs font-extrabold text-[#2D2246] mt-0.5">
                {selectedAsset.virtualBuyPriceXu > 0
                  ? `${selectedAsset.virtualBuyPriceXu.toLocaleString('vi-VN')} XU`
                  : 'Không mở bán'}
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9]">
              <div className="text-[10px] font-bold text-[#65587F] flex items-center gap-1">
                <UserCheck size={11} className="text-[#403064]" />
                <span>Chủ sở hữu trong Game</span>
              </div>
              <div className="text-xs font-extrabold text-[#2D2246] mt-0.5 truncate">
                {selectedAsset.ownerDisplayName || 'Chưa có người sở hữu'}
              </div>
            </div>
          </div>

          {/* Đặc quyền dự kiến */}
          {selectedAsset.perks.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {selectedAsset.perks.map((perk, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#E6F7EF] text-[#1D7A52] text-[10.5px] font-bold"
                >
                  <Sparkles size={10} />
                  <span>{perk}</span>
                </span>
              ))}
            </div>
          )}

          {/* Tham chiếu địa lý & Lịch sử giao dịch mẫu */}
          <div className="mt-2.5 pt-2.5 border-t border-[#E5DEC9] flex items-center justify-between text-[10px] text-[#65587F]">
            <span className="flex items-center gap-1">
              <Link2 size={11} />
              <span>Ref OSM: {selectedAsset.linkedGeoOsmId || 'N/A'}</span>
            </span>
            <span className="flex items-center gap-1">
              <History size={11} />
              <span>{selectedAsset.transactionHistory.length} bản ghi Demo</span>
            </span>
          </div>

          {/* Cảnh báo minh bạch theo Phần 9 */}
          <div className="mt-2.5 p-2 rounded-xl bg-[#FEF3C7]/70 border border-[#F59E0B]/40 text-[10.5px] text-[#92400E] flex items-start gap-1.5">
            <ShieldAlert size={13} className="shrink-0 mt-0.5" />
            <span>
              Đây là tài sản ảo thuộc lớp mô phỏng Game XUHO CITY (Giai đoạn kiến trúc sẵn sàng mở rộng), hoàn toàn không có giá trị pháp lý bất động sản ngoài đời thực.
            </span>
          </div>
        </div>
      )}
    </>
  );
};
