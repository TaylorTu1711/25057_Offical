import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CHART_VIEW_MODES,
  CHART_VIEW_MODE_LABELS,
  RANGE_DISPLAY_MODES,
  RANGE_DISPLAY_LABELS,
  toLocalDateKey,
} from '../../utils/chartViewRange';

const RANGE_DISPLAY_ORDER = [RANGE_DISPLAY_MODES.day, RANGE_DISPLAY_MODES.month];

const MODE_ORDER = [
  CHART_VIEW_MODES.day,
  CHART_VIEW_MODES.month,
  CHART_VIEW_MODES.year,
  CHART_VIEW_MODES.range,
];

const MODE_SHORT_LABELS = {
  [CHART_VIEW_MODES.day]: 'Tháng',
  [CHART_VIEW_MODES.month]: 'Năm',
  [CHART_VIEW_MODES.year]: 'Tổng',
  [CHART_VIEW_MODES.range]: 'Khoảng',
};

const toDateInputValue = (date) => (date ? toLocalDateKey(date) : '');

const parseDateInputValue = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export default function MachineTimeRangePanel({
  viewMode,
  onViewModeChange,
  selectedMonth,
  onMonthChange,
  selectedYear,
  onYearChange,
  availableYears,
  pickerYear,
  rangeFrom,
  rangeTo,
  onRangeApply,
  rangeDisplay,
  onRangeDisplayChange,
}) {
  const [draftFrom, setDraftFrom] = useState(rangeFrom);
  const [draftTo, setDraftTo] = useState(rangeTo);

  useEffect(() => {
    setDraftFrom(rangeFrom);
    setDraftTo(rangeTo);
  }, [rangeFrom, rangeTo]);

  const commitRange = useCallback(() => {
    if (!draftFrom || !draftTo) return;
    if (
      toLocalDateKey(draftFrom) === toLocalDateKey(rangeFrom) &&
      toLocalDateKey(draftTo) === toLocalDateKey(rangeTo)
    ) {
      return;
    }
    onRangeApply({ from: draftFrom, to: draftTo });
  }, [draftFrom, draftTo, rangeFrom, rangeTo, onRangeApply]);

  const handleRangeKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitRange();
    }
  };

  const yearsDesc = useMemo(
    () => [...availableYears].sort((a, b) => b - a),
    [availableYears],
  );
  const manyYears = yearsDesc.length > 4;

  return (
    <div className="card shadow-sm border-0 machine-top-panel__alarms machine-top-panel__alarms--time w-100 h-100">
      <div className="machine-time-range-panel h-100 d-flex flex-column">
        <div className="machine-view-mode-segment" role="tablist" aria-label="Chế độ xem biểu đồ">
          {MODE_ORDER.map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={viewMode === mode}
              title={CHART_VIEW_MODE_LABELS[mode]}
              className={`machine-view-mode-segment__btn${
                viewMode === mode ? ' machine-view-mode-segment__btn--active' : ''
              }`}
              onClick={() => onViewModeChange(mode)}
            >
              {MODE_SHORT_LABELS[mode]}
            </button>
          ))}
        </div>

        <div
          className={`machine-view-mode-body flex-grow-1 min-h-0${
            viewMode === CHART_VIEW_MODES.range ? ' machine-view-mode-body--scroll' : ''
          }`}
        >
          {viewMode === CHART_VIEW_MODES.day && (
            <div className="machine-view-mode-picker h-100 d-flex flex-column">
              <div className="machine-view-mode-picker__caption">
                Tháng{' '}
                <span className="machine-view-mode-picker__month">{selectedMonth}</span>
                <span className="machine-view-mode-picker__caption-sep"> · </span>
                <span className="machine-view-mode-picker__year">{pickerYear}</span>
              </div>
              <div className="machine-view-mode-picker__grid machine-view-mode-picker__grid--months">
                {Array.from({ length: 12 }, (_, i) => {
                  const month = i + 1;
                  return (
                    <button
                      key={month}
                      type="button"
                      className={`machine-view-mode-chip${
                        selectedMonth === month ? ' machine-view-mode-chip--active' : ''
                      }`}
                      onClick={() => onMonthChange(month)}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === CHART_VIEW_MODES.month && (
            <div className="machine-view-mode-picker h-100 d-flex flex-column">
              <div className="machine-view-mode-picker__caption">Năm</div>
              <div
                className={`machine-view-mode-picker__grid machine-view-mode-picker__grid--years${
                  manyYears ? ' machine-view-mode-picker__grid--years-scroll' : ''
                }`}
                style={{ '--year-cols': Math.min(4, Math.max(2, yearsDesc.length)) }}
              >
                {yearsDesc.map((year) => (
                  <button
                    key={year}
                    type="button"
                    className={`machine-view-mode-chip${
                      selectedYear === year ? ' machine-view-mode-chip--active' : ''
                    }`}
                    onClick={() => onYearChange(year)}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewMode === CHART_VIEW_MODES.year && (
            <div className="machine-view-mode-year-info h-100 d-flex align-items-center justify-content-center">
              <p className="machine-view-mode-hint mb-0 text-center">
                Xem tổng hợp
                <br />
                theo từng năm
              </p>
            </div>
          )}

          {viewMode === CHART_VIEW_MODES.range && (
            <div className="machine-view-mode-range d-flex flex-column">
              <div
                className="machine-view-mode-range__granularity"
                role="group"
                aria-label="Cách hiển thị trong khoảng"
              >
                {RANGE_DISPLAY_ORDER.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`machine-view-mode-range__granularity-btn${
                      rangeDisplay === mode ? ' machine-view-mode-range__granularity-btn--active' : ''
                    }`}
                    onClick={() => onRangeDisplayChange(mode)}
                  >
                    {RANGE_DISPLAY_LABELS[mode]}
                  </button>
                ))}
              </div>
              <p className="machine-view-mode-range__hint mb-0 text-center">
                Chọn ngày xong, nhấn ra ngoài hoặc Enter để cập nhật
              </p>
              <div className="machine-view-mode-range__field">
                <label className="machine-view-mode-range__label" htmlFor="chart-range-from">
                  Từ ngày
                </label>
                <input
                  id="chart-range-from"
                  type="date"
                  className="machine-view-mode-range__input form-control form-control-sm"
                  value={toDateInputValue(draftFrom)}
                  max={toDateInputValue(draftTo) || undefined}
                  onChange={(e) => {
                    const next = parseDateInputValue(e.target.value);
                    if (next) setDraftFrom(next);
                  }}
                  onBlur={commitRange}
                  onKeyDown={handleRangeKeyDown}
                />
              </div>
              <div className="machine-view-mode-range__field">
                <label className="machine-view-mode-range__label" htmlFor="chart-range-to">
                  Đến ngày
                </label>
                <input
                  id="chart-range-to"
                  type="date"
                  className="machine-view-mode-range__input form-control form-control-sm"
                  value={toDateInputValue(draftTo)}
                  min={toDateInputValue(draftFrom) || undefined}
                  onChange={(e) => {
                    const next = parseDateInputValue(e.target.value);
                    if (next) setDraftTo(next);
                  }}
                  onBlur={commitRange}
                  onKeyDown={handleRangeKeyDown}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
