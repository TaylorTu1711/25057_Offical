import React from 'react';
import DatePicker from 'react-datepicker';

function isSameLocalDay(a, b) {
  if (!a || !b) return true;
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

function withTimeOnDay(daySource, timeSource) {
  const next = new Date(daySource);
  const t = timeSource instanceof Date ? timeSource : daySource;
  next.setHours(t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds());
  return next;
}

export default function TimeRangeModal({
  open,
  title,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  showViewMode = false,
  viewMode,
  onViewModeChange,
  showTimeSelect = false,
  /** Chỉ cho phép chọn trong cùng một ngày lịch (00:00–23:59). */
  sameCalendarDayOnly = false,
  overlayClassName = '',
  panelClassName = '',
  onCancel,
  onUpdate,
  onClose,
}) {
  if (!open) return null;

  const dateFormat = showTimeSelect ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';

  const handleFromChange = (date) => {
    if (!date) {
      onFromDateChange?.(date);
      return;
    }
    onFromDateChange?.(date);
    if (sameCalendarDayOnly && toDate && !isSameLocalDay(date, toDate)) {
      let nextTo = withTimeOnDay(date, toDate);
      if (nextTo.getTime() < date.getTime()) {
        nextTo = withTimeOnDay(date, date);
        nextTo.setHours(23, 59, 0, 0);
        if (nextTo.getTime() < date.getTime()) nextTo = new Date(date);
      }
      onToDateChange?.(nextTo);
    }
  };

  const handleToChange = (date) => {
    if (!date) {
      onToDateChange?.(date);
      return;
    }
    if (sameCalendarDayOnly && fromDate && !isSameLocalDay(date, fromDate)) {
      let nextTo = withTimeOnDay(fromDate, date);
      if (nextTo.getTime() < fromDate.getTime()) nextTo = new Date(fromDate);
      onToDateChange?.(nextTo);
      return;
    }
    onToDateChange?.(date);
  };

  return (
    <div
      className={`app-modal app-modal-overlay ${overlayClassName}`.trim()}
      onClick={onClose}
    >
      <div
        className={`app-modal-panel app-modal-panel--time ${panelClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="app-modal-title">{title}</h5>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Đóng" />
        </div>

        <hr />

        {sameCalendarDayOnly && (
          <p className="app-modal-hint mb-0 mt-1" style={{ fontSize: '0.875rem', opacity: 0.8 }}>
            Chỉ chọn trong cùng một ngày (tối đa 00:00–23:59).
          </p>
        )}

        <div className="mt-3">
          <label className="app-modal-label">Từ ngày:</label>
          <DatePicker
            selected={fromDate}
            onChange={handleFromChange}
            dateFormat={dateFormat}
            showTimeSelect={showTimeSelect}
            timeFormat="HH:mm"
            timeIntervals={15}
            className="form-control app-modal-input"
            placeholderText="Chọn ngày bắt đầu"
          />
        </div>

        <div className="mt-3">
          <label className="app-modal-label">Đến ngày:</label>
          <DatePicker
            selected={toDate}
            onChange={handleToChange}
            dateFormat={dateFormat}
            showTimeSelect={showTimeSelect}
            timeFormat="HH:mm"
            timeIntervals={15}
            minDate={sameCalendarDayOnly ? fromDate : undefined}
            maxDate={sameCalendarDayOnly ? fromDate : undefined}
            className="form-control app-modal-input"
            placeholderText="Chọn ngày kết thúc"
          />
        </div>

        {showViewMode && (
          <div className="mt-3">
            <label className="app-modal-label">Hiển thị:</label>
            <select
              className="form-select app-modal-input"
              value={viewMode}
              onChange={(e) => onViewModeChange(e.target.value)}
            >
              <option value="month">Từng ngày</option>
              <option value="year">Từng tháng</option>
            </select>
          </div>
        )}

        <div className="d-flex justify-content-end mt-4 gap-2 flex-wrap">
          <button
            type="button"
            className="btn app-modal-btn-outline"
            onClick={() => {
              onCancel();
              onClose();
            }}
          >
            Huỷ
          </button>
          <button
            type="button"
            className="btn app-modal-btn-primary px-4"
            onClick={() => {
              const ok = onUpdate?.();
              if (ok !== false) onClose();
            }}
          >
            Cập nhật
          </button>
        </div>
      </div>
    </div>
  );
}
