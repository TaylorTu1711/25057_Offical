import React, { useCallback, useEffect, useMemo, useState } from 'react';
import useTheme from '../../hooks/useTheme';
import MidaChartExpand from '../mida/MidaChartExpand';
import DtrBottleCountsHourlyChart, {
  DTR_BOTTLE_COUNT_COLORS,
  DtrBottleCountsLegend,
} from './DtrBottleCountsHourlyChart';
import { resolveBottleGlossary } from '../../utils/dtrBottleGlossary';

/** @deprecated dùng resolveBottleGlossary / DTR_BOTTLE_GLOSSARY_KEYS */
export const DTR_BOTTLE_KEY_GLOSSARY = resolveBottleGlossary(null);

const FALLBACK_COLORS = [
  '#3498db',
  '#2ecc71',
  '#9b59b6',
  '#e74c3c',
  '#f39c12',
  '#1abc9c',
  '#8e44ad',
  '#16a085',
  '#c0392b',
  '#27ae60',
];

function colorForKey(key, index) {
  const k = String(key || '').toLowerCase();
  if (DTR_BOTTLE_COUNT_COLORS[k]) return DTR_BOTTLE_COUNT_COLORS[k];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function normKey(key) {
  return String(key || '').toLowerCase();
}

function sumArr(values = []) {
  return values.reduce((sum, v) => {
    const n = Number(v);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function barHeight(total, peak) {
  if (!(total > 0)) return 0;
  const scale = peak > 0 ? peak * 1.15 : total;
  return Math.max(8, Math.min(100, (total / scale) * 100));
}

/** Cột tổng: chỉ số; > 1 triệu → "1,x triệu". */
function formatTotalBottleDisplay(raw) {
  const n = Number(raw) || 0;
  const full = `${n.toLocaleString('vi-VN')} chai`;
  if (n > 1_000_000) {
    const text = (n / 1_000_000).toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return { text: `${text} triệu`, full };
  }
  return { text: n.toLocaleString('vi-VN'), full };
}

/**
 * Biểu đồ thống kê số chai + cột TỔNG bên phải (giống Mida time/energy).
 */
export default function DtrBottleCountsWithTotal({
  labels = [],
  keys = [],
  series = {},
  title = 'BIỂU ĐỒ THỐNG KÊ SỐ CHAI',
  bottleGlossary = null,
  mode = 'hour',
}) {
  const { theme } = useTheme();
  const glossaryByKey = useMemo(() => {
    const map = {};
    for (const item of resolveBottleGlossary(bottleGlossary)) {
      map[String(item.key).toLowerCase()] = item.meaning || item.label || String(item.key).toUpperCase();
    }
    return map;
  }, [bottleGlossary]);
  const [hiddenKeys, setHiddenKeys] = useState(() => new Set());

  useEffect(() => {
    const allowed = new Set(keys.map(normKey));
    setHiddenKeys((prev) => {
      let changed = false;
      const next = new Set();
      prev.forEach((k) => {
        if (allowed.has(k)) next.add(k);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [keys]);

  const toggleKey = useCallback((key) => {
    const code = normKey(key);
    if (!code) return;
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const visibleKeys = useMemo(
    () => keys.filter((key) => !hiddenKeys.has(normKey(key))),
    [keys, hiddenKeys],
  );

  const totals = useMemo(() => {
    const perKey = visibleKeys.map((key, index) => {
      const total = sumArr(series[key] || []);
      const k = String(key || '').toLowerCase();
      return {
        key,
        total,
        color: colorForKey(key, keys.indexOf(key) >= 0 ? keys.indexOf(key) : index),
        label: glossaryByKey[k] || String(key || '').toUpperCase(),
      };
    });
    const grandTotal = perKey.reduce((s, it) => s + it.total, 0);

    let peakBucket = 0;
    const n = labels.length;
    for (let i = 0; i < n; i += 1) {
      let bucketSum = 0;
      for (const key of visibleKeys) {
        bucketSum += Number(series[key]?.[i]) || 0;
      }
      if (bucketSum > peakBucket) peakBucket = bucketSum;
    }

    return {
      perKey: perKey.filter((it) => it.total > 0),
      grandTotal,
      display: formatTotalBottleDisplay(grandTotal),
      stackH: barHeight(grandTotal, peakBucket),
      hasData: grandTotal > 0,
    };
  }, [keys, visibleKeys, series, labels.length, glossaryByKey]);

  const chartOnly = (
    <DtrBottleCountsHourlyChart
      labels={labels}
      keys={keys}
      series={series}
      mode={mode}
      hideLegend
      hiddenKeys={hiddenKeys}
      onToggleKey={toggleKey}
      bottleGlossary={bottleGlossary}
    />
  );

  return (
    <div className="dtr-bottle-total-wrap">
      <div className="dtr-bottle-total-wrap__titles">
        <div className="chart-title-brand machine-chart-head mida-status-chart-head dtr-bottle-total-head">
          <div className="dtr-bottle-total-head__main">{title}</div>
          <div className="dtr-bottle-total-head__actions">
            <MidaChartExpand title={title} tone="plenma">
              <div className="dtr-bottle-expand-surface">
                <DtrBottleCountsHourlyChart
                  labels={labels}
                  keys={keys}
                  series={series}
                  mode={mode}
                  hiddenKeys={hiddenKeys}
                  onToggleKey={toggleKey}
                  bottleGlossary={bottleGlossary}
                />
              </div>
            </MidaChartExpand>
          </div>
        </div>
      </div>

      <DtrBottleCountsLegend
        keys={keys}
        theme={theme}
        hiddenKeys={hiddenKeys}
        onToggleKey={toggleKey}
        bottleGlossary={bottleGlossary}
      />

      <div className="dtr-bottle-total-wrap__body">
        <div className="dtr-bottle-total-wrap__plot machine-chart-plot">
          <div className="machine-chart-plot-inner">{chartOnly}</div>
        </div>

        <aside className="dtr-bottle-total" aria-label="Tổng số chai theo loại">
          <div className="dtr-bottle-total__head-block">
            <div className="chart-title-brand machine-chart-head dtr-bottle-total__title">
              Tổng (chai)
            </div>
            <div className="dtr-bottle-total__sum" title={totals.display.full}>
              {totals.display.text}
            </div>
          </div>
          <div
            className="dtr-bottle-total__bars"
            role="img"
            aria-label={
              totals.hasData
                ? `Tổng ${totals.display.full}`
                : 'Chưa có dữ liệu tổng'
            }
          >
            <div className="dtr-bottle-total__col">
              <div className="dtr-bottle-total__track">
                {totals.hasData ? (
                  <div
                    className="dtr-bottle-total__stack"
                    style={{ height: `${totals.stackH}%` }}
                    title={totals.perKey
                      .map((it) => `${it.label}: ${it.total.toLocaleString('vi-VN')}`)
                      .join('\n')}
                  >
                    {/* Cùng thứ tự dataset Chart.js: key đầu ở đáy stack */}
                    {totals.perKey.map((it) => {
                      const pct = totals.grandTotal > 0
                        ? (it.total / totals.grandTotal) * 100
                        : 0;
                      return (
                        <div
                          key={it.key}
                          className="dtr-bottle-total__seg"
                          style={{
                            flexGrow: Math.max(pct, 0.01),
                            backgroundColor: it.color,
                          }}
                          title={`${it.label}: ${it.total.toLocaleString('vi-VN')}`}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
