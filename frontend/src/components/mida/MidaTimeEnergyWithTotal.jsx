import React, { useMemo } from 'react';
import LineChart_TimeOn from '../BarChart_Thoigian';
import { NEON_BAR_GRADIENTS, formatChartTooltipValue } from '../../utils/chartTheme';

const timePalette = NEON_BAR_GRADIENTS.neonPink;
const energyPalette = NEON_BAR_GRADIENTS.cyanBlue;

function sumSeries(values = []) {
  return values.reduce((sum, v) => {
    const n = Number(v);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function peakSeries(values = []) {
  let peak = 0;
  values.forEach((v) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > peak) peak = n;
  });
  return peak;
}

function barHeight(total, peak) {
  if (!(total > 0)) return 0;
  const scale = peak > 0 ? peak * 1.15 : total;
  return Math.max(8, Math.min(100, (total / scale) * 100));
}

/**
 * Biểu đồ thời gian cắt gọt & điện năng + cột TỔNG bên phải
 * (chữ TỔNG nằm cùng cột với 2 thanh tổng → luôn căn giữa).
 */
export default function MidaTimeEnergyWithTotal({
  labels = [],
  timeRunValues = [],
  energyKwhValues = [],
  xTickMode = 'month',
  categoryPrefix = '',
  timeSeriesType = 'line',
  timeSeriesLabel = 'Thời gian cắt gọt (giờ)',
}) {
  const totals = useMemo(() => {
    const timeTotal = sumSeries(timeRunValues);
    const energyTotal = sumSeries(energyKwhValues);
    const timePeak = peakSeries(timeRunValues);
    const energyPeak = peakSeries(energyKwhValues);
    return {
      timeTotal,
      energyTotal,
      timeH: barHeight(timeTotal, timePeak),
      energyH: barHeight(energyTotal, energyPeak),
      hasData: timeTotal > 0 || energyTotal > 0,
    };
  }, [timeRunValues, energyKwhValues]);

  const timeLabel = formatChartTooltipValue(totals.timeTotal, 1);
  const energyLabel = formatChartTooltipValue(totals.energyTotal, 1);

  return (
    <div className="mida-time-total-wrap mida-time-total-wrap--split">
      <div className="mida-time-total-wrap__main">
        <div className="chart-title-brand machine-chart-head mida-time-total-head">
          <div className="mida-time-total-head__main">THỜI GIAN CẮT GỌT & ĐIỆN NĂNG</div>
        </div>
        <div className="machine-chart-plot">
          <div className="machine-chart-plot-inner">
            <LineChart_TimeOn
              labels={labels}
              line3={timeRunValues}
              energyKwhValues={energyKwhValues}
              xTickMode={xTickMode}
              categoryPrefix={categoryPrefix}
              timeSeriesType={timeSeriesType}
              timeSeriesLabel={timeSeriesLabel}
            />
          </div>
        </div>
      </div>

      <aside
        className="mida-time-total"
        aria-label="Tổng thời gian cắt gọt và điện năng"
      >
        <div className="chart-title-brand machine-chart-head mida-time-total__title">
          TỔNG
        </div>
        <div
          className="mida-time-total__bars"
          role="img"
          aria-label={
            totals.hasData
              ? `Tổng cắt gọt ${timeLabel} giờ, điện năng ${energyLabel} kWh`
              : 'Chưa có dữ liệu tổng'
          }
        >
          <div className="mida-time-total__col">
            <div className="mida-time-total__track">
              {totals.timeTotal > 0 ? (
                <div
                  className="mida-time-total__bar mida-time-total__bar--time"
                  style={{
                    height: `${totals.timeH}%`,
                    background: `linear-gradient(180deg, ${timePalette.top} 0%, ${timePalette.bottom} 100%)`,
                    borderColor: timePalette.border,
                  }}
                >
                  <span className="mida-time-total__pct">{timeLabel} h</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mida-time-total__col">
            <div className="mida-time-total__track">
              {totals.energyTotal > 0 ? (
                <div
                  className="mida-time-total__bar mida-time-total__bar--energy"
                  style={{
                    height: `${totals.energyH}%`,
                    background: `linear-gradient(180deg, ${energyPalette.top} 0%, ${energyPalette.bottom} 100%)`,
                    borderColor: energyPalette.border,
                  }}
                >
                  <span className="mida-time-total__pct">{energyLabel} kWh</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
