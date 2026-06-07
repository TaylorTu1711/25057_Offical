import React from 'react';
import DatePicker from 'react-datepicker';

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
  onCancel,
  onUpdate,
  onClose,
}) {
  if (!open) return null;

  const dateFormat = showTimeSelect ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';

  return (
    <div className="app-modal app-modal-overlay" onClick={onClose}>
      <div
        className="app-modal-panel app-modal-panel--time"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="app-modal-title">{title}</h5>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Đóng" />
        </div>

        <hr />

        <div className="mt-3">
          <label className="app-modal-label">Từ ngày:</label>
          <DatePicker
            selected={fromDate}
            onChange={onFromDateChange}
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
            onChange={onToDateChange}
            dateFormat={dateFormat}
            showTimeSelect={showTimeSelect}
            timeFormat="HH:mm"
            timeIntervals={15}
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
              onUpdate();
              onClose();
            }}
          >
            Cập nhật
          </button>
        </div>
      </div>
    </div>
  );
}
