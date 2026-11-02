import React, { useEffect, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';

export interface DayScheduleEntry {
  dayKey: 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN';
  label: string;
  open: string;
  close: string;
  isClosed: boolean;
}

const DAYS_META: Array<{ key: DayScheduleEntry['dayKey']; label: string }> = [
  { key: 'T2', label: 'Thứ 2' },
  { key: 'T3', label: 'Thứ 3' },
  { key: 'T4', label: 'Thứ 4' },
  { key: 'T5', label: 'Thứ 5' },
  { key: 'T6', label: 'Thứ 6' },
  { key: 'T7', label: 'Thứ 7' },
  { key: 'CN', label: 'Chủ Nhật' },
];

const QUICK_TIME_PRESETS = ['07:00', '08:00', '17:00', '22:00', '23:00'] as const;

/**
 * Chuẩn hóa chuỗi giờ gõ tắt:
 * - "0730" -> "07:30"
 * - "2230" -> "22:30"
 * - "7:30" -> "07:30"
 * - "730"  -> "07:30" (khi blur)
 */
export function autoFormatTimeInput(raw: string, isBlur = false): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Nếu chỉ gồm đúng 4 chữ số liền nhau (VD: 0730, 2230, 2690) -> tự chèn dấu ":" ngay khi đang gõ
  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}:${trimmed.slice(2, 4)}`;
  }

  // Nếu có dạng H:MM (VD: 7:30) -> chuẩn hóa thành 07:30
  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    const hh = colonMatch[1].padStart(2, '0');
    const mm = colonMatch[2];
    if (isBlur) {
      return `${hh}:${mm.padStart(2, '0')}`;
    }
    if (mm.length === 2) {
      return `${hh}:${mm}`;
    }
  }

  if (isBlur) {
    // "730" -> "07:30"
    if (/^\d{3}$/.test(trimmed)) {
      return `0${trimmed[0]}:${trimmed.slice(1, 3)}`;
    }
    // "7" hoặc "07" -> "07:00"
    if (/^\d{1,2}$/.test(trimmed)) {
      return `${trimmed.padStart(2, '0')}:00`;
    }
  }

  return trimmed;
}

/**
 * Kiểm tra giờ hợp lệ trong khoảng 00:00 -> 23:59
 */
export function validateTime24h(val: string): { valid: boolean; error?: string } {
  const clean = val.trim();
  if (!clean) return { valid: true };
  const match = clean.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return {
      valid: false,
      error: 'Giờ phải theo định dạng HH:MM (00:00 – 23:59)',
    };
  }
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return {
      valid: false,
      error: `Giờ "${clean}" không hợp lệ (chỉ nhận 00:00 – 23:59)`,
    };
  }
  return { valid: true };
}

function parseInitialOpenHours(value: string): {
  openTime: string;
  closeTime: string;
  is24Hours: boolean;
  isClosedAll: boolean;
} {
  const v = (value || '').trim();
  if (!v) {
    return { openTime: '07:30', closeTime: '17:30', is24Hours: false, isClosedAll: false };
  }
  const lower = v.toLowerCase();
  if (lower.includes('24/7') || lower.includes('24 giờ') || lower.includes('24h') || v === '00:00 - 23:59') {
    return { openTime: '00:00', closeTime: '23:59', is24Hours: true, isClosedAll: false };
  }
  if (lower === 'đóng cửa' || lower === 'nghỉ' || lower.startsWith('nghỉ / đóng cửa')) {
    return { openTime: '07:30', closeTime: '17:30', is24Hours: false, isClosedAll: true };
  }
  const rangeMatch = v.match(/(\d{1,2}:\d{2})\s*[-–—~]\s*(\d{1,2}:\d{2})/);
  if (rangeMatch) {
    return {
      openTime: autoFormatTimeInput(rangeMatch[1], true),
      closeTime: autoFormatTimeInput(rangeMatch[2], true),
      is24Hours: false,
      isClosedAll: false,
    };
  }
  return { openTime: '07:30', closeTime: '17:30', is24Hours: false, isClosedAll: false };
}

export interface FastOpeningHoursInputProps {
  value: string;
  onChange: (nextValue: string) => void;
  onValidationChange?: (hasError: boolean, errorMessage: string | null) => void;
  compact?: boolean;
}

export const FastOpeningHoursInput: React.FC<FastOpeningHoursInputProps> = ({
  value,
  onChange,
  onValidationChange,
}) => {
  const parsedInit = parseInitialOpenHours(value);
  const [openTime, setOpenTime] = useState<string>(parsedInit.openTime);
  const [closeTime, setCloseTime] = useState<string>(parsedInit.closeTime);
  const [is24Hours, setIs24Hours] = useState<boolean>(parsedInit.is24Hours);
  const [isClosedAll, setIsClosedAll] = useState<boolean>(parsedInit.isClosedAll);
  const [activeField, setActiveField] = useState<'open' | 'close'>('open');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showWeekly, setShowWeekly] = useState<boolean>(false);
  const [weeklySchedule, setWeeklySchedule] = useState<DayScheduleEntry[]>(() =>
    DAYS_META.map((d) => ({
      dayKey: d.key,
      label: d.label,
      open: parsedInit.openTime,
      close: parsedInit.closeTime,
      isClosed: false,
    }))
  );

  // Đồng bộ khi prop value đổi từ bên ngoài (VD: chọn địa điểm khác trong dropdown)
  useEffect(() => {
    const next = parseInitialOpenHours(value);
    setOpenTime(next.openTime);
    setCloseTime(next.closeTime);
    setIs24Hours(next.is24Hours);
    setIsClosedAll(next.isClosedAll);
    setInlineError(null);
    onValidationChange?.(false, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const validateAndEmit = (
    nextOpen: string,
    nextClose: string,
    next24h: boolean,
    nextClosed: boolean,
    customWeekly?: DayScheduleEntry[]
  ) => {
    if (nextClosed) {
      setInlineError(null);
      onValidationChange?.(false, null);
      onChange('Nghỉ / Đóng cửa');
      return;
    }
    if (next24h) {
      setInlineError(null);
      onValidationChange?.(false, null);
      onChange('24/7');
      return;
    }

    const vOpen = validateTime24h(nextOpen);
    if (!vOpen.valid) {
      setInlineError(vOpen.error || 'Giờ mở cửa không hợp lệ');
      onValidationChange?.(true, vOpen.error || 'Giờ mở cửa không hợp lệ');
      return;
    }
    const vClose = validateTime24h(nextClose);
    if (!vClose.valid) {
      setInlineError(vClose.error || 'Giờ đóng cửa không hợp lệ');
      onValidationChange?.(true, vClose.error || 'Giờ đóng cửa không hợp lệ');
      return;
    }

    if (customWeekly && showWeekly) {
      for (const day of customWeekly) {
        if (day.isClosed) continue;
        const vo = validateTime24h(day.open);
        const vc = validateTime24h(day.close);
        if (!vo.valid || !vc.valid) {
          const msg = `${day.label}: ${vo.error || vc.error}`;
          setInlineError(msg);
          onValidationChange?.(true, msg);
          return;
        }
      }
    }

    setInlineError(null);
    onValidationChange?.(false, null);

    if (nextOpen && nextClose) {
      onChange(`${nextOpen} - ${nextClose}`);
    }
  };

  const handleOpenTimeChange = (raw: string) => {
    const formatted = autoFormatTimeInput(raw, false);
    setOpenTime(formatted);
    if (formatted.length >= 5 || /[^0-9:]/.test(formatted)) {
      validateAndEmit(formatted, closeTime, is24Hours, isClosedAll);
    } else {
      setInlineError(null);
      onValidationChange?.(false, null);
    }
  };

  const handleCloseTimeChange = (raw: string) => {
    const formatted = autoFormatTimeInput(raw, false);
    setCloseTime(formatted);
    if (formatted.length >= 5 || /[^0-9:]/.test(formatted)) {
      validateAndEmit(openTime, formatted, is24Hours, isClosedAll);
    } else {
      setInlineError(null);
      onValidationChange?.(false, null);
    }
  };

  const handleBlurOpen = () => {
    const formatted = autoFormatTimeInput(openTime, true);
    setOpenTime(formatted);
    validateAndEmit(formatted, closeTime, is24Hours, isClosedAll);
  };

  const handleBlurClose = () => {
    const formatted = autoFormatTimeInput(closeTime, true);
    setCloseTime(formatted);
    validateAndEmit(openTime, formatted, is24Hours, isClosedAll);
  };

  const handlePresetClick = (preset: string) => {
    if (is24Hours || isClosedAll) {
      setIs24Hours(false);
      setIsClosedAll(false);
    }
    const targetField =
      activeField || (preset === '07:00' || preset === '08:00' ? 'open' : 'close');
    if (targetField === 'open') {
      setOpenTime(preset);
      setActiveField('close');
      validateAndEmit(preset, closeTime, false, false);
    } else {
      setCloseTime(preset);
      validateAndEmit(openTime, preset, false, false);
    }
  };

  const handleApplyAllDays = () => {
    const fmtOpen = autoFormatTimeInput(openTime, true) || '07:30';
    const fmtClose = autoFormatTimeInput(closeTime, true) || '22:30';
    const next = weeklySchedule.map((d) => ({
      ...d,
      open: fmtOpen,
      close: fmtClose,
      isClosed: false,
    }));
    setWeeklySchedule(next);
    validateAndEmit(fmtOpen, fmtClose, false, false, next);
  };

  const handleCopyMonToFri = () => {
    const mon = weeklySchedule[0];
    const fmtOpen = autoFormatTimeInput(mon?.open || openTime, true) || '07:30';
    const fmtClose = autoFormatTimeInput(mon?.close || closeTime, true) || '22:30';
    const next = weeklySchedule.map((d) =>
      d.dayKey === 'T2' || d.dayKey === 'T3' || d.dayKey === 'T4' || d.dayKey === 'T5' || d.dayKey === 'T6'
        ? { ...d, open: fmtOpen, close: fmtClose, isClosed: mon?.isClosed ?? false }
        : d
    );
    setWeeklySchedule(next);
    validateAndEmit(fmtOpen, fmtClose, false, false, next);
  };

  return (
    <div
      data-testid="fast-opening-hours-input"
      className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-2 space-y-1.5"
    >
      {/* Header + 24h / Đóng cửa + Lịch tuần */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#334155]">
          <Clock size={12} strokeWidth={1.75} className="text-[#059669]" />
          <span>Giờ hoạt động</span>
        </span>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-1 text-[11px] font-medium text-[#334155] cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="hours-24h-checkbox"
              checked={is24Hours}
              onChange={(e) => {
                const checked = e.target.checked;
                setIs24Hours(checked);
                if (checked) {
                  setIsClosedAll(false);
                  setOpenTime('00:00');
                  setCloseTime('23:59');
                }
                validateAndEmit(checked ? '00:00' : openTime, checked ? '23:59' : closeTime, checked, false);
              }}
              className="w-3.5 h-3.5 accent-[#059669] rounded cursor-pointer"
            />
            <span>Mở cửa 24 giờ</span>
          </label>

          <label className="inline-flex items-center gap-1 text-[11px] font-medium text-[#475569] cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="hours-closed-checkbox"
              checked={isClosedAll}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsClosedAll(checked);
                if (checked) setIs24Hours(false);
                validateAndEmit(openTime, closeTime, false, checked);
              }}
              className="w-3.5 h-3.5 accent-[#64748B] rounded cursor-pointer"
            />
            <span>Nghỉ / Đóng cửa</span>
          </label>

          <button
            type="button"
            data-testid="hours-toggle-weekly"
            onClick={() => setShowWeekly((prev) => !prev)}
            className={`h-6 px-2 rounded-[6px] border text-[10.5px] font-semibold inline-flex items-center gap-1 cursor-pointer transition ${
              showWeekly
                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F1F5F9]'
            }`}
          >
            <Calendar size={11} strokeWidth={1.75} />
            <span>T2–CN</span>
          </button>
        </div>
      </div>

      {/* 2 Ô NHẬP GIỜ TRỰC TIẾP: Mở cửa [ 07:30 ] | Đóng cửa [ 22:30 ] */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-[#475569] whitespace-nowrap">Mở cửa</span>
          <input
            type="text"
            inputMode="numeric"
            data-testid="hours-open-input"
            disabled={is24Hours || isClosedAll}
            value={openTime}
            onFocus={() => setActiveField('open')}
            onChange={(e) => handleOpenTimeChange(e.target.value)}
            onBlur={handleBlurOpen}
            placeholder="07:30"
            maxLength={5}
            className="w-full h-[34px] px-2 rounded-[8px] border border-[#CBD5E1] bg-white font-mono text-[12px] font-semibold text-[#0F172A] text-center focus:outline-none focus:border-[#059669] disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-[#475569] whitespace-nowrap">Đóng cửa</span>
          <input
            type="text"
            inputMode="numeric"
            data-testid="hours-close-input"
            disabled={is24Hours || isClosedAll}
            value={closeTime}
            onFocus={() => setActiveField('close')}
            onChange={(e) => handleCloseTimeChange(e.target.value)}
            onBlur={handleBlurClose}
            placeholder="22:30"
            maxLength={5}
            className="w-full h-[34px] px-2 rounded-[8px] border border-[#CBD5E1] bg-white font-mono text-[12px] font-semibold text-[#0F172A] text-center focus:outline-none focus:border-[#059669] disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
          />
        </div>
      </div>

      {/* QUICK PRESETS NHỎ: 07:00 | 08:00 | 17:00 | 22:00 | 23:00 */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] font-medium text-[#64748B] mr-0.5">Nhanh:</span>
        {QUICK_TIME_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            data-testid={`hours-preset-${preset}`}
            onClick={() => handlePresetClick(preset)}
            className="h-6 px-2 rounded-[6px] bg-white hover:bg-[#ECFDF5] border border-[#E2E8F0] hover:border-[#059669] text-[10.5px] font-mono font-medium text-[#334155] hover:text-[#059669] cursor-pointer transition"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* LỊCH THỨ 2 -> CHỦ NHẬT COMPACT + NÚT ÁP DỤNG T2-CN / COPY T2->T2-T6 */}
      {showWeekly && (
        <div
          data-testid="hours-weekly-panel"
          className="pt-1.5 border-t border-[#E2E8F0] space-y-1.5"
        >
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <span className="text-[10.5px] font-semibold text-[#475569]">
              Lịch từng ngày (Thứ 2 – Chủ Nhật)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="hours-apply-all-days"
                onClick={handleApplyAllDays}
                className="h-6 px-2 rounded-[6px] bg-[#ECFDF5] hover:bg-[#D1FAE5] border border-[#059669]/40 text-[#059669] text-[10.5px] font-semibold cursor-pointer transition"
              >
                Áp dụng T2–CN
              </button>
              <button
                type="button"
                data-testid="hours-copy-mon-fri"
                onClick={handleCopyMonToFri}
                className="h-6 px-2 rounded-[6px] bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] text-[10.5px] font-semibold cursor-pointer transition"
              >
                Copy T2 → T2–T6
              </button>
            </div>
          </div>

          <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
            {weeklySchedule.map((day, idx) => (
              <div
                key={day.dayKey}
                data-testid={`hours-day-row-${day.dayKey}`}
                className="flex items-center justify-between gap-1.5 text-[11px] bg-white px-2 py-1 rounded-[7px] border border-[#E2E8F0]"
              >
                <span className="w-16 font-medium text-[#334155] truncate">{day.label}</span>
                {day.isClosed ? (
                  <span className="flex-1 text-center text-[11px] font-medium text-[#94A3B8]">
                    Nghỉ / Đóng cửa
                  </span>
                ) : (
                  <div className="flex items-center gap-1 flex-1 justify-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      data-testid={`hours-day-open-${day.dayKey}`}
                      value={day.open}
                      maxLength={5}
                      onChange={(e) => {
                        const fmt = autoFormatTimeInput(e.target.value, false);
                        const next = [...weeklySchedule];
                        next[idx] = { ...day, open: fmt };
                        setWeeklySchedule(next);
                        if (idx === 0) setOpenTime(fmt);
                        if (fmt.length >= 5) validateAndEmit(openTime, closeTime, false, false, next);
                      }}
                      onBlur={() => {
                        const fmt = autoFormatTimeInput(day.open, true);
                        const next = [...weeklySchedule];
                        next[idx] = { ...day, open: fmt };
                        setWeeklySchedule(next);
                        validateAndEmit(openTime, closeTime, false, false, next);
                      }}
                      className="w-[58px] h-[26px] px-1 rounded-[6px] border border-[#CBD5E1] font-mono text-[11px] font-semibold text-center text-[#0F172A] focus:outline-none focus:border-[#059669]"
                    />
                    <span className="text-[#64748B]">–</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      data-testid={`hours-day-close-${day.dayKey}`}
                      value={day.close}
                      maxLength={5}
                      onChange={(e) => {
                        const fmt = autoFormatTimeInput(e.target.value, false);
                        const next = [...weeklySchedule];
                        next[idx] = { ...day, close: fmt };
                        setWeeklySchedule(next);
                        if (idx === 0) setCloseTime(fmt);
                        if (fmt.length >= 5) validateAndEmit(openTime, closeTime, false, false, next);
                      }}
                      onBlur={() => {
                        const fmt = autoFormatTimeInput(day.close, true);
                        const next = [...weeklySchedule];
                        next[idx] = { ...day, close: fmt };
                        setWeeklySchedule(next);
                        validateAndEmit(openTime, closeTime, false, false, next);
                      }}
                      className="w-[58px] h-[26px] px-1 rounded-[6px] border border-[#CBD5E1] font-mono text-[11px] font-semibold text-center text-[#0F172A] focus:outline-none focus:border-[#059669]"
                    />
                  </div>
                )}
                <input
                  type="checkbox"
                  title={day.isClosed ? 'Bật mở cửa ngày này' : 'Đánh dấu nghỉ ngày này'}
                  checked={!day.isClosed}
                  onChange={(e) => {
                    const next = [...weeklySchedule];
                    next[idx] = { ...day, isClosed: !e.target.checked };
                    setWeeklySchedule(next);
                    validateAndEmit(openTime, closeTime, false, false, next);
                  }}
                  className="w-3.5 h-3.5 accent-[#059669] rounded cursor-pointer shrink-0"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BÁO LỖI INLINE NHẸ NẾU NHẬP GIỜ SAI (VD: 26:90) */}
      {inlineError && (
        <div
          data-testid="hours-validation-error"
          className="text-[11px] font-medium text-[#DC2626] px-1"
        >
          {inlineError}
        </div>
      )}
    </div>
  );
};
