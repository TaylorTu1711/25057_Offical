import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const glossaryItems = useMemo(
    () => resolveBottleGlossary(bottleGlossary),
    [bottleGlossary],
  );
  const [hiddenKeys, setHiddenKeys] = useState(() => new Set());
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [glossaryPos, setGlossaryPos] = useState({ top: 0, left: 0, width: 320, maxHeight: 360 });
  const glossaryBtnRef = useRef(null);
  const glossaryPanelRef = useRef(null);

  const updateGlossaryPosition = useCallback(() => {
    const btn = glossaryBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(340, Math.max(260, window.innerWidth - 24));
    const gap = 8;
    const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
    const spaceAbove = rect.top - gap - 12;
    const preferBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(160, Math.min(380, preferBelow ? spaceBelow : spaceAbove));
    let left = rect.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const top = preferBelow
      ? rect.bottom + gap
      : Math.max(12, rect.top - gap - maxHeight);
    setGlossaryPos({ top, left, width, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!glossaryOpen) return undefined;
    updateGlossaryPosition();
    const onReposition = () => updateGlossaryPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [glossaryOpen, updateGlossaryPosition]);

  useEffect(() => {
    if (!glossaryOpen) return undefined;
    const onPointerDown = (event) => {
      const t = event.target;
      if (glossaryBtnRef.current?.contains(t)) return;
      if (glossaryPanelRef.current?.contains(t)) return;
      setGlossaryOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setGlossaryOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [glossaryOpen]);

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
      return {
        key,
        total,
        color: colorForKey(key, keys.indexOf(key) >= 0 ? keys.indexOf(key) : index),
        label: String(key || '').toUpperCase(),
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
      stackH: barHeight(grandTotal, peakBucket),
      hasData: grandTotal > 0,
    };
  }, [keys, visibleKeys, series, labels.length]);

  const chartOnly = (
    <DtrBottleCountsHourlyChart
      labels={labels}
      keys={keys}
      series={series}
      mode={mode}
      hideLegend
      hiddenKeys={hiddenKeys}
      onToggleKey={toggleKey}
    />
  );

  return (
    <div className="dtr-bottle-total-wrap">
      <div className="dtr-bottle-total-wrap__titles">
        <div className="chart-title-brand machine-chart-head mida-status-chart-head dtr-bottle-total-head">
          <div className="dtr-bottle-total-head__main">{title}</div>
          <div className="dtr-bottle-total-head__actions">
            <div className="dtr-bottle-glossary">
              <button
                ref={glossaryBtnRef}
                type="button"
                className={`dtr-bottle-glossary__btn${glossaryOpen ? ' is-open' : ''}`}
                aria-expanded={glossaryOpen}
                aria-controls="dtr-bottle-glossary-panel"
                title="Giải thích ký hiệu loại chai"
                onClick={() => setGlossaryOpen((open) => !open)}
              >
                <i className="bi bi-info-circle" aria-hidden="true" />
                <span>Ký hiệu</span>
              </button>
              {glossaryOpen
                ? createPortal(
                    <div
                      ref={glossaryPanelRef}
                      id="dtr-bottle-glossary-panel"
                      className="dtr-bottle-glossary__panel"
                      role="dialog"
                      aria-label="Giải thích ký hiệu loại chai"
                      style={{
                        top: glossaryPos.top,
                        left: glossaryPos.left,
                        width: glossaryPos.width,
                        maxHeight: glossaryPos.maxHeight,
                      }}
                    >
                      <div className="dtr-bottle-glossary__panel-head">
                        <span>Giải thích ký hiệu</span>
                        <button
                          type="button"
                          className="dtr-bottle-glossary__close"
                          aria-label="Đóng"
                          onClick={() => setGlossaryOpen(false)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="dtr-bottle-glossary__scroll">
                        <ul className="dtr-bottle-glossary__list">
                          {glossaryItems.map((item) => (
                            <li key={item.key} className="dtr-bottle-glossary__item">
                              <span
                                className="dtr-bottle-glossary__swatch"
                                style={{ backgroundColor: colorForKey(item.key, 0) }}
                                aria-hidden="true"
                              />
                              <code className="dtr-bottle-glossary__code">{item.label}</code>
                              <span className="dtr-bottle-glossary__meaning">{item.meaning}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>,
                    document.body,
                  )
                : null}
            </div>
            <MidaChartExpand title={title} tone="plenma">
              <div className="dtr-bottle-expand-surface">
                <DtrBottleCountsHourlyChart
                  labels={labels}
                  keys={keys}
                  series={series}
                  mode={mode}
                  hiddenKeys={hiddenKeys}
                  onToggleKey={toggleKey}
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
      />

      <div className="dtr-bottle-total-wrap__body">
        <div className="dtr-bottle-total-wrap__plot machine-chart-plot">
          <div className="machine-chart-plot-inner">{chartOnly}</div>
        </div>

        <aside className="dtr-bottle-total" aria-label="Tổng số chai theo loại">
          <div className="dtr-bottle-total__head-block">
            <div className="chart-title-brand machine-chart-head dtr-bottle-total__title">
              TỔNG
            </div>
            <div className="dtr-bottle-total__sum" title="Tổng số chai">
              {totals.grandTotal.toLocaleString('vi-VN')} chai
            </div>
          </div>
          <div
            className="dtr-bottle-total__bars"
            role="img"
            aria-label={
              totals.hasData
                ? `Tổng ${totals.grandTotal.toLocaleString('vi-VN')} chai`
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
