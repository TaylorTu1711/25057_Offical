import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Chart as ChartJS } from 'chart.js';

function getCategoryMaxIndex(chart) {
  return Math.max(0, (chart.data?.labels?.length ?? 0) - 1);
}

function isFullCategoryRange(min, max, maxIndex) {
  if (maxIndex <= 0) return true;
  return Number(min) <= 0 && Number(max) >= maxIndex - 0.01;
}

function readAxisRange(scale, maxIndex) {
  if (!scale) return null;
  if (scale.min == null || scale.max == null) return null;
  const min = Number(scale.min);
  const max = Number(scale.max);
  return { min, max, full: isFullCategoryRange(min, max, maxIndex) };
}

function clampRange(saved, maxIndex) {
  if (!saved || saved.full || isFullCategoryRange(saved.min, saved.max, maxIndex)) {
    return null;
  }
  const min = Math.max(0, Math.min(Number(saved.min), maxIndex));
  const max = Math.max(min, Math.min(Number(saved.max), maxIndex));
  if (isFullCategoryRange(min, max, maxIndex)) return null;
  return { min, max };
}

function rangesEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.min === b.min && a.max === b.max;
}

/**
 * Giữ zoom khi react-chartjs-2 gán lại options/data (Object.assign thay cả scales).
 * Merge `zoomedScaleProps` vào scales trong options của chart.
 */
export default function useChartZoomPreserve(restoreDeps, mode = 'x', { getDefaultRange } = {}) {
  const chartRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const suppressRef = useRef(false);
  const getDefaultRangeRef = useRef(getDefaultRange);
  getDefaultRangeRef.current = getDefaultRange;
  const defaultAppliedRef = useRef(false);

  const [xZoom, setXZoom] = useState(null);
  const xZoomRef = useRef(null);
  xZoomRef.current = xZoom;

  const commitXZoom = useCallback((next) => {
    const cur = xZoomRef.current;
    if (rangesEqual(cur, next)) return;
    xZoomRef.current = next;
    setXZoom(next);
  }, []);

  const markUserZoom = useCallback(({ chart }) => {
    if (suppressRef.current || !chart?.scales) return;
    const axis = modeRef.current === 'y' ? 'y' : 'x';
    const maxIndex = getCategoryMaxIndex(chart);
    const range = readAxisRange(chart.scales[axis], maxIndex);
    if (!range) return;
    commitXZoom(range.full ? null : { min: range.min, max: range.max });
  }, [commitXZoom]);

  useEffect(() => {
    const pluginId = `zoomPreserve_${Math.random().toString(36).slice(2, 10)}`;
    const plugin = {
      id: pluginId,
      beforeUpdate(chart) {
        if (chart !== chartRef.current) return;
        const saved = xZoomRef.current;
        if (!saved) return;

        const axis = modeRef.current === 'y' ? 'y' : 'x';
        if (!chart.options.scales) chart.options.scales = {};
        if (!chart.options.scales[axis]) chart.options.scales[axis] = {};
        chart.options.scales[axis].min = saved.min;
        chart.options.scales[axis].max = saved.max;
        chart.options.animation = false;
      },
      afterUpdate(chart) {
        if (chart !== chartRef.current) return;
        const saved = xZoomRef.current;
        if (!saved || suppressRef.current) return;

        const axis = modeRef.current === 'y' ? 'y' : 'x';
        const maxIndex = getCategoryMaxIndex(chart);
        const current = readAxisRange(chart.scales?.[axis], maxIndex);
        if (current && !current.full) return;

        if (typeof chart.zoomScale !== 'function') return;
        suppressRef.current = true;
        try {
          chart.zoomScale(axis, { min: saved.min, max: saved.max }, 'none');
        } finally {
          Promise.resolve().then(() => {
            suppressRef.current = false;
          });
        }
      },
    };
    ChartJS.register(plugin);
    return () => ChartJS.unregister(plugin);
  }, []);

  // Default range một lần khi chart sẵn sàng
  useEffect(() => {
    if (defaultAppliedRef.current || xZoomRef.current) return undefined;
    if (typeof getDefaultRangeRef.current !== 'function') return undefined;

    let attempts = 0;
    let raf = 0;
    const tryApply = () => {
      const chart = chartRef.current;
      if (!chart) {
        if (attempts++ < 30) raf = requestAnimationFrame(tryApply);
        return;
      }
      if (defaultAppliedRef.current || xZoomRef.current) return;
      const maxIndex = getCategoryMaxIndex(chart);
      const range = getDefaultRangeRef.current(maxIndex);
      defaultAppliedRef.current = true;
      if (range && !range.full) {
        commitXZoom({ min: range.min, max: range.max });
      }
    };
    raf = requestAnimationFrame(tryApply);
    return () => cancelAnimationFrame(raf);
  }, [commitXZoom]);

  const depsKey = useMemo(() => {
    try {
      return JSON.stringify(restoreDeps);
    } catch {
      return String(Date.now());
    }
  }, [restoreDeps]);

  useEffect(() => {
    const saved = xZoomRef.current;
    const chart = chartRef.current;
    if (!saved || !chart || typeof chart.zoomScale !== 'function') return undefined;

    const axis = modeRef.current === 'y' ? 'y' : 'x';
    const maxIndex = getCategoryMaxIndex(chart);
    const clamped = clampRange(saved, maxIndex);
    if (!clamped) {
      commitXZoom(null);
      return undefined;
    }
    if (clamped.min !== saved.min || clamped.max !== saved.max) {
      commitXZoom(clamped);
    }

    const id = requestAnimationFrame(() => {
      const c = chartRef.current;
      const z = xZoomRef.current;
      if (!c || !z) return;
      suppressRef.current = true;
      try {
        c.zoomScale(axis, { min: z.min, max: z.max }, 'none');
      } finally {
        Promise.resolve().then(() => {
          suppressRef.current = false;
        });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [depsKey, commitXZoom]);

  const zoomPluginOptions = useMemo(
    () => ({
      pan: {
        enabled: true,
        mode,
        onPanComplete: markUserZoom,
      },
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        mode,
        onZoomComplete: markUserZoom,
      },
    }),
    [markUserZoom, mode],
  );

  const zoomedScaleProps = useMemo(() => {
    if (!xZoom) return null;
    const axis = mode === 'y' ? 'y' : 'x';
    return { [axis]: { min: xZoom.min, max: xZoom.max } };
  }, [xZoom, mode]);

  return { chartRef, zoomPluginOptions, zoomedScaleProps };
}
