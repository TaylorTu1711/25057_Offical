import React, { useMemo } from 'react';
import {
  CHART_VIEW_MODES,
  CHART_VIEW_MODE_LABELS,
} from '../../utils/chartViewRange';
const MODE_ORDER = [
  CHART_VIEW_MODES.day,
  CHART_VIEW_MODES.month,
];

const MODE_SHORT_LABELS = {
  [CHART_VIEW_MODES.day]: 'Tháng',
  [CHART_VIEW_MODES.month]: 'Năm',
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
}) {
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

        <div className="machine-view-mode-body flex-grow-1 min-h-0">
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
        </div>
      </div>
    </div>
  );
}
