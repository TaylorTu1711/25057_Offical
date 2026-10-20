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
  const isMida = /\bmida-modal-panel\b/.test(panelClassName);

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-range-modal-title"
      >
        <header className="app-modal-time__header">
          <div className="app-modal-time__heading">
            <h5 id="time-range-modal-title" className="app-modal-title app-modal-time__title">
              {title}
            </h5>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Đóng" />
        </header>

        <div className="app-modal-time__body">
          <div className={`app-modal-time__fields${showTimeSelect ? ' app-modal-time__fields--timed' : ''}`}>
            <div className="app-modal-time__field">
              <label className="app-modal-label" htmlFor="time-range-from">
                Bắt đầu
              </label>
              <DatePicker
                id="time-range-from"
                selected={fromDate}
                onChange={handleFromChange}
                dateFormat={dateFormat}
                showTimeSelect={showTimeSelect}
                timeFormat="HH:mm"
                timeIntervals={15}
                timeCaption="Giờ"
                className="form-control app-modal-input"
                placeholderText={showTimeSelect ? 'Ngày giờ bắt đầu' : 'Chọn ngày bắt đầu'}
                calendarClassName="app-modal-time__calendar"
              />
            </div>

            <div className="app-modal-time__divider" aria-hidden="true">
              <span />
            </div>

            <div className="app-modal-time__field">
              <label className="app-modal-label" htmlFor="time-range-to">
                Kết thúc
              </label>
              <DatePicker
                id="time-range-to"
                selected={toDate}
                onChange={handleToChange}
                dateFormat={dateFormat}
                showTimeSelect={showTimeSelect}
                timeFormat="HH:mm"
                timeIntervals={15}
                timeCaption="Giờ"
                minDate={sameCalendarDayOnly ? fromDate : undefined}
                maxDate={sameCalendarDayOnly ? fromDate : undefined}
                className="form-control app-modal-input"
                placeholderText={showTimeSelect ? 'Ngày giờ kết thúc' : 'Chọn ngày kết thúc'}
                calendarClassName="app-modal-time__calendar"
              />
            </div>
          </div>

          {showViewMode && (
            <div className="app-modal-time__field app-modal-time__field--full">
              <label className="app-modal-label" htmlFor="time-range-view-mode">
                Hiển thị
              </label>
              <select
                id="time-range-view-mode"
                className="form-select app-modal-input"
                value={viewMode}
                onChange={(e) => onViewModeChange(e.target.value)}
              >
                <option value="month">Từng ngày</option>
                <option value="year">Từng tháng</option>
              </select>
            </div>
          )}
        </div>

        <footer className="app-modal-time__footer">
          <button
            type="button"
            className={`btn app-modal-btn-outline${isMida ? ' mida-modal-btn' : ''}`}
            onClick={() => {
              onCancel();
              onClose();
            }}
          >
            Huỷ
          </button>
          <button
            type="button"
            className={`btn app-modal-btn-primary px-4${isMida ? ' mida-modal-btn mida-modal-btn--primary' : ''}`}
            onClick={() => {
              const ok = onUpdate?.();
              if (ok !== false) onClose();
            }}
          >
            Cập nhật
          </button>
        </footer>
      </div>
    </div>
  );
}
