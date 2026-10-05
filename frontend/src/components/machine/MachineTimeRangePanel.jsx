import React, { useMemo } from 'react';
import {
  CHART_VIEW_MODES,
  CHART_VIEW_MODE_LABELS,
} from '../../utils/chartViewRange';

const MODE_ORDER = [
  CHART_VIEW_MODES.hour,
  CHART_VIEW_MODES.day,
  CHART_VIEW_MODES.week,
  CHART_VIEW_MODES.month,
  CHART_VIEW_MODES.quarter,
  CHART_VIEW_MODES.year,
];

const MODE_SHORT_LABELS = {
  [CHART_VIEW_MODES.hour]: 'Giờ',
  [CHART_VIEW_MODES.day]: 'Ngày',
  [CHART_VIEW_MODES.week]: 'Tuần',
  [CHART_VIEW_MODES.month]: 'Tháng',
  [CHART_VIEW_MODES.quarter]: 'Quý',
  [CHART_VIEW_MODES.year]: 'Năm',
};

function MonthPicker({ selectedMonth, onMonthChange, pickerYear }) {
  return (
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
  );
}

function YearPicker({ selectedYear, onYearChange, yearsDesc, manyYears }) {
  return (
    <div className="machine-view-mode-picker h-100 d-flex flex-column">
      <div className="machine-view-mode-picker__caption">Năm</div>
      <div
        className={`machine-view-mode-picker__grid machine-view-mode-picker__grid--years${
          manyYears ? ' machine-view-mode-picker__grid--years-scroll' : ''
        }`}
        style={{ '--year-cols': Math.min(4, Math.max(2, yearsDesc.length || 1)) }}
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
  );
}

function DayPicker({
  selectedDay,
  selectedMonth,
  pickerYear,
  onDateChange,
}) {
  const value = `${pickerYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const max = new Date().toISOString().slice(0, 10);

  return (
    <div className="machine-view-mode-picker machine-view-mode-picker--date h-100 d-flex flex-column">
      <div className="machine-view-mode-picker__caption">Chọn ngày</div>
      <label className="machine-view-mode-date-field">
        <span className="visually-hidden">Ngày tháng</span>
        <input
          type="date"
          className="machine-view-mode-date-input"
          value={value}
          max={max}
          onChange={(event) => {
            const next = event.target.value;
            if (!next) return;
            const [y, m, d] = next.split('-').map(Number);
            if (!y || !m || !d) return;
            onDateChange({ year: y, month: m, day: d });
          }}
        />
      </label>
    </div>
  );
}

export default function MachineTimeRangePanel({
  viewMode,
  onViewModeChange,
  selectedMonth,
  onMonthChange,
  selectedYear,
  onYearChange,
  selectedDay,
  onDayChange,
  onDateChange,
  availableYears,
  pickerYear,
}) {
  const yearsDesc = useMemo(
    () => [...availableYears].sort((a, b) => b - a),
    [availableYears],
  );
  const manyYears = yearsDesc.length > 4;

  const showDayPicker = viewMode === CHART_VIEW_MODES.hour;
  const showMonthPicker =
    viewMode === CHART_VIEW_MODES.day || viewMode === CHART_VIEW_MODES.week;
  const showYearPicker =
    viewMode === CHART_VIEW_MODES.month
    || viewMode === CHART_VIEW_MODES.quarter
    || viewMode === CHART_VIEW_MODES.year;

  const handleDateChange = onDateChange
    || (({ year, month, day }) => {
      onYearChange?.(year);
      onMonthChange?.(month);
      onDayChange?.(day);
    });

  return (
    <div className="card shadow-sm border-0 machine-top-panel__alarms machine-top-panel__alarms--time w-100 h-100">
      <div className="machine-time-range-panel h-100 d-flex flex-column">
        <div
          className="machine-view-mode-segment machine-view-mode-segment--six"
          role="tablist"
          aria-label="Chế độ xem biểu đồ"
        >
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
          {showDayPicker && (
            <DayPicker
              selectedDay={selectedDay}
              selectedMonth={selectedMonth}
              pickerYear={pickerYear}
              onDateChange={handleDateChange}
            />
          )}
          {showMonthPicker && (
            <MonthPicker
              selectedMonth={selectedMonth}
              onMonthChange={onMonthChange}
              pickerYear={pickerYear}
            />
          )}
          {showYearPicker && (
            <YearPicker
              selectedYear={selectedYear}
              onYearChange={onYearChange}
              yearsDesc={yearsDesc}
              manyYears={manyYears}
            />
          )}
        </div>
      </div>
    </div>
  );
}
